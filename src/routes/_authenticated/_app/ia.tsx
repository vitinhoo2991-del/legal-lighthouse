import { createFileRoute, Link } from "@tanstack/react-router";
import { Bot, BookOpen, FileSearch, Gavel, Mic, Sparkles, Zap } from "lucide-react";

import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/_app/ia")({
  component: IaPage,
});

const MODULES = [
  { icon: Sparkles, title: "Atendimento IA", text: "Primeira resposta e triagem automática dos contatos." },
  { icon: Bot, title: "Agentes IA", text: "Agentes configuráveis por área jurídica e canal." },
  { icon: BookOpen, title: "Base de conhecimento", text: "Conteúdo do escritório usado como fonte das respostas." },
  { icon: Mic, title: "Voz", text: "Atendimento por voz e transcrição de ligações." },
  { icon: FileSearch, title: "Análise de documentos", text: "Leitura e resumo de documentos recebidos." },
  { icon: Zap, title: "Automações", text: "Follow-ups e ações automáticas por etapa do funil." },
  { icon: Gavel, title: "Copiloto jurídico", text: "Apoio ao advogado durante o atendimento." },
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
          <Card key={m.title} className="border-border bg-surface/70 shadow-none">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <m.icon className="h-5 w-5" />
                </span>
                <Badge variant="outline" className="text-[11px] text-muted-foreground">
                  Em breve
                </Badge>
              </div>
              <h2 className="mt-4 font-display text-base font-semibold">{m.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{m.text}</p>
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
