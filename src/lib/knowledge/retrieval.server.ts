// Etapa 09 — Recuperação da base de conhecimento para a IA.
// Server-only. Nunca busca conteúdo global: sempre exige office_id.
// A arquitetura já isola o "como buscar" do "quem consome", permitindo evoluir
// depois para embeddings / busca vetorial sem alterar os chamadores.

export interface KnowledgeMatch {
  id: string;
  title: string;
  content: string;
  content_type: string;
  tags: string[];
  priority: number;
}

export interface KnowledgeContext {
  items: KnowledgeMatch[];
  context: string;
}

const EMPTY: KnowledgeContext = { items: [], context: "" };

/** Normaliza a consulta: remove excesso, limita tamanho e evita termos vazios. */
function normalizeQuery(query: string): string {
  return query.replace(/\s+/g, " ").trim().slice(0, 300);
}

// Palavras muito comuns não ajudam a encontrar o conteúdo certo.
const STOPWORDS = new Set([
  "qual","quais","como","onde","quando","quem","que","por","para","com","sem","dos","das","de","do","da",
  "os","as","um","uma","uns","umas","voce","voces","vcs","eu","meu","minha","seu","sua","ser","tem","ter",
  "sobre","pode","posso","gostaria","queria","favor","ola","oi","bom","boa","dia","tarde","noite","obrigado",
]);

/**
 * Transforma a frase do cliente numa expressão de busca tolerante:
 * termos relevantes combinados com "or", em vez de exigir a frase inteira.
 */
function buildSearchExpression(term: string): string {
  const tokens = term
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token));
  const unique = [...new Set(tokens)].slice(0, 8);
  return unique.length ? unique.join(" or ") : "";
}


function buildContext(items: KnowledgeMatch[]): string {
  if (!items.length) return "";
  return items
    .map(
      (item, index) =>
        `FONTE INTERNA ${index + 1} — ${item.title}\nTipo: ${item.content_type}\nConteúdo: ${item.content}`,
    )
    .join("\n\n");
}

/**
 * Busca conteúdos ativos do escritório relevantes para a mensagem recebida.
 * Aceita qualquer client Supabase (usuário autenticado ou service role),
 * mas o filtro por office_id é sempre aplicado explicitamente.
 */
export async function getKnowledgeContext(options: {
  supabase: {
    from: (table: string) => any;
  };
  officeId: string;
  query: string;
  limit?: number;
  /** Registro opcional da consulta em knowledge_search_logs. */
  log?: {
    conversationId?: string | null;
    createdByProfileId?: string | null;
    source?: "ai" | "whatsapp" | "app";
  };
}): Promise<KnowledgeContext> {
  const term = normalizeQuery(options.query ?? "");
  if (!term || !options.officeId) return EMPTY;
  const limit = Math.min(Math.max(options.limit ?? 5, 1), 12);

  let items: KnowledgeMatch[] = [];
  try {
    const { data, error } = await options.supabase
      .from("knowledge_items")
      .select("id,title,content,content_type,tags,priority")
      .eq("office_id", options.officeId)
      .eq("enabled", true)
      .is("deleted_at", null)
      .textSearch("search_vector", term, { type: "websearch", config: "portuguese" })
      .order("priority", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    items = (data ?? []) as KnowledgeMatch[];
  } catch (error) {
    // A base de conhecimento nunca pode derrubar o atendimento: registramos e seguimos.
    console.error("[knowledge] falha ao recuperar contexto", error);
    return EMPTY;
  }

  if (options.log) {
    try {
      await options.supabase.from("knowledge_search_logs").insert({
        office_id: options.officeId,
        query: term,
        result_count: items.length,
        matched_item_ids: items.map((item) => item.id),
        source: options.log.source ?? "ai",
        conversation_id: options.log.conversationId ?? null,
        created_by: options.log.createdByProfileId ?? null,
      });
    } catch (error) {
      console.error("[knowledge] falha ao registrar consulta", error);
    }
  }

  return { items, context: buildContext(items) };
}
