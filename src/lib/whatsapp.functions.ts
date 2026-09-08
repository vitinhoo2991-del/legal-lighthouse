import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type WaConnectionStatus = "disconnected" | "pending" | "connected" | "error";
export type WaDirection = "inbound" | "outbound";
export type WaMessageStatus = "queued" | "sent" | "delivered" | "read" | "failed";
export type WaConversationStatus = "ai" | "waiting_human" | "human" | "closed";

export interface WaConnection {
  status: WaConnectionStatus;
  phone_number: string | null;
  display_name: string | null;
  external_account_id: string | null;
  external_phone_number_id: string | null;
  last_error: string | null;
  connected_at: string | null;
  last_sync_at: string | null;
}

export interface WaOverview {
  officeId: string;
  officeName: string;
  canEdit: boolean;
  hasCredentials: boolean;
  hasAppSecret: boolean;
  aiEnabled: boolean;
  connection: WaConnection;
  webhookPath: string;
  stats: { received: number; sent: number; failed: number; events: number; eventErrors: number };
}

export interface WaConversationItem {
  id: string;
  status: WaConversationStatus;
  ai_enabled: boolean;
  unread_count: number;
  last_message_at: string;
  contact: { id: string; phone_number: string; name: string | null; profile_name: string | null };
  last_message: { content: string; direction: WaDirection } | null;
}

export interface WaMessage {
  id: string;
  direction: WaDirection;
  message_type: string;
  content: string;
  status: WaMessageStatus;
  error_message: string | null;
  from_ai: boolean;
  created_at: string;
}

type Ctx = { supabase: any; userId: string };

async function getContextOffice(context: Ctx) {
  const { data, error } = await context.supabase
    .from("profiles")
    .select("id, office_id, role, offices:office_id(name)")
    .eq("auth_user_id", context.userId)
    .maybeSingle();
  if (error) throw new Error("PROFILE_ERROR");
  if (!data?.office_id) throw new Error("NO_OFFICE");
  return {
    profileId: data.id as string,
    officeId: data.office_id as string,
    role: data.role as string,
    officeName: (data.offices?.name as string) ?? "Escritório",
  };
}

const isAdmin = (role: string) => role === "owner" || role === "admin";

const EMPTY_CONNECTION: WaConnection = {
  status: "disconnected",
  phone_number: null,
  display_name: null,
  external_account_id: null,
  external_phone_number_id: null,
  last_error: null,
  connected_at: null,
  last_sync_at: null,
};

async function audit(ctx: Ctx, officeId: string, profileId: string, action: string, metadata: unknown) {
  await ctx.supabase.from("audit_logs").insert({
    office_id: officeId,
    actor_profile_id: profileId,
    action,
    entity: "whatsapp",
    metadata: metadata as Record<string, unknown>,
  });
}

export const getWhatsappOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WaOverview> => {
    const ctx = context as unknown as Ctx;
    const { officeId, officeName, role } = await getContextOffice(ctx);

    const [{ data: conn }, { data: settings }] = await Promise.all([
      ctx.supabase.from("whatsapp_connections").select("*").eq("office_id", officeId).maybeSingle(),
      ctx.supabase.from("ai_agent_settings").select("enabled").eq("office_id", officeId).maybeSingle(),
    ]);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: credentials } = await supabaseAdmin
      .from("whatsapp_credentials")
      .select("app_secret")
      .eq("office_id", officeId)
      .maybeSingle();

    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const count = async (build: (q: any) => any) => {
      const { count: c } = await build(
        ctx.supabase.from("whatsapp_messages").select("id", { count: "exact", head: true }),
      );
      return c ?? 0;
    };

    const [received, sent, failed] = await Promise.all([
      count((q: any) => q.eq("office_id", officeId).eq("direction", "inbound").gte("created_at", since)),
      count((q: any) => q.eq("office_id", officeId).eq("direction", "outbound").gte("created_at", since)),
      count((q: any) => q.eq("office_id", officeId).eq("status", "failed").gte("created_at", since)),
    ]);

    const { count: events } = await ctx.supabase
      .from("whatsapp_webhook_events")
      .select("id", { count: "exact", head: true })
      .eq("office_id", officeId);
    const { count: eventErrors } = await ctx.supabase
      .from("whatsapp_webhook_events")
      .select("id", { count: "exact", head: true })
      .eq("office_id", officeId)
      .not("processing_error", "is", null);

    return {
      officeId,
      officeName,
      canEdit: isAdmin(role),
      hasCredentials: Boolean(credentials),
      hasAppSecret: Boolean(credentials?.app_secret),
      aiEnabled: Boolean(settings?.enabled),
      connection: conn ? ({ ...(conn as WaConnection) } as WaConnection) : EMPTY_CONNECTION,
      webhookPath: `/api/public/whatsapp/${officeId}`,
      stats: {
        received,
        sent,
        failed,
        events: events ?? 0,
        eventErrors: eventErrors ?? 0,
      },
    };
  });

const connectionSchema = z.object({
  external_phone_number_id: z.string().min(3).max(64),
  external_account_id: z.string().max(64).optional().default(""),
  access_token: z.string().min(20).max(1000).optional(),
  app_secret: z.string().max(500).optional(),
  verify_token: z.string().min(8).max(200).optional(),
});

export const saveWhatsappConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => connectionSchema.parse(input))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { officeId, profileId, role } = await getContextOffice(ctx);
    if (!isAdmin(role)) throw new Error("FORBIDDEN");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("whatsapp_credentials")
      .select("office_id, access_token, verify_token")
      .eq("office_id", officeId)
      .maybeSingle();

    const accessToken = data.access_token ?? existing?.access_token;
    if (!accessToken) throw new Error("MISSING_TOKEN");
    const verifyToken =
      data.verify_token ?? existing?.verify_token ?? crypto.randomUUID().replace(/-/g, "");

    const credentialPatch: {
      office_id: string;
      access_token: string;
      verify_token: string;
      updated_at: string;
      app_secret?: string | null;
    } = {
      office_id: officeId,
      access_token: accessToken,
      verify_token: verifyToken,
      updated_at: new Date().toISOString(),
    };
    if (data.app_secret !== undefined) credentialPatch.app_secret = data.app_secret || null;

    const { error: credError } = await supabaseAdmin
      .from("whatsapp_credentials")
      .upsert(credentialPatch, { onConflict: "office_id" });
    if (credError) throw new Error("SAVE_ERROR");

    const { error } = await ctx.supabase.from("whatsapp_connections").upsert(
      {
        office_id: officeId,
        external_phone_number_id: data.external_phone_number_id,
        external_account_id: data.external_account_id || null,
        status: "pending",
        last_error: null,
      },
      { onConflict: "office_id" },
    );
    if (error) throw new Error("SAVE_ERROR");

    await audit(ctx, officeId, profileId, "whatsapp_connection_saved", {
      phone_number_id: data.external_phone_number_id,
    });

    return { verifyToken };
  });

export const getWhatsappVerifyToken = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as unknown as Ctx;
    const { officeId, role } = await getContextOffice(ctx);
    if (!isAdmin(role)) throw new Error("FORBIDDEN");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("whatsapp_credentials")
      .select("verify_token")
      .eq("office_id", officeId)
      .maybeSingle();
    return { verifyToken: data?.verify_token ?? null };
  });

export const testWhatsappConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as unknown as Ctx;
    const { officeId, profileId, role } = await getContextOffice(ctx);
    if (!isAdmin(role)) throw new Error("FORBIDDEN");

    const { WhatsAppService } = await import("./whatsapp/service.server");
    try {
      const info = await WhatsAppService.getChannelInfo(officeId);
      if (!info) return { ok: false as const, code: "NOT_CONFIGURED" as const };
      await ctx.supabase
        .from("whatsapp_connections")
        .update({
          status: "connected",
          phone_number: info.phoneNumber,
          display_name: info.displayName,
          last_error: null,
          connected_at: new Date().toISOString(),
          last_sync_at: new Date().toISOString(),
        })
        .eq("office_id", officeId);
      await audit(ctx, officeId, profileId, "whatsapp_connection_tested", { ok: true });
      return { ok: true as const, phone: info.phoneNumber };
    } catch (error) {
      const message = error instanceof Error ? error.message : "falha na conexão";
      await ctx.supabase
        .from("whatsapp_connections")
        .update({ status: "error", last_error: message, last_sync_at: new Date().toISOString() })
        .eq("office_id", officeId);
      await audit(ctx, officeId, profileId, "whatsapp_connection_tested", { ok: false });
      return { ok: false as const, code: "API_ERROR" as const, message };
    }
  });


export const disconnectWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as unknown as Ctx;
    const { officeId, profileId, role } = await getContextOffice(ctx);
    if (!isAdmin(role)) throw new Error("FORBIDDEN");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("whatsapp_credentials").delete().eq("office_id", officeId);
    await ctx.supabase
      .from("whatsapp_connections")
      .update({
        status: "disconnected",
        connected_at: null,
        last_error: null,
        phone_number: null,
        display_name: null,
      })
      .eq("office_id", officeId);
    await audit(ctx, officeId, profileId, "whatsapp_disconnected", {});
    return { ok: true };
  });

const listSchema = z.object({
  filter: z.enum(["all", "unread", "open", "ai", "human", "closed"]).default("all"),
  search: z.string().max(120).default(""),
});

export const listWhatsappConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => listSchema.parse(input ?? {}))
  .handler(async ({ data, context }): Promise<WaConversationItem[]> => {
    const ctx = context as unknown as Ctx;
    const { officeId } = await getContextOffice(ctx);

    let query = ctx.supabase
      .from("whatsapp_conversations")
      .select(
        "id, status, ai_enabled, unread_count, last_message_at, contact:contact_id(id, phone_number, name, profile_name)",
      )
      .eq("office_id", officeId)
      .order("last_message_at", { ascending: false })
      .limit(100);

    if (data.filter === "unread") query = query.gt("unread_count", 0);
    if (data.filter === "ai") query = query.eq("status", "ai");
    if (data.filter === "human") query = query.eq("status", "human");
    if (data.filter === "closed") query = query.eq("status", "closed");
    if (data.filter === "open") query = query.in("status", ["ai", "waiting_human", "human"]);

    const { data: rows } = await query;
    let list = (rows ?? []) as WaConversationItem[];

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
      const lastByConv = new Map<string, { content: string; direction: WaDirection }>();
      for (const m of recent ?? []) {
        if (!lastByConv.has(m.conversation_id)) {
          lastByConv.set(m.conversation_id, { content: m.content, direction: m.direction });
        }
      }
      list = list.map((c) => ({ ...c, last_message: lastByConv.get(c.id) ?? null }));
    }

    return list;
  });

export const getWhatsappMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ conversationId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<WaMessage[]> => {
    const ctx = context as unknown as Ctx;
    const { officeId } = await getContextOffice(ctx);
    const { data: rows } = await ctx.supabase
      .from("whatsapp_messages")
      .select("id, direction, message_type, content, status, error_message, from_ai, created_at")
      .eq("office_id", officeId)
      .eq("conversation_id", data.conversationId)
      .order("created_at", { ascending: true })
      .limit(300);
    await ctx.supabase
      .from("whatsapp_conversations")
      .update({ unread_count: 0 })
      .eq("id", data.conversationId)
      .eq("office_id", officeId);
    return (rows ?? []) as WaMessage[];
  });

export const sendWhatsappMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ conversationId: z.string().uuid(), content: z.string().min(1).max(4000) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { officeId, profileId } = await getContextOffice(ctx);

    const { data: conversation } = await ctx.supabase
      .from("whatsapp_conversations")
      .select("id, contact:contact_id(phone_number)")
      .eq("id", data.conversationId)
      .eq("office_id", officeId)
      .maybeSingle();
    if (!conversation) throw new Error("NOT_FOUND");

    const { getOfficeChannel, sendOutboundText } = await import("./whatsapp.server");
    const channel = await getOfficeChannel(officeId);
    if (!channel) return { ok: false as const, code: "NOT_CONFIGURED" as const };

    const result = await sendOutboundText({
      officeId,
      conversationId: data.conversationId,
      toPhone: conversation.contact.phone_number,
      text: data.content,
      authorProfileId: profileId,
    });
    if (result.ok) return { ok: true as const };
    return { ok: false as const, code: "SEND_ERROR" as const, message: result.message };
  });


export const setWhatsappConversationMode = createServerFn({ method: "POST" })
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
      .from("whatsapp_conversations")
      .update({
        status: data.status,
        ai_enabled: data.status === "ai",
        assigned_to: data.status === "human" ? profileId : null,
        handed_off_at: data.status === "human" ? new Date().toISOString() : null,
      })
      .eq("id", data.conversationId)
      .eq("office_id", officeId);
    if (error) throw new Error("UPDATE_ERROR");

    await audit(ctx, officeId, profileId, "whatsapp_conversation_mode_changed", {
      conversation_id: data.conversationId,
      status: data.status,
    });
    return { status: data.status };
  });
