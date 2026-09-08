import { createFileRoute } from "@tanstack/react-router";
import { Wallet } from "lucide-react";

import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/states";
import { PlaceholderPanel } from "@/components/common/StatCard";

export const Route = createFileRoute("/_authenticated/_app/financeiro")({
  component: FinanceiroPage,
});

function FinanceiroPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Financeiro"
        badge="Estrutural"
        description="Receitas, despesas e honorários do escritório."
      />

      <EmptyState
        icon={<Wallet className="h-5 w-5" />}
        title="Seu financeiro será exibido aqui."
        description="Quando os lançamentos financeiros forem ativados, receita, despesas e inadimplência aparecerão nesta área."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <PlaceholderPanel title="Receita" description="Em breve." height="h-32" />
        <PlaceholderPanel title="Despesas" description="Em breve." height="h-32" />
        <PlaceholderPanel title="Honorários" description="Em breve." height="h-32" />
        <PlaceholderPanel title="Consultas" description="Em breve." height="h-32" />
        <PlaceholderPanel title="Inadimplência" description="Em breve." height="h-32" />
      </div>
    </div>
  );
}
