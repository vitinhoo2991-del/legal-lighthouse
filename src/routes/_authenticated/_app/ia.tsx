import { createFileRoute, Link } from "@tanstack/react-router";
import { Bot, BookOpen, FileSearch, Gavel, Lock, Mic, Sparkles, Zap } from "lucide-react";

import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/_app/ia")({
  component: IaPage,
});

const MODULES = [
  { icon: Sparkles, title: "Atendimento IA", text: "Primeira resposta e triagem automática dos contatos.", status: "Em desenvolvimento" },
  { icon: Bot, title: "Agentes IA", text: "Agentes configuráveis por área jurídica e canal.", status: "Em desenvolvimento" },
  { icon: BookOpen, title: "Base de conhecimento", text: "Conteúdo do escritório usado como fonte das respostas.", status: "Em desenvolvimento" },
  { icon: Mic, title: "Voz", text: "Atendimento por voz e transcrição de ligações.", status: "Disponível em breve" },
  { icon: FileSearch, title: "Análise de documentos", text: "Leitura e resumo de documentos recebidos.", status: "Disponível em breve" },
  { icon: Zap, title: "Automações", text: "Follow-ups e ações automáticas por etapa do funil.", status: "Disponível em breve" },
  { icon: Gavel, title: "Copiloto jurídico", text: "Apoio ao advogado durante o atendimento.", status: "Disponível em breve" },
];

function IaPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Central de Inteligência"
        badge="Estrutural"
        description="Os recursos de inteligência artificial do JurisIA, prontos para serem ativados."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {MODULES.map((m) => (
          <Card
            key={m.title}
            className="relative overflow-hidden border-border bg-surface/70 shadow-none transition-colors hover:border-primary/30"
          >
            <CardContent className="flex h-full flex-col p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <m.icon className="h-5 w-5" />
                </span>
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-background/50 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                  <Lock className="h-3 w-3" />
                  {m.status}
                </span>
              </div>
              <h2 className="mt-5 font-display text-base font-semibold">{m.title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{m.text}</p>
              <p className="mt-5 border-t border-border/70 pt-3 text-[11px] text-muted-foreground/80">
                Recurso poderá fazer parte de planos específicos.
              </p>
            </CardContent>
          </Card>
        ))}
      </div>


      <p className="text-sm text-muted-foreground">
        Configure agentes em{" "}
        <Link to="/agentes-ia" className="text-primary hover:underline">
          Agentes IA
        </Link>{" "}
        e o conteúdo do escritório em{" "}
        <Link to="/base-conhecimento" className="text-primary hover:underline">
          Base de conhecimento
        </Link>
        .
      </p>
    </div>
  );
}
