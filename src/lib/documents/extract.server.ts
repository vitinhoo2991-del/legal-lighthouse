// Etapa 08 — extração real de texto. Server-only.
// PDF textual: unpdf (pdf.js serverless). DOCX: unzip + word/document.xml. TXT: direto.
// Imagens e PDFs digitalizados: sem OCR configurado -> sinalizado como requer_ocr.
import { unzipSync, strFromU8 } from "fflate";

export type ExtractOutcome =
  | { kind: "ok"; pages: string[]; content: string; pageCount: number }
  | { kind: "needs_ocr"; reason: string }
  | { kind: "unsupported"; reason: string }
  | { kind: "failed"; reason: string };

const MAX_CHARS = 400_000;

function normalize(text: string) {
  return text.replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function finish(pages: string[]): ExtractOutcome {
  const cleaned = pages.map(normalize);
  const content = cleaned
    .map((p, i) => (cleaned.length > 1 ? `[Página ${i + 1}]\n${p}` : p))
    .join("\n\n")
    .slice(0, MAX_CHARS);
  if (!content.replace(/\[Página \d+\]/g, "").trim()) {
    return { kind: "needs_ocr", reason: "Nenhum texto selecionável encontrado." };
  }
  return { kind: "ok", pages: cleaned, content, pageCount: cleaned.length };
}

async function extractPdf(bytes: Uint8Array): Promise<ExtractOutcome> {
  try {
    const { getDocumentProxy, extractText } = await import("unpdf");
    const pdf = await getDocumentProxy(bytes);
    const result = await extractText(pdf, { mergePages: false });
    const pages = (result.text as string[]) ?? [];
    return finish(pages);
  } catch (error) {
    console.error("[documents] pdf extract", (error as Error).message);
    return { kind: "failed", reason: "Não foi possível ler este PDF." };
  }
}

function extractDocx(bytes: Uint8Array): ExtractOutcome {
  try {
    const files = unzipSync(bytes);
    const entry = files["word/document.xml"];
    if (!entry) return { kind: "failed", reason: "Arquivo DOCX inválido." };
    const xml = strFromU8(entry);
    const text = xml
      .replace(/<w:p[ >]/g, "\n<w:p ")
      .replace(/<w:tab[^>]*\/>/g, "\t")
      .replace(/<w:br[^>]*\/>/g, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");
    return finish([text]);
  } catch (error) {
    console.error("[documents] docx extract", (error as Error).message);
    return { kind: "failed", reason: "Não foi possível ler este DOCX." };
  }
}

export async function extractDocumentText(args: {
  bytes: ArrayBuffer;
  extension: string;
  mimeType: string;
}): Promise<ExtractOutcome> {
  const ext = args.extension.toLowerCase();
  const bytes = new Uint8Array(args.bytes);

  if (ext === "pdf" || args.mimeType === "application/pdf") return extractPdf(bytes);
  if (ext === "docx" || args.mimeType.includes("wordprocessingml")) return extractDocx(bytes);
  if (ext === "txt" || args.mimeType.startsWith("text/")) {
    try {
      return finish([new TextDecoder("utf-8").decode(bytes)]);
    } catch {
      return { kind: "failed", reason: "Não foi possível ler este arquivo de texto." };
    }
  }
  if (["jpg", "jpeg", "png"].includes(ext) || args.mimeType.startsWith("image/")) {
    return {
      kind: "needs_ocr",
      reason: "Este documento precisa de OCR para análise automática.",
    };
  }
  return { kind: "unsupported", reason: "Formato ainda não suportado para extração de texto." };
}

/**
 * Documentos grandes: seleciona os trechos mais relevantes em vez de enviar tudo ao modelo.
 * Sem pergunta, usa início + fim (onde ficam partes, valores, prazos e assinaturas).
 */
export function buildContextForAi(content: string, question?: string, limit = 24_000): string {
  if (content.length <= limit) return content;

  if (question) {
    const terms = question
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((t) => t.length > 3);
    const chunks: string[] = [];
    for (let i = 0; i < content.length; i += 3000) chunks.push(content.slice(i, i + 3000));
    const scored = chunks
      .map((chunk, index) => {
        const lower = chunk.toLowerCase();
        const score = terms.reduce((acc, t) => acc + (lower.includes(t) ? 1 : 0), 0);
        return { chunk, index, score };
      })
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.floor(limit / 3000));
    if (scored.length) {
      return scored
        .sort((a, b) => a.index - b.index)
        .map((c) => c.chunk)
        .join("\n[...]\n");
    }
  }

  const head = content.slice(0, Math.floor(limit * 0.7));
  const tail = content.slice(-Math.floor(limit * 0.3));
  return `${head}\n[... trecho intermediário omitido por tamanho ...]\n${tail}`;
}
