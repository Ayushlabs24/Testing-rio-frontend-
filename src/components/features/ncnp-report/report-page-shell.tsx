import type { ReactNode } from "react";

interface ReportPageShellProps {
  reportName: string;
  condensedScope: string;
  pageOfLabel: string;
  disclaimer: string;
  children: ReactNode;
  /** Page 1 only — replaces the default runhead with the full masthead. */
  masthead?: ReactNode;
}

// One "page" of the paginated report preview — a bordered, shadowed sheet
// with its own runhead (report name + condensed scope + page badge) and
// footer (disclaimer + page number), repeated on every page so a single
// page printed or shared on its own still carries its own context — per
// the client's "per-page scope context" finding. Every string is passed in
// already-translated (same convention as NamedBarList's emptyText) so this
// stays a pure presentational component.
export function ReportPageShell({
  reportName,
  condensedScope,
  pageOfLabel,
  disclaimer,
  children,
  masthead,
}: ReportPageShellProps) {
  return (
    <div className="border-border/60 bg-card mb-8 overflow-hidden rounded-2xl border shadow-sm">
      <div className="p-8 sm:p-10">
        {masthead ?? (
          <div className="border-border/60 text-muted-foreground mb-6 flex items-center justify-between gap-4 border-b pb-3 text-xs">
            <span className="tracking-wide uppercase">
              {reportName} — {condensedScope}
            </span>
            <span className="border-border/60 bg-muted/40 shrink-0 rounded-full border px-2.5 py-0.5 font-mono whitespace-nowrap">
              {pageOfLabel}
            </span>
          </div>
        )}
        {children}
      </div>
      <div className="border-border/60 text-muted-foreground flex items-center justify-between gap-4 border-t px-8 py-3 text-xs sm:px-10">
        <span>{disclaimer}</span>
        <span className="shrink-0">{pageOfLabel}</span>
      </div>
    </div>
  );
}
