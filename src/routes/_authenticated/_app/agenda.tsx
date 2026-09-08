import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays } from "lucide-react";

import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/_app/agenda")({
  component: AgendaPage,
});

const WEEK = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function AgendaPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Agenda"
        badge="Estrutural"
        description="Consultas e compromissos do escritório."
        actions={<Button variant="outline">Conectar calendário</Button>}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="border-border bg-surface/70 shadow-none">
          <CardContent className="p-4">
            <div className="grid grid-cols-7 gap-2 text-center text-xs text-muted-foreground">
              {WEEK.map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-7 gap-2">
              {Array.from({ length: 35 }).map((_, i) => (
                <div
                  key={i}
                  className="h-16 rounded-lg border border-border/60 bg-background/40 sm:h-20"
                />
              ))}
            </div>
          </CardContent>
        </Card>

        <EmptyState
          icon={<CalendarDays className="h-5 w-5" />}
          title="Nenhum compromisso"
          description="Sua agenda aparecerá aqui quando você conectar seu calendário."
        />
      </div>
    </div>
  );
}
