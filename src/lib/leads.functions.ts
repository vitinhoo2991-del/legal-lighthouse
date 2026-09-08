import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

import {
  computeLeadScore,
  temperatureFor,
  type LeadIntent,
  type LeadStatus,
  type LeadTemperature,
  type LeadUrgency,
} from "@/lib/leads/scoring";

export type { LeadIntent, LeadStatus, LeadTemperature, LeadUrgency };

export interface LeadRow {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  practice_area: string | null;
  practice_area_match: boolean | null;
  case_type: string | null;
  case_summary: string | null;
  qualification_summary: string | null;
  urgency: LeadUrgency;
  intent: LeadIntent;
  location: string | null;
  has_deadline: boolean | null;
  deadline: string | null;
  budget_signal: string | null;
  decision_maker: boolean | null;
  qualification_status: LeadStatus;
  lead_score: number;
  lead_temperature: LeadTemperature;
  score_reason: string | null;
  missing_information: string[];
  source: string;
  assigned_to: string | null;
  assigned_name: string | null;
  whatsapp_conversation_id: string | null;
  ai_conversation_id: string | null;
  last_interaction_at: string;
  last_qualified_at: string | null;
  created_at: string;
}

export interface LeadStats {
  total: number;
  novos: number;
  emQualificacao: number;
  quentes: number;
  mornos: number;
  frios: number;
  scoreMedio: number;
  ultimoQuente: { id: string; name: string | null; score: number; reason: string | null } | null;
}

type Ctx = { supabase: any; userId: string };

async function getContextOffice(context: Ctx) {
  const { data, error } = await context.supabase
    .from("profiles")
    .select("id, office_id, role")
    .eq("auth_user_id", context.userId)
    .maybeSingle();
  if (error) throw new Error("PROFILE_ERROR");
  if (!data?.office_id) throw new Error("NO_OFFICE");
  return {
    profileId: data.id as string,
    officeId: data.office_id as string,
    role: data.role as string,
  };
}

const SELECT =
  "id, name, phone, email, practice_area, practice_area_match, case_type, case_summary, qualification_summary, urgency, intent, location, has_deadline, deadline, budget_signal, decision_maker, qualification_status, lead_score, lead_temperature, score_reason, missing_information, source, assigned_to, whatsapp_conversation_id, ai_conversation_id, last_interaction_at, last_qualified_at, created_at, assignee:assigned_to(name)";

function mapRow(row: any): LeadRow {
  return {
    ...row,
    missing_information: row.missing_information ?? [],
    assigned_name: row.assignee?.name ?? null,
  } as LeadRow;
}

const filterSchema = z.object({
  status: z
    .enum([
      "todos",
      "novo",
      "em_qualificacao",
      "qualificado",
      "incompleto",
      "desqualificado",
      "atendimento_humano",
    ])
    .default("todos"),
  temperature: z.enum(["todas", "quente", "morno", "frio"]).default("todas"),
  practiceArea: z.string().max(80).optional(),
  assignedTo: z.string().uuid().optional(),
  minScore: z.number().int().min(0).max(100).optional(),
  maxScore: z.number().int().min(0).max(100).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  search: z.string().max(120).optional(),
});

export const listLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => filterSchema.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { officeId } = await getContextOffice(ctx);

    let query = ctx.supabase
      .from("leads")
      .select(SELECT)
      .eq("office_id", officeId)
      .order("lead_score", { ascending: false })
      .order("last_interaction_at", { ascending: false })
      .limit(200);

    if (data.status !== "todos") query = query.eq("qualification_status", data.status);
    if (data.temperature !== "todas") query = query.eq("lead_temperature", data.temperature);
    if (data.practiceArea) query = query.ilike("practice_area", `%${data.practiceArea}%`);
    if (data.assignedTo) query = query.eq("assigned_to", data.assignedTo);
    if (typeof data.minScore === "number") query = query.gte("lead_score", data.minScore);
    if (typeof data.maxScore === "number") query = query.lte("lead_score", data.maxScore);
    if (data.from) query = query.gte("created_at", data.from);
    if (data.to) query = query.lte("created_at", data.to);
    if (data.search) {
      const term = data.search.replace(/[%,]/g, " ").trim();
      if (term) {
        query = query.or(
          `name.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%,practice_area.ilike.%${term}%`,
        );
      }
    }

    const { data: rows, error } = await query;
    if (error) throw new Error("LIST_ERROR");

    const areas = new Set<string>();
    for (const r of rows ?? []) if (r.practice_area) areas.add(r.practice_area);

    return { leads: (rows ?? []).map(mapRow), practiceAreas: Array.from(areas).sort() };
  });

export const getLeadDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ leadId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { officeId } = await getContextOffice(ctx);

    const { data: row } = await ctx.supabase
      .from("leads")
      .select(SELECT)
      .eq("office_id", officeId)
      .eq("id", data.leadId)
      .maybeSingle();
    if (!row) throw new Error("NOT_FOUND");

    const { data: history } = await ctx.supabase
      .from("lead_score_history")
      .select("id, previous_score, new_score, reason, source, created_at")
      .eq("office_id", officeId)
      .eq("lead_id", data.leadId)
      .order("created_at", { ascending: false })
      .limit(20);

    return { lead: mapRow(row), history: history ?? [] };
  });

export const listTeamOptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as unknown as Ctx;
    const { officeId } = await getContextOffice(ctx);
    const { data } = await ctx.supabase
      .from("profiles")
      .select("id, name")
      .eq("office_id", officeId)
      .order("name");
    return (data ?? []) as { id: string; name: string }[];
  });

const updateSchema = z.object({
  leadId: z.string().uuid(),
  name: z.string().max(120).nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
  email: z.string().max(160).nullable().optional(),
  practice_area: z.string().max(80).nullable().optional(),
  practice_area_match: z.boolean().nullable().optional(),
  case_type: z.string().max(120).nullable().optional(),
  case_summary: z.string().max(2000).nullable().optional(),
  location: z.string().max(160).nullable().optional(),
  deadline: z.string().max(120).nullable().optional(),
  has_deadline: z.boolean().nullable().optional(),
  budget_signal: z.string().max(200).nullable().optional(),
  decision_maker: z.boolean().nullable().optional(),
  urgency: z.enum(["desconhecida", "baixa", "media", "alta", "critica"]).optional(),
  intent: z.enum(["desconhecida", "informacao", "avaliando", "contratar"]).optional(),
});

/** Edição manual pelo humano: recalcula o score com a mesma fórmula transparente. */
export const updateLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { officeId, profileId } = await getContextOffice(ctx);
    const { leadId, ...patch } = data;

    const { data: current } = await ctx.supabase
      .from("leads")
      .select("*")
      .eq("office_id", officeId)
      .eq("id", leadId)
      .maybeSingle();
    if (!current) throw new Error("NOT_FOUND");

    const merged = { ...current, ...patch };
    const scored = computeLeadScore({
      name: merged.name,
      phone: merged.phone,
      email: merged.email,
      practiceArea: merged.practice_area,
      practiceAreaMatch: merged.practice_area_match,
      caseType: merged.case_type,
      caseSummary: merged.case_summary,
      urgency: merged.urgency,
      intent: merged.intent,
      hasDeadline: merged.has_deadline,
      deadline: merged.deadline,
      signals: [],
    });

    const { data: saved, error } = await ctx.supabase
      .from("leads")
      .update({
        ...patch,
        lead_score: scored.score,
        lead_temperature: scored.temperature,
        score_reason: `${scored.reason} (revisado por um membro da equipe)`,
      })
      .eq("id", leadId)
      .eq("office_id", officeId)
      .select(SELECT)
      .single();
    if (error) throw new Error("SAVE_ERROR");

    if (current.lead_score !== scored.score) {
      await ctx.supabase.from("lead_score_history").insert({
        lead_id: leadId,
        office_id: officeId,
        previous_score: current.lead_score,
        new_score: scored.score,
        reason: "Informações revisadas manualmente pela equipe.",
        source: "user",
      });
    }

    await ctx.supabase.from("audit_logs").insert({
      office_id: officeId,
      actor_profile_id: profileId,
      action: "lead_updated",
      entity: "leads",
      entity_id: leadId,
      metadata: { fields: Object.keys(patch), new_score: scored.score },
    });

    return mapRow(saved);
  });

export const setLeadStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        leadId: z.string().uuid(),
        status: z.enum([
          "novo",
          "em_qualificacao",
          "qualificado",
          "incompleto",
          "desqualificado",
          "atendimento_humano",
        ]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { officeId, profileId } = await getContextOffice(ctx);
    const { error } = await ctx.supabase
      .from("leads")
      .update({ qualification_status: data.status })
      .eq("id", data.leadId)
      .eq("office_id", officeId);
    if (error) throw new Error("UPDATE_ERROR");

    await ctx.supabase.from("audit_logs").insert({
      office_id: officeId,
      actor_profile_id: profileId,
      action:
        data.status === "desqualificado" ? "lead_disqualified" : "lead_status_changed",
      entity: "leads",
      entity_id: data.leadId,
      metadata: { status: data.status },
    });
    return { status: data.status };
  });

export const assignLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ leadId: z.string().uuid(), profileId: z.string().uuid().nullable() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { officeId, profileId } = await getContextOffice(ctx);
    const { error } = await ctx.supabase
      .from("leads")
      .update({ assigned_to: data.profileId })
      .eq("id", data.leadId)
      .eq("office_id", officeId);
    if (error) throw new Error("UPDATE_ERROR");

    await ctx.supabase.from("audit_logs").insert({
      office_id: officeId,
      actor_profile_id: profileId,
      action: "lead_assigned",
      entity: "leads",
      entity_id: data.leadId,
      metadata: { assigned_to: data.profileId },
    });
    return { assignedTo: data.profileId };
  });

export const getLeadStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as unknown as Ctx;
    const { officeId } = await getContextOffice(ctx);
    const { data: rows } = await ctx.supabase
      .from("leads")
      .select("id, name, lead_score, lead_temperature, qualification_status, score_reason, last_qualified_at")
      .eq("office_id", officeId);

    const list = (rows ?? []) as {
      id: string;
      name: string | null;
      lead_score: number;
      lead_temperature: LeadTemperature;
      qualification_status: LeadStatus;
      score_reason: string | null;
      last_qualified_at: string | null;
    }[];

    const quentes = list.filter((l) => l.lead_temperature === "quente");
    const sorted = [...quentes].sort((a, b) =>
      (b.last_qualified_at ?? "").localeCompare(a.last_qualified_at ?? ""),
    );
    const top = sorted[0];

    const stats: LeadStats = {
      total: list.length,
      novos: list.filter((l) => l.qualification_status === "novo").length,
      emQualificacao: list.filter((l) => l.qualification_status === "em_qualificacao").length,
      quentes: quentes.length,
      mornos: list.filter((l) => l.lead_temperature === "morno").length,
      frios: list.filter((l) => l.lead_temperature === "frio").length,
      scoreMedio: list.length
        ? Math.round(list.reduce((sum, l) => sum + l.lead_score, 0) / list.length)
        : 0,
      ultimoQuente: top
        ? { id: top.id, name: top.name, score: top.lead_score, reason: top.score_reason }
        : null,
    };
    return stats;
  });

export { temperatureFor };
