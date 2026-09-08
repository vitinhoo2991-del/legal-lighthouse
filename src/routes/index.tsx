import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Bot, MessagesSquare, ShieldCheck, Sparkles } from "lucide-react";

import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "JurisIA — A inteligência que transforma o atendimento jurídico" },
      {
        name: "description",
        content:
          "Plataforma de atendimento, CRM e inteligência artificial para escritórios de advocacia.",
      },
      { property: "og:title", content: "JurisIA — Plataforma jurídica inteligente" },
      {
        property: "og:description",
        content:
          "Centralize atendimento, leads e gestão do seu escritório em uma única plataforma.",
      },
    ],
  }),
  component: Landing,
});

const pillars = [
  {
    icon: MessagesSquare,
    title: "Central de Atendimento",
    text: "Conversas, WhatsApp e multiatendimento em um só lugar.",
  },
  {
    icon: Sparkles,
    title: "Central de Gestão",
    text: "Leads, clientes, CRM, agenda, documentos e processos.",
  },
  {
    icon: Bot,
    title: "Central de Inteligência",
    text: "Agentes de IA, base de conhecimento e copiloto jurídico.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen glow-aura">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6">
        <Logo />
        <div className="flex items-center gap-2">
          <Button variant="ghost" asChild>
            <Link to="/login">Entrar</Link>
          </Button>
          <Button asChild>
            <Link to="/register">Criar escritório</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-24 pt-10 md:pt-20">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary-soft px-3 py-1 text-xs text-primary">
          <ShieldCheck className="h-3.5 w-3.5" /> Multi-escritório, seguro e isolado por tenant
        </span>
        <h1 className="mt-6 max-w-3xl font-display text-4xl font-semibold leading-tight tracking-tight md:text-6xl">
          A inteligência que transforma o atendimento jurídico.
        </h1>
        <p className="mt-5 max-w-2xl text-base text-muted-foreground md:text-lg">
          O JurisIA organiza quem entrou em contato, o que o cliente precisa e qual o próximo passo
          — com atendimento, gestão e inteligência em uma plataforma única.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button size="lg" asChild>
            <Link to="/register">
              Criar meu escritório <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link to="/login">Já tenho conta</Link>
          </Button>
        </div>

        <div className="mt-16 grid gap-4 md:grid-cols-3">
          {pillars.map((p) => (
            <Card key={p.title} className="border-border bg-surface/70 shadow-none">
              <CardContent className="p-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <p.icon className="h-5 w-5" />
                </span>
                <h2 className="mt-4 font-display text-lg font-semibold">{p.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{p.text}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
