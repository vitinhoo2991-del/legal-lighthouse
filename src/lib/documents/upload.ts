// Upload real para o bucket privado. O caminho começa sempre pelo office_id,
// que é exatamente o que as políticas de storage exigem.
import { supabase } from "@/integrations/supabase/client";
import { ALLOWED_EXTENSIONS, DOCUMENT_BUCKET, MAX_FILE_BYTES } from "@/lib/documents.functions";

export function fileExtension(name: string) {
  const parts = name.split(".");
  return parts.length > 1 ? parts.pop()!.toLowerCase() : "";
}

export function validateFile(file: File) {
  const ext = fileExtension(file.name);
  if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) {
    return "Formato não suportado. Envie PDF, DOCX, TXT, JPG, JPEG ou PNG.";
  }
  if (file.size > MAX_FILE_BYTES) return "Arquivo muito grande. O limite é 25 MB.";
  if (file.size === 0) return "Arquivo vazio ou inválido.";
  return null;
}

async function sha256(file: File) {
  try {
    const buffer = await file.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", buffer);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return undefined;
  }
}

export async function uploadDocumentFile(file: File, officeId: string) {
  const ext = fileExtension(file.name);
  const path = `${officeId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(DOCUMENT_BUCKET).upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (error) throw new Error(error.message);
  return {
    storagePath: path,
    extension: ext,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
    checksum: await sha256(file),
  };
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
