import { createFileRoute } from "@tanstack/react-router";
import { Bot } from "lucide-react";

import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/states";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/_app/agentes-ia")({
  component: AgentesIaPage,
});

function AgentesIaPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Agentes IA"
        badge="Em preparação"
        description="Agentes que atendem, qualificam e encaminham contatos para a equipe."
      />
      <EmptyState
        icon={<Bot className="h-5 w-5" />}
        title="Nenhum agente criado."
        description="Na próxima etapa você poderá criar agentes por área jurídica, canal e horário de atendimento."
        action={<Button disabled>Criar agente</Button>}
      />
    </div>
  );
}
