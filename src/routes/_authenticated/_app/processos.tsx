import { createFileRoute } from "@tanstack/react-router";
import { Scale } from "lucide-react";

import { PageHeader, SearchInput } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/states";
import { PlaceholderPanel } from "@/components/common/StatCard";

export const Route = createFileRoute("/_authenticated/_app/processos")({
  component: ProcessosPage,
});

function ProcessosPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Processos"
        badge="Estrutural"
        description="Acompanhamento processual, movimentações e prazos."
        actions={<SearchInput placeholder="Buscar número do processo" />}
      />

      <EmptyState
        icon={<Scale className="h-5 w-5" />}
        title="Nenhum processo cadastrado."
        description="O monitoramento processual será ativado em uma próxima etapa e listará movimentações e prazos automaticamente."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <PlaceholderPanel
          title="Movimentações"
          description="Em breve: linha do tempo de andamentos por processo."
          height="h-40"
        />
        <PlaceholderPanel
          title="Prazos e alertas"
          description="Em breve: prazos críticos com alertas para o responsável."
          height="h-40"
        />
      </div>
    </div>
  );
}
