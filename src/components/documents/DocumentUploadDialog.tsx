import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, UploadCloud } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProfile } from "@/lib/auth";
import {
  DOCUMENT_CATEGORIES,
  createDocument,
  listDocumentOptions,
  processDocument,
} from "@/lib/documents.functions";
import { formatBytes, uploadDocumentFile, validateFile } from "@/lib/documents/upload";

const NONE = "__none__";

export function DocumentUploadDialog({
  open,
  onOpenChange,
  onUploaded,
  leadId,
  contactId,
  opportunityId,
  conversationId,
  lockRelations = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploaded?: () => void;
  leadId?: string | null;
  contactId?: string | null;
  opportunityId?: string | null;
  conversationId?: string | null;
  lockRelations?: boolean;
}) {
  const { data: profile } = useProfile();
  const officeId = profile?.office?.id ?? profile?.office_id ?? null;
  const create = useServerFn(createDocument);
  const process = useServerFn(processDocument);
  const loadOptions = useServerFn(listDocumentOptions);

  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("outros");
  const [description, setDescription] = useState("");
  const [lead, setLead] = useState(leadId ?? NONE);
  const [contact, setContact] = useState(contactId ?? NONE);
  const [opportunity, setOpportunity] = useState(opportunityId ?? NONE);
  const [busy, setBusy] = useState(false);

  const { data: options } = useQuery({
    queryKey: ["documents", "options"],
    queryFn: () => loadOptions({}),
    enabled: open && !lockRelations,
  });

  function reset() {
    setFile(null);
    setName("");
    setCategory("outros");
    setDescription("");
    setLead(leadId ?? NONE);
    setContact(contactId ?? NONE);
    setOpportunity(opportunityId ?? NONE);
  }

  async function submit() {
    if (!file) return;
    if (!officeId) {
      toast.error("Escritório não identificado.");
      return;
    }
    const invalid = validateFile(file);
    if (invalid) {
      toast.error(invalid);
      return;
    }

    setBusy(true);
    try {
      const uploaded = await uploadDocumentFile(file, officeId);
      const created = (await create({
        data: {
          storagePath: uploaded.storagePath,
          originalName: file.name,
          name: name.trim() || file.name,
          extension: uploaded.extension,
          mimeType: uploaded.mimeType,
          sizeBytes: uploaded.sizeBytes,
          checksum: uploaded.checksum,
          category,
          description: description.trim() || undefined,
          leadId: lead !== NONE ? lead : undefined,
          contactId: contact !== NONE ? contact : undefined,
          opportunityId: opportunity !== NONE ? opportunity : undefined,
          conversationId: conversationId ?? undefined,
        },
      })) as { documentId: string };

      toast.success("Documento enviado. Processando conteúdo...");
      onUploaded?.();
      onOpenChange(false);
      reset();

      try {
        const result = (await process({ data: { documentId: created.documentId } })) as {
          status: string;
          message?: string;
        };
        if (result.status === "processado") toast.success("Documento pronto para análise.");
        else if (result.status === "requer_ocr")
          toast.warning("Este documento precisa de OCR para análise automática.");
        else if (result.status === "falha")
          toast.error(result.message ?? "Não foi possível processar este documento.");
      } catch {
        toast.error("Não foi possível processar este documento.");
      }
      onUploaded?.();
    } catch (error) {
      toast.error((error as Error).message || "Não foi possível enviar o documento.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo documento</DialogTitle>
          <DialogDescription>
            PDF, DOCX, TXT, JPG, JPEG ou PNG — até 25 MB. O arquivo fica privado do seu escritório.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="doc-file">Arquivo</Label>
            <Input
              id="doc-file"
              type="file"
              accept=".pdf,.docx,.txt,.jpg,.jpeg,.png"
              onChange={(e) => {
                const selected = e.target.files?.[0] ?? null;
                setFile(selected);
                if (selected && !name) setName(selected.name);
              }}
            />
            {file ? (
              <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="doc-name">Nome</Label>
            <Input id="doc-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do documento" />
          </div>

          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="doc-desc">Descrição</Label>
            <Textarea
              id="doc-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Opcional"
              rows={2}
            />
          </div>

          {!lockRelations ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Lead</Label>
                <Select value={lead} onValueChange={setLead}>
                  <SelectTrigger>
                    <SelectValue placeholder="Nenhum" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Nenhum</SelectItem>
                    {(options?.leads ?? []).map((l: { id: string; name: string }) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Cliente/Contato</Label>
                <Select value={contact} onValueChange={setContact}>
                  <SelectTrigger>
                    <SelectValue placeholder="Nenhum" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Nenhum</SelectItem>
                    {(options?.contacts ?? []).map((c: { id: string; name: string }) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Oportunidade</Label>
                <Select value={opportunity} onValueChange={setOpportunity}>
                  <SelectTrigger>
                    <SelectValue placeholder="Nenhuma" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Nenhuma</SelectItem>
                    {(options?.opportunities ?? []).map((o: { id: string; title: string }) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={!file || busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
            Enviar documento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
