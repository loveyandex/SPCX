"use client";

import { t as tr } from "@/i18n/t";
import * as React from "react";

import { CpuIcon, FlaskConicalIcon, KeyboardIcon, RadioTowerIcon, SearchIcon, ShieldAlertIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";
import { CHAT_SEND_MODE_OPTIONS, type ChatSendMode, setChatSendMode, useChatSendMode } from "@/lib/chat-send-mode";
import type { Settings } from "@/lib/types";

import { UpdateCard } from "./_components/update-card";

export default function SystemSettingsPage() {
  const [trafficCapture, setTrafficCapture] = React.useState(false);
  const [agentTrafficBinding, setAgentTrafficBinding] = React.useState(false);
  const [webSearch, setWebSearch] = React.useState(false);
  const [backend, setBackend] = React.useState("ddgs");
  const [braveKeySet, setBraveKeySet] = React.useState(false);
  const [braveKeyInput, setBraveKeyInput] = React.useState("");
  const [tavilyKeySet, setTavilyKeySet] = React.useState(false);
  const [tavilyKeyInput, setTavilyKeyInput] = React.useState("");
  const [savingTavilyKey, setSavingTavilyKey] = React.useState(false);
  const [proxyInput, setProxyInput] = React.useState("");
  const [savingProxy, setSavingProxy] = React.useState(false);
  const [globalProxyInput, setGlobalProxyInput] = React.useState("");
  const [savingGlobalProxy, setSavingGlobalProxy] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [savingKey, setSavingKey] = React.useState(false);
  const [pyInterp, setPyInterp] = React.useState("");
  const [workers, setWorkers] = React.useState("3");
  const [savingWorkers, setSavingWorkers] = React.useState(false);
  // 操作约束注入范围(默认都开)。
  const [injectPlanner, setInjectPlanner] = React.useState(true);
  const [injectWorker, setInjectWorker] = React.useState(true);
  // 实验功能:noa 上下文压缩(默认关)。
  const [noaCompaction, setNoaCompaction] = React.useState(false);
  // 纯前端偏好：不走 /api/settings，直接读写 localStorage。
  const sendMode = useChatSendMode();

  const apply = React.useCallback((s: Settings) => {
    setTrafficCapture(!!s.traffic_capture);
    setAgentTrafficBinding(!!s.agent_traffic_binding);
    setWebSearch(!!s.web_search_enabled);
    setBackend(s.web_search_backend || "ddgs");
    setBraveKeySet(!!s.brave_key_set);
    setTavilyKeySet(!!s.tavily_key_set);
    setProxyInput(s.web_search_proxy ?? "");
    setGlobalProxyInput(s.global_proxy ?? "");
    setPyInterp(s.python_interpreter ?? "");
    setWorkers(String(s.workers ?? 3));
    setInjectPlanner(s.constraints_inject_planner !== false);
    setInjectWorker(s.constraints_inject_worker !== false);
    setNoaCompaction(!!s.noa_compaction);
  }, []);

  const saveWorkers = () => {
    const n = Number(workers);
    if (!Number.isInteger(n) || n <= 0) {
      toast.error(tr("Concurrency must be an integer greater than 0"));
      return;
    }
    setSavingWorkers(true);
    api
      .setSettings({ workers: n })
      .then((s) => {
        apply(s);
        toast.success(tr("Concurrent worker agent count saved (applies to tasks started later)"));
      })
      .catch((e) => toast.error(tr("Save failed: ") + (e as Error).message))
      .finally(() => setSavingWorkers(false));
  };

  const savePython = () => {
    setSaving(true);
    api
      .setSettings({ python_interpreter: pyInterp.trim() })
      .then((s) => {
        apply(s);
        toast.success(tr("Python interpreter configuration saved"));
      })
      .catch((e) => toast.error(tr("Save failed: ") + (e as Error).message))
      .finally(() => setSaving(false));
  };
  const detectPython = () => {
    setSaving(true);
    api
      .detectPython()
      .then((r) => setPyInterp(r.python_interpreter))
      .catch(() => undefined)
      .finally(() => setSaving(false));
  };

  React.useEffect(() => {
    api
      .settings()
      .then(apply)
      .catch(() => undefined)
      .finally(() => setLoaded(true));
  }, [apply]);

  const toggleTraffic = (v: boolean) => {
    setTrafficCapture(v); // optimistic
    setSaving(true);
    api
      .setSettings({ traffic_capture: v })
      .then(apply)
      .catch(() => setTrafficCapture(!v)) // revert on failure
      .finally(() => setSaving(false));
  };

  const toggleInjectPlanner = (v: boolean) => {
    setInjectPlanner(v); // optimistic
    api
      .setSettings({ constraints_inject_planner: v })
      .then(apply)
      .catch(() => setInjectPlanner(!v)); // revert on failure
  };

  const toggleAgentTrafficBinding = (v: boolean) => {
    setAgentTrafficBinding(v);
    setSaving(true);
    api
      .setSettings({ agent_traffic_binding: v })
      .then((s) => {
        apply(s);
        toast.success(v ? tr("Agent automatic traffic binding turned on") : tr("Agent automatic traffic binding turned off"));
      })
      .catch((e) => {
        setAgentTrafficBinding(!v);
        toast.error(tr("Save failed: {0}", { "0": (e as Error).message }));
      })
      .finally(() => setSaving(false));
  };

  const toggleInjectWorker = (v: boolean) => {
    setInjectWorker(v); // optimistic
    api
      .setSettings({ constraints_inject_worker: v })
      .then(apply)
      .catch(() => setInjectWorker(!v)); // revert on failure
  };

  const toggleNoaCompaction = (v: boolean) => {
    setNoaCompaction(v); // optimistic
    api
      .setSettings({ noa_compaction: v })
      .then((s) => {
        apply(s);
        toast.success(v ? tr("noa context compression turned on (applies to runs started later)") : tr("noa context compression turned off (built-in compression restored)"));
      })
      .catch((e) => {
        setNoaCompaction(!v); // revert on failure
        toast.error(tr("Save failed: {0}", { "0": (e as Error).message }));
      });
  };

  // Persist a web-search patch (enable and/or backend). Optimistic with refetch.
  const saveWebSearch = (patch: Partial<Settings>) => {
    setSaving(true);
    api
      .setSettings(patch)
      .then((s) => {
        apply(s);
        toast.success(tr("Web search configuration saved"));
      })
      .catch((e) => {
        toast.error(tr("Save failed: ") + (e as Error).message);
        api
          .settings()
          .then(apply)
          .catch(() => undefined);
      })
      .finally(() => setSaving(false));
  };

  const saveBraveKey = () => {
    setSavingKey(true);
    api
      .setSettings({ brave_search_api_key: braveKeyInput })
      .then((s) => {
        apply(s);
        setBraveKeyInput("");
        toast.success(tr("Brave API Key saved"));
      })
      .catch((e) => toast.error(tr("Save failed: ") + (e as Error).message))
      .finally(() => setSavingKey(false));
  };

  const saveTavilyKey = () => {
    setSavingTavilyKey(true);
    api
      .setSettings({ tavily_search_api_key: tavilyKeyInput })
      .then((s) => {
        apply(s);
        setTavilyKeyInput("");
        toast.success(tr("Tavily API Key saved"));
      })
      .catch((e) => toast.error(tr("Save failed: ") + (e as Error).message))
      .finally(() => setSavingTavilyKey(false));
  };

  const saveProxy = () => {
    setSavingProxy(true);
    api
      .setSettings({ web_search_proxy: proxyInput.trim() })
      .then((s) => {
        apply(s);
        toast.success(proxyInput.trim() ? tr("Egress proxy saved") : tr("Egress proxy cleared (switching to a direct connection)"));
      })
      .catch((e) => toast.error(tr("Save failed: ") + (e as Error).message))
      .finally(() => setSavingProxy(false));
  };

  const saveGlobalProxy = () => {
    setSavingGlobalProxy(true);
    api
      .setSettings({ global_proxy: globalProxyInput.trim() })
      .then((s) => {
        apply(s);
        toast.success(globalProxyInput.trim() ? tr("Global proxy saved") : tr("Global proxy cleared (switching to a direct connection)"));
      })
      .catch((e) => toast.error(tr("Save failed: ") + (e as Error).message))
      .finally(() => setSavingGlobalProxy(false));
  };

  // Run a real "test" search ("test") against the CURRENT form values (backend +
  // proxy + entered key), falling back to saved values server-side. Toasts result.
  const runTest = () => {
    setTesting(true);
    api
      .testWebSearch({
        web_search_backend: backend,
        web_search_proxy: proxyInput.trim(),
        brave_search_api_key: braveKeyInput,
        tavily_search_api_key: tavilyKeyInput,
      })
      .then((r) => {
        if (r.ok) toast.success(tr("Search test succeeded · {0}Back{1} results", { "0": r.backend, "1": r.count }));
        else toast.error(tr("Search test failed: ") + (r.error || tr("Unknown error")));
      })
      .catch((e) => toast.error(tr("Search test failed: ") + (e as Error).message))
      .finally(() => setTesting(false));
  };

  // brave-free selected but no key stored and none being entered → tool stays off.
  const braveNeedsKey = webSearch && backend === "brave-free" && !braveKeySet;

  return (
    <div className="flex flex-1 flex-col gap-4 md:gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{tr("System settings")}</h1>
        <p className="text-muted-foreground text-sm">{tr("Global runtime switches")}</p>
      </div>

      {/* 多列而非 grid：网络搜索卡片比其余高数倍，且高度随所选后端变化（brave/tavily
          的 key 输入是条件渲染）。grid 会按最高的一张撑满整行、在旁边留下大片空白，
          多列则自动按内容高度平衡填充。卡片间距靠 mb 而非 gap——多列布局下
          column-gap 只管列间距，行间距要由子元素自己给。 */}
      <div className="columns-1 gap-4 md:gap-6 lg:columns-2">
        <UpdateCard />

        <Card className="mb-4 break-inside-avoid md:mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <RadioTowerIcon className="size-4" />
              
              {tr("Traffic capture")}
            </CardTitle>
            <CardDescription>
              
              {tr("When enabled, all Agent HTTP traffic is stored in full through the recording proxy, and the traffic_search / traffic_get tools plus proxy settings are injected into the Agent (the prompt includes proxy instructions).")}
              <br />
              
              {tr("When off (the default), no traffic is recorded: the Agent")}
              <b>{tr("will not")}</b>{tr("get the proxy configuration and traffic tools, and the prompt also")}<b>{tr("does not include")}</b>{tr("proxy-related content. After you switch, Agents are rebuilt immediately and the change takes effect.")}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <Label htmlFor="traffic-capture" className="text-sm font-normal text-muted-foreground">
              {trafficCapture ? tr("On · recording traffic and injecting the proxy") : tr("Off · not recording and not injecting a proxy")}
            </Label>
            <Switch
              id="traffic-capture"
              checked={trafficCapture}
              disabled={!loaded || saving}
              onCheckedChange={toggleTraffic}
            />
          </CardContent>
        </Card>

        <Card className="mb-4 break-inside-avoid md:mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <RadioTowerIcon className="size-4" />
              
              {tr("Automatic traffic binding for Agents")}
            </CardTitle>
            <CardDescription id="agent-traffic-binding-description">
              
              {tr("Off by default. When enabled, the report Agent that runs when a vulnerability is stored checks existing HTTP requests and responses, links the matching traffic, and then writes the report.")}
              <b>{tr("Reviewing packets and extra tool calls increases Token usage.")}</b>
              <br />
              
              {tr("Reporting still works for TCP, traffic that was not captured, or when nothing matches. This switch does not affect traffic capture, manual binding, or viewing saved evidence. It applies to the next Agent run; turning it off immediately rejects new automatic bindings.")}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <Label htmlFor="agent-traffic-binding" className="text-sm font-normal text-muted-foreground">
              {agentTrafficBinding ? tr("On · increases Token usage") : tr("Off · manual binding is still available")}
            </Label>
            <Switch
              id="agent-traffic-binding"
              aria-describedby="agent-traffic-binding-description"
              checked={agentTrafficBinding}
              disabled={!loaded || saving}
              onCheckedChange={toggleAgentTrafficBinding}
            />
          </CardContent>
        </Card>

        <Card className="mb-4 break-inside-avoid md:mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <RadioTowerIcon className="size-4" />
              
              {tr("Global proxy")}
            </CardTitle>
            <CardDescription>
              
              {tr("All Agents'")}<b>{tr("Target traffic")}</b>{tr("Outbound traffic goes through this proxy (hide the source IP / use a jump host). Supports")} <b>http / https / socks5</b>{tr(", with optional")}{" "}
              <code>user:pass</code>  {tr("authentication. Leave blank for a direct connection.")}
              <br />
              
              {tr("On")}<b>{tr("Traffic capture")}</b>{tr("when, it acts as the recording proxy's")}<b>{tr("Upstream")}</b>{tr("(traffic is still stored in full, then sent out through this proxy). When capture is off, it is injected directly into the Agent's bash / WebFetch egress. It is independent of the web-search proxy and the LLM proxy.")}
              <br />
              <b>{tr("Hint")}</b>{tr(": socks5 when")}<b>{tr("Stop capture")}</b>{tr("it depends on each command-line tool's support for")} <code>ALL_PROXY</code>  {tr("support (curl works; some tools may ignore it). If you mainly use socks5, turn on traffic capture — the MITM dials this path itself, so tools stay unaware of it and it applies reliably.")}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Label htmlFor="global-proxy" className="text-sm font-normal text-muted-foreground">
              
              {tr("Proxy address")}
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="global-proxy"
                autoComplete="off"
                placeholder={tr("socks5://user:pass@host:1080 or http://host:port (empty = direct connection)")}
                value={globalProxyInput}
                disabled={!loaded || savingGlobalProxy}
                onChange={(e) => setGlobalProxyInput(e.target.value)}
              />
              <Button type="button" onClick={saveGlobalProxy} disabled={!loaded || savingGlobalProxy}>
                
                {tr("Save")}
              </Button>
            </div>
            <p className="text-muted-foreground text-xs">
              {globalProxyInput.trim() ? tr("Configured · all target traffic egresses through this proxy") : tr("Not configured · target traffic goes out directly")}
            </p>
          </CardContent>
        </Card>

        <Card className="mb-4 break-inside-avoid md:mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldAlertIcon className="size-4" />
              
              {tr("Operation-constraint injection")}
            </CardTitle>
            <CardDescription>
              
              {tr("When enabled, each task's")}<b>{tr("Operation constraints")}</b>{tr("(the allow/deny entries kept under \"Operation constraints\" in the task overview) are appended to that Agent's system prompt to bound exploration (for example, \"test only the current port\" or \"no brute force\").")}
              <br />
              
              {tr("You can choose separately whether to inject them into")} <b>{tr("Planner (planner)")}</b>{tr("and")} <b>{tr("Executor (worker)")}</b>
              
              {tr("; both are on by default. A change applies immediately (read on the next round) and does not require rebuilding the Agent. After you turn it off, that Agent no longer sees the constraints.")}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="inject-planner" className="text-sm font-normal text-muted-foreground">
                
                {tr("Inject into the planner")}{injectPlanner ? tr(" · On") : tr(" · Off")}
              </Label>
              <Switch
                id="inject-planner"
                checked={injectPlanner}
                disabled={!loaded}
                onCheckedChange={toggleInjectPlanner}
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="inject-worker" className="text-sm font-normal text-muted-foreground">
                
                {tr("Inject into the worker")}{injectWorker ? tr(" · On") : tr(" · Off")}
              </Label>
              <Switch
                id="inject-worker"
                checked={injectWorker}
                disabled={!loaded}
                onCheckedChange={toggleInjectWorker}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="mb-4 break-inside-avoid md:mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FlaskConicalIcon className="size-4" />
              
              {tr("Experimental features")}
            </CardTitle>
            <CardDescription>
              
              {tr("Mechanisms still being validated, off by default. They may change Agent behavior or affect stability. Enable them only after you understand the impact.")}
              <br />
              <b>{tr("noa context compaction")}</b>{tr(": the model actively compresses long conversation history (norma v0.4.0). When enabled, the four Agent types connected on the platform (")}
              <b>{tr("Planner / Executor / Main Agent / Conversation")}</b>{tr(") use noa to manage context instead of built-in compression. The original text is archived under the task working directory so you can look back at it. The switch applies immediately to runs started afterward, without rebuilding the Agent. Turning it off restores built-in compression at once.")}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <Label htmlFor="noa-compaction" className="text-sm font-normal text-muted-foreground">
              
              {tr("noa context compaction")}{noaCompaction ? tr(" · On") : tr(" · Off")}
            </Label>
            <Switch
              id="noa-compaction"
              checked={noaCompaction}
              disabled={!loaded}
              onCheckedChange={toggleNoaCompaction}
            />
          </CardContent>
        </Card>

        <Card className="mb-4 break-inside-avoid md:mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <SearchIcon className="size-4" />
              
              {tr("Web search")}
            </CardTitle>
            <CardDescription>
              
              {tr("This is the web search")}<b>{tr("Master switch + source configuration")}</b>{tr(". Once enabled, you can then, in")}<b>{tr("Configuration for each Agent")}</b>{tr(", where you choose separately whether to enable")}
              <b>web_search</b>{tr("(returns only titles, links, and snippets; WebFetch fetches the page). Web search")}<b>{tr("does not go through")}</b>
              
              {tr("the recording proxy, and it is independent of traffic capture.")}
              <br />
              
              {tr("Sources include")} <b>DuckDuckGo（ddgs）</b>{tr("(no Key required),")}<b>{tr("Brave (free tier)")}</b>{tr(" (a Brave API Key is required),")}{" "}
              <b>Tavily</b>{tr("(Tavily API Key required) or")} <b>DeepSeek</b>{tr("(reuses the current LLM configuration). When the master switch is off, web search cannot be turned on for any Agent.")}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="web-search" className="text-sm font-normal text-muted-foreground">
                {webSearch ? tr("Master switch is on · each Agent can enable it in its own configuration") : tr("Off · Agents cannot enable web search")}
              </Label>
              <Switch
                id="web-search"
                checked={webSearch}
                disabled={!loaded || saving}
                onCheckedChange={(v) => {
                  setWebSearch(v); // optimistic
                  saveWebSearch({ web_search_enabled: v });
                }}
              />
            </div>

            {webSearch && (
              <div className="flex items-center justify-between gap-4">
                <Label className="text-sm font-normal text-muted-foreground">{tr("Search source")}</Label>
                <Select
                  value={backend}
                  disabled={!loaded || saving}
                  onValueChange={(v) => {
                    setBackend(v); // optimistic
                    saveWebSearch({ web_search_backend: v });
                  }}
                >
                  <SelectTrigger className="w-48 shrink-0">
                    <SelectValue placeholder={tr("Select a source")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ddgs">{tr("DuckDuckGo (ddgs · free, no key)")}</SelectItem>
                    <SelectItem value="brave-free">{tr("Brave (free tier · key required)")}</SelectItem>
                    <SelectItem value="tavily">{tr("Tavily (key required)")}</SelectItem>
                    <SelectItem value="deepseek">{tr("DeepSeek (official)")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {webSearch && backend === "deepseek" && (
              <div className="border-border/60 bg-muted/30 flex flex-col gap-2 rounded-md border p-3">
                <p className="text-sm font-medium">{tr("DeepSeek official web search")}</p>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  
                  {tr("This source directly reuses")}<b>{tr("Active LLM configuration")}</b>{tr(". Therefore it")}
                  <b>{tr("Only official DeepSeek models are supported")}</b>{tr(", and this configuration")}<b>{tr("Must use the anthropic protocol")}</b>
                  
                  {tr("—DeepSeek's OpenAI-protocol endpoint does not support server-side search. This source may stop working after you switch the LLM configuration.")}
                </p>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  
                  {tr("Unlike other sources, search is performed by")} <b>{tr("DeepSeek server-side execution")}</b>{tr(": each search spends an extra model call (which costs Tokens), and the search request")}<b>{tr("Do not go through the egress proxy above")}</b>{tr(", and also")}<b>{tr("Not recorded in the traffic trace")}</b>{tr("; results")}<b>{tr("Title and link only")}</b>
                  
                  {tr("(no snippet). When the page body is needed, WebFetch fetches it.")}
                </p>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  
                  {tr("You confirm these conditions yourself; the system does not block you. Use the \"Test search\" button below to run one real search and check.")}
                </p>
              </div>
            )}

            {webSearch && backend === "brave-free" && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="brave-key" className="text-sm font-normal text-muted-foreground">
                  Brave Search API Key
                  {braveKeySet && <span className="ml-2 text-xs text-emerald-500">{tr("Configured")}</span>}
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="brave-key"
                    type="password"
                    autoComplete="off"
                    placeholder={braveKeySet ? tr("Configured (leave blank to keep unchanged)") : tr("Enter Brave API Key")}
                    value={braveKeyInput}
                    disabled={!loaded || savingKey}
                    onChange={(e) => setBraveKeyInput(e.target.value)}
                  />
                  <Button
                    type="button"
                    onClick={saveBraveKey}
                    disabled={!loaded || savingKey || braveKeyInput.trim() === ""}
                  >
                    
                    {tr("Save")}
                  </Button>
                </div>
                {braveNeedsKey && (
                  <p className="text-xs text-amber-500">
                    
                    {tr("Brave is selected, but no Key is saved yet — the search tool stays off until you save a Key.")}
                  </p>
                )}
                <p className="text-muted-foreground text-xs">
                  
                  {tr("The free plan is about 2,000 queries per month. Get a Key at https://brave.com/search/api/.")}
                </p>
              </div>
            )}

            {webSearch && backend === "tavily" && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="tavily-key" className="text-sm font-normal text-muted-foreground">
                  Tavily Search API Key
                  {tavilyKeySet && <span className="ml-2 text-xs text-emerald-500">{tr("Configured")}</span>}
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="tavily-key"
                    type="password"
                    autoComplete="off"
                    placeholder={tavilyKeySet ? tr("Configured (leave blank to keep unchanged)") : tr("Enter Tavily API Key (tvly-…)")}
                    value={tavilyKeyInput}
                    disabled={!loaded || savingTavilyKey}
                    onChange={(e) => setTavilyKeyInput(e.target.value)}
                  />
                  <Button
                    type="button"
                    onClick={saveTavilyKey}
                    disabled={!loaded || savingTavilyKey || tavilyKeyInput.trim() === ""}
                  >
                    
                    {tr("Save")}
                  </Button>
                </div>
                {webSearch && backend === "tavily" && !tavilyKeySet && (
                  <p className="text-xs text-amber-500">
                    
                    {tr("Tavily is selected, but no Key is saved yet — the search tool stays off until you save a Key.")}
                  </p>
                )}
                <p className="text-muted-foreground text-xs">{tr("Go to https://tavily.com to sign up and get an API Key.")}</p>
              </div>
            )}

            {webSearch && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="ws-proxy" className="text-sm font-normal text-muted-foreground">
                  
                  {tr("Egress proxy (optional)")}
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="ws-proxy"
                    autoComplete="off"
                    placeholder={tr("http://host:port or socks5://host:port (empty = direct connection)")}
                    value={proxyInput}
                    disabled={!loaded || savingProxy}
                    onChange={(e) => setProxyInput(e.target.value)}
                  />
                  <Button type="button" onClick={saveProxy} disabled={!loaded || savingProxy}>
                    
                    {tr("Save")}
                  </Button>
                </div>
                <p className="text-muted-foreground text-xs">
                  
                  {tr("A separate egress proxy, used only to reach search endpoints (VPN/SOCKS and similar). It is separate from the MITM proxy that records traffic. Use it when the network cannot connect directly.")}
                </p>
              </div>
            )}

            {webSearch && (
              <div className="flex items-center justify-between gap-4 border-t pt-4">
                <p className="text-muted-foreground text-xs">
                  
                  {tr("Run one real search for \"test\" with the current settings (source + proxy + Key) to see if it works.")}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={runTest}
                  disabled={!loaded || testing}
                  className="shrink-0"
                >
                  {testing ? tr("Testing…") : tr("Test search")}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mb-4 break-inside-avoid md:mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <RadioTowerIcon className="size-4" />
              
              {tr("Custom scripts · Python interpreter")}
            </CardTitle>
            <CardDescription>
              
              {tr("Custom")} <b>script</b>  {tr("type tools use this to run Python. It is detected automatically at startup (python3 first). You can enter the absolute path of a venv or a specific version here. Leave it blank to detect it at runtime.")}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Input
                className="font-mono text-sm"
                placeholder={tr("/usr/bin/python3 (leave empty to auto-detect)")}
                value={pyInterp}
                disabled={!loaded || saving}
                onChange={(e) => setPyInterp(e.target.value)}
              />
              <Button variant="outline" onClick={detectPython} disabled={!loaded || saving}>
                
                {tr("Detect again")}
              </Button>
              <Button onClick={savePython} disabled={!loaded || saving}>
                
                {tr("Save")}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-4 break-inside-avoid md:mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CpuIcon className="size-4" />
              
              {tr("Work concurrency · Work Agent count")}
            </CardTitle>
            <CardDescription>
              
              {tr("How many work Agents run at once per task (default 3). Higher numbers probe more in parallel and cost more. After you change it")}
              <b>{tr("Applies to tasks started later")}</b>{tr(", tasks that are already running are not affected.")}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                className="w-32 font-mono text-sm"
                placeholder="3"
                value={workers}
                disabled={!loaded || savingWorkers}
                onChange={(e) => setWorkers(e.target.value)}
              />
              <Button onClick={saveWorkers} disabled={!loaded || savingWorkers}>
                
                {tr("Save")}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-4 break-inside-avoid md:mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyboardIcon className="size-4" />
              
              {tr("Chat input send key")}
            </CardTitle>
            <CardDescription>
              
              {tr("The main Agent composer on the conversation page and on task details shares this setting. It applies as soon as you choose it, with no need to save.")}
              <br />
              
              {tr("This preference")}<b>{tr("Stored only in this browser")}</b>{tr(", is not synced with the account, and must be set again after you switch browsers or clear site data.")}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <Label htmlFor="chat-send-mode" className="text-sm font-normal text-muted-foreground">
              
              {tr("Send method")}
            </Label>
            <Select value={sendMode} onValueChange={(v) => setChatSendMode(v as ChatSendMode)}>
              <SelectTrigger id="chat-send-mode" className="w-72">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHAT_SEND_MODE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
