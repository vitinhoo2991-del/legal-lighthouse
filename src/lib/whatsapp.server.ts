// Server-only WhatsApp Cloud API service. Never imported by client code.
import { createHmac, timingSafeEqual } from "crypto";

const GRAPH_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

export class WhatsAppApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function graph<T>(path: string, accessToken: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${GRAPH_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const body = (await response.json().catch(() => ({}))) as {
    error?: { message?: string; type?: string; code?: number };
  };
  if (!response.ok) {
    // Never log tokens — only the provider's own message.
    const message = body.error?.message ?? `HTTP ${response.status}`;
    console.error("[whatsapp]", response.status, message);
    throw new WhatsAppApiError(response.status, message);
  }
  return body as T;
}

export interface PhoneNumberInfo {
  id: string;
  display_phone_number?: string;
  verified_name?: string;
  quality_rating?: string;
}

export async function fetchPhoneNumber(accessToken: string, phoneNumberId: string) {
  return graph<PhoneNumberInfo>(
    `/${encodeURIComponent(phoneNumberId)}?fields=id,display_phone_number,verified_name,quality_rating`,
    accessToken,
  );
}

export async function sendTextMessage(options: {
  accessToken: string;
  phoneNumberId: string;
  to: string;
  text: string;
}): Promise<string> {
  const payload = await graph<{ messages?: Array<{ id: string }> }>(
    `/${encodeURIComponent(options.phoneNumberId)}/messages`,
    options.accessToken,
    {
      method: "POST",
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: options.to,
        type: "text",
        text: { preview_url: false, body: options.text },
      }),
    },
  );
  const id = payload.messages?.[0]?.id;
  if (!id) throw new WhatsAppApiError(502, "resposta sem identificador de mensagem");
  return id;
}

export function verifyMetaSignature(appSecret: string, rawBody: string, header: string | null) {
  if (!header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const received = header.slice("sha256=".length);
  const a = Buffer.from(received, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// ---------------------------------------------------------------------------
// Webhook processing (service role — the caller is Meta, not a logged-in user)
// ---------------------------------------------------------------------------

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

async function admin(): Promise<Admin> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function getOfficeCredentials(officeId: string) {
  const db = await admin();
  const { data } = await db
    .from("whatsapp_credentials")
    .select("access_token, app_secret, verify_token")
    .eq("office_id", officeId)
    .maybeSingle();
  return data ?? null;
}

interface InboundMessage {
  externalId: string;
  from: string;
  profileName: string | null;
  type: string;
  text: string;
  timestamp: string;
}

interface StatusUpdate {
  externalId: string;
  status: string;
  timestamp: string;
  errorMessage: string | null;
}

function parseEntry(payload: unknown) {
  const inbound: InboundMessage[] = [];
  const statuses: StatusUpdate[] = [];
  const body = payload as {
    entry?: Array<{
      changes?: Array<{
        value?: {
          contacts?: Array<{ wa_id?: string; profile?: { name?: string } }>;
          messages?: Array<Record<string, any>>;
          statuses?: Array<Record<string, any>>;
        };
      }>;
    }>;
  };
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value ?? {};
      const profileName = value.contacts?.[0]?.profile?.name ?? null;
      for (const m of value.messages ?? []) {
        const type = String(m["type"] ?? "unknown");
        const text =
          type === "text"
            ? String(m["text"]?.body ?? "")
            : type === "button"
              ? String(m["button"]?.text ?? "")
              : type === "interactive"
                ? String(
                    m["interactive"]?.button_reply?.title ??
                      m["interactive"]?.list_reply?.title ??
                      "",
                  )
                : "";
        inbound.push({
          externalId: String(m["id"]),
          from: String(m["from"] ?? ""),
          profileName,
          type,
          text,
          timestamp: new Date(Number(m["timestamp"] ?? Date.now() / 1000) * 1000).toISOString(),
        });
      }
      for (const s of value.statuses ?? []) {
        statuses.push({
          externalId: String(s["id"]),
          status: String(s["status"] ?? ""),
          timestamp: new Date(Number(s["timestamp"] ?? Date.now() / 1000) * 1000).toISOString(),
          errorMessage: s["errors"]?.[0]?.title ? String(s["errors"][0].title) : null,
        });
      }
    }
  }
  return { inbound, statuses };
}

async function recordEvent(officeId: string, externalEventId: string, eventType: string) {
  const db = await admin();
  const { error } = await db
    .from("whatsapp_webhook_events")
    .insert({ office_id: officeId, external_event_id: externalEventId, event_type: eventType });
  // Unique violation => already processed (idempotency).
  if (error) return false;
  return true;
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

async function replyWithAi(options: {
  officeId: string;
  conversationId: string;
  toPhone: string;
  accessToken: string;
  phoneNumberId: string;
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

  const { generateAssistantReply, buildInstructions } = await import("./ai-attendance.server");
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

  const { data: row } = await db
    .from("whatsapp_messages")
    .insert({
      office_id: options.officeId,
      conversation_id: options.conversationId,
      direction: "outbound",
      message_type: "text",
      content: reply.text,
      status: "queued",
      from_ai: true,
    })
    .select("id")
    .single();

  try {
    const externalId = await sendTextMessage({
      accessToken: options.accessToken,
      phoneNumberId: options.phoneNumberId,
      to: options.toPhone,
      text: reply.text,
    });
    if (row) {
      await db
        .from("whatsapp_messages")
        .update({ external_message_id: externalId, status: "sent", sent_at: new Date().toISOString() })
        .eq("id", row.id);
    }
  } catch (error) {
    if (row) {
      await db
        .from("whatsapp_messages")
        .update({
          status: "failed",
          error_message: error instanceof Error ? error.message : "falha no envio",
        })
        .eq("id", row.id);
    }
  }

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

export async function processWebhookPayload(officeId: string, payload: unknown) {
  const db = await admin();
  const { inbound, statuses } = parseEntry(payload);

  const { data: connection } = await db
    .from("whatsapp_connections")
    .select("external_phone_number_id, status")
    .eq("office_id", officeId)
    .maybeSingle();

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

      const credentials = await getOfficeCredentials(officeId);
      const canReply =
        conversation.status === "ai" &&
        conversation.ai_enabled &&
        message.type === "text" &&
        credentials?.access_token &&
        connection?.external_phone_number_id;

      if (canReply) {
        await replyWithAi({
          officeId,
          conversationId: conversation.id,
          toPhone: message.from,
          accessToken: credentials!.access_token,
          phoneNumberId: connection!.external_phone_number_id!,
        });
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
