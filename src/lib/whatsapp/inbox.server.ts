// Persistência da caixa de entrada do WhatsApp — agnóstica de provedor.
// Recebe eventos já normalizados pelo WhatsAppService.
import { admin, getOfficeChannel } from "./service.server";
import type { WhatsAppWebhookEvents } from "./types";

async function recordEvent(officeId: string, externalEventId: string, eventType: string) {
  const db = await admin();
  const { error } = await db
    .from("whatsapp_webhook_events")
    .insert({ office_id: officeId, external_event_id: externalEventId, event_type: eventType });
  // Violação de unicidade => já processado (idempotência).
  return !error;
}

async function finishEvent(externalEventId: string, processingError: string | null) {
  const db = await admin();
  await db
    .from("whatsapp_webhook_events")
    .update({
      processed: !processingError,
      processing_error: processingError,
      processed_at: new Date().toISOString(),
    })
    .eq("external_event_id", externalEventId);
}

async function ensureConversation(officeId: string, phone: string, profileName: string | null) {
  const db = await admin();
  const { data: existingContact } = await db
    .from("whatsapp_contacts")
    .select("id")
    .eq("office_id", officeId)
    .eq("phone_number", phone)
    .maybeSingle();

  let contactId = existingContact?.id ?? null;
  if (!contactId) {
    const { data: created, error } = await db
      .from("whatsapp_contacts")
      .insert({ office_id: officeId, phone_number: phone, profile_name: profileName })
      .select("id")
      .single();
    if (error || !created) throw new Error("CONTACT_ERROR");
    contactId = created.id;
  } else if (profileName) {
    await db.from("whatsapp_contacts").update({ profile_name: profileName }).eq("id", contactId);
  }

  const { data: existingConv } = await db
    .from("whatsapp_conversations")
    .select("id, status, ai_enabled, unread_count")
    .eq("office_id", officeId)
    .eq("contact_id", contactId)
    .maybeSingle();

  if (existingConv) return { ...existingConv, contactId };

  const { data: conv, error } = await db
    .from("whatsapp_conversations")
    .insert({ office_id: officeId, contact_id: contactId })
    .select("id, status, ai_enabled, unread_count")
    .single();
  if (error || !conv) throw new Error("CONVERSATION_ERROR");
  return { ...conv, contactId };
}

function isOutsideHours(settings: any, timezone: string) {
  if (!settings || settings.hours_mode === "always") return false;
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
      hour12: false,
    }).formatToParts(new Date());
    const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
    const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
    const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const day = map[parts.find((p) => p.type === "weekday")?.value ?? "Mon"] ?? 1;
    if (!(settings.hours_days ?? []).includes(day)) return true;
    const now = hour * 60 + minute;
    const [sh, sm] = String(settings.hours_start ?? "09:00").split(":").map(Number);
    const [eh, em] = String(settings.hours_end ?? "18:00").split(":").map(Number);
    return now < (sh ?? 0) * 60 + (sm ?? 0) || now > (eh ?? 23) * 60 + (em ?? 59);
  } catch {
    return false;
  }
}

/** Envia texto pelo canal do escritório e registra a mensagem outbound. */
export async function sendOutboundText(options: {
  officeId: string;
  conversationId: string;
  toPhone: string;
  text: string;
  fromAi?: boolean;
  authorProfileId?: string | null;
}) {
  const db = await admin();
  const { data: row } = await db
    .from("whatsapp_messages")
    .insert({
      office_id: options.officeId,
      conversation_id: options.conversationId,
      direction: "outbound",
      message_type: "text",
      content: options.text,
      status: "queued",
      from_ai: options.fromAi ?? false,
      author_profile_id: options.authorProfileId ?? null,
    })
    .select("id")
    .single();

  try {
    const { WhatsAppService } = await import("./service.server");
    const externalId = await WhatsAppService.sendText(
      options.officeId,
      options.toPhone,
      options.text,
    );
    if (row) {
      await db
        .from("whatsapp_messages")
        .update({
          external_message_id: externalId,
          status: "sent",
          sent_at: new Date().toISOString(),
        })
        .eq("id", row.id);
    }
    await db
      .from("whatsapp_conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", options.conversationId);
    return { ok: true as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "falha no envio";
    if (row) {
      await db
        .from("whatsapp_messages")
        .update({ status: "failed", error_message: message })
        .eq("id", row.id);
    }
    return { ok: false as const, message };
  }
}

async function replyWithAi(options: {
  officeId: string;
  conversationId: string;
  toPhone: string;
}) {
  const db = await admin();
  const { data: settings } = await db
    .from("ai_agent_settings")
    .select("*")
    .eq("office_id", options.officeId)
    .maybeSingle();
  if (!settings?.enabled) return;

  const { data: office } = await db
    .from("offices")
    .select("name, timezone")
    .eq("id", options.officeId)
    .maybeSingle();

  const { data: history } = await db
    .from("whatsapp_messages")
    .select("direction, content")
    .eq("conversation_id", options.conversationId)
    .eq("message_type", "text")
    .order("created_at", { ascending: true })
    .limit(40);

  const turns = (history ?? [])
    .filter((m) => m.content)
    .map((m) => ({
      role: (m.direction === "inbound" ? "user" : "assistant") as "user" | "assistant",
      content: m.content,
    }));
  if (!turns.length) return;

  const { generateAssistantReply, buildInstructions } = await import("../ai-attendance.server");
  const instructions = buildInstructions({
    agentName: settings.agent_name,
    officeName: office?.name ?? "Escritório",
    tones: settings.tones ?? [],
    objective: settings.objective,
    behavior: settings.behavior,
    rules: settings.rules,
    handoffMessage: settings.handoff_message,
    outsideHours: isOutsideHours(settings, office?.timezone ?? "America/Sao_Paulo"),
    afterHoursMessage: settings.after_hours_message,
  });

  const started = Date.now();
  let reply;
  try {
    reply = await generateAssistantReply({
      model: settings.model || "openai/gpt-6-astra",
      instructions,
      turns,
    });
  } catch {
    await db.from("ai_usage_logs").insert({
      office_id: options.officeId,
      model: settings.model,
      status: "AI_ERROR",
      duration_ms: Date.now() - started,
    });
    return;
  }

  await sendOutboundText({
    officeId: options.officeId,
    conversationId: options.conversationId,
    toPhone: options.toPhone,
    text: reply.text,
    fromAi: true,
  });

  await db.from("ai_usage_logs").insert({
    office_id: options.officeId,
    model: reply.model,
    prompt_tokens: reply.promptTokens,
    completion_tokens: reply.completionTokens,
    total_tokens: reply.totalTokens,
    duration_ms: reply.durationMs,
    status: "success",
  });
}

export async function processInboundEvents(officeId: string, events: WhatsAppWebhookEvents) {
  const db = await admin();
  const { inbound, statuses } = events;

  for (const status of statuses) {
    const eventId = `${status.externalId}:${status.status}`;
    if (!(await recordEvent(officeId, eventId, `status.${status.status}`))) continue;
    try {
      const patch: {
        status?: "sent" | "delivered" | "read" | "failed";
        delivered_at?: string;
        read_at?: string;
        error_message?: string;
      } = {};
      if (status.status === "sent") patch.status = "sent";
      if (status.status === "delivered") {
        patch.status = "delivered";
        patch.delivered_at = status.timestamp;
      }
      if (status.status === "read") {
        patch.status = "read";
        patch.read_at = status.timestamp;
      }
      if (status.status === "failed") {
        patch.status = "failed";
        patch.error_message = status.errorMessage ?? "falha reportada pelo WhatsApp";
      }
      if (Object.keys(patch).length) {
        await db
          .from("whatsapp_messages")
          .update(patch)
          .eq("office_id", officeId)
          .eq("external_message_id", status.externalId);
      }
      await finishEvent(eventId, null);
    } catch (error) {
      await finishEvent(eventId, error instanceof Error ? error.message : "erro");
    }
  }

  for (const message of inbound) {
    if (!(await recordEvent(officeId, message.externalId, `message.${message.type}`))) continue;
    try {
      const conversation = await ensureConversation(officeId, message.from, message.profileName);
      const content =
        message.text ||
        (message.type === "text" ? "" : `[mensagem do tipo ${message.type} recebida]`);

      await db.from("whatsapp_messages").insert({
        office_id: officeId,
        conversation_id: conversation.id,
        external_message_id: message.externalId,
        direction: "inbound",
        message_type: message.type,
        content,
        status: "delivered",
        delivered_at: message.timestamp,
      });

      await db
        .from("whatsapp_conversations")
        .update({
          last_message_at: message.timestamp,
          unread_count: (conversation.unread_count ?? 0) + 1,
        })
        .eq("id", conversation.id);

      const channel = await getOfficeChannel(officeId);
      const canReply =
        conversation.status === "ai" &&
        conversation.ai_enabled &&
        message.type === "text" &&
        Boolean(channel);

      if (canReply) {
        await replyWithAi({
          officeId,
          conversationId: conversation.id,
          toPhone: message.from,
        });
      }

      // Etapa 04 — qualificação inteligente sobre a conversa real.
      if (message.type === "text" && content.trim()) {
        try {
          const { ensureWhatsappLead, qualifyLead } = await import(
            "@/lib/leads/qualification.server"
          );
          const leadId = await ensureWhatsappLead({
            officeId,
            contactId: conversation.contactId,
            conversationId: conversation.id,
            phone: message.from,
            profileName: message.profileName,
          });
          if (leadId) {
            const { data: history } = await db
              .from("whatsapp_messages")
              .select("direction, content")
              .eq("office_id", officeId)
              .eq("conversation_id", conversation.id)
              .order("created_at", { ascending: true })
              .limit(40);
            await qualifyLead({
              officeId,
              leadId,
              conversationId: null,
              messageMarker: message.externalId,
              humanHandled: conversation.status === "human",
              turns: (history ?? []).map((m) => ({
                role: m.direction === "inbound" ? ("user" as const) : ("assistant" as const),
                content: m.content,
              })),
            });
          }
        } catch (error) {
          console.error(
            "[lead-qualification]",
            error instanceof Error ? error.message : "erro",
          );
        }
      }

      await finishEvent(message.externalId, null);
    } catch (error) {
      await finishEvent(message.externalId, error instanceof Error ? error.message : "erro");
    }
  }

  await db
    .from("whatsapp_connections")
    .update({ last_sync_at: new Date().toISOString() })
    .eq("office_id", officeId);
}
