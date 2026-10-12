"use client";

import { t as tr } from "@/i18n/t";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import type { ParsedCompanyScopeText } from "@/lib/company-scope";
import type { CompanyScopeKind } from "@/lib/types";

const SCOPE_KIND_LABELS: Record<CompanyScopeKind, string> = {
  domain: "Domain",
  ip: "IP",
  cidr: "CIDR",
  icp: "ICP",
  keyword: "Keyword",
};

export function ScopeTextEditor({
  id,
  value,
  onValueChange,
  parsed,
  label = tr("Asset scope"),
  description = tr("One entry per line. Domains, IP addresses, CIDR ranges, ICP filings, and company keywords are recognized automatically."),
}: {
  id: string;
  value: string;
  onValueChange: (value: string) => void;
  parsed: ParsedCompanyScopeText;
  label?: string;
  description?: string;
}) {
  const counts = React.useMemo(() => {
    const result = new Map<CompanyScopeKind, number>();
    for (const rule of parsed.rules) result.set(rule.kind, (result.get(rule.kind) ?? 0) + 1);
    return result;
  }, [parsed.rules]);

  return (
    <Field data-invalid={parsed.errors.length > 0}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <FieldDescription>{description}</FieldDescription>
      <Textarea
        id={id}
        rows={8}
        value={value}
        aria-invalid={parsed.errors.length > 0}
        placeholder={tr("example.com\n203.0.113.10\n198.51.100.0/24\nICP-12345678-1\nCompany name keyword")}
        className="min-h-36 resize-y font-mono text-sm"
        onChange={(event) => onValueChange(event.target.value)}
      />
      {parsed.rules.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-muted-foreground text-xs">
          <span>{tr("Recognized")} {parsed.rules.length}  {tr("items")}</span>
          {Object.entries(SCOPE_KIND_LABELS).map(([kind, kindLabel]) => {
            const count = counts.get(kind as CompanyScopeKind) ?? 0;
            return count > 0 ? (
              <Badge key={kind} variant="secondary" className="font-mono tabular-nums">
                {kindLabel} {count}
              </Badge>
            ) : null;
          })}
        </div>
      )}
      {parsed.errors.length > 0 && (
        <FieldError>
          {parsed.errors.slice(0, 5).map((item) => (
            <span key={`${item.line}-${item.error}`} className="block">
              
              {tr("Page")} {item.line}  {tr(": ")}{item.error}
            </span>
          ))}
          {parsed.errors.length > 5 && <span className="block">{tr("And")} {parsed.errors.length - 5}  {tr("more lines have errors")}</span>}
        </FieldError>
      )}
    </Field>
  );
}
