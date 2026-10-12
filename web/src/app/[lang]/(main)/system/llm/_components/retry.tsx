"use client";

import { t as tr } from "@/i18n/t";
// LLM 重试配置的共用件：五层重试各自的「次数 + 间隔」。
//
// 五层从内到外：建连(SDK) → 空响应(SDK) → 同 provider 安全窗口 → 轮询熔断 → 意图重跑。
// 前三层跟着端点走，所以每个模型配置都能覆盖全局默认；后两层是进程级的，只有全局一份。
//
// 所有输入都遵循同一套「留空 = 不配置」语义，与后端 db.RetryRule 一致：
//   次数   空/0 = 用内置默认 | -1 = 关闭这层重试 | >0 = 用这个次数
//   间隔   空/0 = 用这层原本的指数退避 | >0 = 改用这个固定毫秒间隔

import * as React from "react";

import { Loader2Icon, SaveIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import type { LLMRetryOverride, LLMRetryPolicy, LLMRetryRule } from "@/lib/types";

export const ZERO_RULE: LLMRetryRule = { attempts: 0, interval_ms: 0 };
export const ZERO_OVERRIDE: LLMRetryOverride = {
  connect: ZERO_RULE,
  empty: ZERO_RULE,
  stream: ZERO_RULE,
};
const ZERO_POLICY: LLMRetryPolicy = {
  ...ZERO_OVERRIDE,
  breaker: ZERO_RULE,
  intent: ZERO_RULE,
};

type LayerMeta = {
  title: string;
  /** 这层重试发生在哪、由谁执行 */
  where: string;
  /** 什么样的错误会走到这层——具体到状态码，别让人猜 */
  trigger: string;
  /** 长得像但【不】走这层的错误，省得填了没反应还以为是 bug */
  skips?: string;
  desc: string;
  attemptsLabel: string;
  /** 次数留空时的默认值，用于占位符 */
  defAttempts: number;
  /** 间隔留空时的默认策略，用于占位符 */
  defInterval: string;
  /** 次数填 -1 的含义 */
  offHint: string;
};

export const RETRY_LAYERS = {
  connect: {
    title: "Connection retry",
    where: "SDK · before a 200 is received",
    trigger:
      "Unreachable or no 200 yet: network errors such as connection reset, read/write timeout, or DNS failure, plus HTTP 408, 429, 500, 502, 503, and 504.",
    skips: "Any other status code (400 / 401 / 403 / 404 / 413 / 422, and so on) is a deterministic rejection. Retrying fails the same way, so it is raised immediately.",
    desc: "Resend the same request unchanged. Once the stream has started (a 200 is already in), a disconnect midway is outside this layer.",
    attemptsLabel: "Retry count",
    defAttempts: 3,
    defInterval: "0.5s→1s→2s exponential (capped at 8s)",
    offHint: "-1 = do not retry; surface the failure immediately",
  },
  empty: {
    title: "Empty-response retry",
    where: "SDK · openai format only",
    trigger:
      "HTTP 200 and finish_reason is a normal stop, but the response has no content blocks. An empty gateway frame, a dropped thinking field, or a sampling hiccup all look like this.",
    skips: "Responses cut off by max_tokens with no content do not count (raise the output limit for those; sending again only hits the same limit).",
    desc: "Resends the entire prompt, so it is expensive on long contexts. Keep the count low.",
    attemptsLabel: "Retry count",
    defAttempts: 2,
    defInterval: "0.5s→1s→2s exponential (capped at 8s)",
    offHint: "-1 = return an empty response as-is",
  },
  stream: {
    title: "Same-provider safety-window retry",
    where: "This project · before any output is delivered",
    trigger:
      "The failure happens only after the stream is established (a 200 is received): the connection drops midway, the provider is overloaded, or a 429 / 5xx error event arrives inside the stream — and not a single token has been delivered to the caller yet.",
    skips:
      "Do not retry quota exhaustion (402 / insufficient_quota, handed off to rotation to switch configuration), context length exceeded (413 / context length, handed off to compaction), or the deterministic rejections 400 / 401 / 403 / 404 / 422.",
    desc: "Replay the same request on the same configuration. Because no output has been delivered yet, replay does not duplicate model output or tool execution.",
    attemptsLabel: "Retry count",
    defAttempts: 2,
    defInterval: "0.5s→1s exponential (capped at 4s)",
    offHint: "-1 = on a dropped stream, hand off to the outer intent retry",
  },
  breaker: {
    title: "Rotation circuit breaker",
    where: "This project · process-level, one global copy",
    trigger:
      "Transient failures (429, 5xx, network errors) open the circuit breaker once they reach the threshold in a row. Deterministic failures such as insufficient balance (402), invalid credentials (401 / 403), and a missing model (404) ignore the threshold and open the breaker on the first occurrence.",
    skips: "One success resets the count, so a configuration that only fails occasionally will not slowly accumulate into a trip.",
    desc: "After the circuit breaker opens, the configuration enters cooldown. Polling skips it during cooldown. The state is saved and kept across restarts.",
    attemptsLabel: "Consecutive failures before the circuit opens",
    defAttempts: 3,
    defInterval: "1min→5min→30min stepped backoff",
    offHint: "-1 = transient failures never open the circuit (deterministic failures still do)",
  },
  intent: {
    title: "Intent rerun",
    where: "This project · process-level, one global copy",
    trigger:
      "None of the earlier layers caught it: the worker ended with model_error — inner retries were exhausted, or the stream dropped only after it had started delivering output (replay is unsafe then, so the whole request has to start over).",
    skips: "Quota exhaustion is already handled by rotating to another configuration and is not rerun here. If the task is paused, stopped, or enters wrap-up, it yields immediately and does not consume backoff time.",
    desc: "Rerun the entire intent from the start. This is the outermost layer, so one rerun multiplies the attempt counts of the inner layers again.",
    attemptsLabel: "Rerun count",
    defAttempts: 2,
    defInterval: "Fixed 3s",
    offHint: "-1 = do not rerun; mark this intent blocked",
  },
} satisfies Record<string, LayerMeta>;

type LayerKey = keyof typeof RETRY_LAYERS;

/** 毫秒的人话，只用于在输入框旁边回显，免得数零。 */
function humanMs(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return "";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${Number((ms / 1000).toFixed(2))}s`;
  return `${Number((ms / 60_000).toFixed(2))}min`;
}

/** 受控数字输入：空串 ↔ 0，中间态（"-"、"1e"）原样留在本地，不打扰父级。 */
function NumField({
  id,
  value,
  onChange,
  placeholder,
  min,
}: {
  id: string;
  value: number;
  onChange: (n: number) => void;
  placeholder: string;
  min: number;
}) {
  const [text, setText] = React.useState(value === 0 ? "" : String(value));
  // 父级换了一整套值（读取到策略、切换配置）时跟上；自己敲字时不会走到这里，
  // 因为那时 value 已经等于本地文本 parse 后的结果。
  React.useEffect(() => {
    const incoming = value === 0 ? "" : String(value);
    setText((cur) => (Number(cur || 0) === value ? cur : incoming));
  }, [value]);
  return (
    <Input
      id={id}
      type="number"
      min={min}
      className="w-28 shrink-0"
      value={text}
      placeholder={placeholder}
      onChange={(e) => {
        setText(e.target.value);
        const n = Number(e.target.value);
        onChange(e.target.value.trim() === "" || !Number.isFinite(n) ? 0 : Math.trunc(n));
      }}
    />
  );
}

/** 一层重试的两个旋钮。idPrefix 用来在同一页出现多次时保住 label 的 htmlFor。 */
export function RetryRuleFields({
  layer,
  idPrefix,
  value,
  onChange,
  compact,
}: {
  layer: LayerKey;
  idPrefix: string;
  value: LLMRetryRule;
  onChange: (r: LLMRetryRule) => void;
  /** true = 配置抽屉里的紧凑版：省掉展开说明，只留「什么错误会走到这层」这一句 */
  compact?: boolean;
}) {
  const meta = RETRY_LAYERS[layer];
  const human = humanMs(value.interval_ms);
  return (
    <div className={compact ? "grid gap-2" : "grid gap-3 rounded-lg border p-3"}>
      <div className="grid gap-0.5">
        <div className="flex flex-wrap items-baseline gap-2">
          <Label className="text-sm">{meta.title}</Label>
          <span className="text-muted-foreground text-xs">{meta.where}</span>
        </div>
        {/* 哪些错误会走到这层，具体到状态码——填了旋钮却看不到效果，多半是错误压根不落在这层。 */}
        <p className="text-muted-foreground text-xs">
          <span className="font-medium text-foreground">{tr("Trigger")}</span>：{meta.trigger}
        </p>
        {!compact && meta.skips && (
          <p className="text-muted-foreground text-xs">
            <span className="font-medium text-foreground">{tr("Skips this layer")}</span>：{meta.skips}
          </p>
        )}
        {!compact && <p className="text-muted-foreground text-xs">{meta.desc}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          <Label htmlFor={`${idPrefix}-${layer}-n`} className="text-muted-foreground text-xs">
            {meta.attemptsLabel}
          </Label>
          <NumField
            id={`${idPrefix}-${layer}-n`}
            min={-1}
            value={value.attempts}
            placeholder={tr("Default{0}", { "0": meta.defAttempts })}
            onChange={(n) => onChange({ ...value, attempts: n })}
          />
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor={`${idPrefix}-${layer}-ms`} className="text-muted-foreground text-xs">
            
            {tr("Interval ms")}
          </Label>
          <NumField
            id={`${idPrefix}-${layer}-ms`}
            min={0}
            value={value.interval_ms}
            placeholder={tr("Default backoff")}
            onChange={(n) => onChange({ ...value, interval_ms: n })}
          />
          <span className="text-muted-foreground text-xs">{human ? tr("fixed {0}", { "0": human }) : meta.defInterval}</span>
        </div>
      </div>
      {!compact && <p className="text-muted-foreground text-xs">{tr("Empty = default; ")}{meta.offHint}。</p>}
    </div>
  );
}

/** 模型配置抽屉里的三层覆盖（跟着端点走的那三层）。 */
export function ProfileRetryFields({
  value,
  onChange,
}: {
  value: LLMRetryOverride;
  onChange: (o: LLMRetryOverride) => void;
}) {
  return (
    <div className="grid gap-3 rounded-lg border p-3">
      <div className="grid gap-0.5">
        <Label className="text-sm">{tr("Retry override")}</Label>
        <p className="text-muted-foreground text-xs">
          
          {tr("Applies only to this profile and overrides the global defaults under “Retry and backoff”. An empty cell follows the global value; attempts set to -1 turn this retry layer off;\n          a filled interval uses a fixed delay instead of exponential backoff. Circuit breaking and intent replay are process-wide and can only be changed on the global page.")}
        </p>
      </div>
      {(["connect", "empty", "stream"] as const).map((k) => (
        <div key={k} className="border-t pt-3 first:border-t-0 first:pt-0">
          <RetryRuleFields
            compact
            layer={k}
            idPrefix="pf"
            value={value[k]}
            onChange={(r) => onChange({ ...value, [k]: r })}
          />
        </div>
      ))}
    </div>
  );
}

/** 「重试与退避」tab：五层的全局默认值。 */
export function RetryPolicyPanel() {
  const [policy, setPolicy] = React.useState<LLMRetryPolicy>(ZERO_POLICY);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const p = await api.llmRetryPolicy();
      setPolicy({ ...ZERO_POLICY, ...p });
    } catch (e) {
      toast.error(tr("Failed to load retry policy: {0}", { "0": (e as Error).message }));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      // 后端会把越界值夹回区间并回传，直接用回传值刷新，所见即所存。
      const saved = await api.saveLLMRetryPolicy(policy);
      setPolicy({ ...ZERO_POLICY, ...saved });
      toast.success(tr("Saved and applied immediately (the call already running this round still uses the old parameters)"));
    } catch (e) {
      toast.error(tr("Save failed: {0}", { "0": (e as Error).message }));
    } finally {
      setSaving(false);
    }
  }

  const set = (k: LayerKey) => (r: LLMRetryRule) => setPolicy((p) => ({ ...p, [k]: r }));

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed p-10 text-muted-foreground text-sm">
        <Loader2Icon className="size-4 animate-spin" />  {tr("Loading retry policy…")}
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="rounded-lg border bg-muted/30 p-3 text-muted-foreground text-xs leading-relaxed">
        
        {tr("A failed model call goes through five retry layers, inner to outer:")}
        <span className="text-foreground">  {tr("Connect → empty response → same-provider safety window → rotation circuit breaker → intent rerun")}</span>
        
        {tr(". An outer layer runs only after the inner one is exhausted, so the counts are ")}
        <span className="text-foreground">{tr("multiplied")}</span>
        
        {tr(" — maxing out every layer can burn dozens of requests on a single blip.\n        Leave every field empty to keep the current defaults, the same behavior as without this page. The first three layers can be overridden on each model profile.")}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {(Object.keys(RETRY_LAYERS) as LayerKey[]).map((k) => (
          <RetryRuleFields key={k} layer={k} idPrefix="gl" value={policy[k]} onChange={set(k)} />
        ))}
      </div>

      <div className="flex gap-2">
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2Icon className="animate-spin" /> : <SaveIcon />}
          
          {tr("Save")}
        </Button>
        <Button variant="outline" onClick={() => setPolicy(ZERO_POLICY)} disabled={saving}>
          
          {tr("Reset all to defaults")}
        </Button>
      </div>
    </div>
  );
}
