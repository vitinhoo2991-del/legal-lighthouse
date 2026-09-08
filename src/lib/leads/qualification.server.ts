// Camada de qualificação inteligente (Etapa 04).
// Server-only: usa a mesma infraestrutura de IA da Etapa 02 e o service role
// apenas depois que o office_id já foi resolvido pelo chamador.
import {
  computeLeadScore,
  deriveStatus,
  temperatureFor,
  INTENT_SIGNALS,
  type IntentSignal,
  type LeadIntent,
  type LeadUrgency,
  type ScoreInput,
} from "./scoring";

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

async function admin(): Promise<Admin> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export interface TranscriptTurn {
  role: "user" | "assistant";
  content: string;
}

interface Extraction {
  name: string | null;
  email: string | null;
  practice_area: string | null;
  practice_area_match: boolean | null;
  case_type: string | null;
  case_summary: string | null;
  urgency: LeadUrgency;
  intent: LeadIntent;
  location: string | null;
  has_deadline: boolean | null;
  deadline: string | null;
  budget_signal: string | null;
  decision_maker: boolean | null;
  signals: IntentSignal[];
  missing_information: string[];
  disqualified: boolean;
}

const URGENCIES: LeadUrgency[] = ["desconhecida", "baixa", "media", "alta", "critica"];
const INTENTS: LeadIntent[] = ["desconhecida", "informacao", "avaliando", "contratar"];

function str(value: unknown, max = 400): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === "null" || trimmed === "-") return null;
  return trimmed.slice(0, max);
}

function bool(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  return null;
}

function normalize(raw: unknown): Extraction {
  const r = (raw ?? {}) as Record<string, unknown>;
  const urgency = URGENCIES.includes(r["urgency"] as LeadUrgency)
    ? (r["urgency"] as LeadUrgency)
    : "desconhecida";
  const intent = INTENTS.includes(r["intent"] as LeadIntent)
    ? (r["intent"] as LeadIntent)
    : "desconhecida";
  const signals = Array.isArray(r["signals"])
    ? (r["signals"] as unknown[])
        .filter((s): s is IntentSignal => (INTENT_SIGNALS as readonly string[]).includes(String(s)))
        .slice(0, 8)
    : [];
  const missing = Array.isArray(r["missing_information"])
    ? (r["missing_information"] as unknown[])
        .map((m) => str(m, 120))
        .filter((m): m is string => Boolean(m))
        .slice(0, 8)
    : [];

  return {
    name: str(r["name"], 120),
    email: str(r["email"], 160),
    practice_area: str(r["practice_area"], 80),
    practice_area_match: bool(r["practice_area_match"]),
    case_type: str(r["case_type"], 120),
    case_summary: str(r["case_summary"], 1200),
    urgency,
    intent,
    location: str(r["location"], 160),
    has_deadline: bool(r["has_deadline"]),
    deadline: str(r["deadline"], 120),
    budget_signal: str(r["budget_signal"], 200),
    decision_maker: bool(r["decision_maker"]),
    signals,
    missing_information: missing,
    disqualified: r["disqualified"] === true,
  };
}

function buildInstructions(practiceAreas: string[]): string {
  const areas = practiceAreas.length ? practiceAreas.join(", ") : "não informadas";
  return [
    "Você é um analista de triagem de um escritório de advocacia.",
    "Analise a conversa e extraia SOMENTE informações que realmente aparecem nela.",
    "Nunca invente dados. Se a informação não estiver presente, use null.",
    `Áreas de atuação do escritório: ${areas}.`,
    "Compare o assunto do caso com essas áreas para definir practice_area_match (true = dentro das áreas, false = fora, null = indefinido). Se as áreas não foram informadas, use null.",
    "",
    "Campos do JSON:",
    "name (string|null), email (string|null), practice_area (string|null, área jurídica do caso),",
    "practice_area_match (boolean|null), case_type (string|null), case_summary (string|null, resumo objetivo em português, até 3 frases),",
    'urgency ("desconhecida"|"baixa"|"media"|"alta"|"critica"), intent ("desconhecida"|"informacao"|"avaliando"|"contratar"),',
    "location (string|null), has_deadline (boolean|null), deadline (string|null, prazo/data mencionada),",
    "budget_signal (string|null, sinais sobre honorários/orçamento), decision_maker (boolean|null),",
    'signals (array com valores entre: "honorarios","contratacao","consulta","documentos","falar_com_advogado","agendamento","urgencia","enviou_documentos"),',
    "missing_information (array de informações importantes que AINDA faltam para qualificar o caso, em português, frases curtas),",
    "disqualified (boolean, true apenas quando o contato claramente não tem aderência jurídica: spam, engano, propaganda).",
  ].join("\n");
}

export interface QualifyResult {
  ok: boolean;
  code?: string;
  leadId?: string;
  score?: number;
}

/**
 * Executa a qualificação de um lead a partir da conversa real.
 * `messageMarker` garante idempotência: o mesmo marcador não é reprocessado.
 */
export async function qualifyLead(options: {
  officeId: string;
  leadId: string;
  turns: TranscriptTurn[];
  messageMarker?: string | null;
  humanHandled?: boolean;
  conversationId?: string | null;
}): Promise<QualifyResult> {
  const db = await admin();

  const { data: lead } = await db
    .from("leads")
    .select("*")
    .eq("id", options.leadId)
    .eq("office_id", options.officeId)
    .maybeSingle();
  if (!lead) return { ok: false, code: "LEAD_NOT_FOUND" };

  if (options.messageMarker && lead.last_qualified_message_id === options.messageMarker) {
    return { ok: true, code: "ALREADY_QUALIFIED", leadId: lead.id, score: lead.lead_score };
  }

  const userTurns = options.turns.filter((t) => t.role === "user" && t.content.trim());
  if (userTurns.length === 0) return { ok: false, code: "NO_CONTENT" };

  const [{ data: office }, { data: settings }] = await Promise.all([
    db.from("offices").select("practice_areas").eq("id", options.officeId).maybeSingle(),
    db.from("ai_agent_settings").select("model").eq("office_id", options.officeId).maybeSingle(),
  ]);

  const transcript = options.turns
    .slice(-30)
    .map((t) => `${t.role === "user" ? "Cliente" : "Atendimento"}: ${t.content}`)
    .join("\n")
    .slice(0, 12000);

  const model = settings?.model || "openai/gpt-6-astra";
  const { generateStructuredJson, AiNotConfiguredError, AiProviderError } = await import(
    "@/lib/ai-attendance.server"
  );

  let extraction: Extraction;
  let usage = { model, promptTokens: null as number | null, completionTokens: null as number | null, totalTokens: null as number | null, durationMs: 0 };
  try {
    const result = await generateStructuredJson({
      model,
      instructions: buildInstructions((office?.practice_areas as string[]) ?? []),
      input: transcript,
    });
    extraction = normalize(result.data);
    usage = {
      model: result.model,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      totalTokens: result.totalTokens,
      durationMs: result.durationMs,
    };
  } catch (error) {
    let code = "QUALIFICATION_ERROR";
    if (error instanceof AiNotConfiguredError) code = "AI_NOT_CONFIGURED";
    else if (error instanceof AiProviderError) {
      if (error.status === 402) code = "AI_NO_CREDITS";
      else if (error.status === 429) code = "AI_RATE_LIMITED";
      else if (error.status === 403) code = "AI_BLOCKED";
    }
    await db.from("ai_usage_logs").insert({
      office_id: options.officeId,
      conversation_id: null,
      model,
      status: `qualification:${code}`,
    });
    return { ok: false, code };
  }

  // Informação manual do humano tem prioridade sobre a extração da IA quando a IA nada encontrou.
  const merged = {
    name: extraction.name ?? lead.name,
    email: extraction.email ?? lead.email,
    practice_area: extraction.practice_area ?? lead.practice_area,
    practice_area_match: extraction.practice_area_match ?? lead.practice_area_match,
    case_type: extraction.case_type ?? lead.case_type,
    case_summary: extraction.case_summary ?? lead.case_summary,
    urgency: extraction.urgency === "desconhecida" ? (lead.urgency as LeadUrgency) : extraction.urgency,
    intent: extraction.intent === "desconhecida" ? (lead.intent as LeadIntent) : extraction.intent,
    location: extraction.location ?? lead.location,
    has_deadline: extraction.has_deadline ?? lead.has_deadline,
    deadline: extraction.deadline ?? lead.deadline,
    budget_signal: extraction.budget_signal ?? lead.budget_signal,
    decision_maker: extraction.decision_maker ?? lead.decision_maker,
  };

  const scoreInput: ScoreInput = {
    name: merged.name,
    phone: lead.phone,
    email: merged.email,
    practiceArea: merged.practice_area,
    practiceAreaMatch: merged.practice_area_match,
    caseType: merged.case_type,
    caseSummary: merged.case_summary,
    urgency: merged.urgency,
    intent: merged.intent,
    hasDeadline: merged.has_deadline,
    deadline: merged.deadline,
    signals: extraction.signals,
  };

  const scored = computeLeadScore(scoreInput);
  const status = deriveStatus({
    input: scoreInput,
    missingInformation: extraction.missing_information,
    messageCount: options.turns.length,
    humanHandled: options.humanHandled ?? false,
    disqualified: extraction.disqualified,
  });

  const previousScore = lead.lead_score as number;
  const previousTemperature = lead.lead_temperature as string;

  await db
    .from("leads")
    .update({
      ...merged,
      qualification_status: status,
      lead_score: scored.score,
      lead_temperature: scored.temperature,
      score_reason: scored.reason,
      qualification_summary: merged.case_summary,
      missing_information: extraction.missing_information,
      last_qualified_at: new Date().toISOString(),
      last_qualified_message_id: options.messageMarker ?? lead.last_qualified_message_id,
      last_interaction_at: new Date().toISOString(),
    })
    .eq("id", lead.id)
    .eq("office_id", options.officeId);

  if (previousScore !== scored.score || !lead.last_qualified_at) {
    await db.from("lead_score_history").insert({
      lead_id: lead.id,
      office_id: options.officeId,
      previous_score: lead.last_qualified_at ? previousScore : null,
      new_score: scored.score,
      reason: scored.reason,
      source: "ai",
    });
    await db.from("audit_logs").insert({
      office_id: options.officeId,
      action: "lead_score_updated",
      entity: "leads",
      entity_id: lead.id,
      metadata: {
        previous_score: previousScore,
        new_score: scored.score,
        temperature: scored.temperature,
        previous_temperature: previousTemperature,
        status,
        source: "ai",
      },
    });
  }

  await db.from("ai_usage_logs").insert({
    office_id: options.officeId,
    conversation_id: options.conversationId ?? null,
    model: usage.model,
    prompt_tokens: usage.promptTokens,
    completion_tokens: usage.completionTokens,
    total_tokens: usage.totalTokens,
    duration_ms: usage.durationMs,
    status: "qualification",
  });

  return { ok: true, leadId: lead.id, score: scored.score };
}

/** Garante o lead do contato de WhatsApp (um lead por contato do escritório). */
export async function ensureWhatsappLead(options: {
  officeId: string;
  contactId: string;
  conversationId: string;
  phone: string;
  profileName: string | null;
}): Promise<string | null> {
  const db = await admin();
  const { data: existing } = await db
    .from("leads")
    .select("id")
    .eq("office_id", options.officeId)
    .eq("contact_id", options.contactId)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: created, error } = await db
    .from("leads")
    .insert({
      office_id: options.officeId,
      contact_id: options.contactId,
      whatsapp_conversation_id: options.conversationId,
      source: "whatsapp",
      phone: options.phone,
      name: options.profileName,
    })
    .select("id")
    .single();
  if (error || !created) return null;

  await db.from("audit_logs").insert({
    office_id: options.officeId,
    action: "lead_created",
    entity: "leads",
    entity_id: created.id,
    metadata: { source: "whatsapp" },
  });
  return created.id;
}

/** Garante o lead vinculado a uma conversa da área de teste da IA (Etapa 02). */
export async function ensureAiConversationLead(options: {
  officeId: string;
  conversationId: string;
  contactName: string | null;
}): Promise<string | null> {
  const db = await admin();
  const { data: existing } = await db
    .from("leads")
    .select("id")
    .eq("office_id", options.officeId)
    .eq("ai_conversation_id", options.conversationId)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: created, error } = await db
    .from("leads")
    .insert({
      office_id: options.officeId,
      ai_conversation_id: options.conversationId,
      source: "atendimento_ia",
      name: options.contactName,
    })
    .select("id")
    .single();
  if (error || !created) return null;

  await db.from("audit_logs").insert({
    office_id: options.officeId,
    action: "lead_created",
    entity: "leads",
    entity_id: created.id,
    metadata: { source: "atendimento_ia" },
  });
  return created.id;
}

export { temperatureFor };
