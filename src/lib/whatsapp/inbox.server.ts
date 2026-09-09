// Persistência da caixa de entrada do WhatsApp — agnóstica de provedor.
// Recebe eventos já normalizados pelo WhatsAppService.
import { createHash } from "crypto";
import { admin, getOfficeChannel } from "./service.server";
import type { WhatsAppWebhookEvents } from "./types";

const DOCUMENT_BUCKET = "documents";
const MAX_AUTO_DOCUMENT_BYTES = 25 * 1024 * 1024;
const AUTO_DOCUMENT_EXTENSIONS = new Set(["pdf", "docx", "txt", "jpg", "jpeg", "png"]);

async function recordEvent(officeId: string, externalEventId: string, eventType: string) {
  const db = await admin();
  const { error } = await db
    .from("whatsapp_webhook_events")
    .insert({ office_id: officeId, external_event_id: externalEventId, event_type: eventType });
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

  const columns = "id, status, ai_enabled, unread_count, service_status, assigned_to";
  const { data: existingConv } = await db
    .from("whatsapp_conversations")
    .select(columns)
    .eq("office_id", officeId)
    .eq("contact_id", contactId)
    .maybeSingle();
  if (existingConv) return { ...existingConv, contactId, isNew: false as const };

  const { data: conv, error } = await db
    .from("whatsapp_conversations")
    .insert({ office_id: officeId, contact_id: contactId })
    .select(columns)
    .single();
  if (error || !conv) throw new Error("CONVERSATION_ERROR");
  return { ...conv, contactId, isNew: true as const };
}

async function recordConversationEvent(
  officeId: string,
  conversationId: string,
  eventType: "reopened" | "status_changed" | "message_sent",
  description: string,
) {
  const db = await admin();
  await db.from("conversation_events").insert({
    office_id: officeId,
    conversation_id: conversationId,
    event_type: eventType,
    description,
  });
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
    const externalId = await WhatsAppService.sendText(options.officeId, options.toPhone, options.text);
    if (row) {
      await db
        .from("whatsapp_messages")
        .update({ external_message_id: externalId, status: "sent", sent_at: new Date().toISOString() })
        .eq("id", row.id);
    }
    const patch: { last_message_at: string; service_status?: "aguardando_cliente" } = {
      last_message_at: new Date().toISOString(),
    };
    if (!options.fromAi && options.authorProfileId) patch.service_status = "aguardando_cliente";
    await db.from("whatsapp_conversations").update(patch).eq("id", options.conversationId);
    return { ok: true as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "falha no envio";
    if (row) await db.from("whatsapp_messages").update({ status: "failed", error_message: message }).eq("id", row.id);
    return { ok: false as const, message };
  }
}

async function replyWithAi(options: { officeId: string; conversationId: string; toPhone: string }) {
  const db = await admin();
  const { data: settings } = await db.from("ai_agent_settings").select("*").eq("office_id", options.officeId).maybeSingle();
  if (!settings?.enabled) return;

  const { data: office } = await db.from("offices").select("name, timezone").eq("id", options.officeId).maybeSingle();
  const { data: history } = await db
    .from("whatsapp_messages")
    .select("direction, content")
    .eq("conversation_id", options.conversationId)
    .eq("message_type", "text")
    .order("created_at", { ascending: true })
    .limit(40);
  const turns = (history ?? []).filter((m) => m.content).map((m) => ({
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
    reply = await generateAssistantReply({ model: settings.model || "openai/gpt-6-astra", instructions, turns });
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

function extensionFromFilename(filename: string | null, mimeType: string): string | null {
  const ext = filename?.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";
  if (AUTO_DOCUMENT_EXTENSIONS.has(ext)) return ext;
  const byMime: Record<string, string> = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "text/plain": "txt",
    "image/jpeg": "jpg",
    "image/png": "png",
  };
  return byMime[mimeType.toLowerCase()] ?? null;
}

function safeFilename(filename: string | null, extension: string) {
  const base = (filename ?? `documento.${extension}`)
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 180);
  return base.toLowerCase().endsWith(`.${extension}`) ? base : `${base}.${extension}`;
}

/**
 * Arquivos suportados enviados pelo cliente via WhatsApp são arquivados
 * automaticamente no módulo Documentos. A análise por IA continua manual.
 */
async function autoArchiveWhatsAppMedia(options: {
  officeId: string;
  conversationId: string;
  contactId: string;
  messageExternalId: string;
  profileName: string | null;
  mediaId: string;
  filename: string | null;
  mimeType: string | null;
  sha256: string | null;
  caption: string;
}) {
  const channel = await getOfficeChannel(options.officeId);
  if (!channel) return { saved: false as const, reason: "WHATSAPP_NOT_CONFIGURED" };

  const downloader = (channel.provider as unknown as {
    downloadMedia?: (mediaId: string, filename?: string | null) => Promise<{
      bytes: ArrayBuffer;
      mimeType: string;
      filename: string | null;
      sha256: string | null;
      sizeBytes: number;
    }>;
  }).downloadMedia;
  if (!downloader) return { saved: false as const, reason: "MEDIA_DOWNLOAD_UNSUPPORTED" };

  const media = await downloader.call(channel.provider, options.mediaId, options.filename);
  const mimeType = options.mimeType || media.mimeType || "application/octet-stream";
  const extension = extensionFromFilename(options.filename || media.filename, mimeType);
  if (!extension) return { saved: false as const, reason: "UNSUPPORTED_TYPE" };
  if (media.sizeBytes > MAX_AUTO_DOCUMENT_BYTES) return { saved: false as const, reason: "FILE_TOO_LARGE" };

  const checksum = media.sha256 || options.sha256 || createHash("sha256").update(Buffer.from(media.bytes)).digest("hex");
  const db = await admin();
  const { data: duplicate } = await db
    .from("documents")
    .select("id")
    .eq("office_id", options.officeId)
    .eq("checksum", checksum)
    .is("deleted_at", null)
    .maybeSingle();
  if (duplicate?.id) return { saved: true as const, documentId: duplicate.id, duplicate: true as const };

  const originalName = safeFilename(options.filename || media.filename, extension);
  const storagePath = `${options.officeId}/whatsapp/${options.conversationId}/${options.messageExternalId}-${originalName}`;
  const { error: uploadError } = await db.storage.from(DOCUMENT_BUCKET).upload(storagePath, Buffer.from(media.bytes), {
    contentType: mimeType,
    upsert: false,
  });
  if (uploadError) throw new Error(`DOCUMENT_STORAGE_ERROR:${uploadError.message}`);

  const caption = options.caption.trim();
  const { data: inserted, error: insertError } = await db
    .from("documents")
    .insert({
      office_id: options.officeId,
      storage_path: storagePath,
      original_name: originalName,
      name: originalName,
      extension,
      mime_type: mimeType,
      size_bytes: media.sizeBytes,
      checksum,
      category: "outros",
      description: caption || null,
      contact_id: options.contactId,
      conversation_id: options.conversationId,
      processing_status: "aguardando",
      analysis_status: "nao_analisado",
      metadata: {
        origin: "whatsapp",
        source: "whatsapp",
        whatsapp_message_id: options.messageExternalId,
        whatsapp_media_id: options.mediaId,
        received_from: options.profileName,
        caption: caption || null,
        auto_saved: true,
      },
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    await db.storage.from(DOCUMENT_BUCKET).remove([storagePath]);
    throw new Error(`DOCUMENT_CREATE_ERROR:${insertError?.message ?? "unknown"}`);
  }

  await db.from("audit_logs").insert({
    office_id: options.officeId,
    actor_profile_id: null,
    action: "document.auto_saved_from_whatsapp",
    entity: "documents",
    entity_id: inserted.id,
    metadata: {
      conversation_id: options.conversationId,
      whatsapp_message_id: options.messageExternalId,
      original_name: originalName,
      size_bytes: media.sizeBytes,
    },
  });

  return { saved: true as const, documentId: inserted.id, duplicate: false as const };
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
        await db.from("whatsapp_messages").update(patch).eq("office_id", officeId).eq("external_message_id", status.externalId);
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
      const content = message.text || (message.type === "text" ? "" : `[mensagem do tipo ${message.type} recebida]`);

      const { error: messageInsertError } = await db.from("whatsapp_messages").insert({
        office_id: officeId,
        conversation_id: conversation.id,
        external_message_id: message.externalId,
        direction: "inbound",
        message_type: message.type,
        content,
        status: "delivered",
        delivered_at: message.timestamp,
      });
      if (messageInsertError) throw new Error("MESSAGE_CREATE_ERROR");

      const wasClosed = conversation.service_status === "encerrada";
      const nextServiceStatus = wasClosed
        ? "aberta"
        : conversation.assigned_to
          ? "aguardando_equipe"
          : conversation.service_status === "aguardando_cliente"
            ? "aguardando_equipe"
            : conversation.service_status;

      const conversationPatch: {
        last_message_at: string;
        unread_count: number;
        service_status: "aberta" | "aguardando_equipe" | "aguardando_cliente" | "em_atendimento" | "encerrada";
        status?: "ai" | "human";
        ai_enabled?: boolean;
        closed_at?: string | null;
      } = {
        last_message_at: message.timestamp,
        unread_count: (conversation.unread_count ?? 0) + 1,
        service_status: nextServiceStatus,
      };
      if (wasClosed) {
        conversationPatch.status = conversation.assigned_to ? "human" : "ai";
        conversationPatch.ai_enabled = !conversation.assigned_to;
        conversationPatch.closed_at = null;
      }
      await db.from("whatsapp_conversations").update(conversationPatch).eq("id", conversation.id);

      if (wasClosed) {
        await recordConversationEvent(officeId, conversation.id, "reopened", "Conversa reaberta por nova mensagem do cliente.");
      }

      await db.from("notifications").insert({
        office_id: officeId,
        profile_id: conversation.assigned_to ?? null,
        conversation_id: conversation.id,
        type: conversation.isNew ? "new_conversation" : "new_message",
        title: conversation.isNew ? `Nova conversa de ${message.profileName ?? message.from}` : `Nova mensagem de ${message.profileName ?? message.from}`,
        body: content.slice(0, 160) || null,
      });

      // Etapa 08 — anexo suportado recebido do WhatsApp é arquivado automaticamente.
      if (message.mediaId) {
        try {
          await autoArchiveWhatsAppMedia({
            officeId,
            conversationId: conversation.id,
            contactId: conversation.contactId,
            messageExternalId: message.externalId,
            profileName: message.profileName,
            mediaId: message.mediaId,
            filename: message.mediaFilename ?? null,
            mimeType: message.mediaMimeType ?? null,
            sha256: message.mediaSha256 ?? null,
            caption: message.text ?? "",
          });
        } catch (error) {
          // O anexo não deve impedir a entrega da mensagem nem a IA.
          console.error("[whatsapp:document-auto-save]", error instanceof Error ? error.message : "erro");
        }
      }

      const channel = await getOfficeChannel(officeId);
      const canReply = conversation.status === "ai" && conversation.ai_enabled && message.type === "text" && Boolean(channel);
      if (canReply) {
        await replyWithAi({ officeId, conversationId: conversation.id, toPhone: message.from });
      }

      // Etapa 04 — qualificação inteligente sobre a conversa real.
      if (message.type === "text" && content.trim()) {
        try {
          const { ensureWhatsappLead, qualifyLead } = await import("@/lib/leads/qualification.server");
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
          console.error("[lead-qualification]", error instanceof Error ? error.message : "erro");
        }
      }

      await finishEvent(message.externalId, null);
    } catch (error) {
      await finishEvent(message.externalId, error instanceof Error ? error.message : "erro");
    }
  }

  await db.from("whatsapp_connections").update({ last_sync_at: new Date().toISOString() }).eq("office_id", officeId);
}