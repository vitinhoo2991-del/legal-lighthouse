import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarCheck, MessagesSquare, Sparkles, UserRound, Users } from "lucide-react";

import { PageHeader } from "@/components/common/PageHeader";
import { StatCard, PlaceholderPanel } from "@/components/common/StatCard";
import { EmptyState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/_app/dashboard")({
  component: DashboardPage,
});

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function DashboardPage() {
  const { data: profile } = useProfile();
  const firstName = profile?.name?.split(" ")[0] ?? "";

  return (
    <div className="space-y-8">
      <PageHeader
        title={`${greeting()}, ${firstName}.`}
        description="Veja o que está acontecendo no seu escritório."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Novos leads" value={0} hint="Últimos 30 dias" icon={Users} />
        <StatCard label="Leads qualificados" value={0} hint="Últimos 30 dias" icon={Sparkles} />
        <StatCard label="Consultas" value={0} hint="Agendadas" icon={CalendarCheck} />
        <StatCard label="Clientes" value={0} hint="Ativos" icon={UserRound} />
      </div>

      <EmptyState
        icon={<MessagesSquare className="h-5 w-5" />}
        title="Seu escritório ainda não recebeu contatos"
        description="Conecte seu WhatsApp ou comece a cadastrar seus primeiros leads para acompanhar seus atendimentos por aqui."
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild className="w-full sm:w-auto">
              <Link to="/whatsapp">Conectar WhatsApp</Link>
            </Button>
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link to="/leads">Cadastrar leads</Link>
            </Button>
          </div>
        }
      />


      <div className="grid gap-4 lg:grid-cols-2">
        <PlaceholderPanel
          title="Leads e conversão"
          description="Em breve: volume de leads recebidos e taxa de conversão por período."
        />
        <PlaceholderPanel
          title="Origem dos leads"
          description="Em breve: captação por WhatsApp, site, redes sociais e indicações."
        />
        <PlaceholderPanel
          title="Desempenho da IA e do atendimento humano"
          description="Em breve: atendimentos resolvidos pela IA, transferências e tempo de resposta."
        />
        <PlaceholderPanel
          title="Consultas, contratos e receita"
          description="Em breve: agendamentos realizados, contratos fechados e receita do período."
        />
      </div>
    </div>
  );
}
