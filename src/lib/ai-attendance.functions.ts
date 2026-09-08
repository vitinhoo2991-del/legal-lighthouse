import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type ConversationStatus = "ai" | "waiting_human" | "human" | "closed";
export type MessageRole = "user" | "assistant" | "system";

export interface AiSettings {
  id: string | null;
  office_id: string;
  enabled: boolean;
  agent_name: string;
  greeting: string;
  tones: string[];
  objective: string;
  behavior: string;
  rules: string;
  hours_mode: "always" | "business_hours";
  hours_start: string;
  hours_end: string;
  hours_days: number[];
  after_hours_message: string;
  handoff_message: string;
  model: string;
}

export interface AiMessage {
  id: string;
  role: MessageRole;
  content: string;
  created_at: string;
}

export interface AiConversation {
  id: string;
  title: string;
  status: ConversationStatus;
  channel: string;
  last_message_at: string;
  created_at: string;
}

type Ctx = { supabase: any; userId: string };

async function getContextOffice(context: Ctx) {
  const { data, error } = await context.supabase
    .from("profiles")
    .select("id, office_id, role, offices:office_id(name, timezone)")
    .eq("auth_user_id", context.userId)
    .maybeSingle();
  if (error) throw new Error("PROFILE_ERROR");
  if (!data?.office_id) throw new Error("NO_OFFICE");
  return {
    profileId: data.id as string,
    officeId: data.office_id as string,
    role: data.role as string,
    officeName: (data.offices?.name as string) ?? "Escritório",
    timezone: (data.offices?.timezone as string) ?? "America/Sao_Paulo",
  };
}

function isAdmin(role: string) {
  return role === "owner" || role === "admin";
}

const DEFAULTS: Omit<AiSettings, "office_id"> = {
  id: null,
  enabled: false,
  agent_name: "Assistente Jurídico",
  greeting: "Olá! Sou a assistente virtual do escritório. Como posso ajudar você hoje?",
  tones: ["profissional", "cordial"],
  objective:
    "Acolher o potencial cliente, entender sua necessidade, coletar informações iniciais e encaminhar o atendimento quando necessário.",
  behavior: "",
  rules: "",
  hours_mode: "always",
  hours_start: "09:00",
  hours_end: "18:00",
  hours_days: [1, 2, 3, 4, 5],
  after_hours_message:
    "Estamos fora do horário de atendimento no momento. Deixe sua mensagem que retornaremos assim que possível.",
  handoff_message: "Vou encaminhar seu atendimento para um profissional do escritório.",
  model: "openai/gpt-6-astra",
};

export const getAiSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { officeId, role } = await getContextOffice(context as unknown as Ctx);
    const { data } = await (context as unknown as Ctx).supabase
      .from("ai_agent_settings")
      .select("*")
      .eq("office_id", officeId)
      .maybeSingle();
    const settings: AiSettings = data
      ? { ...(data as AiSettings), tones: data.tones ?? [], hours_days: data.hours_days ?? [] }
      : { ...DEFAULTS, office_id: officeId };
    return {
      settings,
      canEdit: isAdmin(role),
      providerConfigured: Boolean(process.env["LOVABLE_API_KEY"]),
    };
  });

const settingsSchema = z.object({
  enabled: z.boolean(),
  agent_name: z.string().min(1).max(80),
  greeting: z.string().max(600),
  tones: z.array(z.string().max(40)).max(6),
  objective: z.string().max(1000),
  behavior: z.string().max(4000),
  rules: z.string().max(4000),
  hours_mode: z.enum(["always", "business_hours"]),
  hours_start: z.string().regex(/^\d{2}:\d{2}$/),
  hours_end: z.string().regex(/^\d{2}:\d{2}$/),
  hours_days: z.array(z.number().int().min(0).max(6)).max(7),
  after_hours_message: z.string().max(600),
  handoff_message: z.string().max(600),
});

export const saveAiSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => settingsSchema.parse(input))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { officeId, role, profileId } = await getContextOffice(ctx);
    if (!isAdmin(role)) throw new Error("FORBIDDEN");

    const { data: saved, error } = await ctx.supabase
      .from("ai_agent_settings")
      .upsert({ ...data, office_id: officeId }, { onConflict: "office_id" })
      .select("*")
      .single();
    if (error) throw new Error("SAVE_ERROR");

    await ctx.supabase.from("audit_logs").insert({
      office_id: officeId,
      actor_profile_id: profileId,
      action: "ai_settings_updated",
      entity: "ai_agent_settings",
      entity_id: saved.id,
      metadata: { enabled: data.enabled, agent_name: data.agent_name },
    });

    return saved as AiSettings;
  });

export const listConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as unknown as Ctx;
    const { officeId } = await getContextOffice(ctx);
    const { data } = await ctx.supabase
      .from("ai_conversations")
      .select("id, title, status, channel, last_message_at, created_at")
      .eq("office_id", officeId)
      .order("last_message_at", { ascending: false })
      .limit(50);
    return (data ?? []) as AiConversation[];
  });

export const createConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as unknown as Ctx;
    const { officeId, profileId } = await getContextOffice(ctx);
    const { data, error } = await ctx.supabase
      .from("ai_conversations")
      .insert({ office_id: officeId, created_by: profileId, title: "Conversa de teste", channel: "test" })
      .select("id, title, status, channel, last_message_at, created_at")
      .single();
    if (error) throw new Error("CREATE_ERROR");
    return data as AiConversation;
  });

export const getMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ conversationId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { officeId } = await getContextOffice(ctx);
    const { data: rows } = await ctx.supabase
      .from("ai_messages")
      .select("id, role, content, created_at")
      .eq("office_id", officeId)
      .eq("conversation_id", data.conversationId)
      .order("created_at", { ascending: true });
    return (rows ?? []) as AiMessage[];
  });

export const setConversationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        conversationId: z.string().uuid(),
        status: z.enum(["ai", "waiting_human", "human", "closed"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { officeId, profileId } = await getContextOffice(ctx);
    const { error } = await ctx.supabase
      .from("ai_conversations")
      .update({ status: data.status })
      .eq("id", data.conversationId)
      .eq("office_id", officeId);
    if (error) throw new Error("UPDATE_ERROR");

    await ctx.supabase.from("audit_logs").insert({
      office_id: officeId,
      actor_profile_id: profileId,
      action: "ai_conversation_status_changed",
      entity: "ai_conversations",
      entity_id: data.conversationId,
      metadata: { status: data.status },
    });
    return { status: data.status };
  });

function isOutsideHours(settings: AiSettings, timezone: string) {
  if (settings.hours_mode === "always") return false;
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
      hour12: false,
    });
    const parts = fmt.formatToParts(new Date());
    const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
    const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
    const wdName = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
    const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const day = map[wdName] ?? 1;
    if (!settings.hours_days.includes(day)) return true;
    const now = hour * 60 + minute;
    const [sh, sm] = settings.hours_start.split(":").map(Number);
    const [eh, em] = settings.hours_end.split(":").map(Number);
    return now < (sh ?? 0) * 60 + (sm ?? 0) || now > (eh ?? 23) * 60 + (em ?? 59);
  } catch {
    return false;
  }
}

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        conversationId: z.string().uuid(),
        content: z.string().min(1).max(4000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { officeId, profileId, officeName, timezone } = await getContextOffice(ctx);

    const { data: conversation } = await ctx.supabase
      .from("ai_conversations")
      .select("id, status, title")
      .eq("id", data.conversationId)
      .eq("office_id", officeId)
      .maybeSingle();
    if (!conversation) throw new Error("NOT_FOUND");

    const { data: settingsRow } = await ctx.supabase
      .from("ai_agent_settings")
      .select("*")
      .eq("office_id", officeId)
      .maybeSingle();
    const settings: AiSettings = settingsRow
      ? { ...(settingsRow as AiSettings), tones: settingsRow.tones ?? [], hours_days: settingsRow.hours_days ?? [] }
      : { ...DEFAULTS, office_id: officeId };

    // Save the incoming message first — it is kept even if the model fails.
    const { data: userMessage, error: insertError } = await ctx.supabase
      .from("ai_messages")
      .insert({
        conversation_id: data.conversationId,
        office_id: officeId,
        role: "user",
        content: data.content,
        author_profile_id: profileId,
      })
      .select("id, role, content, created_at")
      .single();
    if (insertError) throw new Error("SAVE_ERROR");

    await ctx.supabase
      .from("ai_conversations")
      .update({
        last_message_at: new Date().toISOString(),
        ...(conversation.title === "Conversa de teste"
          ? { title: data.content.slice(0, 60) }
          : {}),
      })
      .eq("id", data.conversationId)
      .eq("office_id", officeId);

    if (conversation.status !== "ai") {
      return { userMessage: userMessage as AiMessage, assistantMessage: null, aiSkipped: "human" as const };
    }

    const history = await ctx.supabase
      .from("ai_messages")
      .select("role, content")
      .eq("office_id", officeId)
      .eq("conversation_id", data.conversationId)
      .in("role", ["user", "assistant"])
      .order("created_at", { ascending: true })
      .limit(40);

    const { generateAssistantReply, buildInstructions, AiNotConfiguredError, AiProviderError } =
      await import("./ai-attendance.server");

    const instructions = buildInstructions({
      agentName: settings.agent_name,
      officeName,
      tones: settings.tones,
      objective: settings.objective,
      behavior: settings.behavior,
      rules: settings.rules,
      handoffMessage: settings.handoff_message,
      outsideHours: isOutsideHours(settings, timezone),
      afterHoursMessage: settings.after_hours_message,
    });

    try {
      const reply = await generateAssistantReply({
        model: settings.model || "openai/gpt-6-astra",
        instructions,
        turns: (history.data ?? []) as { role: "user" | "assistant"; content: string }[],
      });

      const { data: assistantMessage } = await ctx.supabase
        .from("ai_messages")
        .insert({
          conversation_id: data.conversationId,
          office_id: officeId,
          role: "assistant",
          content: reply.text,
        })
        .select("id, role, content, created_at")
        .single();

      await ctx.supabase.from("ai_usage_logs").insert({
        office_id: officeId,
        conversation_id: data.conversationId,
        model: reply.model,
        prompt_tokens: reply.promptTokens,
        completion_tokens: reply.completionTokens,
        total_tokens: reply.totalTokens,
        duration_ms: reply.durationMs,
        status: "success",
      });

      await ctx.supabase
        .from("ai_conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", data.conversationId)
        .eq("office_id", officeId);

      return {
        userMessage: userMessage as AiMessage,
        assistantMessage: assistantMessage as AiMessage,
        aiSkipped: null,
      };
    } catch (error) {
      let code = "AI_ERROR";
      if (error instanceof AiNotConfiguredError) code = "AI_NOT_CONFIGURED";
      else if (error instanceof AiProviderError) {
        if (error.status === 402) code = "AI_NO_CREDITS";
        else if (error.status === 429) code = "AI_RATE_LIMITED";
        else if (error.status === 403) code = "AI_BLOCKED";
      }
      await ctx.supabase.from("ai_usage_logs").insert({
        office_id: officeId,
        conversation_id: data.conversationId,
        model: settings.model,
        status: code,
      });
      return { userMessage: userMessage as AiMessage, assistantMessage: null, aiSkipped: code };
    }
  });
