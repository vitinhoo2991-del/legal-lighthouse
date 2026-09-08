import { createFileRoute } from "@tanstack/react-router";
import { MessagesSquare, UserRound } from "lucide-react";

import { PageHeader, SearchInput } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/_app/atendimento")({
  component: AtendimentoPage,
});

const clientFields = [
  "Nome",
  "Telefone",
  "E-mail",
  "Origem",
  "Área jurídica",
  "Lead score",
  "Status",
  "Tags",
  "Último contato",
  "Responsável",
];

function AtendimentoPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Central de Atendimento"
        badge="Estrutural"
        description="Conversas, chat e perfil do cliente em uma única tela."
      />

      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)_300px]">
        <section className="surface-panel flex min-h-[420px] flex-col p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold">Conversas</h2>
            <Badge variant="outline">0</Badge>
          </div>
          <div className="mt-3">
            <SearchInput placeholder="Buscar contato" className="sm:max-w-none" />
          </div>
          <div className="mt-4 flex flex-1 items-center justify-center rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Suas conversas aparecerão aqui quando o atendimento estiver conectado.
          </div>
        </section>

        <section className="surface-panel flex min-h-[420px] flex-col p-4">
          <EmptyState
            className="flex-1 border-none bg-transparent"
            icon={<MessagesSquare className="h-5 w-5" />}
            title="Nenhuma conversa selecionada"
            description="Ao conectar o WhatsApp e os canais de captação, o atendimento em tempo real acontecerá nesta área."
          />
        </section>

        <section className="surface-panel min-h-[420px] p-4">
          <div className="flex items-center gap-2">
            <UserRound className="h-4 w-4 text-primary" />
            <h2 className="font-display text-sm font-semibold">Perfil do cliente</h2>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Informações do contato em atendimento aparecerão aqui.
          </p>
          <ul className="mt-4 space-y-2">
            {clientFields.map((f) => (
              <li
                key={f}
                className="flex items-center justify-between rounded-lg border border-border/70 bg-background/40 px-3 py-2 text-xs"
              >
                <span className="text-muted-foreground">{f}</span>
                <span className="text-muted-foreground/60">—</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[11px] text-muted-foreground">
            <div className="rounded-lg border border-dashed border-border py-3">Documentos</div>
            <div className="rounded-lg border border-dashed border-border py-3">Agenda</div>
            <div className="rounded-lg border border-dashed border-border py-3">Histórico</div>
          </div>
        </section>
      </div>
    </div>
  );
}
