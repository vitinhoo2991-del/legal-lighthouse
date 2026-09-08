// Etapa 06 — CRM + Pipeline.
// Oportunidades comerciais construídas sobre os leads reais da Etapa 04.
// O Lead Score NUNCA é copiado: é sempre lido do lead vinculado.
// Toda validação é feita no servidor por office_id.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type StageKind = "aberta" | "ganha" | "perdida";
export type ActivityType =
  | "ligacao"
  | "mensagem"
  | "reuniao"
  | "consulta"
  | "proposta"
  | "observacao"
  | "tarefa";
export type ActivityStatus = "pendente" | "em_andamento" | "concluida" | "cancelada";
export type TaskPriority = "baixa" | "media" | "alta" | "urgente";

export interface StageRow {
  id: string;
  name: string;
  kind: StageKind;
  position: number;
}

export interface PipelineRow {
  id: string;
  name: string;
  is_default: boolean;
}

export interface OpportunityRow {
  id: string;
  title: string;
  description: string | null;
  stage_id: string;
  pipeline_id: string;
  estimated_value: number | null;
  currency: string;
  probability: number;
  expected_close_date: string | null;
  source: string | null;
  loss_reason: string | null;
  won_at: string | null;
  lost_at: string | null;
  last_activity_at: string;
  stage_changed_at: string;
  created_at: string;
  assigned_to: string | null;
  assigned_name: string | null;
  lead_id: string | null;
  lead_score: number | null;
  lead_temperature: string | null;
  practice_area: string | null;
  qualification_status: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  whatsapp_conversation_id: string | null;
  service_assignee_name: string | null;
  open_tasks: number;
  overdue_tasks: number;
}

export interface CrmStats {
  total: number;
  novas: number;
  emNegociacao: number;
  ganhas: number;
  perdidas: number;
  valorEstimado: number;
  /** Conversão = oportunidades ganhas / oportunidades encerradas (ganhas + perdidas). */
  conversao: number | null;
  conversaoBase: number;
}

type Ctx = { supabase: any; userId: string };

const DEFAULT_STAGES: Array<{ name: string; kind: StageKind }> = [
  { name: "Novo lead", kind: "aberta" },
  { name: "Em qualificação", kind: "aberta" },
  { name: "Contato realizado", kind: "aberta" },
  { name: "Consulta/Atendimento", kind: "aberta" },
  { name: "Proposta/Negociação", kind: "aberta" },
  { name: "Contratado", kind: "ganha" },
  { name: "Perdido", kind: "perdida" },
];

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

/** Gestores mexem em tudo; demais perfis apenas nas oportunidades próprias ou sem responsável. */
function assertCanEdit(role: string, profileId: string, opportunity: { assigned_to: string | null }) {
  if (isManager(role)) return;
  if (!opportunity.assigned_to || opportunity.assigned_to === profileId) return;
  throw new Error("FORBIDDEN");
}

async function audit(
  ctx: Ctx,
  args: {
    officeId: string;
    profileId: string | null;
    action: string;
    opportunityId: string;
    metadata?: Record<string, unknown>;
  },
) {
  await ctx.supabase.from("audit_logs").insert({
    office_id: args.officeId,
    actor_profile_id: args.profileId,
    action: args.action,
    entity: "crm_opportunities",
    entity_id: args.opportunityId,
    metadata: args.metadata ?? {},
  });
}

async function notify(
  ctx: Ctx,
  args: {
    officeId: string;
    profileId: string | null;
    opportunityId?: string | null;
    taskId?: string | null;
    type: string;
    title: string;
    body?: string | null;
  },
) {
  if (!args.profileId) return;
  await ctx.supabase.from("notifications").insert({
    office_id: args.officeId,
    profile_id: args.profileId,
    opportunity_id: args.opportunityId ?? null,
    task_id: args.taskId ?? null,
    type: args.type,
    title: args.title,
    body: args.body ?? null,
  });
}

async function history(
  ctx: Ctx,
  args: {
    officeId: string;
    opportunityId: string;
    fromStageId: string | null;
    toStageId: string | null;
    profileId: string | null;
    description: string;
    metadata?: Record<string, unknown>;
  },
) {
  await ctx.supabase.from("crm_stage_history").insert({
    office_id: args.officeId,
    opportunity_id: args.opportunityId,
    from_stage_id: args.fromStageId,
    to_stage_id: args.toStageId,
    actor_profile_id: args.profileId,
    description: args.description,
    metadata: args.metadata ?? {},
  });
}

/** Cria o pipeline padrão do escritório na primeira utilização (sem dados fictícios). */
async function ensurePipeline(ctx: Ctx, officeId: string) {
  const { data: existing } = await ctx.supabase
    .from("crm_pipelines")
    .select("id, name, is_default")
    .eq("office_id", officeId)
    .order("is_default", { ascending: false })
    .limit(1);

  let pipeline = existing?.[0] ?? null;
  if (!pipeline) {
    const { data: created, error } = await ctx.supabase
      .from("crm_pipelines")
      .insert({ office_id: officeId, name: "Pipeline comercial", is_default: true })
      .select("id, name, is_default")
      .single();
    if (error || !created) throw new Error("PIPELINE_ERROR");
    pipeline = created;
  }

  const { data: stages } = await ctx.supabase
    .from("crm_stages")
    .select("id")
    .eq("pipeline_id", pipeline.id)
    .limit(1);

  if (!stages || stages.length === 0) {
    await ctx.supabase.from("crm_stages").insert(
      DEFAULT_STAGES.map((stage, index) => ({
        office_id: officeId,
        pipeline_id: pipeline.id,
        name: stage.name,
        kind: stage.kind,
        position: index,
      })),
    );
  }
  return pipeline as PipelineRow;
}

const OPP_SELECT = `id, title, description, stage_id, pipeline_id, estimated_value, currency, probability,
  expected_close_date, source, loss_reason, won_at, lost_at, last_activity_at, stage_changed_at, created_at,
  assigned_to, lead_id,
  assignee:assigned_to(name),
  lead:lead_id(id, lead_score, lead_temperature, practice_area, qualification_status, name, phone, email,
    whatsapp_conversation_id, case_summary, score_reason, missing_information, source,
    conversation:whatsapp_conversation_id(assigned_to, assignee:assigned_to(name)))`;

function mapOpportunity(row: any, tasks: Map<string, { open: number; overdue: number }>): OpportunityRow {
  const lead = row.lead ?? null;
  const counts = tasks.get(row.id) ?? { open: 0, overdue: 0 };
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? null,
    stage_id: row.stage_id,
    pipeline_id: row.pipeline_id,
    estimated_value: row.estimated_value === null ? null : Number(row.estimated_value),
    currency: row.currency ?? "BRL",
    probability: row.probability ?? 0,
    expected_close_date: row.expected_close_date ?? null,
    source: row.source ?? lead?.source ?? null,
    loss_reason: row.loss_reason ?? null,
    won_at: row.won_at ?? null,
    lost_at: row.lost_at ?? null,
    last_activity_at: row.last_activity_at,
    stage_changed_at: row.stage_changed_at,
    created_at: row.created_at,
    assigned_to: row.assigned_to ?? null,
    assigned_name: row.assignee?.name ?? null,
    lead_id: row.lead_id ?? null,
    lead_score: lead?.lead_score ?? null,
    lead_temperature: lead?.lead_temperature ?? null,
    practice_area: lead?.practice_area ?? null,
    qualification_status: lead?.qualification_status ?? null,
    contact_name: lead?.name ?? null,
    contact_phone: lead?.phone ?? null,
    contact_email: lead?.email ?? null,
    whatsapp_conversation_id: lead?.whatsapp_conversation_id ?? null,
    service_assignee_name: lead?.conversation?.assignee?.name ?? null,
    open_tasks: counts.open,
    overdue_tasks: counts.overdue,
  };
}

async function taskCounts(ctx: Ctx, officeId: string, ids: string[]) {
  const map = new Map<string, { open: number; overdue: number }>();
  if (ids.length === 0) return map;
  const { data } = await ctx.supabase
    .from("crm_tasks")
    .select("opportunity_id, status, due_at")
    .eq("office_id", officeId)
    .in("opportunity_id", ids)
    .in("status", ["pendente", "em_andamento"]);
  const now = Date.now();
  for (const task of data ?? []) {
    const entry = map.get(task.opportunity_id) ?? { open: 0, overdue: 0 };
    entry.open += 1;
    if (task.due_at && new Date(task.due_at).getTime() < now) entry.overdue += 1;
    map.set(task.opportunity_id, entry);
  }
  return map;
}

const boardFilters = z.object({
  pipelineId: z.string().uuid().optional(),
  stageId: z.string().uuid().optional(),
  assignedTo: z.string().uuid().optional(),
  practiceArea: z.string().max(80).optional(),
  temperature: z.enum(["todas", "quente", "morno", "frio"]).default("todas"),
  minScore: z.number().int().min(0).max(100).optional(),
  maxScore: z.number().int().min(0).max(100).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  source: z.string().max(60).optional(),
  result: z.enum(["todas", "abertas", "ganhas", "perdidas"]).default("todas"),
  search: z.string().max(120).default(""),
  limit: z.number().int().min(1).max(500).default(300),
});

export const getCrmBoard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => boardFilters.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { officeId, profileId, role } = await getContextOffice(ctx);
    const pipeline = data.pipelineId
      ? ((
          await ctx.supabase
            .from("crm_pipelines")
            .select("id, name, is_default")
            .eq("office_id", officeId)
            .eq("id", data.pipelineId)
            .maybeSingle()
        ).data as PipelineRow | null) ?? (await ensurePipeline(ctx, officeId))
      : await ensurePipeline(ctx, officeId);

    const { data: pipelines } = await ctx.supabase
      .from("crm_pipelines")
      .select("id, name, is_default")
      .eq("office_id", officeId)
      .order("created_at", { ascending: true });

    const { data: stagesData } = await ctx.supabase
      .from("crm_stages")
      .select("id, name, kind, position")
      .eq("office_id", officeId)
      .eq("pipeline_id", pipeline.id)
      .order("position", { ascending: true });
    const stages = (stagesData ?? []) as StageRow[];

    let query = ctx.supabase
      .from("crm_opportunities")
      .select(OPP_SELECT)
      .eq("office_id", officeId)
      .eq("pipeline_id", pipeline.id)
      .order("updated_at", { ascending: false })
      .limit(data.limit);

    if (data.stageId) query = query.eq("stage_id", data.stageId);
    if (data.assignedTo) query = query.eq("assigned_to", data.assignedTo);
    if (data.source) query = query.eq("source", data.source);
    if (data.from) query = query.gte("created_at", data.from);
    if (data.to) query = query.lte("created_at", data.to);

    const { data: rows, error } = await query;
    if (error) throw new Error("LIST_ERROR");

    const tasks = await taskCounts(
      ctx,
      officeId,
      (rows ?? []).map((r: any) => r.id),
    );
    let opportunities: OpportunityRow[] = (rows ?? []).map((row: any) =>
      mapOpportunity(row, tasks),
    );

    const stageKind = new Map(stages.map((s) => [s.id, s.kind]));
    if (data.result !== "todas") {
      opportunities = opportunities.filter((o) => {
        const kind = stageKind.get(o.stage_id) ?? "aberta";
        if (data.result === "ganhas") return kind === "ganha";
        if (data.result === "perdidas") return kind === "perdida";
        return kind === "aberta";
      });
    }
    if (data.temperature !== "todas") {
      opportunities = opportunities.filter((o) => o.lead_temperature === data.temperature);
    }
    if (data.practiceArea) {
      const term = data.practiceArea.toLowerCase();
      opportunities = opportunities.filter((o) =>
        (o.practice_area ?? "").toLowerCase().includes(term),
      );
    }
    if (typeof data.minScore === "number") {
      opportunities = opportunities.filter((o) => (o.lead_score ?? 0) >= data.minScore!);
    }
    if (typeof data.maxScore === "number") {
      opportunities = opportunities.filter((o) => (o.lead_score ?? 0) <= data.maxScore!);
    }
    if (data.search.trim()) {
      const term = data.search.trim().toLowerCase();
      opportunities = opportunities.filter((o) =>
        [o.title, o.contact_name, o.contact_phone, o.contact_email, o.practice_area]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term)),
      );
    }

    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const ganhas = opportunities.filter((o) => stageKind.get(o.stage_id) === "ganha").length;
    const perdidas = opportunities.filter((o) => stageKind.get(o.stage_id) === "perdida").length;
    const emNegociacao = opportunities.filter((o) => {
      const stage = stages.find((s) => s.id === o.stage_id);
      return stage?.kind === "aberta" && stage.position >= 3;
    }).length;
    const encerradas = ganhas + perdidas;

    const stats: CrmStats = {
      total: opportunities.length,
      novas: opportunities.filter((o) => new Date(o.created_at).getTime() >= weekAgo).length,
      emNegociacao,
      ganhas,
      perdidas,
      valorEstimado: opportunities.reduce((sum, o) => sum + (o.estimated_value ?? 0), 0),
      // Fórmula: ganhas / (ganhas + perdidas). Leads que nunca viraram oportunidade não entram.
      conversao: encerradas > 0 ? Math.round((ganhas / encerradas) * 100) : null,
      conversaoBase: encerradas,
    };

    const funnel = stages.map((stage) => ({
      stageId: stage.id,
      name: stage.name,
      kind: stage.kind,
      count: opportunities.filter((o) => o.stage_id === stage.id).length,
    }));

    return {
      pipeline,
      pipelines: (pipelines ?? []) as PipelineRow[],
      stages,
      opportunities,
      stats,
      funnel,
      canManage: isManager(role),
      profileId,
    };
  });

export const getOpportunityDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ opportunityId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { officeId, role, profileId } = await getContextOffice(ctx);

    const { data: row } = await ctx.supabase
      .from("crm_opportunities")
      .select(OPP_SELECT)
      .eq("office_id", officeId)
      .eq("id", data.opportunityId)
      .maybeSingle();
    if (!row) throw new Error("NOT_FOUND");

    const tasksMap = await taskCounts(ctx, officeId, [row.id]);
    const opportunity = mapOpportunity(row, tasksMap);

    const [{ data: activities }, { data: tasks }, { data: events }, { data: stages }] =
      await Promise.all([
        ctx.supabase
          .from("crm_activities")
          .select("id, type, description, status, activity_at, completed_at, owner:owner_profile_id(name)")
          .eq("office_id", officeId)
          .eq("opportunity_id", row.id)
          .order("activity_at", { ascending: false })
          .limit(100),
        ctx.supabase
          .from("crm_tasks")
          .select("id, title, description, priority, status, due_at, completed_at, assignee:assigned_to(name)")
          .eq("office_id", officeId)
          .eq("opportunity_id", row.id)
          .order("due_at", { ascending: true })
          .limit(100),
        ctx.supabase
          .from("crm_stage_history")
          .select("id, description, created_at, actor:actor_profile_id(name)")
          .eq("office_id", officeId)
          .eq("opportunity_id", row.id)
          .order("created_at", { ascending: false })
          .limit(100),
        ctx.supabase
          .from("crm_stages")
          .select("id, name, kind, position")
          .eq("office_id", officeId)
          .eq("pipeline_id", row.pipeline_id)
          .order("position", { ascending: true }),
      ]);

    return {
      opportunity,
      lead: row.lead
        ? {
            id: row.lead.id,
            case_summary: row.lead.case_summary ?? null,
            score_reason: row.lead.score_reason ?? null,
            missing_information: row.lead.missing_information ?? [],
          }
        : null,
      stages: (stages ?? []) as StageRow[],
      activities: (activities ?? []).map((a: any) => ({
        id: a.id,
        type: a.type as ActivityType,
        description: a.description,
        status: a.status as ActivityStatus,
        activity_at: a.activity_at,
        completed_at: a.completed_at,
        owner_name: a.owner?.name ?? null,
      })),
      tasks: (tasks ?? []).map((t: any) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        priority: t.priority as TaskPriority,
        status: t.status as ActivityStatus,
        due_at: t.due_at,
        completed_at: t.completed_at,
        assignee_name: t.assignee?.name ?? null,
      })),
      history: (events ?? []).map((e: any) => ({
        id: e.id,
        description: e.description,
        created_at: e.created_at,
        actor_name: e.actor?.name ?? null,
      })),
      canEdit: isManager(role) || !opportunity.assigned_to || opportunity.assigned_to === profileId,
    };
  });

const createSchema = z.object({
  leadId: z.string().uuid().nullable().optional(),
  pipelineId: z.string().uuid().optional(),
  stageId: z.string().uuid().optional(),
  title: z.string().min(2).max(160),
  description: z.string().max(2000).nullable().optional(),
  assignedTo: z.string().uuid().nullable().optional(),
  estimatedValue: z.number().min(0).max(1_000_000_000).nullable().optional(),
  probability: z.number().int().min(0).max(100).default(0),
  expectedCloseDate: z.string().nullable().optional(),
  source: z.string().max(60).nullable().optional(),
});

export const createOpportunity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createSchema.parse(input))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { officeId, profileId, name } = await getContextOffice(ctx);
    const pipeline = data.pipelineId
      ? { id: data.pipelineId }
      : await ensurePipeline(ctx, officeId);

    const { data: stages } = await ctx.supabase
      .from("crm_stages")
      .select("id, name, kind, position")
      .eq("office_id", officeId)
      .eq("pipeline_id", pipeline.id)
      .order("position", { ascending: true });
    if (!stages?.length) throw new Error("NO_STAGES");
    const stage = data.stageId
      ? stages.find((s: any) => s.id === data.stageId)
      : stages[0];
    if (!stage) throw new Error("STAGE_NOT_FOUND");

    let contactId: string | null = null;
    let leadSource: string | null = null;
    if (data.leadId) {
      const { data: lead } = await ctx.supabase
        .from("leads")
        .select("id, contact_id, source")
        .eq("office_id", officeId)
        .eq("id", data.leadId)
        .maybeSingle();
      if (!lead) throw new Error("LEAD_NOT_FOUND");
      contactId = lead.contact_id ?? null;
      leadSource = lead.source ?? null;
    }

    if (data.assignedTo) {
      const { data: target } = await ctx.supabase
        .from("profiles")
        .select("id")
        .eq("office_id", officeId)
        .eq("id", data.assignedTo)
        .maybeSingle();
      if (!target) throw new Error("ASSIGNEE_NOT_FOUND");
    }

    const { data: created, error } = await ctx.supabase
      .from("crm_opportunities")
      .insert({
        office_id: officeId,
        lead_id: data.leadId ?? null,
        contact_id: contactId,
        pipeline_id: pipeline.id,
        stage_id: stage.id,
        assigned_to: data.assignedTo ?? null,
        created_by: profileId,
        title: data.title,
        description: data.description ?? null,
        estimated_value: data.estimatedValue ?? null,
        probability: data.probability,
        expected_close_date: data.expectedCloseDate || null,
        source: data.source ?? leadSource ?? "manual",
      })
      .select("id")
      .single();
    if (error || !created) throw new Error("CREATE_ERROR");

    await history(ctx, {
      officeId,
      opportunityId: created.id,
      fromStageId: null,
      toStageId: stage.id,
      profileId,
      description: `${name} criou a oportunidade em ${stage.name}.`,
    });
    await audit(ctx, {
      officeId,
      profileId,
      action: "crm_opportunity_created",
      opportunityId: created.id,
      metadata: { stage: stage.name, lead_id: data.leadId ?? null },
    });
    if (data.assignedTo && data.assignedTo !== profileId) {
      await notify(ctx, {
        officeId,
        profileId: data.assignedTo,
        opportunityId: created.id,
        type: "opportunity_assigned",
        title: "Nova oportunidade atribuída a você",
        body: data.title,
      });
    }
    return { id: created.id as string };
  });

const updateSchema = z.object({
  opportunityId: z.string().uuid(),
  title: z.string().min(2).max(160).optional(),
  description: z.string().max(2000).nullable().optional(),
  estimatedValue: z.number().min(0).max(1_000_000_000).nullable().optional(),
  probability: z.number().int().min(0).max(100).optional(),
  expectedCloseDate: z.string().nullable().optional(),
  source: z.string().max(60).nullable().optional(),
  assignedTo: z.string().uuid().nullable().optional(),
});

export const updateOpportunity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { officeId, profileId, role, name } = await getContextOffice(ctx);
    const { opportunityId, ...patch } = data;

    const { data: current } = await ctx.supabase
      .from("crm_opportunities")
      .select("id, assigned_to, estimated_value, probability, title, stage_id")
      .eq("office_id", officeId)
      .eq("id", opportunityId)
      .maybeSingle();
    if (!current) throw new Error("NOT_FOUND");
    assertCanEdit(role, profileId, current);

    if (patch.assignedTo) {
      const { data: target } = await ctx.supabase
        .from("profiles")
        .select("id")
        .eq("office_id", officeId)
        .eq("id", patch.assignedTo)
        .maybeSingle();
      if (!target) throw new Error("ASSIGNEE_NOT_FOUND");
    }

    const update: Record<string, unknown> = {};
    if (patch.title !== undefined) update['title'] = patch.title;
    if (patch.description !== undefined) update['description'] = patch.description;
    if (patch.estimatedValue !== undefined) update['estimated_value'] = patch.estimatedValue;
    if (patch.probability !== undefined) update['probability'] = patch.probability;
    if (patch.expectedCloseDate !== undefined)
      update['expected_close_date'] = patch.expectedCloseDate || null;
    if (patch.source !== undefined) update['source'] = patch.source;
    if (patch.assignedTo !== undefined) update['assigned_to'] = patch.assignedTo;

    const { error } = await ctx.supabase
      .from("crm_opportunities")
      .update(update)
      .eq("id", opportunityId)
      .eq("office_id", officeId);
    if (error) throw new Error("UPDATE_ERROR");

    await audit(ctx, {
      officeId,
      profileId,
      action: "crm_opportunity_updated",
      opportunityId,
      metadata: { fields: Object.keys(update) },
    });

    if (patch.assignedTo !== undefined && patch.assignedTo !== current.assigned_to) {
      await history(ctx, {
        officeId,
        opportunityId,
        fromStageId: current.stage_id,
        toStageId: current.stage_id,
        profileId,
        description: patch.assignedTo
          ? `${name} alterou o responsável comercial.`
          : `${name} removeu o responsável comercial.`,
      });
      if (patch.assignedTo && patch.assignedTo !== profileId) {
        await notify(ctx, {
          officeId,
          profileId: patch.assignedTo,
          opportunityId,
          type: current.assigned_to ? "opportunity_transferred" : "opportunity_assigned",
          title: "Oportunidade atribuída a você",
          body: current.title,
        });
      }
    }
    return { ok: true };
  });

const moveSchema = z.object({
  opportunityId: z.string().uuid(),
  stageId: z.string().uuid(),
  expectedStageId: z.string().uuid(),
  lossReason: z.string().max(300).nullable().optional(),
});

/** Move entre etapas com trava de concorrência: só altera se a etapa atual for a esperada. */
export const moveOpportunityStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => moveSchema.parse(input))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { officeId, profileId, role, name } = await getContextOffice(ctx);

    const { data: current } = await ctx.supabase
      .from("crm_opportunities")
      .select("id, stage_id, assigned_to, title")
      .eq("office_id", officeId)
      .eq("id", data.opportunityId)
      .maybeSingle();
    if (!current) throw new Error("NOT_FOUND");
    assertCanEdit(role, profileId, current);

    const { data: stages } = await ctx.supabase
      .from("crm_stages")
      .select("id, name, kind")
      .eq("office_id", officeId)
      .in("id", [data.stageId, current.stage_id, data.expectedStageId]);
    const target = (stages ?? []).find((s: any) => s.id === data.stageId);
    const from = (stages ?? []).find((s: any) => s.id === current.stage_id);
    if (!target) throw new Error("STAGE_NOT_FOUND");
    if (target.kind === "perdida" && !data.lossReason?.trim()) throw new Error("LOSS_REASON_REQUIRED");

    const now = new Date().toISOString();
    const update: Record<string, unknown> = {
      stage_id: target.id,
      stage_changed_at: now,
      last_activity_at: now,
      won_at: target.kind === "ganha" ? now : null,
      won_by: target.kind === "ganha" ? profileId : null,
      lost_at: target.kind === "perdida" ? now : null,
      lost_by: target.kind === "perdida" ? profileId : null,
      loss_reason: target.kind === "perdida" ? data.lossReason!.trim() : null,
    };

    const { data: moved, error } = await ctx.supabase
      .from("crm_opportunities")
      .update(update)
      .eq("id", data.opportunityId)
      .eq("office_id", officeId)
      .eq("stage_id", data.expectedStageId)
      .select("id");
    if (error) throw new Error("MOVE_ERROR");
    if (!moved || moved.length === 0) throw new Error("CONFLICT");

    const reopened = from && from.kind !== "aberta" && target.kind === "aberta";
    const description = reopened
      ? `${name} reabriu a oportunidade em ${target.name}.`
      : target.kind === "ganha"
        ? `${name} marcou a oportunidade como ${target.name}.`
        : target.kind === "perdida"
          ? `${name} marcou como ${target.name}. Motivo: ${data.lossReason!.trim()}`
          : `${name} moveu de ${from?.name ?? "—"} para ${target.name}.`;

    await history(ctx, {
      officeId,
      opportunityId: data.opportunityId,
      fromStageId: current.stage_id,
      toStageId: target.id,
      profileId,
      description,
      metadata: { loss_reason: data.lossReason ?? null, reopened: Boolean(reopened) },
    });
    await audit(ctx, {
      officeId,
      profileId,
      action: reopened
        ? "crm_opportunity_reopened"
        : target.kind === "ganha"
          ? "crm_opportunity_won"
          : target.kind === "perdida"
            ? "crm_opportunity_lost"
            : "crm_opportunity_stage_changed",
      opportunityId: data.opportunityId,
      metadata: { from: from?.name ?? null, to: target.name, loss_reason: data.lossReason ?? null },
    });

    if (current.assigned_to && current.assigned_to !== profileId) {
      await notify(ctx, {
        officeId,
        profileId: current.assigned_to,
        opportunityId: data.opportunityId,
        type:
          target.kind === "ganha"
            ? "opportunity_won"
            : target.kind === "perdida"
              ? "opportunity_lost"
              : "opportunity_stage_changed",
        title: description,
        body: current.title,
      });
    }
    return { ok: true, stageId: target.id };
  });

const activitySchema = z.object({
  opportunityId: z.string().uuid(),
  type: z.enum(["ligacao", "mensagem", "reuniao", "consulta", "proposta", "observacao", "tarefa"]),
  description: z.string().min(2).max(1000),
  status: z.enum(["pendente", "em_andamento", "concluida", "cancelada"]).default("concluida"),
  activityAt: z.string().optional(),
});

export const createActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => activitySchema.parse(input))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { officeId, profileId, role } = await getContextOffice(ctx);

    const { data: current } = await ctx.supabase
      .from("crm_opportunities")
      .select("id, assigned_to")
      .eq("office_id", officeId)
      .eq("id", data.opportunityId)
      .maybeSingle();
    if (!current) throw new Error("NOT_FOUND");
    assertCanEdit(role, profileId, current);

    const at = data.activityAt || new Date().toISOString();
    const { error } = await ctx.supabase.from("crm_activities").insert({
      office_id: officeId,
      opportunity_id: data.opportunityId,
      type: data.type,
      description: data.description,
      status: data.status,
      owner_profile_id: profileId,
      created_by: profileId,
      activity_at: at,
      completed_at: data.status === "concluida" ? at : null,
    });
    if (error) throw new Error("ACTIVITY_ERROR");

    await ctx.supabase
      .from("crm_opportunities")
      .update({ last_activity_at: at })
      .eq("id", data.opportunityId)
      .eq("office_id", officeId);
    await audit(ctx, {
      officeId,
      profileId,
      action: "crm_activity_created",
      opportunityId: data.opportunityId,
      metadata: { type: data.type },
    });
    return { ok: true };
  });

const taskSchema = z.object({
  opportunityId: z.string().uuid(),
  title: z.string().min(2).max(160),
  description: z.string().max(1000).nullable().optional(),
  assignedTo: z.string().uuid().nullable().optional(),
  dueAt: z.string().nullable().optional(),
  priority: z.enum(["baixa", "media", "alta", "urgente"]).default("media"),
});

export const createTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => taskSchema.parse(input))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { officeId, profileId, role } = await getContextOffice(ctx);

    const { data: current } = await ctx.supabase
      .from("crm_opportunities")
      .select("id, assigned_to, title")
      .eq("office_id", officeId)
      .eq("id", data.opportunityId)
      .maybeSingle();
    if (!current) throw new Error("NOT_FOUND");
    assertCanEdit(role, profileId, current);

    if (data.assignedTo) {
      const { data: target } = await ctx.supabase
        .from("profiles")
        .select("id")
        .eq("office_id", officeId)
        .eq("id", data.assignedTo)
        .maybeSingle();
      if (!target) throw new Error("ASSIGNEE_NOT_FOUND");
    }

    const { data: created, error } = await ctx.supabase
      .from("crm_tasks")
      .insert({
        office_id: officeId,
        opportunity_id: data.opportunityId,
        title: data.title,
        description: data.description ?? null,
        assigned_to: data.assignedTo ?? profileId,
        created_by: profileId,
        due_at: data.dueAt || null,
        priority: data.priority,
        status: "pendente",
      })
      .select("id")
      .single();
    if (error || !created) throw new Error("TASK_ERROR");

    await audit(ctx, {
      officeId,
      profileId,
      action: "crm_task_created",
      opportunityId: data.opportunityId,
      metadata: { task_id: created.id, priority: data.priority },
    });
    const owner = data.assignedTo ?? profileId;
    if (owner !== profileId) {
      await notify(ctx, {
        officeId,
        profileId: owner,
        opportunityId: data.opportunityId,
        taskId: created.id,
        type: "task_assigned",
        title: "Nova tarefa atribuída a você",
        body: data.title,
      });
    }
    return { id: created.id as string };
  });

export const setTaskStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        taskId: z.string().uuid(),
        status: z.enum(["pendente", "em_andamento", "concluida", "cancelada"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { officeId, profileId } = await getContextOffice(ctx);
    const { data: task } = await ctx.supabase
      .from("crm_tasks")
      .select("id, opportunity_id")
      .eq("office_id", officeId)
      .eq("id", data.taskId)
      .maybeSingle();
    if (!task) throw new Error("NOT_FOUND");

    const { error } = await ctx.supabase
      .from("crm_tasks")
      .update({
        status: data.status,
        completed_at: data.status === "concluida" ? new Date().toISOString() : null,
      })
      .eq("id", data.taskId)
      .eq("office_id", officeId);
    if (error) throw new Error("UPDATE_ERROR");

    await audit(ctx, {
      officeId,
      profileId,
      action: "crm_task_status_changed",
      opportunityId: task.opportunity_id,
      metadata: { task_id: data.taskId, status: data.status },
    });
    return { ok: true };
  });

/** Tarefas atrasadas ou vencendo, usadas nos alertas reais do CRM. */
export const listCrmTasks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ onlyMine: z.boolean().default(false) }).parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { officeId, profileId } = await getContextOffice(ctx);
    let query = ctx.supabase
      .from("crm_tasks")
      .select("id, title, due_at, priority, status, opportunity_id, opportunity:opportunity_id(title)")
      .eq("office_id", officeId)
      .in("status", ["pendente", "em_andamento"])
      .order("due_at", { ascending: true })
      .limit(50);
    if (data.onlyMine) query = query.eq("assigned_to", profileId);
    const { data: rows } = await query;
    const now = Date.now();
    return (rows ?? []).map((t: any) => ({
      id: t.id,
      title: t.title,
      due_at: t.due_at,
      priority: t.priority as TaskPriority,
      status: t.status as ActivityStatus,
      opportunity_id: t.opportunity_id,
      opportunity_title: t.opportunity?.title ?? "",
      overdue: Boolean(t.due_at && new Date(t.due_at).getTime() < now),
    }));
  });

/** Leads com intenção comercial concreta e ainda sem oportunidade — base para conversão. */
export const listConvertibleLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as unknown as Ctx;
    const { officeId } = await getContextOffice(ctx);
    const { data: leads } = await ctx.supabase
      .from("leads")
      .select("id, name, phone, practice_area, lead_score, lead_temperature, intent, qualification_status")
      .eq("office_id", officeId)
      .in("intent", ["contratar", "avaliando"])
      .order("lead_score", { ascending: false })
      .limit(50);
    const ids = (leads ?? []).map((l: any) => l.id);
    if (ids.length === 0) return [];
    const { data: used } = await ctx.supabase
      .from("crm_opportunities")
      .select("lead_id")
      .eq("office_id", officeId)
      .in("lead_id", ids);
    const taken = new Set((used ?? []).map((o: any) => o.lead_id));
    return (leads ?? []).filter((l: any) => !taken.has(l.id));
  });
