import { createFileRoute } from "@tanstack/react-router";
import { Gavel } from "lucide-react";

import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/states";

export const Route = createFileRoute("/_authenticated/_app/copiloto")({
  component: CopilotoPage,
});

function CopilotoPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Copiloto jurídico"
        badge="Em preparação"
        description="Apoio ao advogado durante o atendimento e a análise de casos."
      />
      <EmptyState
        icon={<Gavel className="h-5 w-5" />}
        title="Copiloto ainda não ativado."
        description="Nenhum modelo de inteligência artificial está conectado nesta etapa da plataforma."
      />
    </div>
  );
}
