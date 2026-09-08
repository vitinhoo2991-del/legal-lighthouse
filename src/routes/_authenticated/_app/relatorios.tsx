import { createFileRoute } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";

import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/states";
import { PlaceholderPanel } from "@/components/common/StatCard";

export const Route = createFileRoute("/_authenticated/_app/relatorios")({
  component: RelatoriosPage,
});

const REPORTS = [
  "Leads",
  "Conversão",
  "Origem",
  "Atendimento",
  "Agendamentos",
  "Clientes",
  "Financeiro",
  "Performance da IA",
];

function RelatoriosPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Relatórios"
        badge="Estrutural"
        description="Indicadores de captação, atendimento e resultado."
      />

      <EmptyState
        icon={<BarChart3 className="h-5 w-5" />}
        title="Ainda não há dados para relatar."
        description="Os relatórios são gerados automaticamente conforme o escritório recebe leads e atendimentos."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {REPORTS.map((r) => (
          <PlaceholderPanel key={r} title={r} description="Em breve." height="h-24" />
        ))}
      </div>
    </div>
  );
}
