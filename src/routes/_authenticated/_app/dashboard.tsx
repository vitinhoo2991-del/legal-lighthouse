import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Flame,
  Gauge,
  MessagesSquare,
  Snowflake,
  Sparkles,
  Thermometer,
  Users,
} from "lucide-react";

import { PageHeader } from "@/components/common/PageHeader";
import { StatCard, PlaceholderPanel } from "@/components/common/StatCard";
import { EmptyState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useProfile } from "@/lib/auth";
import { getLeadStats } from "@/lib/leads.functions";

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
  const fetchStats = useServerFn(getLeadStats);
  const statsQuery = useQuery({ queryKey: ["lead-stats"], queryFn: () => fetchStats({}) });
  const stats = statsQuery.data;
  const hasLeads = (stats?.total ?? 0) > 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title={`${greeting()}, ${firstName}.`}
        description="Veja o que está acontecendo no seu escritório."
      />

      {stats?.ultimoQuente ? (
        <div className="flex flex-col gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <Badge variant="outline" className="gap-1.5 border-rose-500/30 text-rose-300">
              <Flame className="h-3.5 w-3.5" /> Lead quente
            </Badge>
            <p className="mt-2 text-sm">
              <span className="font-medium">{stats.ultimoQuente.name ?? "Novo contato"}</span> —
              score {stats.ultimoQuente.score}.
            </p>
            {stats.ultimoQuente.reason ? (
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {stats.ultimoQuente.reason}
              </p>
            ) : null}
          </div>
          <Button asChild variant="outline" className="shrink-0">
            <Link to="/leads">Ver lead</Link>
          </Button>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total de leads" value={stats?.total ?? 0} hint="Captados pelo atendimento" icon={Users} />
        <StatCard label="Novos" value={stats?.novos ?? 0} hint="Ainda não qualificados" icon={Sparkles} />
        <StatCard label="Em qualificação" value={stats?.emQualificacao ?? 0} hint="A IA está coletando informações" icon={Thermometer} />
        <StatCard label="Score médio" value={stats?.scoreMedio ?? 0} hint="De 0 a 100" icon={Gauge} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Leads quentes" value={stats?.quentes ?? 0} hint="Score 70 a 100" icon={Flame} />
        <StatCard label="Leads mornos" value={stats?.mornos ?? 0} hint="Score 40 a 69" icon={Thermometer} />
        <StatCard label="Leads frios" value={stats?.frios ?? 0} hint="Score 0 a 39" icon={Snowflake} />
      </div>

      {hasLeads ? null : (
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
  
      )}

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
