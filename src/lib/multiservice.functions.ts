// Etapa 05 — Multiatendimento.
// Toda a lógica de fila, atribuição, transferência, notas internas, histórico
// e notificações. Sempre validada no servidor por office_id.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type ServiceStatus =
  | "aberta"
  | "em_atendimento"
  | "aguardando_cliente"
  | "aguardando_equipe"
  | "encerrada";

export type QueueView =
  | "all"
  | "mine"
  | "unassigned"
  | "waiting_service"
  | "waiting_client"
  | "closed";

export interface QueueCounts {
  all: number;
  mine: number;
  unassigned: number;
  waiting_service: number;
  waiting_client: number;
  closed: number;
}

export interface ConversationRow {
  id: string;
  status: "ai" | "waiting_human" | "human" | "closed";
  service_status: ServiceStatus;
  ai_enabled: boolean;
  unread_count: number;
  last_message_at: string;
  assigned_to: string | null;
  assignee_name: string | null;
  contact: {
    id: string;
    phone_number: string;
    name: string | null;
    profile_name: string | null;
  } | null;
  last_message: { content: string; direction: "inbound" | "outbound" } | null;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  presence: "online" | "busy" | "offline";
  active_conversations: number;
  max_concurrent_conversations: number | null;
  last_seen_at: string | null;
}

export interface ConversationEventRow {
  id: string;
  event_type: string;
  description: string;
  created_at: string;
  actor_name: string | null;
}

export interface InternalNote {
  id: string;
  content: string;
  created_at: string;
  author_name: string | null;
}

export interface ConversationDetail {
  id: string;
  service_status: ServiceStatus;
  status: "ai" | "waiting_human" | "human" | "closed";
  ai_enabled: boolean;
  assigned_to: string | null;
  assignee_name: string | null;
  assigned_at: string | null;
  closed_at: string | null;
  contact: {
    id: string;
    phone_number: string;
    name: string | null;
    profile_name: string | null;
  } | null;
  lead: {
    id: string;
    lead_score: number;
    lead_temperature: string;
    practice_area: string | null;
    qualification_status: string;
    score_reason: string | null;
  } | null;
  events: ConversationEventRow[];
  notes: InternalNote[];
}

type Ctx = { supabase: any; userId: string };

/** Presença: janelas baseadas em atividade real (last_seen_at). */
const ONLINE_WINDOW_MS = 3 * 60 * 1000;
const BUSY_WINDOW_MS = 15 * 60 * 1000;

async function getContextOffice(context: Ctx) {
  const { data, error } = await context.supabase
    .from("profiles")
    .select("id, office_id, role, name")
    .eq("auth_user_id", context.userId)
    .maybeSingle();
  if (error) throw new Error("PROFILE_ERROR");
  if (!data?.office_id) throw new Error("NO_OFFICE");
  return {
    profileId: data.id as string,
    officeId: data.office_id as string,
    role: data.role as string,
    name: data.name as string,
  };
}

async function touchPresence(ctx: Ctx, profileId: string) {
  await ctx.supabase
    .from("profiles")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", profileId);
}

async function logEvent(
  ctx: Ctx,
  args: {
    officeId: string;
    conversationId: string;
    actorProfileId: string | null;
    eventType: string;
    description: string;
    metadata?: Record<string, unknown>;
  },
) {
  await ctx.supabase.from("conversation_events").insert({
    office_id: args.officeId,
    conversation_id: args.conversationId,
    actor_profile_id: args.actorProfileId,
    event_type: args.eventType,
    description: args.description,
    metadata: args.metadata ?? {},
  });
  await ctx.supabase.from("audit_logs").insert({
    office_id: args.officeId,
    actor_profile_id: args.actorProfileId,
    action: `conversation_${args.eventType}`,
    entity: "whatsapp_conversation",
    entity_id: args.conversationId,
    metadata: { description: args.description, ...(args.metadata ?? {}) },
  });
}

async function notify(
  ctx: Ctx,
  args: {
    officeId: string;
    profileId: string | null;
    conversationId: string;
    type: string;
    title: string;
    body?: string | null;
  },
) {
  await ctx.supabase.from("notifications").insert({
    office_id: args.officeId,
    profile_id: args.profileId,
    conversation_id: args.conversationId,
    type: args.type,
    title: args.title,
    body: args.body ?? null,
  });
}

/** Garante que a conversa pertence ao escritório do usuário autenticado. */
async function loadConversation(ctx: Ctx, officeId: string, conversationId: string) {
  const { data } = await ctx.supabase
    .from("whatsapp_conversations")
    .select(
      "id, office_id, status, service_status, ai_enabled, assigned_to, assigned_at, closed_at, contact:contact_id(id, phone_number, name, profile_name)",
    )
    .eq("id", conversationId)
    .eq("office_id", officeId)
    .maybeSingle();
  if (!data) throw new Error("NOT_FOUND");
  return data;
}

// ------------------------------------------------------------------ fila

const queueSchema = z.object({
  view: z
    .enum(["all", "mine", "unassigned", "waiting_service", "waiting_client", "closed"])
    .default("all"),
  search: z.string().max(120).default(""),
});

export const listServiceQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => queueSchema.parse(input ?? {}))
  .handler(
    async ({
      data,
      context,
    }): Promise<{ conversations: ConversationRow[]; counts: QueueCounts; profileId: string }> => {
      const ctx = context as unknown as Ctx;
      const { officeId, profileId } = await getContextOffice(ctx);
      await touchPresence(ctx, profileId);

      const base = () =>
        ctx.supabase
          .from("whatsapp_conversations")
          .select("id", { count: "exact", head: true })
          .eq("office_id", officeId);

      const [all, mine, unassigned, waitingService, waitingClient, closed] = await Promise.all([
        base().neq("service_status", "encerrada"),
        base().eq("assigned_to", profileId).neq("service_status", "encerrada"),
        base().is("assigned_to", null).neq("service_status", "encerrada"),
        base().in("service_status", ["aberta", "aguardando_equipe"]),
        base().eq("service_status", "aguardando_cliente"),
        base().eq("service_status", "encerrada"),
      ]);

      const counts: QueueCounts = {
        all: all.count ?? 0,
        mine: mine.count ?? 0,
        unassigned: unassigned.count ?? 0,
        waiting_service: waitingService.count ?? 0,
        waiting_client: waitingClient.count ?? 0,
        closed: closed.count ?? 0,
      };

      let query = ctx.supabase
        .from("whatsapp_conversations")
        .select(
          "id, status, service_status, ai_enabled, unread_count, last_message_at, assigned_to, assignee:assigned_to(name), contact:contact_id(id, phone_number, name, profile_name)",
        )
        .eq("office_id", officeId)
        .order("last_message_at", { ascending: false })
        .limit(100);

      if (data.view === "mine") query = query.eq("assigned_to", profileId).neq("service_status", "encerrada");
      if (data.view === "unassigned") query = query.is("assigned_to", null).neq("service_status", "encerrada");
      if (data.view === "waiting_service") query = query.in("service_status", ["aberta", "aguardando_equipe"]);
      if (data.view === "waiting_client") query = query.eq("service_status", "aguardando_cliente");
      if (data.view === "closed") query = query.eq("service_status", "encerrada");
      if (data.view === "all") query = query.neq("service_status", "encerrada");

      const { data: rows } = await query;
      let list = ((rows ?? []) as any[]).map((r) => ({
        id: r.id,
        status: r.status,
        service_status: r.service_status,
        ai_enabled: r.ai_enabled,
        unread_count: r.unread_count,
        last_message_at: r.last_message_at,
        assigned_to: r.assigned_to,
        assignee_name: r.assignee?.name ?? null,
        contact: r.contact ?? null,
        last_message: null,
      })) as ConversationRow[];

      const term = data.search.trim().toLowerCase();
      if (term) {
        const { data: hits } = await ctx.supabase
          .from("whatsapp_messages")
          .select("conversation_id")
          .eq("office_id", officeId)
          .ilike("content", `%${term}%`)
          .limit(200);
        const ids = new Set((hits ?? []).map((h: { conversation_id: string }) => h.conversation_id));
        list = list.filter(
          (c) =>
            ids.has(c.id) ||
            (c.contact?.name ?? "").toLowerCase().includes(term) ||
            (c.contact?.profile_name ?? "").toLowerCase().includes(term) ||
            (c.contact?.phone_number ?? "").includes(term),
        );
      }

      const ids = list.map((c) => c.id);
      if (ids.length) {
        const { data: recent } = await ctx.supabase
          .from("whatsapp_messages")
          .select("conversation_id, content, direction, created_at")
          .eq("office_id", officeId)
          .in("conversation_id", ids)
          .order("created_at", { ascending: false })
          .limit(400);
        const lastByConv = new Map<string, { content: string; direction: "inbound" | "outbound" }>();
        for (const m of recent ?? []) {
          if (!lastByConv.has(m.conversation_id)) {
            lastByConv.set(m.conversation_id, { content: m.content, direction: m.direction });
          }
        }
        list = list.map((c) => ({ ...c, last_message: lastByConv.get(c.id) ?? null }));
      }

      return { conversations: list, counts, profileId };
    },
  );

// ------------------------------------------------------- detalhe da conversa

export const getConversationDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ conversationId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<ConversationDetail> => {
    const ctx = context as unknown as Ctx;
    const { officeId } = await getContextOffice(ctx);
    const conversation = await loadConversation(ctx, officeId, data.conversationId);

    const [{ data: assignee }, { data: lead }, { data: events }, { data: notes }] =
      await Promise.all([
        conversation.assigned_to
          ? ctx.supabase.from("profiles").select("name").eq("id", conversation.assigned_to).maybeSingle()
          : Promise.resolve({ data: null }),
        ctx.supabase
          .from("leads")
          .select("id, lead_score, lead_temperature, practice_area, qualification_status, score_reason")
          .eq("office_id", officeId)
          .eq("whatsapp_conversation_id", data.conversationId)
          .maybeSingle(),
        ctx.supabase
          .from("conversation_events")
          .select("id, event_type, description, created_at, actor:actor_profile_id(name)")
          .eq("office_id", officeId)
          .eq("conversation_id", data.conversationId)
          .order("created_at", { ascending: false })
          .limit(50),
        ctx.supabase
          .from("conversation_notes")
          .select("id, content, created_at, author:author_profile_id(name)")
          .eq("office_id", officeId)
          .eq("conversation_id", data.conversationId)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

    return {
      id: conversation.id,
      service_status: conversation.service_status,
      status: conversation.status,
      ai_enabled: conversation.ai_enabled,
      assigned_to: conversation.assigned_to,
      assignee_name: assignee?.name ?? null,
      assigned_at: conversation.assigned_at ?? null,
      closed_at: conversation.closed_at ?? null,
      contact: conversation.contact ?? null,
      lead: (lead as ConversationDetail["lead"]) ?? null,
      events: ((events ?? []) as any[]).map((e) => ({
        id: e.id,
        event_type: e.event_type,
        description: e.description,
        created_at: e.created_at,
        actor_name: e.actor?.name ?? null,
      })),
      notes: ((notes ?? []) as any[]).map((n) => ({
        id: n.id,
        content: n.content,
        created_at: n.created_at,
        author_name: n.author?.name ?? null,
      })),
    };
  });

// --------------------------------------------------------------- equipe

export const listServiceTeam = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TeamMember[]> => {
    const ctx = context as unknown as Ctx;
    const { officeId } = await getContextOffice(ctx);

    const { data: members } = await ctx.supabase
      .from("profiles")
      .select("id, name, role, last_seen_at, max_concurrent_conversations, status")
      .eq("office_id", officeId)
      .eq("status", "active")
      .order("name", { ascending: true });

    const { data: active } = await ctx.supabase
      .from("whatsapp_conversations")
      .select("assigned_to")
      .eq("office_id", officeId)
      .eq("service_status", "em_atendimento")
      .not("assigned_to", "is", null);

    const load = new Map<string, number>();
    for (const row of active ?? []) {
      load.set(row.assigned_to, (load.get(row.assigned_to) ?? 0) + 1);
    }

    const now = Date.now();
    return ((members ?? []) as any[]).map((m) => {
      const seen = m.last_seen_at ? new Date(m.last_seen_at).getTime() : 0;
      const activeCount = load.get(m.id) ?? 0;
      let presence: TeamMember["presence"] = "offline";
      if (now - seen <= ONLINE_WINDOW_MS) presence = activeCount > 0 ? "busy" : "online";
      else if (now - seen <= BUSY_WINDOW_MS) presence = "busy";
      return {
        id: m.id,
        name: m.name,
        role: m.role,
        presence,
        active_conversations: activeCount,
        max_concurrent_conversations: m.max_concurrent_conversations ?? null,
        last_seen_at: m.last_seen_at ?? null,
      };
    });
  });

// ------------------------------------------------------------- atribuição

/**
 * Assumir atendimento — atômico.
 * O UPDATE só acontece se a conversa continuar livre (assigned_to IS NULL),
 * então dois atendentes simultâneos nunca produzem atribuição dupla.
 */
export const claimConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ conversationId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { officeId, profileId, name } = await getContextOffice(ctx);
    const conversation = await loadConversation(ctx, officeId, data.conversationId);

    if (conversation.assigned_to === profileId) {
      return { ok: true as const, alreadyMine: true as const };
    }

    const now = new Date().toISOString();
    const { data: updated } = await ctx.supabase
      .from("whatsapp_conversations")
      .update({
        assigned_to: profileId,
        assigned_at: now,
        status: "human",
        ai_enabled: false,
        service_status: "em_atendimento",
        handed_off_at: now,
      })
      .eq("id", data.conversationId)
      .eq("office_id", officeId)
      .is("assigned_to", null)
      .select("id");

    if (!updated || updated.length === 0) {
      const { data: current } = await ctx.supabase
        .from("whatsapp_conversations")
        .select("assignee:assigned_to(name)")
        .eq("id", data.conversationId)
        .eq("office_id", officeId)
        .maybeSingle();
      return {
        ok: false as const,
        code: "ALREADY_TAKEN" as const,
        assignee: current?.assignee?.name ?? null,
      };
    }

    await ctx.supabase.from("conversation_assignments").insert({
      office_id: officeId,
      conversation_id: data.conversationId,
      assigned_to: profileId,
      assigned_by: profileId,
      assigned_at: now,
    });
    await logEvent(ctx, {
      officeId,
      conversationId: data.conversationId,
      actorProfileId: profileId,
      eventType: "assumed",
      description: `${name} assumiu o atendimento.`,
    });
    return { ok: true as const, alreadyMine: false as const };
  });

export const transferConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        conversationId: z.string().uuid(),
        targetProfileId: z.string().uuid(),
        reason: z.string().max(300).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { officeId, profileId, name, role } = await getContextOffice(ctx);
    const conversation = await loadConversation(ctx, officeId, data.conversationId);

    const isManager = role === "owner" || role === "admin";
    if (conversation.assigned_to && conversation.assigned_to !== profileId && !isManager) {
      return { ok: false as const, code: "FORBIDDEN" as const };
    }

    const { data: target } = await ctx.supabase
      .from("profiles")
      .select("id, name")
      .eq("id", data.targetProfileId)
      .eq("office_id", officeId)
      .eq("status", "active")
      .maybeSingle();
    if (!target) return { ok: false as const, code: "INVALID_TARGET" as const };

    const now = new Date().toISOString();
    const guard = ctx.supabase
      .from("whatsapp_conversations")
      .update({
        assigned_to: target.id,
        assigned_at: now,
        status: "human",
        ai_enabled: false,
        service_status: "em_atendimento",
      })
      .eq("id", data.conversationId)
      .eq("office_id", officeId);

    const { data: updated } = await (conversation.assigned_to
      ? guard.eq("assigned_to", conversation.assigned_to)
      : guard.is("assigned_to", null)
    ).select("id");

    if (!updated || updated.length === 0) {
      return { ok: false as const, code: "CONFLICT" as const };
    }

    await ctx.supabase
      .from("conversation_assignments")
      .update({ unassigned_at: now })
      .eq("conversation_id", data.conversationId)
      .is("unassigned_at", null);
    await ctx.supabase.from("conversation_assignments").insert({
      office_id: officeId,
      conversation_id: data.conversationId,
      assigned_to: target.id,
      assigned_by: profileId,
      assigned_at: now,
      transfer_reason: data.reason ?? null,
    });
    await logEvent(ctx, {
      officeId,
      conversationId: data.conversationId,
      actorProfileId: profileId,
      eventType: "transferred",
      description: `${name} transferiu a conversa para ${target.name}.`,
      metadata: { to: target.id, reason: data.reason ?? null },
    });
    await notify(ctx, {
      officeId,
      profileId: target.id,
      conversationId: data.conversationId,
      type: "conversation_transferred",
      title: `Conversa transferida por ${name}`,
      body: data.reason ?? null,
    });
    return { ok: true as const, assignee: target.name };
  });

export const releaseConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ conversationId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { officeId, profileId, name, role } = await getContextOffice(ctx);
    const conversation = await loadConversation(ctx, officeId, data.conversationId);
    const isManager = role === "owner" || role === "admin";
    if (conversation.assigned_to && conversation.assigned_to !== profileId && !isManager) {
      return { ok: false as const, code: "FORBIDDEN" as const };
    }

    await ctx.supabase
      .from("whatsapp_conversations")
      .update({
        assigned_to: null,
        assigned_at: null,
        service_status: "aberta",
        status: "waiting_human",
      })
      .eq("id", data.conversationId)
      .eq("office_id", officeId);

    await ctx.supabase
      .from("conversation_assignments")
      .update({ unassigned_at: new Date().toISOString() })
      .eq("conversation_id", data.conversationId)
      .is("unassigned_at", null);

    await logEvent(ctx, {
      officeId,
      conversationId: data.conversationId,
      actorProfileId: profileId,
      eventType: "returned_to_queue",
      description: `${name} devolveu a conversa para a fila.`,
    });
    return { ok: true as const };
  });

export const returnConversationToAi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ conversationId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { officeId, profileId, name } = await getContextOffice(ctx);
    await loadConversation(ctx, officeId, data.conversationId);

    await ctx.supabase
      .from("whatsapp_conversations")
      .update({
        assigned_to: null,
        assigned_at: null,
        status: "ai",
        ai_enabled: true,
        service_status: "aberta",
        handed_off_at: null,
      })
      .eq("id", data.conversationId)
      .eq("office_id", officeId);

    await ctx.supabase
      .from("conversation_assignments")
      .update({ unassigned_at: new Date().toISOString() })
      .eq("conversation_id", data.conversationId)
      .is("unassigned_at", null);

    await logEvent(ctx, {
      officeId,
      conversationId: data.conversationId,
      actorProfileId: profileId,
      eventType: "ai_enabled",
      description: `${name} devolveu o atendimento para a IA.`,
    });
    return { ok: true as const };
  });

const statusSchema = z.object({
  conversationId: z.string().uuid(),
  serviceStatus: z.enum([
    "aberta",
    "em_atendimento",
    "aguardando_cliente",
    "aguardando_equipe",
    "encerrada",
  ]),
});

export const setConversationServiceStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => statusSchema.parse(input))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { officeId, profileId, name } = await getContextOffice(ctx);
    await loadConversation(ctx, officeId, data.conversationId);

    const closing = data.serviceStatus === "encerrada";
    const patch: Record<string, unknown> = { service_status: data.serviceStatus };
    if (closing) {
      patch['status'] = "closed";
      patch['ai_enabled'] = false;
      patch['closed_at'] = new Date().toISOString();
      patch['closed_by'] = profileId;
    }

    const { error } = await ctx.supabase
      .from("whatsapp_conversations")
      .update(patch)
      .eq("id", data.conversationId)
      .eq("office_id", officeId);
    if (error) throw new Error("UPDATE_ERROR");

    await logEvent(ctx, {
      officeId,
      conversationId: data.conversationId,
      actorProfileId: profileId,
      eventType: closing ? "closed" : "status_changed",
      description: closing
        ? `${name} encerrou o atendimento.`
        : `${name} alterou o status para ${data.serviceStatus.replace("_", " ")}.`,
      metadata: { service_status: data.serviceStatus },
    });
    return { ok: true as const };
  });

// ---------------------------------------------------------- notas internas

export const createInternalNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ conversationId: z.string().uuid(), content: z.string().min(1).max(2000) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { officeId, profileId, name } = await getContextOffice(ctx);
    await loadConversation(ctx, officeId, data.conversationId);

    const { error } = await ctx.supabase.from("conversation_notes").insert({
      office_id: officeId,
      conversation_id: data.conversationId,
      author_profile_id: profileId,
      content: data.content,
    });
    if (error) throw new Error("NOTE_ERROR");

    await logEvent(ctx, {
      officeId,
      conversationId: data.conversationId,
      actorProfileId: profileId,
      eventType: "note_created",
      description: `${name} adicionou uma nota interna.`,
    });
    return { ok: true as const };
  });

// ---------------------------------------------------------- notificações

export interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string | null;
  conversation_id: string | null;
  read_at: string | null;
  created_at: string;
}

export const listNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<NotificationRow[]> => {
    const ctx = context as unknown as Ctx;
    const { officeId, profileId } = await getContextOffice(ctx);
    await touchPresence(ctx, profileId);
    const { data } = await ctx.supabase
      .from("notifications")
      .select("id, type, title, body, conversation_id, read_at, created_at")
      .eq("office_id", officeId)
      .order("created_at", { ascending: false })
      .limit(30);
    return (data ?? []) as NotificationRow[];
  });

export const markNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as unknown as Ctx;
    const { officeId } = await getContextOffice(ctx);
    await ctx.supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("office_id", officeId)
      .is("read_at", null);
    return { ok: true as const };
  });
