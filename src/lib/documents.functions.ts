// Etapa 08 — Documentos + IA.
// Arquivos ficam em bucket privado, isolados por office_id. Toda leitura/escrita passa por RLS
// e por validação server-side. A IA usa o mesmo gateway/modelo da Etapa 02.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const DOCUMENT_BUCKET = "documents";

export const DOCUMENT_CATEGORIES = [
  { value: "contratos", label: "Contratos" },
  { value: "procuracoes", label: "Procurações" },
  { value: "documentos_pessoais", label: "Documentos pessoais" },
  { value: "peticoes", label: "Petições" },
  { value: "decisoes", label: "Decisões" },
  { value: "comprovantes", label: "Comprovantes" },
  { value: "processos", label: "Processos" },
  { value: "outros", label: "Outros" },
] as const;

export const ALLOWED_EXTENSIONS = ["pdf", "docx", "txt", "jpg", "jpeg", "png"] as const;
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

export const PROCESSING_LABEL: Record<string, string> = {
  aguardando: "Aguardando processamento",
  processando: "Processando",
  processado: "Processado",
  falha: "Falha no processamento",
  requer_ocr: "Requer OCR",
};

export const ANALYSIS_LABEL: Record<string, string> = {
  nao_analisado: "Não analisado",
  analisando: "Analisando",
  analisado: "Analisado",
  falha: "Falha na análise",
};

export function categoryLabel(value: string) {
  return DOCUMENT_CATEGORIES.find((c) => c.value === value)?.label ?? "Outros";
}

export interface DocumentRow {
  id: string;
  name: string;
  original_name: string;
  extension: string;
  mime_type: string;
  size_bytes: number;
  category: string;
  description: string | null;
  processing_status: string;
  processing_error: string | null;
  analysis_status: string;
  page_count: number | null;
  char_count: number | null;
  lead_id: string | null;
  contact_id: string | null;
  opportunity_id: string | null;
  conversation_id: string | null;
  process_reference: string | null;
  uploaded_by: string | null;
  uploaded_name: string | null;
  version: number;
  created_at: string;
  lead_name?: string | null;
  contact_name?: string | null;
  opportunity_title?: string | null;
}

export interface DocumentStats {
  total: number;
  analisados: number;
  aguardando: number;
  processando: number;
  erro: number;
}

type Ctx = { supabase: any; userId: string };

const SELECT =
  "id, name, original_name, extension, mime_type, size_bytes, category, description, processing_status, processing_error, analysis_status, page_count, char_count, lead_id, contact_id, opportunity_id, conversation_id, process_reference, uploaded_by, version, created_at, uploader:uploaded_by(name), lead:lead_id(name), contact:contact_id(name, phone_number), opportunity:opportunity_id(title)";

function mapDoc(row: any): DocumentRow {
  return {
    ...row,
    uploaded_name: row.uploader?.name ?? null,
    lead_name: row.lead?.name ?? null,
    contact_name: row.contact?.name ?? row.contact?.phone_number ?? null,
    opportunity_title: row.opportunity?.title ?? null,
  } as DocumentRow;
}

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
  };
}

function isManager(role: string) {
  return role === "owner" || role === "admin";
}

async function audit(
  ctx: Ctx,
  args: {
    officeId: string;
    profileId: string | null;
    action: string;
    documentId: string;
    metadata?: Record<string, unknown>;
  },
) {
  await ctx.supabase.from("audit_logs").insert({
    office_id: args.officeId,
    actor_profile_id: args.profileId,
    action: args.action,
    entity: "documents",
    entity_id: args.documentId,
    metadata: args.metadata ?? {},
  });
}

/** Documento sempre carregado pelo par (id, office_id) — nunca só pelo id. */
async function loadDocument(ctx: Ctx, officeId: string, documentId: string) {
  const { data } = await ctx.supabase
    .from("documents")
    .select("*")
    .eq("id", documentId)
    .eq("office_id", officeId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!data) throw new Error("NOT_FOUND");
  return data as any;
}

function assertCanMutate(role: string, profileId: string, doc: { uploaded_by: string | null }) {
  if (isManager(role)) return;
  if (doc.uploaded_by === profileId) return;
  throw new Error("FORBIDDEN");
}

/* ------------------------------- Listagem -------------------------------- */

const listSchema = z.object({
  search: z.string().max(160).optional(),
  category: z.string().optional(),
  extension: z.string().optional(),
  status: z.string().optional(),
  analysis: z.string().optional(),
  uploadedBy: z.string().uuid().optional(),
  leadId: z.string().uuid().optional(),
  contactId: z.string().uuid().optional(),
  opportunityId: z.string().uuid().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export const listDocuments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => listSchema.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { officeId, profileId, role } = await getContextOffice(ctx);

    let query = ctx.supabase
      .from("documents")
      .select(SELECT)
      .eq("office_id", officeId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(300);

    if (data.category && data.category !== "todos") query = query.eq("category", data.category);
    if (data.extension && data.extension !== "todos") query = query.eq("extension", data.extension);
    if (data.status && data.status !== "todos") query = query.eq("processing_status", data.status);
    if (data.uploadedBy) query = query.eq("uploaded_by", data.uploadedBy);
    if (data.leadId) query = query.eq("lead_id", data.leadId);
    if (data.contactId) query = query.eq("contact_id", data.contactId);
    if (data.opportunityId) query = query.eq("opportunity_id", data.opportunityId);
    if (data.from) query = query.gte("created_at", data.from);
    if (data.to) query = query.lte("created_at", data.to);
    if (data.analysis === "analisado") query = query.eq("analysis_status", "analisado");
    if (data.analysis === "nao_analisado") query = query.neq("analysis_status", "analisado");

    const term = (data.search ?? "").replace(/[%,()]/g, " ").trim();
    if (term) {
      // Busca no banco por nome e descrição; nomes de lead/contato/oportunidade são
      // resolvidos antes para permitir pesquisar pelo relacionamento.
      const [leads, contacts, opps] = await Promise.all([
        ctx.supabase.from("leads").select("id").eq("office_id", officeId).ilike("name", `%${term}%`).limit(50),
        ctx.supabase
          .from("whatsapp_contacts")
          .select("id")
          .eq("office_id", officeId)
          .or(`name.ilike.%${term}%,phone_number.ilike.%${term}%`)
          .limit(50),
        ctx.supabase.from("crm_opportunities").select("id").eq("office_id", officeId).ilike("title", `%${term}%`).limit(50),
      ]);
      const parts = [`name.ilike.%${term}%`, `original_name.ilike.%${term}%`, `description.ilike.%${term}%`];
      const leadIds = (leads.data ?? []).map((r: any) => r.id);
      const contactIds = (contacts.data ?? []).map((r: any) => r.id);
      const oppIds = (opps.data ?? []).map((r: any) => r.id);
      if (leadIds.length) parts.push(`lead_id.in.(${leadIds.join(",")})`);
      if (contactIds.length) parts.push(`contact_id.in.(${contactIds.join(",")})`);
      if (oppIds.length) parts.push(`opportunity_id.in.(${oppIds.join(",")})`);
      query = query.or(parts.join(","));
    }

    const { data: rows, error } = await query;
    if (error) throw new Error("LIST_ERROR");

    const base = () =>
      ctx.supabase
        .from("documents")
        .select("id", { count: "exact", head: true })
        .eq("office_id", officeId)
        .is("deleted_at", null);

    const [total, analisados, aguardando, processando, erro] = await Promise.all([
      base(),
      base().eq("analysis_status", "analisado"),
      base().eq("processing_status", "aguardando"),
      base().eq("processing_status", "processando"),
      base().eq("processing_status", "falha"),
    ]);

    return {
      documents: (rows ?? []).map(mapDoc),
      stats: {
        total: total.count ?? 0,
        analisados: analisados.count ?? 0,
        aguardando: aguardando.count ?? 0,
        processando: processando.count ?? 0,
        erro: erro.count ?? 0,
      } as DocumentStats,
      me: { profileId, role, isManager: isManager(role) },
    };
  });

export const listRelatedDocuments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        leadId: z.string().uuid().optional(),
        contactId: z.string().uuid().optional(),
        opportunityId: z.string().uuid().optional(),
        conversationId: z.string().uuid().optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { officeId } = await getContextOffice(ctx);
    if (!data.leadId && !data.contactId && !data.opportunityId && !data.conversationId) return [];

    let query = ctx.supabase
      .from("documents")
      .select(SELECT)
      .eq("office_id", officeId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(50);

    if (data.leadId) query = query.eq("lead_id", data.leadId);
    if (data.contactId) query = query.eq("contact_id", data.contactId);
    if (data.opportunityId) query = query.eq("opportunity_id", data.opportunityId);
    if (data.conversationId) query = query.eq("conversation_id", data.conversationId);

    const { data: rows } = await query;
    return (rows ?? []).map(mapDoc);
  });

export const getDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ documentId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { officeId, profileId, role } = await getContextOffice(ctx);

    const { data: row } = await ctx.supabase
      .from("documents")
      .select(SELECT)
      .eq("id", data.documentId)
      .eq("office_id", officeId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!row) throw new Error("NOT_FOUND");

    const [{ data: analyses }, { data: history }] = await Promise.all([
      ctx.supabase
        .from("document_ai_analyses")
        .select(
          "id, kind, question, status, result, answer, model, prompt_tokens, completion_tokens, total_tokens, duration_ms, estimated_cost, error_message, created_at, completed_at, requester:requested_by(name)",
        )
        .eq("office_id", officeId)
        .eq("document_id", data.documentId)
        .order("created_at", { ascending: false })
        .limit(30),
      ctx.supabase
        .from("audit_logs")
        .select("id, action, metadata, created_at, actor:actor_profile_id(name)")
        .eq("office_id", officeId)
        .eq("entity", "documents")
        .eq("entity_id", data.documentId)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

    return {
      document: mapDoc(row),
      analyses: (analyses ?? []).map((a: any) => ({ ...a, requester_name: a.requester?.name ?? null })),
      history: (history ?? []).map((h: any) => ({ ...h, actor_name: h.actor?.name ?? null })),
      me: { profileId, role, isManager: isManager(role) },
    };
  });

/* -------------------------- Upload e processamento ------------------------ */

const createSchema = z.object({
  storagePath: z.string().min(3),
  originalName: z.string().min(1).max(300),
  name: z.string().min(1).max(300),
  extension: z.string().min(1).max(10),
  mimeType: z.string().min(1).max(200),
  sizeBytes: z.number().int().positive().max(MAX_FILE_BYTES),
  checksum: z.string().max(128).optional(),
  category: z.string().max(60).default("outros"),
  description: z.string().max(2000).optional(),
  leadId: z.string().uuid().optional(),
  contactId: z.string().uuid().optional(),
  opportunityId: z.string().uuid().optional(),
  conversationId: z.string().uuid().optional(),
  processReference: z.string().max(120).optional(),
});

/** Registra no banco um arquivo já enviado ao storage privado do escritório. */
export const createDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createSchema.parse(input))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { officeId, profileId } = await getContextOffice(ctx);

    const ext = data.extension.toLowerCase();
    if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) throw new Error("UNSUPPORTED_TYPE");
    if (!data.storagePath.startsWith(`${officeId}/`)) throw new Error("FORBIDDEN");

    // Vínculos precisam pertencer ao mesmo escritório.
    const checks: Array<[string, string | undefined]> = [
      ["leads", data.leadId],
      ["whatsapp_contacts", data.contactId],
      ["crm_opportunities", data.opportunityId],
      ["whatsapp_conversations", data.conversationId],
    ];
    for (const [table, id] of checks) {
      if (!id) continue;
      const { data: found } = await ctx.supabase
        .from(table)
        .select("id")
        .eq("id", id)
        .eq("office_id", officeId)
        .maybeSingle();
      if (!found) throw new Error("INVALID_RELATION");
    }

    const { data: inserted, error } = await ctx.supabase
      .from("documents")
      .insert({
        office_id: officeId,
        storage_path: data.storagePath,
        original_name: data.originalName,
        name: data.name,
        extension: ext,
        mime_type: data.mimeType,
        size_bytes: data.sizeBytes,
        checksum: data.checksum ?? null,
        category: data.category,
        description: data.description ?? null,
        lead_id: data.leadId ?? null,
        contact_id: data.contactId ?? null,
        opportunity_id: data.opportunityId ?? null,
        conversation_id: data.conversationId ?? null,
        process_reference: data.processReference ?? null,
        uploaded_by: profileId,
        processing_status: "aguardando",
      })
      .select("id")
      .single();
    if (error) throw new Error("CREATE_ERROR");

    await audit(ctx, {
      officeId,
      profileId,
      action: "document.uploaded",
      documentId: inserted.id,
      metadata: { name: data.name, extension: ext, size_bytes: data.sizeBytes },
    });

    return { documentId: inserted.id as string };
  });

/** Baixa o arquivo do storage, extrai o texto e grava o resultado. */
export const processDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ documentId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { officeId, profileId, role } = await getContextOffice(ctx);
    const doc = await loadDocument(ctx, officeId, data.documentId);
    assertCanMutate(role, profileId, doc);

    // Trava otimista: só um processamento por vez.
    const { data: claimed } = await ctx.supabase
      .from("documents")
      .update({ processing_status: "processando", processing_error: null })
      .eq("id", doc.id)
      .eq("office_id", officeId)
      .in("processing_status", ["aguardando", "falha", "requer_ocr", "processado"])
      .select("id");
    if (!claimed?.length) return { status: "processando" as const };

    const { data: file, error: downloadError } = await ctx.supabase.storage
      .from(DOCUMENT_BUCKET)
      .download(doc.storage_path);

    if (downloadError || !file) {
      await ctx.supabase
        .from("documents")
        .update({ processing_status: "falha", processing_error: "Arquivo não encontrado no armazenamento." })
        .eq("id", doc.id)
        .eq("office_id", officeId);
      return { status: "falha" as const, message: "Arquivo não encontrado no armazenamento." };
    }

    const { extractDocumentText } = await import("@/lib/documents/extract.server");
    const outcome = await extractDocumentText({
      bytes: await file.arrayBuffer(),
      extension: doc.extension,
      mimeType: doc.mime_type,
    });

    if (outcome.kind === "ok") {
      await ctx.supabase.from("document_texts").upsert({
        document_id: doc.id,
        office_id: officeId,
        content: outcome.content,
        pages: outcome.pages,
        char_count: outcome.content.length,
      });
      await ctx.supabase
        .from("documents")
        .update({
          processing_status: "processado",
          processing_error: null,
          page_count: outcome.pageCount,
          char_count: outcome.content.length,
        })
        .eq("id", doc.id)
        .eq("office_id", officeId);
      await audit(ctx, {
        officeId,
        profileId,
        action: "document.processed",
        documentId: doc.id,
        metadata: { pages: outcome.pageCount, chars: outcome.content.length },
      });
      return { status: "processado" as const, pages: outcome.pageCount };
    }

    const status = outcome.kind === "needs_ocr" ? "requer_ocr" : "falha";
    await ctx.supabase
      .from("documents")
      .update({ processing_status: status, processing_error: outcome.reason })
      .eq("id", doc.id)
      .eq("office_id", officeId);
    await audit(ctx, {
      officeId,
      profileId,
      action: "document.process_failed",
      documentId: doc.id,
      metadata: { status, reason: outcome.reason },
    });
    return { status: status as "requer_ocr" | "falha", message: outcome.reason };
  });

/** URL assinada temporária (o arquivo nunca fica público). */
export const getDocumentUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ documentId: z.string().uuid(), download: z.boolean().default(false) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { officeId, profileId } = await getContextOffice(ctx);
    const doc = await loadDocument(ctx, officeId, data.documentId);

    const { data: signed, error } = await ctx.supabase.storage
      .from(DOCUMENT_BUCKET)
      .createSignedUrl(doc.storage_path, 120, data.download ? { download: doc.original_name } : undefined);
    if (error || !signed?.signedUrl) throw new Error("SIGN_ERROR");

    await audit(ctx, {
      officeId,
      profileId,
      action: data.download ? "document.downloaded" : "document.viewed",
      documentId: doc.id,
    });

    return { url: signed.signedUrl as string, mimeType: doc.mime_type as string, name: doc.original_name as string };
  });

/* ------------------------------- Edição ---------------------------------- */

const updateSchema = z.object({
  documentId: z.string().uuid(),
  expectedVersion: z.number().int().positive(),
  name: z.string().min(1).max(300).optional(),
  category: z.string().max(60).optional(),
  description: z.string().max(2000).nullable().optional(),
  leadId: z.string().uuid().nullable().optional(),
  contactId: z.string().uuid().nullable().optional(),
  opportunityId: z.string().uuid().nullable().optional(),
  conversationId: z.string().uuid().nullable().optional(),
  processReference: z.string().max(120).nullable().optional(),
});

export const updateDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { officeId, profileId, role } = await getContextOffice(ctx);
    const doc = await loadDocument(ctx, officeId, data.documentId);
    assertCanMutate(role, profileId, doc);

    const patch: Record<string, unknown> = { version: doc.version + 1 };
    if (data.name !== undefined) patch["name"] = data.name;
    if (data.category !== undefined) patch["category"] = data.category;
    if (data.description !== undefined) patch["description"] = data.description;
    if (data.processReference !== undefined) patch["process_reference"] = data.processReference;

    const relations: Array<[string, string, string | null | undefined]> = [
      ["lead_id", "leads", data.leadId],
      ["contact_id", "whatsapp_contacts", data.contactId],
      ["opportunity_id", "crm_opportunities", data.opportunityId],
      ["conversation_id", "whatsapp_conversations", data.conversationId],
    ];
    for (const [column, table, value] of relations) {
      if (value === undefined) continue;
      if (value === null) {
        patch[column] = null;
        continue;
      }
      const { data: found } = await ctx.supabase
        .from(table)
        .select("id")
        .eq("id", value)
        .eq("office_id", officeId)
        .maybeSingle();
      if (!found) throw new Error("INVALID_RELATION");
      patch[column] = value;
    }

    const { data: updated } = await ctx.supabase
      .from("documents")
      .update(patch)
      .eq("id", doc.id)
      .eq("office_id", officeId)
      .eq("version", data.expectedVersion)
      .is("deleted_at", null)
      .select("id");
    if (!updated?.length) throw new Error("CONFLICT");

    await audit(ctx, {
      officeId,
      profileId,
      action: "document.updated",
      documentId: doc.id,
      metadata: { fields: Object.keys(patch).filter((k) => k !== "version") },
    });
    return { ok: true };
  });

export const deleteDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ documentId: z.string().uuid(), expectedVersion: z.number().int().positive() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { officeId, profileId, role } = await getContextOffice(ctx);
    const doc = await loadDocument(ctx, officeId, data.documentId);
    assertCanMutate(role, profileId, doc);

    // Marca a exclusão de forma atômica (evita dois usuários excluindo em paralelo).
    const { data: marked } = await ctx.supabase
      .from("documents")
      .update({ deleted_at: new Date().toISOString(), deleted_by: profileId, version: doc.version + 1 })
      .eq("id", doc.id)
      .eq("office_id", officeId)
      .eq("version", data.expectedVersion)
      .is("deleted_at", null)
      .select("id");
    if (!marked?.length) throw new Error("CONFLICT");

    // Remove o arquivo e o texto extraído: nenhuma URL antiga continua válida.
    await ctx.supabase.storage.from(DOCUMENT_BUCKET).remove([doc.storage_path]);
    await ctx.supabase.from("document_texts").delete().eq("document_id", doc.id).eq("office_id", officeId);

    await audit(ctx, {
      officeId,
      profileId,
      action: "document.deleted",
      documentId: doc.id,
      metadata: { name: doc.name },
    });
    return { ok: true };
  });

/* ---------------------------------- IA ------------------------------------ */

const ANALYSIS_PROMPT_VERSION = "doc-analysis-v1";

async function loadOfficeModel(ctx: Ctx, officeId: string) {
  const { data } = await ctx.supabase
    .from("ai_agent_settings")
    .select("model")
    .eq("office_id", officeId)
    .maybeSingle();
  return (data?.model as string) || "openai/gpt-6-astra";
}

async function loadText(ctx: Ctx, officeId: string, documentId: string) {
  const { data } = await ctx.supabase
    .from("document_texts")
    .select("content")
    .eq("document_id", documentId)
    .eq("office_id", officeId)
    .maybeSingle();
  return (data?.content as string) ?? "";
}

const NO_HALLUCINATION = [
  "Você analisa documentos jurídicos para um escritório de advocacia brasileiro.",
  "REGRA ABSOLUTA: use EXCLUSIVAMENTE o conteúdo do documento fornecido.",
  "É proibido inventar nomes, datas, valores, cláusulas, artigos de lei, decisões ou jurisprudência.",
  'Quando a informação não estiver no documento, escreva exatamente: "Não identificado no documento."',
  "Quando o texto indicar a página (marcadores [Página N]) ou o nome da cláusula/seção, cite essa origem.",
  "Sua análise é assistiva e não substitui a conclusão jurídica de um advogado.",
].join("\n");

export const analyzeDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ documentId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { officeId, profileId } = await getContextOffice(ctx);
    const doc = await loadDocument(ctx, officeId, data.documentId);

    if (doc.processing_status !== "processado") throw new Error("NOT_PROCESSED");
    const content = await loadText(ctx, officeId, doc.id);
    if (!content.trim()) throw new Error("NOT_PROCESSED");

    const model = await loadOfficeModel(ctx, officeId);
    const { data: analysis } = await ctx.supabase
      .from("document_ai_analyses")
      .insert({
        office_id: officeId,
        document_id: doc.id,
        kind: "analise",
        requested_by: profileId,
        model,
        prompt_version: ANALYSIS_PROMPT_VERSION,
        status: "processando",
      })
      .select("id")
      .single();

    await ctx.supabase
      .from("documents")
      .update({ analysis_status: "analisando" })
      .eq("id", doc.id)
      .eq("office_id", officeId);
    await audit(ctx, { officeId, profileId, action: "document.analysis_started", documentId: doc.id });

    const { generateStructuredJson, AiNotConfiguredError } = await import("@/lib/ai-attendance.server");
    const { buildContextForAi } = await import("@/lib/documents/extract.server");

    try {
      const reply = await generateStructuredJson({
        model,
        instructions: [
          NO_HALLUCINATION,
          "",
          "Responda com este JSON:",
          `{"resumo":"","tipo_documento":"","partes":[{"nome":"","papel":"","origem":""}],"datas":[{"data":"","descricao":"","origem":""}],"valores":[{"valor":"","descricao":"","origem":""}],"obrigacoes":[{"descricao":"","origem":""}],"prazos":[{"descricao":"","origem":""}],"pontos_atencao":[{"descricao":"","origem":""}],"riscos":[{"descricao":"","origem":""}]}`,
          'Listas sem informação no documento devem ficar vazias. Campos de texto sem informação recebem "Não identificado no documento."',
        ].join("\n"),
        input: `Documento: ${doc.original_name}\n\nConteúdo:\n${buildContextForAi(content)}`,
      });

      await ctx.supabase
        .from("document_ai_analyses")
        .update({
          status: "concluida",
          result: reply.data,
          model: reply.model,
          prompt_tokens: reply.promptTokens,
          completion_tokens: reply.completionTokens,
          total_tokens: reply.totalTokens,
          duration_ms: reply.durationMs,
          estimated_cost: null, // provedor não retorna custo: registrado como não calculado
          completed_at: new Date().toISOString(),
        })
        .eq("id", analysis.id)
        .eq("office_id", officeId);

      await ctx.supabase.from("ai_usage_logs").insert({
        office_id: officeId,
        document_id: doc.id,
        model: reply.model,
        prompt_tokens: reply.promptTokens,
        completion_tokens: reply.completionTokens,
        total_tokens: reply.totalTokens,
        duration_ms: reply.durationMs,
        status: "success",
      });

      await ctx.supabase
        .from("documents")
        .update({ analysis_status: "analisado" })
        .eq("id", doc.id)
        .eq("office_id", officeId);
      await audit(ctx, {
        officeId,
        profileId,
        action: "document.analysis_completed",
        documentId: doc.id,
        metadata: { analysis_id: analysis.id, model: reply.model, total_tokens: reply.totalTokens },
      });

      return { analysisId: analysis.id as string };
    } catch (error) {
      const notConfigured = error instanceof AiNotConfiguredError;
      const message = notConfigured
        ? "A IA ainda não está configurada."
        : "Não foi possível concluir a análise deste documento.";
      await ctx.supabase
        .from("document_ai_analyses")
        .update({ status: "falha", error_message: message, completed_at: new Date().toISOString() })
        .eq("id", analysis.id)
        .eq("office_id", officeId);
      await ctx.supabase.from("ai_usage_logs").insert({
        office_id: officeId,
        document_id: doc.id,
        model,
        status: notConfigured ? "not_configured" : "error",
      });
      await ctx.supabase
        .from("documents")
        .update({ analysis_status: "falha" })
        .eq("id", doc.id)
        .eq("office_id", officeId);
      await audit(ctx, {
        officeId,
        profileId,
        action: "document.analysis_failed",
        documentId: doc.id,
        metadata: { analysis_id: analysis.id },
      });
      throw new Error(notConfigured ? "AI_NOT_CONFIGURED" : "AI_ERROR");
    }
  });

/** Perguntar ao documento: contexto restrito a este único documento. */
export const askDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ documentId: z.string().uuid(), question: z.string().min(3).max(500) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { officeId, profileId } = await getContextOffice(ctx);
    const doc = await loadDocument(ctx, officeId, data.documentId);

    if (doc.processing_status !== "processado") throw new Error("NOT_PROCESSED");
    const content = await loadText(ctx, officeId, doc.id);
    if (!content.trim()) throw new Error("NOT_PROCESSED");

    const model = await loadOfficeModel(ctx, officeId);
    const { data: analysis } = await ctx.supabase
      .from("document_ai_analyses")
      .insert({
        office_id: officeId,
        document_id: doc.id,
        kind: "pergunta",
        question: data.question,
        requested_by: profileId,
        model,
        prompt_version: "doc-question-v1",
        status: "processando",
      })
      .select("id")
      .single();

    const { generateAssistantReply, AiNotConfiguredError } = await import("@/lib/ai-attendance.server");
    const { buildContextForAi } = await import("@/lib/documents/extract.server");

    try {
      const reply = await generateAssistantReply({
        model,
        instructions: [
          NO_HALLUCINATION,
          "Responda apenas com base neste documento, em português do Brasil, de forma objetiva.",
          'Se a resposta não estiver no documento, responda exatamente: "Não encontrei essa informação no documento."',
          "Quando possível, cite a página ou a cláusula/seção de onde tirou a resposta.",
        ].join("\n"),
        turns: [
          {
            role: "user",
            content: `Documento: ${doc.original_name}\n\nConteúdo:\n${buildContextForAi(content, data.question)}\n\nPergunta: ${data.question}`,
          },
        ],
      });

      await ctx.supabase
        .from("document_ai_analyses")
        .update({
          status: "concluida",
          answer: reply.text,
          model: reply.model,
          prompt_tokens: reply.promptTokens,
          completion_tokens: reply.completionTokens,
          total_tokens: reply.totalTokens,
          duration_ms: reply.durationMs,
          completed_at: new Date().toISOString(),
        })
        .eq("id", analysis.id)
        .eq("office_id", officeId);

      await ctx.supabase.from("ai_usage_logs").insert({
        office_id: officeId,
        document_id: doc.id,
        model: reply.model,
        prompt_tokens: reply.promptTokens,
        completion_tokens: reply.completionTokens,
        total_tokens: reply.totalTokens,
        duration_ms: reply.durationMs,
        status: "success",
      });

      await audit(ctx, {
        officeId,
        profileId,
        action: "document.question_answered",
        documentId: doc.id,
        metadata: { analysis_id: analysis.id, model: reply.model },
      });

      return { analysisId: analysis.id as string, answer: reply.text };
    } catch (error) {
      const notConfigured = error instanceof AiNotConfiguredError;
      await ctx.supabase
        .from("document_ai_analyses")
        .update({
          status: "falha",
          error_message: notConfigured ? "A IA ainda não está configurada." : "Falha ao consultar a IA.",
          completed_at: new Date().toISOString(),
        })
        .eq("id", analysis.id)
        .eq("office_id", officeId);
      await ctx.supabase.from("ai_usage_logs").insert({
        office_id: officeId,
        document_id: doc.id,
        model,
        status: notConfigured ? "not_configured" : "error",
      });
      throw new Error(notConfigured ? "AI_NOT_CONFIGURED" : "AI_ERROR");
    }
  });

/* ------------------------------- Opções ---------------------------------- */

export const listDocumentOptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as unknown as Ctx;
    const { officeId } = await getContextOffice(ctx);

    const [team, leads, contacts, opportunities] = await Promise.all([
      ctx.supabase.from("profiles").select("id, name").eq("office_id", officeId).order("name"),
      ctx.supabase
        .from("leads")
        .select("id, name, phone")
        .eq("office_id", officeId)
        .order("last_interaction_at", { ascending: false })
        .limit(200),
      ctx.supabase
        .from("whatsapp_contacts")
        .select("id, name, phone_number")
        .eq("office_id", officeId)
        .order("updated_at", { ascending: false })
        .limit(200),
      ctx.supabase
        .from("crm_opportunities")
        .select("id, title")
        .eq("office_id", officeId)
        .order("last_activity_at", { ascending: false })
        .limit(200),
    ]);

    return {
      team: (team.data ?? []) as Array<{ id: string; name: string }>,
      leads: ((leads.data ?? []) as any[]).map((l) => ({ id: l.id, name: l.name || l.phone || "Lead" })),
      contacts: ((contacts.data ?? []) as any[]).map((c) => ({ id: c.id, name: c.name || c.phone_number })),
      opportunities: (opportunities.data ?? []) as Array<{ id: string; title: string }>,
    };
  });
