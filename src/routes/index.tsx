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
    label: "1",
    title: "Central de Atendimento",
    text: "Conversas, WhatsApp e atendimento em um só lugar.",
  },
  {
    icon: Sparkles,
    label: "2",
    title: "Central de Gestão",
    text: "Leads, clientes, CRM, agenda, documentos e processos.",
  },
  {
    icon: Bot,
    label: "3",
    title: "Central de Inteligência",
    text: "Agentes de IA, base de conhecimento, análise e copiloto jurídico.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen glow-aura">
      <header className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 py-6">
        <Logo />
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="ghost" asChild>
            <Link to="/login">Entrar</Link>
          </Button>
          <Button asChild className="hidden sm:inline-flex">
            <Link to="/register">Criar escritório</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-20 pt-8 md:pt-20">
        <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-primary/25 bg-primary-soft px-3 py-1 text-xs text-primary">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">Multi-escritório, seguro e isolado por tenant</span>
        </span>
        <h1 className="mt-6 max-w-3xl text-balance font-display text-3xl font-semibold leading-[1.15] tracking-tight sm:text-4xl md:text-6xl">
          Seu escritório mais organizado. Seu atendimento mais inteligente.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
          O JurisIA centraliza atendimento, WhatsApp, leads, clientes, gestão e inteligência
          artificial em uma única plataforma para escritórios de advocacia.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Button size="lg" asChild className="w-full sm:w-auto">
            <Link to="/register">
              Criar meu escritório <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild className="w-full sm:w-auto">
            <Link to="/login">Já tenho conta</Link>
          </Button>
        </div>

        <div className="mt-16 md:mt-20">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            As três centrais do JurisIA
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {pillars.map((p) => (
              <Card key={p.title} className="border-border bg-surface/70 shadow-none">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                      <p.icon className="h-5 w-5" />
                    </span>
                    <span className="font-display text-2xl font-semibold text-muted-foreground/25">
                      {p.label}
                    </span>
                  </div>
                  <h2 className="mt-4 font-display text-lg font-semibold">{p.title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.text}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
