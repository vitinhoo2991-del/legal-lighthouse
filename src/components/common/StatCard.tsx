import type { LucideIcon } from "lucide-react";
import { BarChart3 } from "lucide-react";
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
  emptyTitle = "Sem dados suficientes",
  emptyDescription = "Assim que seu escritório começar a registrar atendimentos, leads e atividades, seus indicadores aparecerão aqui.",
}: {
  title: string;
  description: string;
  height?: string;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  return (
    <Card className="border-border bg-surface/60 shadow-none">
      <CardContent className="p-5">
        <p className="font-display text-sm font-semibold">{title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        <div
          className={`mt-4 ${height} flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-background/40 px-5 py-6 text-center`}
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <BarChart3 className="h-4 w-4" />
          </span>
          <p className="text-sm font-medium text-foreground/90">{emptyTitle}</p>
          <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
            {emptyDescription}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
