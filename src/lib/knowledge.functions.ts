// Etapa 09 — Base de conhecimento + treinamento da IA.
// Todo o conteúdo é isolado por escritório (office_id) no frontend, no backend e no banco (RLS).
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
  version: number;
  source_document_id: string | null;
  source_document_name?: string | null;
  created_by: string | null;
  updated_by: string | null;
  updated_by_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeVersion {
  id: string;
  knowledge_item_id: string;
  version: number;
  title: string;
  content: string;
  content_type: KnowledgeType;
  tags: string[];
  enabled: boolean;
  priority: number;
  source_document_id: string | null;
  changed_by: string | null;
  changed_by_name: string | null;
  created_at: string;
}

export interface KnowledgeStats {
  total: number;
  enabled: number;
  disabled: number;
  byType: Record<string, number>;
  lastUpdatedAt: string | null;
  canManage: boolean;
}

const ITEM_FIELDS =
  "id,title,content,content_type,tags,enabled,priority,version,source_document_id,created_by,updated_by,created_at,updated_at";

async function getOffice(ctx: Ctx) {
  const { data, error } = await ctx.supabase
    .from("profiles")
    .select("id, office_id, role")
    .eq("auth_user_id", ctx.userId)
    .maybeSingle();
  if (error) throw new Error("PROFILE_ERROR");
  if (!data?.office_id) throw new Error("NO_OFFICE");
  return {
    profileId: data.id as string,
    officeId: data.office_id as string,
    role: data.role as string,
  };
}

function canManage(role: string) {
  return role === "owner" || role === "admin";
}

function cleanTags(tags: string[]) {
  return [...new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))].slice(0, 20);
}

/** Erros técnicos ficam no log do servidor; o cliente recebe apenas um código tratável. */
function throwDatabaseError(error: unknown, fallback: string): never {
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message)
      : "";
  const code =
    error && typeof error === "object" && "code" in error ? String((error as { code?: unknown }).code) : "";
  console.error(`[Knowledge] ${fallback}`, { code, message });
  if (code === "42P01" || code === "PGRST205") throw new Error("KNOWLEDGE_TABLE_MISSING");
  if (code === "42501" || code === "PGRST301") throw new Error("FORBIDDEN");
  throw new Error(fallback);
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

/** Insere uma linha de histórico usando exatamente a versão gravada pelo banco. */
async function recordVersion(
  ctx: Ctx,
  officeId: string,
  profileId: string,
  row: {
    id: string;
    version: number;
    title: string;
    content: string;
    content_type: string;
    tags: string[];
    enabled: boolean;
    priority: number;
    source_document_id: string | null;
  },
) {
  const { error } = await ctx.supabase.from("knowledge_item_versions").insert({
    office_id: officeId,
    knowledge_item_id: row.id,
    version: row.version,
    title: row.title,
    content: row.content,
    content_type: row.content_type,
    tags: row.tags,
    enabled: row.enabled,
    priority: row.priority,
    source_document_id: row.source_document_id,
    changed_by: profileId,
  });
  if (error) throwDatabaseError(error, "VERSION_ERROR");
}

async function audit(
  ctx: Ctx,
  officeId: string,
  profileId: string,
  action: string,
  entityId: string,
  metadata: Record<string, unknown> = {},
) {
  const { error } = await ctx.supabase.from("audit_logs").insert({
    office_id: officeId,
    actor_profile_id: profileId,
    action,
    entity: "knowledge_items",
    entity_id: entityId,
    metadata,
  });
  if (error) console.error("[Knowledge] AUDIT_ERROR", error);
}

/** Nomes de autores e documentos vinculados, sempre dentro do mesmo escritório. */
async function decorate(ctx: Ctx, officeId: string, rows: any[]): Promise<KnowledgeItem[]> {
  if (!rows.length) return [];
  const profileIds = [...new Set(rows.map((r) => r.updated_by ?? r.created_by).filter(Boolean))];
  const documentIds = [...new Set(rows.map((r) => r.source_document_id).filter(Boolean))];
  const [profiles, documents] = await Promise.all([
    profileIds.length
      ? ctx.supabase.from("profiles").select("id,name").eq("office_id", officeId).in("id", profileIds)
      : Promise.resolve({ data: [] }),
    documentIds.length
      ? ctx.supabase.from("documents").select("id,name").eq("office_id", officeId).in("id", documentIds)
      : Promise.resolve({ data: [] }),
  ]);
  const profileMap = new Map((profiles.data ?? []).map((p: any) => [p.id, p.name]));
  const documentMap = new Map((documents.data ?? []).map((d: any) => [d.id, d.name]));
  return rows.map((row) => ({
    ...row,
    updated_by_name: profileMap.get(row.updated_by ?? row.created_by) ?? null,
    source_document_name: row.source_document_id ? (documentMap.get(row.source_document_id) ?? null) : null,
  })) as KnowledgeItem[];
}

export const listKnowledgeItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        search: z.string().max(160).optional(),
        type: z.enum(["faq", "orientacao", "procedimento", "politica", "modelo", "outro"]).optional(),
        enabled: z.boolean().optional(),
        limit: z.number().int().min(1).max(200).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { officeId, role } = await getOffice(ctx);
    const term = (data.search ?? "").trim();
    const limit = data.limit ?? 100;

    let rows: any[] = [];
    if (term) {
      // Busca real no banco (full-text em português sobre título, tags e conteúdo).
      const { data: found, error } = await ctx.supabase.rpc("knowledge_search", {
        _query: term,
        _limit: Math.min(limit, 50),
        _only_enabled: false,
      });
      if (error) throwDatabaseError(error, "LIST_ERROR");
      const ids = (found ?? []).map((r: any) => r.id);
      if (ids.length) {
        const { data: full, error: fullError } = await ctx.supabase
          .from("knowledge_items")
          .select(ITEM_FIELDS)
          .eq("office_id", officeId)
          .is("deleted_at", null)
          .in("id", ids);
        if (fullError) throwDatabaseError(fullError, "LIST_ERROR");
        const order = new Map<string, number>(ids.map((id: string, index: number) => [id, index]));
        rows = (full ?? []).sort((a: any, b: any) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
      }
    } else {
      let query = ctx.supabase
        .from("knowledge_items")
        .select(ITEM_FIELDS)
        .eq("office_id", officeId)
        .is("deleted_at", null)
        .order("priority", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(limit);
      if (data.type) query = query.eq("content_type", data.type);
      if (typeof data.enabled === "boolean") query = query.eq("enabled", data.enabled);
      const { data: found, error } = await query;
      if (error) throwDatabaseError(error, "LIST_ERROR");
      rows = found ?? [];
    }

    if (term && data.type) rows = rows.filter((row) => row.content_type === data.type);
    if (term && typeof data.enabled === "boolean") rows = rows.filter((row) => row.enabled === data.enabled);

    const items = await decorate(ctx, officeId, rows);
    return { items, canManage: canManage(role) };
  });

export const getKnowledgeStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as unknown as Ctx;
    const { officeId, role } = await getOffice(ctx);
    const { data: rows, error } = await ctx.supabase
      .from("knowledge_items")
      .select("content_type,enabled,updated_at")
      .eq("office_id", officeId)
      .is("deleted_at", null);
    if (error) throwDatabaseError(error, "STATS_ERROR");
    const list = (rows ?? []) as Array<{ content_type: string; enabled: boolean; updated_at: string }>;
    const byType: Record<string, number> = {};
    for (const row of list) byType[row.content_type] = (byType[row.content_type] ?? 0) + 1;
    const lastUpdatedAt = list.reduce<string | null>(
      (acc, row) => (!acc || row.updated_at > acc ? row.updated_at : acc),
      null,
    );
    const stats: KnowledgeStats = {
      total: list.length,
      enabled: list.filter((row) => row.enabled).length,
      disabled: list.filter((row) => !row.enabled).length,
      byType,
      lastUpdatedAt,
      canManage: canManage(role),
    };
    return stats;
  });

export const getKnowledgeItem = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { officeId } = await getOffice(ctx);
    const { data: row, error } = await ctx.supabase
      .from("knowledge_items")
      .select(ITEM_FIELDS)
      .eq("id", data.id)
      .eq("office_id", officeId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throwDatabaseError(error, "GET_ERROR");
    if (!row) throw new Error("NOT_FOUND");
    const [item] = await decorate(ctx, officeId, [row]);
    return item as KnowledgeItem;
  });

export const saveKnowledgeItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => itemSchema.parse(input))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { officeId, profileId, role } = await getOffice(ctx);
    if (!canManage(role)) throw new Error("FORBIDDEN");

    // Documento de origem precisa pertencer ao mesmo escritório.
    let sourceDocumentId: string | null = data.sourceDocumentId ?? null;
    if (sourceDocumentId) {
      const { data: doc } = await ctx.supabase
        .from("documents")
        .select("id")
        .eq("id", sourceDocumentId)
        .eq("office_id", officeId)
        .is("deleted_at", null)
        .maybeSingle();
      if (!doc) throw new Error("INVALID_DOCUMENT");
    }

    const payload = {
      title: data.title,
      content: data.content,
      content_type: data.contentType,
      tags: cleanTags(data.tags),
      enabled: data.enabled,
      priority: data.priority,
      source_document_id: sourceDocumentId,
      updated_by: profileId,
    };

    if (data.id) {
      const { data: saved, error } = await ctx.supabase
        .from("knowledge_items")
        .update(payload)
        .eq("id", data.id)
        .eq("office_id", officeId)
        .is("deleted_at", null)
        .select(ITEM_FIELDS)
        .maybeSingle();
      if (error) throwDatabaseError(error, "SAVE_ERROR");
      if (!saved) throw new Error("NOT_FOUND");

      // O banco (trigger) é a única fonte de verdade da versão.
      await recordVersion(ctx, officeId, profileId, saved);
      await audit(ctx, officeId, profileId, "knowledge_item_updated", saved.id, {
        title: saved.title,
        version: saved.version,
      });
      return saved as KnowledgeItem;
    }

    const { data: saved, error } = await ctx.supabase
      .from("knowledge_items")
      .insert({ ...payload, office_id: officeId, created_by: profileId })
      .select(ITEM_FIELDS)
      .single();
    if (error) throwDatabaseError(error, "CREATE_ERROR");

    await recordVersion(ctx, officeId, profileId, saved);
    await audit(ctx, officeId, profileId, "knowledge_item_created", saved.id, {
      title: saved.title,
      version: saved.version,
    });
    return saved as KnowledgeItem;
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
      .select(ITEM_FIELDS)
      .maybeSingle();
    if (error) throwDatabaseError(error, "UPDATE_ERROR");
    if (!saved) throw new Error("NOT_FOUND");
    await recordVersion(ctx, officeId, profileId, saved);
    await audit(ctx, officeId, profileId, data.enabled ? "knowledge_item_enabled" : "knowledge_item_disabled", saved.id, {
      title: saved.title,
      version: saved.version,
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
    const { data: saved, error } = await ctx.supabase
      .from("knowledge_items")
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: profileId,
        enabled: false,
        updated_by: profileId,
      })
      .eq("id", data.id)
      .eq("office_id", officeId)
      .is("deleted_at", null)
      .select(ITEM_FIELDS)
      .maybeSingle();
    if (error) throwDatabaseError(error, "DELETE_ERROR");
    if (!saved) throw new Error("NOT_FOUND");
    await recordVersion(ctx, officeId, profileId, saved);
    await audit(ctx, officeId, profileId, "knowledge_item_deleted", saved.id, {
      title: saved.title,
      version: saved.version,
    });
    return { ok: true };
  });

export const listKnowledgeVersions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { officeId } = await getOffice(ctx);
    const { data: rows, error } = await ctx.supabase
      .from("knowledge_item_versions")
      .select(
        "id,knowledge_item_id,version,title,content,content_type,tags,enabled,priority,source_document_id,changed_by,created_at",
      )
      .eq("knowledge_item_id", data.id)
      .eq("office_id", officeId)
      .order("version", { ascending: false });
    if (error) throwDatabaseError(error, "VERSIONS_ERROR");
    const list = (rows ?? []) as any[];
    const profileIds = [...new Set(list.map((r) => r.changed_by).filter(Boolean))];
    const { data: profiles } = profileIds.length
      ? await ctx.supabase.from("profiles").select("id,name").eq("office_id", officeId).in("id", profileIds)
      : { data: [] };
    const nameMap = new Map((profiles ?? []).map((p: any) => [p.id, p.name]));
    return list.map((row) => ({
      ...row,
      changed_by_name: row.changed_by ? (nameMap.get(row.changed_by) ?? null) : null,
    })) as KnowledgeVersion[];
  });

/** Documentos reais do escritório disponíveis para vincular como origem do conhecimento. */
export const listKnowledgeDocumentOptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as unknown as Ctx;
    const { officeId } = await getOffice(ctx);
    const { data: rows, error } = await ctx.supabase
      .from("documents")
      .select("id,name")
      .eq("office_id", officeId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throwDatabaseError(error, "DOCUMENTS_ERROR");
    return (rows ?? []) as Array<{ id: string; name: string }>;
  });
