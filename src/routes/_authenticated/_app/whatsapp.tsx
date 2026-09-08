import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  Check,
  CheckCheck,
  Clock,
  Copy,
  Loader2,
  Phone,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Unplug,
  UserCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import {
  disconnectWhatsapp,
  getWhatsappMessages,
  getWhatsappOverview,
  getWhatsappVerifyToken,
  listWhatsappConversations,
  saveWhatsappConnection,
  sendWhatsappMessage,
  setWhatsappConversationMode,
  testWhatsappConnection,
  type WaConversationStatus,
  type WaMessage,
} from "@/lib/whatsapp.functions";

export const Route = createFileRoute("/_authenticated/_app/whatsapp")({
  component: WhatsappPage,
});

const CONNECTION_LABEL = {
  connected: { label: "Conectado", dot: "bg-emerald-400", tone: "text-emerald-300" },
  pending: { label: "Configuração pendente", dot: "bg-amber-400", tone: "text-amber-300" },
  disconnected: { label: "Desconectado", dot: "bg-rose-400", tone: "text-rose-300" },
  error: { label: "Erro de integração", dot: "bg-orange-400", tone: "text-orange-300" },
} as const;

const FILTERS = [
  { value: "all", label: "Todas" },
  { value: "unread", label: "Não lidas" },
  { value: "open", label: "Em atendimento" },
  { value: "ai", label: "IA atendendo" },
  { value: "human", label: "Humano atendendo" },
  { value: "closed", label: "Encerradas" },
] as const;

const CONV_STATUS_LABEL: Record<WaConversationStatus, string> = {
  ai: "IA atendendo",
  waiting_human: "Aguardando humano",
  human: "Atendimento humano",
  closed: "Encerrada",
};

function MessageStatusIcon({ message }: { message: WaMessage }) {
  if (message.direction === "inbound") return null;
  if (message.status === "failed")
    return <AlertTriangle className="h-3.5 w-3.5 text-destructive" aria-label="Falhou" />;
  if (message.status === "queued")
    return <Clock className="h-3.5 w-3.5 opacity-70" aria-label="Enviando" />;
  if (message.status === "read")
    return <CheckCheck className="h-3.5 w-3.5 text-primary" aria-label="Lida" />;
  if (message.status === "delivered")
    return <CheckCheck className="h-3.5 w-3.5 opacity-70" aria-label="Entregue" />;
  return <Check className="h-3.5 w-3.5 opacity-70" aria-label="Enviada" />;
}

function WhatsappPage() {
  const queryClient = useQueryClient();

  const fetchOverview = useServerFn(getWhatsappOverview);
  const saveConnection = useServerFn(saveWhatsappConnection);
  const testConnection = useServerFn(testWhatsappConnection);
  const disconnect = useServerFn(disconnectWhatsapp);
  const fetchVerifyToken = useServerFn(getWhatsappVerifyToken);
  const fetchConversations = useServerFn(listWhatsappConversations);
  const fetchMessages = useServerFn(getWhatsappMessages);
  const postMessage = useServerFn(sendWhatsappMessage);
  const changeMode = useServerFn(setWhatsappConversationMode);

  const overviewQuery = useQuery({ queryKey: ["wa-overview"], queryFn: () => fetchOverview() });
  const overview = overviewQuery.data;
  const status = overview?.connection.status ?? "disconnected";
  const meta = CONNECTION_LABEL[status];
  const canEdit = overview?.canEdit ?? false;

  const webhookUrl = useMemo(() => {
    if (!overview) return "";
    const origin = typeof window === "undefined" ? "" : window.location.origin;
    return `${origin}${overview.webhookPath}`;
  }, [overview]);

  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [appSecret, setAppSecret] = useState("");

  useEffect(() => {
    if (overview) {
      setPhoneNumberId(overview.connection.external_phone_number_id ?? "");
      setAccountId(overview.connection.external_account_id ?? "");
    }
  }, [overview]);

  const verifyTokenQuery = useQuery({
    queryKey: ["wa-verify-token"],
    enabled: canEdit && Boolean(overview?.hasCredentials),
    queryFn: () => fetchVerifyToken(),
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      saveConnection({
        data: {
          external_phone_number_id: phoneNumberId.trim(),
          external_account_id: accountId.trim(),
          ...(accessToken.trim() ? { access_token: accessToken.trim() } : {}),
          ...(appSecret.trim() ? { app_secret: appSecret.trim() } : {}),
        },
      }),
    onSuccess: () => {
      setAccessToken("");
      setAppSecret("");
      toast.success("Dados de conexão salvos com segurança.");
      queryClient.invalidateQueries({ queryKey: ["wa-overview"] });
      queryClient.invalidateQueries({ queryKey: ["wa-verify-token"] });
    },
    onError: () =>
      toast.error("Não foi possível salvar. Informe o token de acesso ao configurar pela primeira vez."),
  });

  const testMutation = useMutation({
    mutationFn: () => testConnection(),
    onSuccess: (result) => {
      if (result.ok) toast.success(`Conexão confirmada${result.phone ? ` — ${result.phone}` : ""}.`);
      else if (result.code === "NOT_CONFIGURED")
        toast.error("Informe o identificador do número e o token antes de testar.");
      else toast.error("Não foi possível concluir a conexão.");
      queryClient.invalidateQueries({ queryKey: ["wa-overview"] });
    },
    onError: () => toast.error("Não foi possível testar a conexão."),
  });

  const disconnectMutation = useMutation({
    mutationFn: () => disconnect(),
    onSuccess: () => {
      toast.success("WhatsApp desconectado.");
      queryClient.invalidateQueries({ queryKey: ["wa-overview"] });
      queryClient.invalidateQueries({ queryKey: ["wa-verify-token"] });
    },
    onError: () => toast.error("Não foi possível desconectar."),
  });

  // ------- conversations -------
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["value"]>("all");
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const conversationsQuery = useQuery({
    queryKey: ["wa-conversations", filter, search],
    queryFn: () => fetchConversations({ data: { filter, search } }),
    refetchInterval: 15000,
  });

  const active = conversationsQuery.data?.find((c) => c.id === activeId) ?? null;

  const messagesQuery = useQuery({
    queryKey: ["wa-messages", activeId],
    enabled: Boolean(activeId),
    queryFn: () => fetchMessages({ data: { conversationId: activeId! } }),
    refetchInterval: 10000,
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messagesQuery.data]);

  const send = useMutation({
    mutationFn: (content: string) =>
      postMessage({ data: { conversationId: activeId!, content } }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(
          result.code === "NOT_CONFIGURED"
            ? "Conecte o WhatsApp antes de responder."
            : "Não foi possível enviar esta mensagem.",
        );
      }
      queryClient.invalidateQueries({ queryKey: ["wa-messages", activeId] });
      queryClient.invalidateQueries({ queryKey: ["wa-conversations"] });
    },
    onError: () => toast.error("Não foi possível enviar esta mensagem."),
  });

  const modeMutation = useMutation({
    mutationFn: (next: WaConversationStatus) =>
      changeMode({ data: { conversationId: activeId!, status: next } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["wa-conversations"] }),
    onError: () => toast.error("Não foi possível alterar o atendimento."),
  });

  const messages = (messagesQuery.data ?? []) as WaMessage[];

  return (
    <div className="space-y-6">
      <PageHeader
        title="WhatsApp"
        badge={meta.label}
        description={`Central de conexão e atendimento do WhatsApp oficial do escritório ${overview?.officeName ?? ""}.`.trim()}
        actions={
          <span className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface/60 px-3 py-2 text-xs">
            <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
            <span className={meta.tone}>{meta.label}</span>
          </span>
        }
      />

      <Tabs defaultValue="conexao" className="space-y-5">
        <TabsList>
          <TabsTrigger value="conexao">Conexão</TabsTrigger>
          <TabsTrigger value="conversas">Conversas</TabsTrigger>
        </TabsList>

        {/* ---------------- CONEXÃO ---------------- */}
        <TabsContent value="conexao" className="space-y-5">
          {status !== "connected" ? (
            <Card className="border-border bg-surface/60">
              <CardContent className="p-5">
                <h2 className="font-display text-base font-semibold">
                  {status === "error"
                    ? "Não foi possível concluir a conexão."
                    : status === "pending"
                      ? "Configuração pendente"
                      : "Seu WhatsApp ainda não está conectado."}
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                  A conexão usa a API oficial do WhatsApp Business (Meta). Você precisa de uma conta
                  WhatsApp Business com número verificado e, no painel da Meta, do identificador do
                  número, do identificador da conta e de um token de acesso permanente. O token fica
                  guardado apenas no servidor — nunca aparece nesta tela depois de salvo.
                </p>
                {overview?.connection.last_error ? (
                  <p className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                    {overview.connection.last_error}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="surface-panel space-y-4 p-5">
              <h2 className="font-display text-sm font-semibold">Credenciais oficiais</h2>
              <div className="space-y-2">
                <Label htmlFor="phoneNumberId">Identificador do número (Phone Number ID)</Label>
                <Input
                  id="phoneNumberId"
                  value={phoneNumberId}
                  disabled={!canEdit}
                  onChange={(e) => setPhoneNumberId(e.target.value)}
                  placeholder="Ex.: 123456789012345"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accountId">Identificador da conta (WABA ID)</Label>
                <Input
                  id="accountId"
                  value={accountId}
                  disabled={!canEdit}
                  onChange={(e) => setAccountId(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accessToken">
                  Token de acesso {overview?.hasCredentials ? "(deixe em branco para manter)" : ""}
                </Label>
                <Textarea
                  id="accessToken"
                  rows={3}
                  value={accessToken}
                  disabled={!canEdit}
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder={overview?.hasCredentials ? "•••••••• já armazenado" : "Cole aqui o token permanente"}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="appSecret">
                  Chave secreta do app {overview?.hasAppSecret ? "(armazenada)" : "(recomendada)"}
                </Label>
                <Input
                  id="appSecret"
                  value={appSecret}
                  disabled={!canEdit}
                  onChange={(e) => setAppSecret(e.target.value)}
                  placeholder="Usada para validar a assinatura dos eventos"
                />
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  className="w-full sm:w-auto"
                  disabled={!canEdit || saveMutation.isPending || !phoneNumberId.trim()}
                  onClick={() => saveMutation.mutate()}
                >
                  {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Conectar WhatsApp
                </Button>
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  disabled={!canEdit || testMutation.isPending}
                  onClick={() => testMutation.mutate()}
                >
                  {testMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Testar conexão
                </Button>
                <Button
                  variant="ghost"
                  className="w-full text-destructive sm:w-auto"
                  disabled={!canEdit || !overview?.hasCredentials || disconnectMutation.isPending}
                  onClick={() => disconnectMutation.mutate()}
                >
                  <Unplug className="mr-2 h-4 w-4" /> Desconectar
                </Button>
              </div>
              {!canEdit ? (
                <p className="text-xs text-muted-foreground">
                  Apenas proprietário e administradores podem alterar a conexão.
                </p>
              ) : null}
            </section>

            <div className="space-y-4">
              <section className="surface-panel space-y-3 p-5">
                <h2 className="font-display text-sm font-semibold">Situação</h2>
                <dl className="grid gap-2 text-sm">
                  {[
                    ["Número conectado", overview?.connection.phone_number ?? "—"],
                    ["Nome verificado", overview?.connection.display_name ?? "—"],
                    ["ID da conta", overview?.connection.external_account_id ?? "—"],
                    [
                      "Última sincronização",
                      overview?.connection.last_sync_at
                        ? new Date(overview.connection.last_sync_at).toLocaleString("pt-BR")
                        : "—",
                    ],
                    ["IA de atendimento", overview?.aiEnabled ? "Ativa" : "Inativa"],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between gap-3">
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd className="truncate text-right">{value}</dd>
                    </div>
                  ))}
                </dl>
              </section>

              <section className="surface-panel space-y-3 p-5">
                <h2 className="font-display text-sm font-semibold">Webhook</h2>
                <p className="text-xs text-muted-foreground">
                  Cadastre este endereço no painel da Meta para receber as mensagens.
                </p>
                <div className="flex items-center gap-2">
                  <Input readOnly value={webhookUrl} className="text-xs" />
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(webhookUrl);
                      toast.success("Endereço copiado.");
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                {verifyTokenQuery.data?.verifyToken ? (
                  <div className="space-y-2">
                    <Label className="text-xs">Token de verificação</Label>
                    <div className="flex items-center gap-2">
                      <Input readOnly value={verifyTokenQuery.data.verifyToken} className="text-xs" />
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText(verifyTokenQuery.data!.verifyToken!);
                          toast.success("Token copiado.");
                        }}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    O token de verificação é gerado ao salvar as credenciais.
                  </p>
                )}
                <p className="flex items-start gap-2 rounded-lg border border-border/70 bg-background/40 p-3 text-[11px] text-muted-foreground">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  Eventos repetidos são ignorados automaticamente e cada evento é validado pela
                  assinatura da Meta antes de ser processado.
                </p>
              </section>

              <section className="surface-panel grid grid-cols-2 gap-3 p-5 sm:grid-cols-4">
                {[
                  ["Recebidas", overview?.stats.received ?? 0],
                  ["Enviadas", overview?.stats.sent ?? 0],
                  ["Falhas", overview?.stats.failed ?? 0],
                  ["Eventos", overview?.stats.events ?? 0],
                ].map(([label, value]) => (
                  <div key={label as string} className="rounded-lg border border-border/70 p-3">
                    <p className="text-[11px] text-muted-foreground">{label}</p>
                    <p className="font-display text-lg font-semibold">{value}</p>
                  </div>
                ))}
              </section>
            </div>
          </div>
        </TabsContent>

        {/* ---------------- CONVERSAS ---------------- */}
        <TabsContent value="conversas">
          <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)_260px]">
            <section
              className={`surface-panel flex max-h-[620px] flex-col p-4 ${activeId ? "hidden lg:flex" : "flex"}`}
            >
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar nome, telefone ou mensagem"
                  className="pl-9 text-sm"
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {FILTERS.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setFilter(f.value)}
                    className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                      filter === f.value
                        ? "border-primary/40 bg-primary-soft text-primary"
                        : "border-border text-muted-foreground hover:border-primary/30"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex-1 space-y-2 overflow-y-auto">
                {conversationsQuery.isLoading ? (
                  <p className="p-4 text-center text-xs text-muted-foreground">Carregando...</p>
                ) : (conversationsQuery.data ?? []).length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                    Nenhuma conversa ainda. As mensagens aparecem aqui assim que o WhatsApp oficial
                    estiver conectado e um cliente escrever para o escritório.
                  </p>
                ) : (
                  conversationsQuery.data!.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setActiveId(c.id)}
                      className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${
                        c.id === activeId
                          ? "border-primary/40 bg-primary-soft/60"
                          : "border-border hover:border-primary/30"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
                          {(c.contact?.name ?? c.contact?.profile_name ?? "?").slice(0, 1).toUpperCase()}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-1 text-sm font-medium">
                            {c.contact?.name ?? c.contact?.profile_name ?? c.contact?.phone_number}
                          </p>
                          <p className="line-clamp-1 text-[11px] text-muted-foreground">
                            {c.last_message?.content ?? c.contact?.phone_number}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(c.last_message_at).toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          {c.unread_count > 0 ? (
                            <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                              {c.unread_count}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </section>

            <section
              className={`surface-panel min-h-[620px] flex-col p-4 ${activeId ? "flex" : "hidden lg:flex"}`}
            >
              {!active ? (
                <div className="flex flex-1 items-center justify-center text-center text-sm text-muted-foreground">
                  Selecione uma conversa para ver o histórico.
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3 border-b border-border pb-3">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="lg:hidden"
                      onClick={() => setActiveId(null)}
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 font-display text-sm font-semibold">
                        {active.contact?.name ?? active.contact?.profile_name ?? active.contact?.phone_number}
                      </p>
                      <p className="text-xs text-muted-foreground">{active.contact?.phone_number}</p>
                    </div>
                    <Badge variant="outline">{CONV_STATUS_LABEL[active.status]}</Badge>
                  </div>

                  <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto py-4">
                    {messages.length === 0 ? (
                      <p className="text-center text-xs text-muted-foreground">Sem mensagens.</p>
                    ) : (
                      messages.map((m) => (
                        <div
                          key={m.id}
                          className={`flex ${m.direction === "outbound" ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
                              m.direction === "outbound"
                                ? "bg-primary text-primary-foreground"
                                : "border border-border bg-surface"
                            }`}
                          >
                            <p className="whitespace-pre-wrap break-words">{m.content}</p>
                            <div className="mt-1 flex items-center justify-end gap-1.5 text-[10px] opacity-80">
                              {m.from_ai ? <Bot className="h-3 w-3" /> : null}
                              <span>
                                {new Date(m.created_at).toLocaleTimeString("pt-BR", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                              <MessageStatusIcon message={m} />
                            </div>
                            {m.status === "failed" ? (
                              <p className="mt-1 text-[10px] text-destructive-foreground/90">
                                Não foi possível enviar esta mensagem.
                              </p>
                            ) : null}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="sticky bottom-0 flex items-end gap-2 border-t border-border pt-3">
                    <Textarea
                      rows={2}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder="Escreva uma resposta"
                      className="min-h-[44px] resize-none"
                    />
                    <Button
                      disabled={!draft.trim() || send.isPending}
                      onClick={() => {
                        const content = draft.trim();
                        setDraft("");
                        send.mutate(content);
                      }}
                    >
                      {send.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </>
              )}
            </section>

            <section
              className={`surface-panel space-y-4 p-4 ${activeId ? "block" : "hidden lg:block"}`}
            >
              <h2 className="font-display text-sm font-semibold">Contato</h2>
              {!active ? (
                <p className="text-xs text-muted-foreground">Nenhuma conversa selecionada.</p>
              ) : (
                <>
                  <dl className="space-y-2 text-sm">
                    <div>
                      <dt className="text-xs text-muted-foreground">Nome</dt>
                      <dd>{active.contact?.name ?? active.contact?.profile_name ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Telefone</dt>
                      <dd>{active.contact?.phone_number}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Origem</dt>
                      <dd>WhatsApp</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Status do atendimento</dt>
                      <dd>{CONV_STATUS_LABEL[active.status]}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">IA nesta conversa</dt>
                      <dd>{active.ai_enabled ? "Ativada" : "Desativada"}</dd>
                    </div>
                  </dl>

                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      className="w-full"
                      disabled={modeMutation.isPending || active.status === "human"}
                      onClick={() => modeMutation.mutate("human")}
                    >
                      <UserCheck className="mr-2 h-4 w-4" /> Assumir atendimento
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full"
                      disabled={modeMutation.isPending || active.status === "ai"}
                      onClick={() => modeMutation.mutate("ai")}
                    >
                      <Bot className="mr-2 h-4 w-4" /> Devolver para IA
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full"
                      disabled={modeMutation.isPending || active.status === "closed"}
                      onClick={() => modeMutation.mutate("closed")}
                    >
                      <X className="mr-2 h-4 w-4" /> Encerrar conversa
                    </Button>
                  </div>

                  <p className="flex items-start gap-2 rounded-lg border border-border/70 bg-background/40 p-3 text-[11px] text-muted-foreground">
                    <Phone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                    Respostas enviadas daqui saem pelo número oficial do escritório.
                  </p>
                </>
              )}
            </section>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
