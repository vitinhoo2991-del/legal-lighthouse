import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bot, Loader2, Plus, RefreshCw, Send, ShieldCheck, UserCheck } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { useProfile } from "@/lib/auth";
import {
  createConversation,
  getAiSettings,
  getMessages,
  listConversations,
  saveAiSettings,
  sendMessage,
  setConversationStatus,
  type AiMessage,
  type AiSettings,
  type ConversationStatus,
} from "@/lib/ai-attendance.functions";

export const Route = createFileRoute("/_authenticated/_app/atendimento-ia")({
  component: AtendimentoIaPage,
});

const TONES = ["profissional", "cordial", "objetivo", "empático"];
const DAYS = [
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
  { value: 0, label: "Dom" },
];

const STATUS_LABEL: Record<ConversationStatus, string> = {
  ai: "Respondida pela IA",
  waiting_human: "Aguardando humano",
  human: "Atendimento humano",
  closed: "Encerrada",
};

const ERROR_MESSAGE: Record<string, string> = {
  AI_NOT_CONFIGURED: "A IA ainda não está configurada neste ambiente.",
  AI_NO_CREDITS: "Os créditos de IA do espaço acabaram. Recarregue para continuar.",
  AI_RATE_LIMITED: "Muitas solicitações agora. Tente novamente em instantes.",
  AI_BLOCKED: "O uso de IA está bloqueado para este espaço.",
  AI_ERROR: "Não foi possível obter a resposta da IA agora. Tente novamente.",
  human: "Esta conversa está em atendimento humano — a IA não respondeu.",
};

function AtendimentoIaPage() {
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();

  const fetchSettings = useServerFn(getAiSettings);
  const persistSettings = useServerFn(saveAiSettings);
  const fetchConversations = useServerFn(listConversations);
  const startConversation = useServerFn(createConversation);
  const fetchMessages = useServerFn(getMessages);
  const postMessage = useServerFn(sendMessage);
  const changeStatus = useServerFn(setConversationStatus);

  const settingsQuery = useQuery({
    queryKey: ["ai-settings"],
    queryFn: () => fetchSettings(),
  });

  const [form, setForm] = useState<AiSettings | null>(null);
  useEffect(() => {
    if (settingsQuery.data?.settings) setForm(settingsQuery.data.settings);
  }, [settingsQuery.data]);

  const canEdit = settingsQuery.data?.canEdit ?? false;
  const providerConfigured = settingsQuery.data?.providerConfigured ?? false;

  const saveMutation = useMutation({
    mutationFn: async (values: AiSettings) =>
      persistSettings({
        data: {
          enabled: values.enabled,
          agent_name: values.agent_name,
          greeting: values.greeting,
          tones: values.tones,
          objective: values.objective,
          behavior: values.behavior,
          rules: values.rules,
          hours_mode: values.hours_mode,
          hours_start: values.hours_start.slice(0, 5),
          hours_end: values.hours_end.slice(0, 5),
          hours_days: values.hours_days,
          after_hours_message: values.after_hours_message,
          handoff_message: values.handoff_message,
        },
      }),
    onSuccess: () => {
      toast.success("Configurações da IA salvas.");
      queryClient.invalidateQueries({ queryKey: ["ai-settings"] });
    },
    onError: () => toast.error("Não foi possível salvar as configurações."),
  });

  // ---- Test chat ----
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const conversationsQuery = useQuery({
    queryKey: ["ai-conversations"],
    queryFn: () => fetchConversations(),
  });

  useEffect(() => {
    if (!conversationId && conversationsQuery.data?.length) {
      setConversationId(conversationsQuery.data[0]!.id);
    }
  }, [conversationsQuery.data, conversationId]);

  const current = conversationsQuery.data?.find((c) => c.id === conversationId) ?? null;

  const messagesQuery = useQuery({
    queryKey: ["ai-messages", conversationId],
    enabled: Boolean(conversationId),
    queryFn: () => fetchMessages({ data: { conversationId: conversationId! } }),
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messagesQuery.data]);

  const newConversation = useMutation({
    mutationFn: () => startConversation(),
    onSuccess: (conv) => {
      setConversationId(conv.id);
      queryClient.invalidateQueries({ queryKey: ["ai-conversations"] });
    },
    onError: () => toast.error("Não foi possível iniciar a conversa."),
  });

  const send = useMutation({
    mutationFn: async (content: string) => {
      let id = conversationId;
      if (!id) {
        const conv = await startConversation();
        id = conv.id;
        setConversationId(id);
      }
      return postMessage({ data: { conversationId: id, content } });
    },
    onSuccess: (result) => {
      if (result.aiSkipped) toast.message(ERROR_MESSAGE[result.aiSkipped] ?? ERROR_MESSAGE["AI_ERROR"]!);
      queryClient.invalidateQueries({ queryKey: ["ai-messages", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["ai-conversations"] });
    },
    onError: () => toast.error("Não foi possível enviar a mensagem."),
  });

  const statusMutation = useMutation({
    mutationFn: (status: ConversationStatus) =>
      changeStatus({ data: { conversationId: conversationId!, status } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ai-conversations"] }),
    onError: () => toast.error("Não foi possível alterar o atendimento."),
  });

  function update<K extends keyof AiSettings>(key: K, value: AiSettings[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  const messages = (messagesQuery.data ?? []) as AiMessage[];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Atendimento IA"
        badge={form?.enabled ? "IA ativa" : "IA inativa"}
        description={`Configuração e teste da inteligência de atendimento do escritório ${profile?.office?.name ?? ""}.`.trim()}
        actions={
          form ? (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-surface/60 px-3 py-2">
              <Switch
                checked={form.enabled}
                disabled={!canEdit}
                onCheckedChange={(v) => {
                  update("enabled", v);
                  if (form) saveMutation.mutate({ ...form, enabled: v });
                }}
              />
              <span className="text-sm text-muted-foreground">
                {form.enabled ? "Ativa" : "Inativa"}
              </span>
            </div>
          ) : null
        }
      />

      {!providerConfigured ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-4 text-sm">
            A IA ainda não está configurada neste ambiente. As configurações podem ser salvas, mas as
            respostas só funcionarão após a configuração da chave de acesso ao modelo.
          </CardContent>
        </Card>
      ) : null}

      <Tabs defaultValue="config" className="space-y-5">
        <TabsList>
          <TabsTrigger value="config">Configuração</TabsTrigger>
          <TabsTrigger value="test">Testar IA</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-5">
          {!form ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando configuração...
            </div>
          ) : (
            <>
              <div className="grid gap-4 lg:grid-cols-2">
                <section className="surface-panel space-y-4 p-5">
                  <h2 className="font-display text-sm font-semibold">Persona</h2>
                  <div className="space-y-2">
                    <Label htmlFor="agent_name">Nome da IA</Label>
                    <Input
                      id="agent_name"
                      value={form.agent_name}
                      disabled={!canEdit}
                      onChange={(e) => update("agent_name", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="greeting">Saudação inicial</Label>
                    <Textarea
                      id="greeting"
                      rows={2}
                      value={form.greeting}
                      disabled={!canEdit}
                      onChange={(e) => update("greeting", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tom de atendimento</Label>
                    <div className="flex flex-wrap gap-2">
                      {TONES.map((tone) => {
                        const active = form.tones.includes(tone);
                        return (
                          <button
                            key={tone}
                            type="button"
                            disabled={!canEdit}
                            onClick={() =>
                              update(
                                "tones",
                                active
                                  ? form.tones.filter((t) => t !== tone)
                                  : [...form.tones, tone],
                              )
                            }
                            className={`rounded-full border px-3 py-1.5 text-xs capitalize transition-colors ${
                              active
                                ? "border-primary/40 bg-primary-soft text-primary"
                                : "border-border text-muted-foreground hover:border-primary/30"
                            }`}
                          >
                            {tone}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="objective">Objetivo do atendimento</Label>
                    <Textarea
                      id="objective"
                      rows={3}
                      value={form.objective}
                      disabled={!canEdit}
                      onChange={(e) => update("objective", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="behavior">Como a IA deve se comportar?</Label>
                    <Textarea
                      id="behavior"
                      rows={5}
                      placeholder="Você é a assistente virtual do escritório. Seu objetivo é acolher o potencial cliente, entender sua necessidade, coletar informações iniciais e encaminhar o atendimento quando necessário."
                      value={form.behavior}
                      disabled={!canEdit}
                      onChange={(e) => update("behavior", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rules">Regras básicas de atendimento</Label>
                    <Textarea
                      id="rules"
                      rows={4}
                      placeholder="Ex.: não informar valores de honorários, sempre confirmar o melhor telefone de contato."
                      value={form.rules}
                      disabled={!canEdit}
                      onChange={(e) => update("rules", e.target.value)}
                    />
                  </div>
                </section>

                <div className="space-y-4">
                  <section className="surface-panel space-y-4 p-5">
                    <h2 className="font-display text-sm font-semibold">Horário de atendimento</h2>
                    <div className="flex flex-wrap gap-2">
                      {(["always", "business_hours"] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          disabled={!canEdit}
                          onClick={() => update("hours_mode", mode)}
                          className={`rounded-lg border px-3 py-2 text-xs transition-colors ${
                            form.hours_mode === mode
                              ? "border-primary/40 bg-primary-soft text-primary"
                              : "border-border text-muted-foreground hover:border-primary/30"
                          }`}
                        >
                          {mode === "always" ? "Atendimento 24/7" : "Horário comercial"}
                        </button>
                      ))}
                    </div>

                    {form.hours_mode === "business_hours" ? (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label htmlFor="hours_start">Início</Label>
                            <Input
                              id="hours_start"
                              type="time"
                              value={form.hours_start.slice(0, 5)}
                              disabled={!canEdit}
                              onChange={(e) => update("hours_start", e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="hours_end">Fim</Label>
                            <Input
                              id="hours_end"
                              type="time"
                              value={form.hours_end.slice(0, 5)}
                              disabled={!canEdit}
                              onChange={(e) => update("hours_end", e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Dias de atendimento</Label>
                          <div className="flex flex-wrap gap-2">
                            {DAYS.map((d) => {
                              const active = form.hours_days.includes(d.value);
                              return (
                                <button
                                  key={d.value}
                                  type="button"
                                  disabled={!canEdit}
                                  onClick={() =>
                                    update(
                                      "hours_days",
                                      active
                                        ? form.hours_days.filter((v) => v !== d.value)
                                        : [...form.hours_days, d.value],
                                    )
                                  }
                                  className={`h-9 w-12 rounded-lg border text-xs transition-colors ${
                                    active
                                      ? "border-primary/40 bg-primary-soft text-primary"
                                      : "border-border text-muted-foreground hover:border-primary/30"
                                  }`}
                                >
                                  {d.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </>
                    ) : null}

                    <div className="space-y-2">
                      <Label htmlFor="after_hours_message">Comportamento fora do horário</Label>
                      <Textarea
                        id="after_hours_message"
                        rows={3}
                        value={form.after_hours_message}
                        disabled={!canEdit}
                        onChange={(e) => update("after_hours_message", e.target.value)}
                      />
                    </div>
                  </section>

                  <section className="surface-panel space-y-4 p-5">
                    <h2 className="font-display text-sm font-semibold">Transferência para humano</h2>
                    <div className="space-y-2">
                      <Label htmlFor="handoff_message">Mensagem de transferência</Label>
                      <Textarea
                        id="handoff_message"
                        rows={3}
                        value={form.handoff_message}
                        disabled={!canEdit}
                        onChange={(e) => update("handoff_message", e.target.value)}
                      />
                    </div>
                    <p className="flex items-start gap-2 rounded-lg border border-border/70 bg-background/40 p-3 text-xs text-muted-foreground">
                      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      A IA nunca se apresenta como advogada, não inventa leis ou jurisprudência e não
                      promete resultados. Casos que exigem análise individualizada são encaminhados ao
                      atendimento humano.
                    </p>
                  </section>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                {!canEdit ? (
                  <p className="text-xs text-muted-foreground">
                    Apenas proprietário e administradores podem alterar a IA.
                  </p>
                ) : (
                  <Button
                    className="w-full sm:w-auto"
                    disabled={saveMutation.isPending}
                    onClick={() => form && saveMutation.mutate(form)}
                  >
                    {saveMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Salvar configurações
                  </Button>
                )}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="test">
          <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
            <section className="surface-panel flex max-h-[560px] flex-col p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-sm font-semibold">Conversas</h2>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => newConversation.mutate()}
                  disabled={newConversation.isPending}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" /> Nova
                </Button>
              </div>
              <div className="mt-3 flex-1 space-y-2 overflow-y-auto">
                {(conversationsQuery.data ?? []).length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                    Nenhuma conversa ainda. Inicie uma nova para testar a IA.
                  </p>
                ) : (
                  conversationsQuery.data!.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setConversationId(c.id)}
                      className={`w-full rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                        c.id === conversationId
                          ? "border-primary/40 bg-primary-soft/60"
                          : "border-border hover:border-primary/30"
                      }`}
                    >
                      <span className="line-clamp-1 font-medium">{c.title}</span>
                      <span className="mt-1 block text-[11px] text-muted-foreground">
                        {STATUS_LABEL[c.status]}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </section>

            <section className="surface-panel flex min-h-[560px] flex-col p-4">
              <div className="flex flex-col gap-3 border-b border-border pb-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-display text-sm font-semibold">
                    <Bot className="h-4 w-4 text-primary" />
                    {form?.agent_name ?? "Assistente"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Você está conversando com a IA configurada para este escritório.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">
                    {current ? STATUS_LABEL[current.status] : "Sem conversa"}
                  </Badge>
                  {current && current.status === "ai" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => statusMutation.mutate("human")}
                      disabled={statusMutation.isPending}
                    >
                      <UserCheck className="mr-1 h-3.5 w-3.5" /> Assumir atendimento
                    </Button>
                  ) : null}
                  {current && current.status !== "ai" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => statusMutation.mutate("ai")}
                      disabled={statusMutation.isPending}
                    >
                      <RefreshCw className="mr-1 h-3.5 w-3.5" /> Devolver para IA
                    </Button>
                  ) : null}
                </div>
              </div>

              <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto py-4">
                {messages.length === 0 ? (
                  <div className="mx-auto max-w-md rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    {form?.greeting ?? "Envie uma mensagem para começar."}
                  </div>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm sm:max-w-[70%] ${
                          m.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "border border-border bg-background/60"
                        }`}
                      >
                        {m.content}
                      </div>
                    </div>
                  ))
                )}
                {send.isPending ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> A IA está respondendo...
                  </div>
                ) : null}
              </div>

              <form
                className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row"
                onSubmit={(e) => {
                  e.preventDefault();
                  const value = draft.trim();
                  if (!value || send.isPending) return;
                  setDraft("");
                  send.mutate(value);
                }}
              >
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Escreva uma mensagem como se fosse um cliente..."
                />
                <Button type="submit" disabled={send.isPending || !draft.trim()} className="sm:w-auto">
                  <Send className="mr-2 h-4 w-4" /> Enviar
                </Button>
              </form>
            </section>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
