import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/components/common/PageHeader";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/_app/crm")({
  component: CrmPage,
});

const STAGES = [
  "Novo lead",
  "Em triagem",
  "Qualificado",
  "Em contato",
  "Agendado",
  "Proposta",
  "Contratado",
];

function CrmPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="CRM jurídico"
        badge="Estrutural"
        description="Seu pipeline está vazio. Quando novos leads forem captados, eles aparecerão aqui."
      />

      <div className="-mx-4 overflow-x-auto px-4 pb-2">
        <div className="flex min-w-max gap-4">
          {STAGES.map((stage) => (
            <div key={stage} className="w-[260px] shrink-0">
              <div className="surface-panel flex h-full min-h-[380px] flex-col p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{stage}</span>
                  <Badge variant="outline" className="text-[11px]">
                    0
                  </Badge>
                </div>
                <div className="mt-3 flex flex-1 items-center justify-center rounded-lg border border-dashed border-border px-3 text-center text-xs text-muted-foreground">
                  Nenhum lead nesta etapa.
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
