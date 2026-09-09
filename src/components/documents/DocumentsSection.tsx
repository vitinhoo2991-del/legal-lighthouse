import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileText, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listRelatedDocuments, type DocumentRow } from "@/lib/documents.functions";
import { formatBytes } from "@/lib/documents/upload";
import { DocumentUploadDialog } from "@/components/documents/DocumentUploadDialog";
import { DocumentDetailDialog } from "@/components/documents/DocumentDetailDialog";

/** Documentos vinculados a um lead, contato, oportunidade ou conversa. */
export function DocumentsSection({
  leadId,
  contactId,
  opportunityId,
  conversationId,
  label = "Documentos",
}: {
  leadId?: string | null;
  contactId?: string | null;
  opportunityId?: string | null;
  conversationId?: string | null;
  label?: string;
}) {
  const load = useServerFn(listRelatedDocuments);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const enabled = Boolean(leadId || contactId || opportunityId || conversationId);
  const { data, refetch } = useQuery({
    queryKey: ["documents", "related", leadId, contactId, opportunityId, conversationId],
    queryFn: () =>
      load({
        data: {
          leadId: leadId ?? undefined,
          contactId: contactId ?? undefined,
          opportunityId: opportunityId ?? undefined,
          conversationId: conversationId ?? undefined,
        },
      }) as Promise<DocumentRow[]>,
    enabled,
  });

  const documents = data ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <Button size="sm" variant="outline" onClick={() => setUploadOpen(true)} disabled={!enabled}>
          <Plus className="mr-1 h-4 w-4" /> Adicionar
        </Button>
      </div>

      {documents.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum documento vinculado.</p>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <button
              key={doc.id}
              type="button"
              onClick={() => setDetailId(doc.id)}
              className="flex w-full items-center justify-between gap-3 rounded-lg border border-border/60 bg-surface/60 px-3 py-2 text-left text-sm transition-colors hover:border-primary/30"
            >
              <span className="flex min-w-0 items-center gap-2">
                <FileText className="h-4 w-4 shrink-0 text-primary" />
                <span className="truncate">{doc.name}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <Badge variant="outline" className="text-[10px]">
                  {doc.extension.toUpperCase()}
                </Badge>
                <span className="text-xs text-muted-foreground">{formatBytes(doc.size_bytes)}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      <DocumentUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onUploaded={() => void refetch()}
        leadId={leadId ?? null}
        contactId={contactId ?? null}
        opportunityId={opportunityId ?? null}
        conversationId={conversationId ?? null}
        lockRelations
      />
      <DocumentDetailDialog
        documentId={detailId}
        open={Boolean(detailId)}
        onOpenChange={(o) => !o && setDetailId(null)}
        onChanged={() => void refetch()}
      />
    </div>
  );
}
