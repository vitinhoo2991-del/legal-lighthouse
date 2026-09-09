// Etapa 09 — Treinamento / Base de conhecimento.
// Conteúdo isolado por escritório. O módulo também expõe um recuperador server-side
// simples e determinístico para que as próximas integrações de IA possam consumir a base.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

type Ctx = { supabase: any; userId: string };

export const KNOWLEDGE_TYPES = [
  { value: "faq", label: "Perguntas frequentes" },
  { value: "orientacao", label: "Orientações" },
  { value: "procedimento", label: "Procedimentos internos" },
  { value: "politica", label: "Políticas do escritório" },
  { value: "modelo", label: "Modelos e padrões" },
  { value: "outro", label: "Outro" },
] as const;

export type KnowledgeType = (typeof KNOWLEDGE_TYPES)[number]["value"];

export interface KnowledgeItem {
  id: string;
  title: string;
  content: string;
  content_type: KnowledgeType;
  tags: string[];
  enabled: boolean;
  priority: number;
  source_document_id: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

async function getOffice(ctx: Ctx) {
  const { data, error } = await ctx.supabase
    .from("profiles")
    .select("id, office_id, role")
    .eq("auth_user_id", ctx.userId)
    .maybeSingle();
  if (error) throw new Error("PROFILE_ERROR");
  if (!data?.office_id) throw new Error("NO_OFFICE");
  return { profileId: data.id as string, officeId: data.office_id as string, role: data.role as string };
}

function canManage(role: string) {
  return role === "owner" || role === "admin";
}

function cleanTags(tags: string[]) {
  return [...new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))].slice(0, 20);
}

const itemSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(180),
  content: z.string().trim().min(1).max(30000),
  contentType: z.enum(["faq", "orientacao", "procedimento", "politica", "modelo", "outro"]),
  tags: z.array(z.string().max(40)).max(20).default([]),
  enabled: z.boolean().default(true),
  priority: z.number().int().min(0).max(100).default(50),
  sourceDocumentId: z.string().uuid().nullable().optional(),
});

export const listKnowledgeItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ search: z.string().max(160).optional(), type: z.string().optional(), enabled: z.boolean().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { officeId } = await getOffice(ctx);
    let query = ctx.supabase
      .from("knowledge_items")
      .select("id,title,content,content_type,tags,enabled,priority,source_document_id,created_by,updated_by,created_at,updated_at")
      .eq("office_id", officeId)
      .is("deleted_at", null)
      .order("priority", { ascending: false })
      .order("updated_at", { ascending: false });
    if (data.search?.trim()) {
      const term = data.search.trim().replace(/[%_]/g, "");
      query = query.or(`title.ilike.%${term}%,content.ilike.%${term}%`);
    }
    if (data.type) query = query.eq("content_type", data.type);
    if (typeof data.enabled === "boolean") query = query.eq("enabled", data.enabled);
    const { data: rows, error } = await query;
    if (error) throw new Error("LIST_ERROR");
    return (rows ?? []) as KnowledgeItem[];
  });

export const getKnowledgeItem = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { officeId } = await getOffice(ctx);
    const { data: row, error } = await ctx.supabase
      .from("knowledge_items")
      .select("id,title,content,content_type,tags,enabled,priority,source_document_id,created_by,updated_by,created_at,updated_at")
      .eq("id", data.id)
      .eq("office_id", officeId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw new Error("GET_ERROR");
    if (!row) throw new Error("NOT_FOUND");
    return row as KnowledgeItem;
  });

export const saveKnowledgeItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => itemSchema.parse(input))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { officeId, profileId, role } = await getOffice(ctx);
    if (!canManage(role)) throw new Error("FORBIDDEN");
    const payload = {
      title: data.title,
      content: data.content,
      content_type: data.contentType,
      tags: cleanTags(data.tags),
      enabled: data.enabled,
      priority: data.priority,
      source_document_id: data.sourceDocumentId ?? null,
      updated_by: profileId,
    };

    if (data.id) {
      const { data: current } = await ctx.supabase
        .from("knowledge_items")
        .select("*")
        .eq("id", data.id)
        .eq("office_id", officeId)
        .is("deleted_at", null)
        .maybeSingle();
      if (!current) throw new Error("NOT_FOUND");
      const { data: saved, error } = await ctx.supabase
        .from("knowledge_items")
        .update(payload)
        .eq("id", data.id)
        .eq("office_id", officeId)
        .select("*")
        .single();
      if (error) throw new Error("SAVE_ERROR");
      await ctx.supabase.from("knowledge_item_versions").insert({
        office_id: officeId,
        knowledge_item_id: data.id,
        version: Number(current.version ?? 1) + 1,
        title: saved.title,
        content: saved.content,
        content_type: saved.content_type,
        tags: saved.tags,
        enabled: saved.enabled,
        priority: saved.priority,
        changed_by: profileId,
      });
      await ctx.supabase.from("audit_logs").insert({
        office_id: officeId,
        actor_profile_id: profileId,
        action: "knowledge_item_updated",
        entity: "knowledge_items",
        entity_id: data.id,
        metadata: { title: saved.title },
      });
      return saved as KnowledgeItem;
    }

    const { data: saved, error } = await ctx.supabase
      .from("knowledge_items")
      .insert({ ...payload, office_id: officeId, created_by: profileId })
      .select("*")
      .single();
    if (error) throw new Error("CREATE_ERROR");
    await ctx.supabase.from("knowledge_item_versions").insert({
      office_id: officeId,
      knowledge_item_id: saved.id,
      version: 1,
      title: saved.title,
      content: saved.content,
      content_type: saved.content_type,
      tags: saved.tags,
      enabled: saved.enabled,
      priority: saved.priority,
      changed_by: profileId,
    });
    await ctx.supabase.from("audit_logs").insert({
      office_id: officeId,
      actor_profile_id: profileId,
      action: "knowledge_item_created",
      entity: "knowledge_items",
      entity_id: saved.id,
      metadata: { title: saved.title },
    });
    return saved as KnowledgeItem;
  });

export const deleteKnowledgeItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { officeId, profileId, role } = await getOffice(ctx);
    if (!canManage(role)) throw new Error("FORBIDDEN");
    const { error } = await ctx.supabase
      .from("knowledge_items")
      .update({ deleted_at: new Date().toISOString(), deleted_by: profileId, enabled: false, updated_by: profileId })
      .eq("id", data.id)
      .eq("office_id", officeId)
      .is("deleted_at", null);
    if (error) throw new Error("DELETE_ERROR");
    await ctx.supabase.from("audit_logs").insert({
      office_id: officeId,
      actor_profile_id: profileId,
      action: "knowledge_item_deleted",
      entity: "knowledge_items",
      entity_id: data.id,
    });
    return { ok: true };
  });

export const toggleKnowledgeItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid(), enabled: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { officeId, profileId, role } = await getOffice(ctx);
    if (!canManage(role)) throw new Error("FORBIDDEN");
    const { data: saved, error } = await ctx.supabase
      .from("knowledge_items")
      .update({ enabled: data.enabled, updated_by: profileId })
      .eq("id", data.id)
      .eq("office_id", officeId)
      .is("deleted_at", null)
      .select("*")
      .single();
    if (error) throw new Error("UPDATE_ERROR");
    await ctx.supabase.from("audit_logs").insert({
      office_id: officeId,
      actor_profile_id: profileId,
      action: "knowledge_item_toggled",
      entity: "knowledge_items",
      entity_id: data.id,
      metadata: { enabled: data.enabled },
    });
    return saved as KnowledgeItem;
  });

export const listKnowledgeVersions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { officeId } = await getOffice(ctx);
    const { data: rows, error } = await ctx.supabase
      .from("knowledge_item_versions")
      .select("id,knowledge_item_id,version,title,content,content_type,tags,enabled,priority,changed_by,created_at")
      .eq("knowledge_item_id", data.id)
      .eq("office_id", officeId)
      .order("version", { ascending: false });
    if (error) throw new Error("VERSIONS_ERROR");
    return rows ?? [];
  });

/** Recuperação server-side para IA. Não expõe conteúdo de outro escritório. */
export async function getKnowledgeContext(options: {
  supabase: any;
  officeId: string;
  query: string;
  limit?: number;
}) {
  const term = options.query.trim().replace(/[%_]/g, "").slice(0, 160);
  if (!term) return { items: [], context: "" };
  const limit = Math.min(Math.max(options.limit ?? 6, 1), 12);
  const words = [...new Set(term.toLowerCase().split(/\s+/).filter((w) => w.length >= 4))].slice(0, 8);
  const clauses = words.flatMap((word) => [`title.ilike.%${word}%`, `content.ilike.%${word}%`]);
  let query = options.supabase
    .from("knowledge_items")
    .select("id,title,content,content_type,tags,priority")
    .eq("office_id", options.officeId)
    .eq("enabled", true)
    .is("deleted_at", null)
    .order("priority", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (clauses.length) query = query.or(clauses.join(","));
  const { data: rows } = await query;
  const items = (rows ?? []) as Array<{ id: string; title: string; content: string; content_type: string; tags: string[]; priority: number }>;
  const context = items
    .map((item, index) => `FONTE INTERNA ${index + 1} — ${item.title}\nTipo: ${item.content_type}\nConteúdo: ${item.content}`)
    .join("\n\n");
  return { items, context };
}
