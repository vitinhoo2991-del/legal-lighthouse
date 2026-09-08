import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
}) {
  return (
    <Card className="border-border bg-surface/80 shadow-none transition-colors hover:border-primary/30">
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 font-display text-3xl font-semibold tabular-nums">{value}</p>
          {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <Icon className="h-5 w-5" />
        </span>
      </CardContent>
    </Card>
  );
}

export function PlaceholderPanel({
  title,
  description,
  height = "h-56",
}: {
  title: string;
  description: string;
  height?: string;
}) {
  return (
    <Card className="border-border bg-surface/60 shadow-none">
      <CardContent className="p-5">
        <p className="font-display text-sm font-semibold">{title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        <div
          className={`mt-4 ${height} rounded-lg border border-dashed border-border bg-background/40`}
        />
      </CardContent>
    </Card>
  );
}
