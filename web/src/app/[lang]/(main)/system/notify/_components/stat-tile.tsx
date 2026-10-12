import { t as tr } from "@/i18n/t";
import { Card, CardContent } from "@/components/ui/card";

export function StatTile({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <Card size="sm" className="gap-1">
      <CardContent>
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className={`text-lg font-semibold ${tone === "red" ? "text-rose-600" : ""}`}>{value}</p>
        {hint && <p className={`text-xs ${tone === "red" ? "text-rose-600" : "text-muted-foreground"}`}>{hint}</p>}
      </CardContent>
    </Card>
  );
}

// formatBacklog 把积压毫秒数渲染成人看得懂的量级。
export function formatBacklog(ms: number): string {
  if (!ms) return "—";
  if (ms < 60_000) return tr("{0}seconds", { "0": Math.round(ms / 1000) });
  if (ms < 3_600_000) return tr("{0} minutes", { "0": Math.round(ms / 60_000) });
  return tr("{0} hours", { "0": (ms / 3_600_000).toFixed(1) });
}
