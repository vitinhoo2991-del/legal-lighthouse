// Etapa 05 — Central de Multiatendimento (fila, atribuição, transferência,
// notas internas, histórico, IA ↔ humano e tempo real).
import { useEffect, useMemo, useRef, useState } from "react";
import { UpcomingEvents } from "@/components/calendar/UpcomingEvents";
import { DocumentsSection } from "@/components/documents/DocumentsSection";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Bell,
  BellOff,
  Bot,
  Check,
  CheckCheck,
  Clock,
  AlertTriangle,
  Lock,
  LogOut,
  Search,
  Send,
  Share2,
  UserCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/common/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/auth";
import {
  claimConversation,
  createInternalNote,
  getConversationDetail,
  listNotifications,
  listServiceQueue,
  listServiceTeam,
  markNotificationsRead,
  releaseConversation,
  returnConversationToAi,
  setConversationServiceStatus,
  transferConversation,
  type QueueView,
  type ServiceStatus,
} from "@/lib/multiservice.functions";
import { getWhatsappMessages, sendWhatsappMessage, type WaMessage } from "@/lib/whatsapp.functions";

export const Route = createFileRoute("/_authenticated/_app/atendimento")({
  component: AtendimentoPage,
});

const SERVICE_LABEL: Record<ServiceStatus, { label: string; dot: string }> = {
  aberta: { label: "Aberta", dot: "bg-emerald-400" },
  em_atendimento: { label: "Em atendimento", dot: "bg-amber-400" },
  aguardando_cliente: { label: "Aguardando cliente", dot: "bg-sky-400" },
  aguardando_equipe: { label: "Aguardando equipe", dot: "bg-violet-400" },
  encerrada: { label: "Encerrada", dot: "bg-muted-foreground" },
};

const VIEWS: { value: QueueView; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "mine", label: "Minhas" },
  { value: "unassigned", label: "Não atribuídas" },
  { value: "waiting_service", label: "Aguardando atendimento" },
  { value: "waiting_client", label: "Aguardando cliente" },
  { value: "closed", label: "Encerradas" },
];

const PRESENCE_LABEL = {
  online: { label: "Online", dot: "bg-emerald-400" },
  busy: { label: "Ocupado", dot: "bg-amber-400" },
  offline: { label: "Offline", dot: "bg-muted-foreground" },
} as const;

function timeOf(value: string) {
  return new Date(value).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function MessageStatusIcon({ message }: { message: WaMessage }) {
  if (message.direction === "inbound") return null;
  if (message.status === "failed")
    return <AlertTriangle className="h-3.5 w-3.5 text-destructive" aria-label="Falhou" />;
  if (message.status === "queued")
    return <Clock className="h-3.5 w-3.5 opacity-70" aria-label="Enviando" />;
  if (message.status === "read") return <CheckCheck className="h-3.5 w-3.5" aria-label="Lida" />;
  if (message.status === "delivered")
    return <CheckCheck className="h-3.5 w-3.5 opacity-70" aria-label="Entregue" />;
  return <Check className="h-3.5 w-3.5 opacity-70" aria-label="Enviada" />;
}

function beep() {
  try {
    const AudioCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return;
    const ctx = new AudioCtor();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.value = 0.05;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch {
    /* som é opcional */
  }
}

function AtendimentoPage() {
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();
  const officeId = profile?.office_id ?? null;

  const fetchQueue = useServerFn(listServiceQueue);
  const fetchTeam = useServerFn(listServiceTeam);
  const fetchDetail = useServerFn(getConversationDetail);
  const fetchMessages = useServerFn(getWhatsappMessages);
  const postMessage = useServerFn(sendWhatsappMessage);
  const claim = useServerFn(claimConversation);
  const transfer = useServerFn(transferConversation);
  const release = useServerFn(releaseConversation);
  const backToAi = useServerFn(returnConversationToAi);
  const changeStatus = useServerFn(setConversationServiceStatus);
  const addNote = useServerFn(createInternalNote);
  const fetchNotifications = useServerFn(listNotifications);
  const readNotifications = useServerFn(markNotificationsRead);

  const [view, setView] = useState<QueueView>("all");
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState("");
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferTarget, setTransferTarget] = useState<string | null>(null);
  const [transferReason, setTransferReason] = useState("");
  const [soundOn, setSoundOn] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (profile)
      setSoundOn(
        (profile as unknown as { notification_sound_enabled?: boolean })
          .notification_sound_enabled ?? true,
      );
  }, [profile]);

  const queueQuery = useQuery({
    queryKey: ["service-queue", view, search],
    queryFn: () => fetchQueue({ data: { view, search } }),
    refetchInterval: 60_000,
  });
  const teamQuery = useQuery({
    queryKey: ["service-team"],
    queryFn: () => fetchTeam(),
    refetchInterval: 60_000,
  });
  const notificationsQuery = useQuery({
    queryKey: ["service-notifications"],
    queryFn: () => fetchNotifications(),
    refetchInterval: 60_000,
  });

  const conversations = queueQuery.data?.conversations ?? [];
  const counts = queueQuery.data?.counts;
  const myProfileId = queueQuery.data?.profileId ?? null;
  const active = conversations.find((c) => c.id === activeId) ?? null;

  const detailQuery = useQuery({
    queryKey: ["conversation-detail", activeId],
    enabled: Boolean(activeId),
    queryFn: () => fetchDetail({ data: { conversationId: activeId! } }),
  });
  const detail = detailQuery.data ?? null;

  const messagesQuery = useQuery({
    queryKey: ["wa-messages", activeId],
    enabled: Boolean(activeId),
    queryFn: () => fetchMessages({ data: { conversationId: activeId! } }),
  });
  const messages = (messagesQuery.data ?? []) as WaMessage[];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // ---------------- tempo real ----------------
  useEffect(() => {
    if (!officeId) return;
    const channel = supabase
      .channel(`multiatendimento-${officeId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "whatsapp_conversations",
          filter: `office_id=eq.${officeId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["service-queue"] });
          queryClient.invalidateQueries({ queryKey: ["conversation-detail"] });
          queryClient.invalidateQueries({ queryKey: ["service-team"] });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "whatsapp_messages",
          filter: `office_id=eq.${officeId}`,
        },
        (payload) => {
          const row = payload.new as { conversation_id: string; direction: string };
          queryClient.invalidateQueries({ queryKey: ["service-queue"] });
          queryClient.invalidateQueries({ queryKey: ["wa-messages", row.conversation_id] });
          if (row.direction === "inbound" && soundOn) beep();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversation_events",
          filter: `office_id=eq.${officeId}`,
        },
        () => queryClient.invalidateQueries({ queryKey: ["conversation-detail"] }),
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `office_id=eq.${officeId}`,
        },
        () => queryClient.invalidateQueries({ queryKey: ["service-notifications"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [officeId, queryClient, soundOn]);

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ["service-queue"] });
    queryClient.invalidateQueries({ queryKey: ["conversation-detail", activeId] });
    queryClient.invalidateQueries({ queryKey: ["service-team"] });
  };

  const claimMutation = useMutation({
    mutationFn: () => claim({ data: { conversationId: activeId! } }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(
          result.assignee
            ? `Esta conversa acabou de ser assumida por ${result.assignee}.`
            : "Esta conversa acabou de ser assumida por outro atendente.",
        );
      } else {
        toast.success("Atendimento assumido.");
      }
      refreshAll();
    },
    onError: () => toast.error("Não foi possível assumir o atendimento."),
  });

  const transferMutation = useMutation({
    mutationFn: () =>
      transfer({
        data: {
          conversationId: activeId!,
          targetProfileId: transferTarget!,
          ...(transferReason.trim() ? { reason: transferReason.trim() } : {}),
        },
      }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(
          result.code === "CONFLICT"
            ? "A responsabilidade mudou enquanto você transferia. Atualize e tente de novo."
            : result.code === "FORBIDDEN"
              ? "Você não pode transferir uma conversa de outro atendente."
              : "Selecione um membro válido da equipe.",
        );
      } else {
        toast.success(`Conversa transferida para ${result.assignee}.`);
        setTransferOpen(false);
        setTransferReason("");
        setTransferTarget(null);
      }
      refreshAll();
    },
    onError: () => toast.error("Não foi possível transferir."),
  });

  const releaseMutation = useMutation({
    mutationFn: () => release({ data: { conversationId: activeId! } }),
    onSuccess: (result) => {
      if (!result.ok) toast.error("Você não pode devolver esta conversa.");
      else toast.success("Conversa devolvida para a fila.");
      refreshAll();
    },
  });

  const aiMutation = useMutation({
    mutationFn: () => backToAi({ data: { conversationId: activeId! } }),
    onSuccess: () => {
      toast.success("Atendimento devolvido para a IA.");
      refreshAll();
    },
  });

  const statusMutation = useMutation({
    mutationFn: (serviceStatus: ServiceStatus) =>
      changeStatus({ data: { conversationId: activeId!, serviceStatus } }),
    onSuccess: () => refreshAll(),
    onError: () => toast.error("Não foi possível alterar o status."),
  });

  const send = useMutation({
    mutationFn: (content: string) => postMessage({ data: { conversationId: activeId!, content } }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(
          result.code === "NOT_CONFIGURED"
            ? "Conecte o WhatsApp antes de responder."
            : "Não foi possível enviar esta mensagem.",
        );
      }
      queryClient.invalidateQueries({ queryKey: ["wa-messages", activeId] });
      queryClient.invalidateQueries({ queryKey: ["service-queue"] });
    },
    onError: () => toast.error("Não foi possível enviar esta mensagem."),
  });

  const noteMutation = useMutation({
    mutationFn: (content: string) => addNote({ data: { conversationId: activeId!, content } }),
    onSuccess: () => {
      setNote("");
      toast.success("Nota interna registrada.");
      queryClient.invalidateQueries({ queryKey: ["conversation-detail", activeId] });
    },
    onError: () => toast.error("Não foi possível salvar a nota."),
  });

  const unreadNotifications = (notificationsQuery.data ?? []).filter((n) => !n.read_at);

  const toggleSound = async () => {
    const next = !soundOn;
    setSoundOn(next);
    if (profile?.id) {
      await supabase
        .from("profiles")
        .update({ notification_sound_enabled: next })
        .eq("id", profile.id);
    }
  };

  const assignedLabel = useMemo(() => {
    if (!active) return "";
    if (active.assigned_to) return active.assignee_name ?? "Responsável";
    if (active.status === "ai" && active.ai_enabled) return "IA";
    return "Sem responsável";
  }, [active]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Central de Atendimento"
        description="Fila, atribuição e conversas em tempo real da equipe do escritório."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={toggleSound}>
              {soundOn ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await readNotifications();
                queryClient.invalidateQueries({ queryKey: ["service-notifications"] });
              }}
            >
              Notificações
              {unreadNotifications.length > 0 ? (
                <span className="ml-2 rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                  {unreadNotifications.length}
                </span>
              ) : null}
            </Button>
          </div>
        }
      />

      {/* Equipe / presença */}
      <section className="surface-panel flex flex-wrap items-center gap-3 p-4">
        <span className="text-xs text-muted-foreground">Equipe:</span>
        {(teamQuery.data ?? []).length === 0 ? (
          <span className="text-xs text-muted-foreground">Nenhum membro ativo.</span>
        ) : (
          (teamQuery.data ?? []).map((m) => (
            <span
              key={m.id}
              className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-[11px]"
            >
              <span className={`h-2 w-2 rounded-full ${PRESENCE_LABEL[m.presence].dot}`} />
              {m.name}
              <span className="text-muted-foreground">
                {m.active_conversations}
                {m.max_concurrent_conversations ? `/${m.max_concurrent_conversations}` : ""}
              </span>
            </span>
          ))
        )}
      </section>

      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)_300px]">
        {/* -------- fila -------- */}
        <section
          className={`surface-panel flex max-h-[640px] flex-col p-4 ${activeId ? "hidden xl:flex" : "flex"}`}
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
            {VIEWS.map((v) => {
              const count = counts ? counts[v.value === "all" ? "all" : v.value] : 0;
              return (
                <button
                  key={v.value}
                  type="button"
                  onClick={() => setView(v.value)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                    view === v.value
                      ? "border-primary/40 bg-primary-soft text-primary"
                      : "border-border text-muted-foreground hover:border-primary/30"
                  }`}
                >
                  {v.label} — {count}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex-1 space-y-2 overflow-y-auto">
            {queueQuery.isLoading ? (
              <p className="p-4 text-center text-xs text-muted-foreground">Carregando...</p>
            ) : conversations.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                Nenhuma conversa nesta visão. As conversas aparecem aqui assim que chegarem
                mensagens pelo WhatsApp do escritório.
              </p>
            ) : (
              conversations.map((c) => (
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
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-sm font-medium">
                        {c.contact?.name ?? c.contact?.profile_name ?? c.contact?.phone_number}
                      </p>
                      <p className="line-clamp-1 text-[11px] text-muted-foreground">
                        {c.last_message?.content ?? c.contact?.phone_number}
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${SERVICE_LABEL[c.service_status].dot}`}
                          />
                          {SERVICE_LABEL[c.service_status].label}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          {c.assigned_to ? (
                            <>
                              <UserCheck className="h-3 w-3" /> {c.assignee_name ?? "Responsável"}
                            </>
                          ) : c.ai_enabled && c.status === "ai" ? (
                            <>
                              <Bot className="h-3 w-3" /> IA
                            </>
                          ) : (
                            "Sem responsável"
                          )}
                        </span>
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-[10px] text-muted-foreground">
                        {timeOf(c.last_message_at)}
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

        {/* -------- conversa -------- */}
        <section
          className={`surface-panel min-h-[640px] flex-col p-4 ${activeId ? "flex" : "hidden xl:flex"}`}
        >
          {!active ? (
            <div className="flex flex-1 items-center justify-center text-center text-sm text-muted-foreground">
              Selecione uma conversa da fila.
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 border-b border-border pb-3">
                <Button
                  size="icon"
                  variant="ghost"
                  className="xl:hidden"
                  onClick={() => setActiveId(null)}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 font-display text-sm font-semibold">
                    {active.contact?.name ??
                      active.contact?.profile_name ??
                      active.contact?.phone_number}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {active.assigned_to
                      ? `👤 Atendimento humano — ${assignedLabel}`
                      : active.ai_enabled && active.status === "ai"
                        ? "🤖 Atendimento pela IA"
                        : "Sem responsável"}
                  </p>
                </div>
                <Badge variant="outline">{SERVICE_LABEL[active.service_status].label}</Badge>
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
                        <p className="mb-1 text-[10px] font-medium opacity-80">
                          {m.direction === "inbound"
                            ? "Cliente"
                            : m.from_ai
                              ? "🤖 IA"
                              : "👤 Atendente"}
                        </p>
                        <p className="whitespace-pre-wrap break-words">{m.content}</p>
                        <div className="mt-1 flex items-center justify-end gap-1.5 text-[10px] opacity-80">
                          <span>{timeOf(m.created_at)}</span>
                          <MessageStatusIcon message={m} />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-2 border-t border-border pt-3">
                <div className="flex items-end gap-2">
                  <Textarea
                    rows={2}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Escreva uma resposta para o cliente"
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
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-end gap-2">
                  <Textarea
                    rows={1}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="🔒 Nota interna (não é enviada ao cliente)"
                    className="min-h-[38px] resize-none text-xs"
                  />
                  <Button
                    variant="outline"
                    disabled={!note.trim() || noteMutation.isPending}
                    onClick={() => noteMutation.mutate(note.trim())}
                  >
                    <Lock className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </section>

        {/* -------- detalhes -------- */}
        <section
          className={`surface-panel space-y-4 p-4 ${activeId ? "block" : "hidden xl:block"}`}
        >
          {!active || !detail ? (
            <p className="text-xs text-muted-foreground">Nenhuma conversa selecionada.</p>
          ) : (
            <>
              <div>
                <h2 className="font-display text-sm font-semibold">Contato</h2>
                <dl className="mt-2 space-y-1 text-sm">
                  <div className="flex justify-between gap-2">
                    <dt className="text-xs text-muted-foreground">Nome</dt>
                    <dd className="truncate">
                      {detail.contact?.name ?? detail.contact?.profile_name ?? "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-xs text-muted-foreground">Telefone</dt>
                    <dd>{detail.contact?.phone_number ?? "—"}</dd>
                  </div>
                </dl>
              </div>

              <div>
                <h2 className="font-display text-sm font-semibold">Lead</h2>
                {detail.lead ? (
                  <div className="mt-2 space-y-1 text-sm">
                    <p>
                      Lead Score: <strong>{detail.lead.lead_score}</strong>{" "}
                      <Badge variant="outline" className="ml-1 capitalize">
                        {detail.lead.lead_temperature}
                      </Badge>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Área: {detail.lead.practice_area ?? "—"} · Qualificação:{" "}
                      {detail.lead.qualification_status}
                    </p>
                    {detail.lead.score_reason ? (
                      <p className="text-xs text-muted-foreground">{detail.lead.score_reason}</p>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Ainda sem lead qualificado para este contato.
                  </p>
                )}
              </div>

              <div>
                <h2 className="font-display text-sm font-semibold">Atendimento</h2>
                <p className="mt-2 text-sm">
                  Responsável: <strong>{detail.assignee_name ?? "Sem responsável"}</strong>
                </p>
                <p className="text-xs text-muted-foreground">
                  Status: {SERVICE_LABEL[detail.service_status].label} ·{" "}
                  {detail.ai_enabled ? "IA ativa" : "IA pausada"}
                </p>
              </div>

              <div className="space-y-2">
                <Button
                  className="w-full"
                  disabled={claimMutation.isPending || detail.assigned_to === myProfileId}
                  onClick={() => claimMutation.mutate()}
                >
                  <UserCheck className="mr-2 h-4 w-4" /> Assumir atendimento
                </Button>
                <Button variant="outline" className="w-full" onClick={() => setTransferOpen(true)}>
                  <Share2 className="mr-2 h-4 w-4" /> Transferir
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={!detail.assigned_to || releaseMutation.isPending}
                  onClick={() => releaseMutation.mutate()}
                >
                  <LogOut className="mr-2 h-4 w-4" /> Devolver para fila
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={detail.ai_enabled || aiMutation.isPending}
                  onClick={() => aiMutation.mutate()}
                >
                  <Bot className="mr-2 h-4 w-4" /> Devolver para IA
                </Button>
                <Button
                  variant="ghost"
                  className="w-full"
                  disabled={detail.service_status === "encerrada" || statusMutation.isPending}
                  onClick={() => statusMutation.mutate("encerrada")}
                >
                  <X className="mr-2 h-4 w-4" /> Encerrar atendimento
                </Button>
              </div>

              <div className="rounded-xl border border-border bg-surface/60 p-3">
                <UpcomingEvents
                  conversationId={detail.id}
                  title="Agendar atendimento"
                  eventType="atendimento"
                />
              </div>

              <div className="rounded-xl border border-border bg-surface/60 p-3">
                <DocumentsSection conversationId={detail.id} />
              </div>


              {detail.notes.length > 0 ? (
                <div>
                  <h2 className="font-display text-sm font-semibold">Notas internas</h2>
                  <ul className="mt-2 space-y-2">
                    {detail.notes.map((n) => (
                      <li
                        key={n.id}
                        className="rounded-lg border border-border/70 bg-background/40 p-2 text-xs"
                      >
                        <p className="whitespace-pre-wrap">🔒 {n.content}</p>
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {n.author_name ?? "Equipe"} · {timeOf(n.created_at)}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div>
                <h2 className="font-display text-sm font-semibold">Histórico</h2>
                {detail.events.length === 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">Sem eventos ainda.</p>
                ) : (
                  <ul className="mt-2 space-y-1.5">
                    {detail.events.map((e) => (
                      <li key={e.id} className="text-[11px] text-muted-foreground">
                        {e.description} — {timeOf(e.created_at)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </section>
      </div>

      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transferir atendimento</DialogTitle>
            <DialogDescription>Escolha um membro ativo da equipe do escritório.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {(teamQuery.data ?? []).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setTransferTarget(m.id)}
                className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm ${
                  transferTarget === m.id ? "border-primary/50 bg-primary-soft" : "border-border"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${PRESENCE_LABEL[m.presence].dot}`} />
                  {m.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {PRESENCE_LABEL[m.presence].label} · {m.active_conversations} em atendimento
                </span>
              </button>
            ))}
            <Textarea
              rows={2}
              value={transferReason}
              onChange={(e) => setTransferReason(e.target.value)}
              placeholder="Motivo (opcional)"
            />
            <Button
              className="w-full"
              disabled={!transferTarget || transferMutation.isPending}
              onClick={() => transferMutation.mutate()}
            >
              Transferir
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
