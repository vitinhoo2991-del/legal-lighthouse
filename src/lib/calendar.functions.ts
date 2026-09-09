// Etapa 07 — Agenda inteligente.
// Eventos reais persistidos em calendar_events, isolados por office_id.
// Conflitos de horário são verificados no banco (advisory lock + checagem atômica).
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type EventType =
  | "consulta"
  | "reuniao"
  | "atendimento"
  | "audiencia"
  | "retorno"
  | "ligacao"
  | "videoconferencia"
  | "prazo"
  | "tarefa"
  | "outro";

export type EventStatus =
  | "agendado"
  | "confirmado"
  | "em_andamento"
  | "concluido"
  | "cancelado"
  | "nao_compareceu";

export type EventPriority = "baixa" | "media" | "alta" | "urgente";

export const EVENT_TYPE_LABEL: Record<EventType, string> = {
  consulta: "Consulta",
  reuniao: "Reunião",
  atendimento: "Atendimento",
  audiencia: "Audiência",
  retorno: "Retorno",
  ligacao: "Ligação",
  videoconferencia: "Videoconferência",
  prazo: "Prazo",
  tarefa: "Tarefa",
  outro: "Outro",
};

export const EVENT_STATUS_LABEL: Record<EventStatus, string> = {
  agendado: "Agendado",
  confirmado: "Confirmado",
  em_andamento: "Em andamento",
  concluido: "Concluído",
  cancelado: "Cancelado",
  nao_compareceu: "Não compareceu",
};

export const REMINDER_OPTIONS = [
  { value: 0, label: "No momento" },
  { value: 5, label: "5 minutos antes" },
  { value: 15, label: "15 minutos antes" },
  { value: 30, label: "30 minutos antes" },
  { value: 60, label: "1 hora antes" },
  { value: 1440, label: "1 dia antes" },
];

export interface CalendarEventRow {
  id: string;
  title: string;
  description: string | null;
  event_type: EventType;
  status: EventStatus;
  is_deadline: boolean;
  priority: EventPriority;
  start_at: string;
  end_at: string;
  all_day: boolean;
  location: string | null;
  meeting_url: string | null;
  process_reference: string | null;
  lead_id: string | null;
  contact_id: string | null;
  opportunity_id: string | null;
  conversation_id: string | null;
  assigned_to: string | null;
  assigned_name: string | null;
  created_by: string | null;
  created_name: string | null;
  cancel_reason: string | null;
  cancelled_at: string | null;
  completed_at: string | null;
  version: number;
  created_at: string;
  lead_name?: string | null;
  contact_name?: string | null;
  opportunity_title?: string | null;
}

export interface CalendarStats {
  hoje: number;
  proximos: number;
  pendentes: number;
  atrasados: number;
  cancelados: number;
}

type Ctx = { supabase: any; userId: string };

const SELECT =
  "id, title, description, event_type, status, is_deadline, priority, start_at, end_at, all_day, location, meeting_url, process_reference, lead_id, contact_id, opportunity_id, conversation_id, assigned_to, created_by, cancel_reason, cancelled_at, completed_at, version, created_at, assignee:assigned_to(name), creator:created_by(name), lead:lead_id(name), contact:contact_id(name, phone_number), opportunity:opportunity_id(title)";

function mapEvent(row: any): CalendarEventRow {
  return {
    ...row,
    assigned_name: row.assignee?.name ?? null,
    created_name: row.creator?.name ?? null,
    lead_name: row.lead?.name ?? null,
    contact_name: row.contact?.name ?? row.contact?.phone_number ?? null,
    opportunity_title: row.opportunity?.title ?? null,
  } as CalendarEventRow;
}

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

function isManager(role: string) {
  return role === "owner" || role === "admin";
}

/** Gestores editam qualquer evento; demais perfis só os próprios (criados por ou atribuídos a si). */
function assertCanEdit(
  role: string,
  profileId: string,
  event: { assigned_to: string | null; created_by: string | null },
) {
  if (isManager(role)) return;
  if (event.assigned_to === profileId || event.created_by === profileId) return;
  throw new Error("FORBIDDEN");
}

async function audit(
  ctx: Ctx,
  args: {
    officeId: string;
    profileId: string | null;
    action: string;
    eventId: string;
    metadata?: Record<string, unknown>;
  },
) {
  await ctx.supabase.from("audit_logs").insert({
    office_id: args.officeId,
    actor_profile_id: args.profileId,
    action: args.action,
    entity: "calendar_events",
    entity_id: args.eventId,
    metadata: args.metadata ?? {},
  });
}

async function notify(
  ctx: Ctx,
  args: {
    officeId: string;
    profileId: string | null;
    eventId: string;
    type: string;
    title: string;
    body?: string | null;
  },
) {
  if (!args.profileId) return;
  await ctx.supabase.from("notifications").insert({
    office_id: args.officeId,
    profile_id: args.profileId,
    event_id: args.eventId,
    type: args.type,
    title: args.title,
    body: args.body ?? null,
  });
}

async function syncReminders(
  ctx: Ctx,
  args: {
    officeId: string;
    eventId: string;
    profileId: string | null;
    startAt: string;
    reminders: number[];
  },
) {
  await ctx.supabase.from("calendar_reminders").delete().eq("event_id", args.eventId);
  if (!args.reminders.length || !args.profileId) return;
  const start = new Date(args.startAt).getTime();
  const rows = args.reminders.map((minutes) => ({
    office_id: args.officeId,
    event_id: args.eventId,
    profile_id: args.profileId,
    minutes_before: minutes,
    remind_at: new Date(start - minutes * 60_000).toISOString(),
  }));
  await ctx.supabase.from("calendar_reminders").insert(rows);
}

/* ------------------------------- Leitura -------------------------------- */

const listSchema = z.object({
  from: z.string(),
  to: z.string(),
  assignedTo: z.string().uuid().optional(),
  onlyMine: z.boolean().default(false),
  type: z.string().optional(),
  status: z.string().optional(),
  leadId: z.string().uuid().optional(),
  contactId: z.string().uuid().optional(),
  opportunityId: z.string().uuid().optional(),
  search: z.string().max(120).optional(),
});

export const listCalendarEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => listSchema.parse(input))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { officeId, profileId, role } = await getContextOffice(ctx);

    let query = ctx.supabase
      .from("calendar_events")
      .select(SELECT)
      .eq("office_id", officeId)
      .gte("start_at", data.from)
      .lte("start_at", data.to)
      .order("start_at", { ascending: true })
      .limit(500);

    if (data.onlyMine) query = query.eq("assigned_to", profileId);
    else if (data.assignedTo) query = query.eq("assigned_to", data.assignedTo);
    if (data.type && data.type !== "todos") query = query.eq("event_type", data.type);
    if (data.status && data.status !== "todos") query = query.eq("status", data.status);
    if (data.leadId) query = query.eq("lead_id", data.leadId);
    if (data.contactId) query = query.eq("contact_id", data.contactId);
    if (data.opportunityId) query = query.eq("opportunity_id", data.opportunityId);
    if (data.search) {
      const term = data.search.replace(/[%,]/g, " ").trim();
      if (term) query = query.or(`title.ilike.%${term}%,description.ilike.%${term}%`);
    }

    const { data: rows, error } = await query;
    if (error) throw new Error("LIST_ERROR");

    // Indicadores calculados a partir do banco (janela ampla, independente da visualização).
    const nowIso = new Date().toISOString();
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const base = () => ctx.supabase.from("calendar_events").select("id", { count: "exact", head: true }).eq("office_id", officeId);

    const [hoje, proximos, pendentes, atrasados, cancelados] = await Promise.all([
      base().gte("start_at", dayStart.toISOString()).lt("start_at", dayEnd.toISOString()).neq("status", "cancelado"),
      base().gt("start_at", nowIso).in("status", ["agendado", "confirmado"]),
      base().in("status", ["agendado", "confirmado"]),
      base().lt("end_at", nowIso).in("status", ["agendado", "confirmado", "em_andamento"]),
      base().eq("status", "cancelado"),
    ]);

    const stats: CalendarStats = {
      hoje: hoje.count ?? 0,
      proximos: proximos.count ?? 0,
      pendentes: pendentes.count ?? 0,
      atrasados: atrasados.count ?? 0,
      cancelados: cancelados.count ?? 0,
    };

    return {
      events: (rows ?? []).map(mapEvent),
      stats,
      me: { profileId, role, isManager: isManager(role) },
    };
  });

export const getCalendarEvent = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ eventId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { officeId, profileId, role } = await getContextOffice(ctx);

    const { data: row } = await ctx.supabase
      .from("calendar_events")
      .select(SELECT)
      .eq("office_id", officeId)
      .eq("id", data.eventId)
      .maybeSingle();
    if (!row) throw new Error("NOT_FOUND");

    const [{ data: participants }, { data: reminders }, { data: history }] = await Promise.all([
      ctx.supabase
        .from("calendar_event_participants")
        .select("id, profile_id, external_name, external_email, external_phone, profile:profile_id(name)")
        .eq("event_id", data.eventId),
      ctx.supabase
        .from("calendar_reminders")
        .select("id, minutes_before, remind_at, sent_at")
        .eq("event_id", data.eventId)
        .order("minutes_before"),
      ctx.supabase
        .from("audit_logs")
        .select("id, action, metadata, created_at, actor:actor_profile_id(name)")
        .eq("office_id", officeId)
        .eq("entity", "calendar_events")
        .eq("entity_id", data.eventId)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

    return {
      event: mapEvent(row),
      participants: (participants ?? []).map((p: any) => ({
        id: p.id,
        name: p.profile?.name ?? p.external_name ?? p.external_email ?? p.external_phone ?? "Convidado",
        isTeam: Boolean(p.profile_id),
      })),
      reminders: reminders ?? [],
      history: (history ?? []).map((h: any) => ({
        id: h.id,
        action: h.action,
        metadata: h.metadata ?? {},
        created_at: h.created_at,
        actor_name: h.actor?.name ?? null,
      })),
      canEdit: isManager(role) || row.assigned_to === profileId || row.created_by === profileId,
    };
  });

/** Próximos compromissos de um lead / oportunidade / conversa (usado nas outras telas). */
export const listRelatedEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        leadId: z.string().uuid().optional(),
        opportunityId: z.string().uuid().optional(),
        conversationId: z.string().uuid().optional(),
        contactId: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { officeId } = await getContextOffice(ctx);

    let query = ctx.supabase
      .from("calendar_events")
      .select(SELECT)
      .eq("office_id", officeId)
      .neq("status", "cancelado")
      .gte("end_at", new Date().toISOString())
      .order("start_at", { ascending: true })
      .limit(5);

    if (data.leadId) query = query.eq("lead_id", data.leadId);
    else if (data.opportunityId) query = query.eq("opportunity_id", data.opportunityId);
    else if (data.conversationId) query = query.eq("conversation_id", data.conversationId);
    else if (data.contactId) query = query.eq("contact_id", data.contactId);
    else return [];

    const { data: rows } = await query;
    return (rows ?? []).map(mapEvent);
  });

/* ------------------------------- Escrita -------------------------------- */

const eventTypeEnum = z.enum([
  "consulta",
  "reuniao",
  "atendimento",
  "audiencia",
  "retorno",
  "ligacao",
  "videoconferencia",
  "prazo",
  "tarefa",
  "outro",
]);

const createSchema = z.object({
  title: z.string().min(2).max(160),
  description: z.string().max(4000).optional(),
  event_type: eventTypeEnum.default("consulta"),
  is_deadline: z.boolean().default(false),
  priority: z.enum(["baixa", "media", "alta", "urgente"]).default("media"),
  start_at: z.string(),
  end_at: z.string(),
  all_day: z.boolean().default(false),
  location: z.string().max(200).optional(),
  meeting_url: z.string().max(400).optional(),
  process_reference: z.string().max(160).optional(),
  lead_id: z.string().uuid().optional().nullable(),
  contact_id: z.string().uuid().optional().nullable(),
  opportunity_id: z.string().uuid().optional().nullable(),
  conversation_id: z.string().uuid().optional().nullable(),
  assigned_to: z.string().uuid().optional().nullable(),
  participants: z.array(z.string().uuid()).default([]),
  reminders: z.array(z.number().int().min(0).max(10080)).default([]),
  allowConflict: z.boolean().default(false),
});

export const createCalendarEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createSchema.parse(input))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { officeId, profileId, name } = await getContextOffice(ctx);

    if (new Date(data.end_at) <= new Date(data.start_at)) throw new Error("INVALID_RANGE");

    // Responsável precisa ser do mesmo escritório (RLS + verificação explícita).
    if (data.assigned_to) {
      const { data: member } = await ctx.supabase
        .from("profiles")
        .select("id")
        .eq("office_id", officeId)
        .eq("id", data.assigned_to)
        .maybeSingle();
      if (!member) throw new Error("INVALID_ASSIGNEE");
    }

    const { data: result, error } = await ctx.supabase.rpc("calendar_create_event", {
      _payload: {
        office_id: officeId,
        title: data.title,
        description: data.description ?? "",
        event_type: data.event_type,
        is_deadline: data.is_deadline,
        priority: data.priority,
        start_at: data.start_at,
        end_at: data.end_at,
        all_day: data.all_day,
        location: data.location ?? "",
        meeting_url: data.meeting_url ?? "",
        process_reference: data.process_reference ?? "",
        lead_id: data.lead_id ?? "",
        contact_id: data.contact_id ?? "",
        opportunity_id: data.opportunity_id ?? "",
        conversation_id: data.conversation_id ?? "",
        assigned_to: data.assigned_to ?? "",
        created_by: profileId,
      },
      _allow_conflict: data.allowConflict,
    });
    if (error) throw new Error(error.message?.includes("INVALID_RANGE") ? "INVALID_RANGE" : "CREATE_ERROR");

    if (!result?.event) {
      return { conflict: result?.conflict ?? [], event: null };
    }

    const event = result.event;

    if (data.participants.length) {
      await ctx.supabase.from("calendar_event_participants").insert(
        data.participants.map((pid) => ({
          office_id: officeId,
          event_id: event.id,
          profile_id: pid,
        })),
      );
    }

    await syncReminders(ctx, {
      officeId,
      eventId: event.id,
      profileId: data.assigned_to ?? profileId,
      startAt: data.start_at,
      reminders: data.reminders,
    });

    await audit(ctx, {
      officeId,
      profileId,
      action: "calendar.event_created",
      eventId: event.id,
      metadata: { title: data.title, start_at: data.start_at, assigned_to: data.assigned_to ?? null },
    });

    if (data.assigned_to && data.assigned_to !== profileId) {
      await notify(ctx, {
        officeId,
        profileId: data.assigned_to,
        eventId: event.id,
        type: "event_assigned",
        title: "Novo compromisso atribuído",
        body: `${name} agendou "${data.title}".`,
      });
    }

    return { conflict: result?.conflict ?? [], event: mapEvent(event) };
  });

const updateSchema = z.object({
  eventId: z.string().uuid(),
  expectedVersion: z.number().int(),
  title: z.string().min(2).max(160).optional(),
  description: z.string().max(4000).nullable().optional(),
  event_type: eventTypeEnum.optional(),
  is_deadline: z.boolean().optional(),
  priority: z.enum(["baixa", "media", "alta", "urgente"]).optional(),
  start_at: z.string().optional(),
  end_at: z.string().optional(),
  all_day: z.boolean().optional(),
  location: z.string().max(200).nullable().optional(),
  meeting_url: z.string().max(400).nullable().optional(),
  process_reference: z.string().max(160).nullable().optional(),
  assigned_to: z.string().uuid().nullable().optional(),
  reminders: z.array(z.number().int().min(0).max(10080)).optional(),
  allowConflict: z.boolean().default(false),
});

export const updateCalendarEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { officeId, profileId, role, name } = await getContextOffice(ctx);

    const { data: current } = await ctx.supabase
      .from("calendar_events")
      .select("*")
      .eq("office_id", officeId)
      .eq("id", data.eventId)
      .maybeSingle();
    if (!current) throw new Error("NOT_FOUND");
    assertCanEdit(role, profileId, current);

    const startAt = data.start_at ?? current.start_at;
    const endAt = data.end_at ?? current.end_at;
    if (new Date(endAt) <= new Date(startAt)) throw new Error("INVALID_RANGE");

    const assigned = data.assigned_to === undefined ? current.assigned_to : data.assigned_to;
    if (assigned) {
      const { data: member } = await ctx.supabase
        .from("profiles")
        .select("id")
        .eq("office_id", officeId)
        .eq("id", assigned)
        .maybeSingle();
      if (!member) throw new Error("INVALID_ASSIGNEE");
    }

    const timeChanged = startAt !== current.start_at || endAt !== current.end_at;
    const assigneeChanged = assigned !== current.assigned_to;

    if (assigned && (timeChanged || assigneeChanged) && !data.allowConflict) {
      const { data: conflicts } = await ctx.supabase.rpc("calendar_check_conflict", {
        _office_id: officeId,
        _assigned_to: assigned,
        _start_at: startAt,
        _end_at: endAt,
        _ignore_event_id: data.eventId,
      });
      if (conflicts && conflicts.length) return { conflict: conflicts, event: null };
    }

    const patch: Record<string, unknown> = { version: current.version + 1 };
    for (const key of [
      "title",
      "description",
      "event_type",
      "is_deadline",
      "priority",
      "all_day",
      "location",
      "meeting_url",
      "process_reference",
    ] as const) {
      if (data[key] !== undefined) patch[key] = data[key];
    }
    if (data.start_at !== undefined) patch["start_at"] = data.start_at;
    if (data.end_at !== undefined) patch["end_at"] = data.end_at;
    if (data.assigned_to !== undefined) patch["assigned_to"] = data.assigned_to;

    const { data: updated, error } = await ctx.supabase
      .from("calendar_events")
      .update(patch)
      .eq("office_id", officeId)
      .eq("id", data.eventId)
      .eq("version", data.expectedVersion)
      .select("id, version")
      .maybeSingle();

    if (error) throw new Error("UPDATE_ERROR");
    if (!updated) throw new Error("VERSION_CONFLICT");

    if (data.reminders) {
      await syncReminders(ctx, {
        officeId,
        eventId: data.eventId,
        profileId: assigned ?? profileId,
        startAt,
        reminders: data.reminders,
      });
    }

    await audit(ctx, {
      officeId,
      profileId,
      action: timeChanged ? "calendar.event_rescheduled" : "calendar.event_updated",
      eventId: data.eventId,
      metadata: {
        from: { start_at: current.start_at, end_at: current.end_at, assigned_to: current.assigned_to },
        to: { start_at: startAt, end_at: endAt, assigned_to: assigned },
      },
    });

    if (assigneeChanged && assigned && assigned !== profileId) {
      await notify(ctx, {
        officeId,
        profileId: assigned,
        eventId: data.eventId,
        type: "event_assigned",
        title: "Compromisso transferido para você",
        body: `${name} transferiu "${current.title}".`,
      });
    } else if (timeChanged && assigned && assigned !== profileId) {
      await notify(ctx, {
        officeId,
        profileId: assigned,
        eventId: data.eventId,
        type: "event_updated",
        title: "Horário alterado",
        body: `${name} reagendou "${current.title}".`,
      });
    }

    return { conflict: [], event: { id: data.eventId, version: updated.version } };
  });

export const setCalendarEventStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        eventId: z.string().uuid(),
        expectedVersion: z.number().int(),
        status: z.enum([
          "agendado",
          "confirmado",
          "em_andamento",
          "concluido",
          "cancelado",
          "nao_compareceu",
        ]),
        reason: z.string().max(400).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { officeId, profileId, role, name } = await getContextOffice(ctx);

    const { data: current } = await ctx.supabase
      .from("calendar_events")
      .select("id, title, status, version, assigned_to, created_by")
      .eq("office_id", officeId)
      .eq("id", data.eventId)
      .maybeSingle();
    if (!current) throw new Error("NOT_FOUND");
    assertCanEdit(role, profileId, current);

    const patch: Record<string, unknown> = { status: data.status, version: current.version + 1 };
    if (data.status === "cancelado") {
      patch["cancelled_at"] = new Date().toISOString();
      patch["cancelled_by"] = profileId;
      patch["cancel_reason"] = data.reason ?? null;
    } else {
      patch["cancelled_at"] = null;
      patch["cancelled_by"] = null;
      patch["cancel_reason"] = null;
    }
    patch["completed_at"] = data.status === "concluido" ? new Date().toISOString() : null;

    const { data: updated } = await ctx.supabase
      .from("calendar_events")
      .update(patch)
      .eq("office_id", officeId)
      .eq("id", data.eventId)
      .eq("version", data.expectedVersion)
      .select("id, version")
      .maybeSingle();
    if (!updated) throw new Error("VERSION_CONFLICT");

    await audit(ctx, {
      officeId,
      profileId,
      action: "calendar.event_status_changed",
      eventId: data.eventId,
      metadata: { from: current.status, to: data.status, reason: data.reason ?? null },
    });

    if (data.status === "cancelado" && current.assigned_to && current.assigned_to !== profileId) {
      await notify(ctx, {
        officeId,
        profileId: current.assigned_to,
        eventId: data.eventId,
        type: "event_cancelled",
        title: "Compromisso cancelado",
        body: `${name} cancelou "${current.title}".`,
      });
    }

    return { version: updated.version };
  });

/** Converte lembretes vencidos em notificações reais do JurisIA. */
export const dispatchDueReminders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as unknown as Ctx;
    const { officeId } = await getContextOffice(ctx);

    const { data: due } = await ctx.supabase
      .from("calendar_reminders")
      .select("id, profile_id, event_id, minutes_before, event:event_id(title, start_at, status)")
      .eq("office_id", officeId)
      .is("sent_at", null)
      .lte("remind_at", new Date().toISOString())
      .limit(50);

    if (!due?.length) return { dispatched: 0 };

    let dispatched = 0;
    for (const reminder of due) {
      const event = reminder.event;
      if (event && event.status !== "cancelado" && reminder.profile_id) {
        await notify(ctx, {
          officeId,
          profileId: reminder.profile_id,
          eventId: reminder.event_id,
          type: "event_reminder",
          title: "Lembrete de compromisso",
          body: `${event.title} — ${new Date(event.start_at).toLocaleString("pt-BR")}`,
        });
        dispatched += 1;
      }
      await ctx.supabase
        .from("calendar_reminders")
        .update({ sent_at: new Date().toISOString() })
        .eq("id", reminder.id);
    }

    return { dispatched };
  });

/** Opções reais de vínculo para o formulário (somente do escritório atual). */
export const listCalendarLinkOptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as unknown as Ctx;
    const { officeId } = await getContextOffice(ctx);

    const [team, leads, contacts, opportunities] = await Promise.all([
      ctx.supabase.from("profiles").select("id, name").eq("office_id", officeId).order("name"),
      ctx.supabase
        .from("leads")
        .select("id, name, phone, contact_id")
        .eq("office_id", officeId)
        .order("last_interaction_at", { ascending: false })
        .limit(100),
      ctx.supabase
        .from("whatsapp_contacts")
        .select("id, name, phone_number")
        .eq("office_id", officeId)
        .order("updated_at", { ascending: false })
        .limit(100),
      ctx.supabase
        .from("crm_opportunities")
        .select("id, title, lead_id, contact_id")
        .eq("office_id", officeId)
        .order("last_activity_at", { ascending: false })
        .limit(100),
    ]);

    return {
      team: (team.data ?? []) as { id: string; name: string }[],
      leads: (leads.data ?? []).map((l: any) => ({
        id: l.id,
        name: l.name ?? l.phone ?? "Lead sem nome",
        contact_id: l.contact_id ?? null,
      })),
      contacts: (contacts.data ?? []).map((c: any) => ({
        id: c.id,
        name: c.name ?? c.phone_number,
      })),
      opportunities: (opportunities.data ?? []).map((o: any) => ({
        id: o.id,
        name: o.title,
        lead_id: o.lead_id ?? null,
        contact_id: o.contact_id ?? null,
      })),
    };
  });
