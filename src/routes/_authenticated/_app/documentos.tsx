import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileText, FolderOpen } from "lucide-react";

import { FilterBar, PageHeader, SearchInput } from "@/components/common/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ANALYSIS_LABEL,
  DOCUMENT_CATEGORIES,
  PROCESSING_LABEL,
  categoryLabel,
  listDocumentOptions,
  listDocuments,
  type DocumentRow,
  type DocumentStats,
} from "@/lib/documents.functions";
import { formatBytes } from "@/lib/documents/upload";
import { DocumentUploadDialog } from "@/components/documents/DocumentUploadDialog";
import { DocumentDetailDialog } from "@/components/documents/DocumentDetailDialog";

export const Route = createFileRoute("/_authenticated/_app/documentos")({
  component: DocumentosPage,
  head: () => ({
    meta: [
      { title: "Documentos | JurisIA" },
      {
        name: "description",
        content:
          "Organize, consulte e analise os documentos do seu escritório com inteligência artificial.",
      },
      { property: "og:title", content: "Documentos | JurisIA" },
      {
        property: "og:description",
        content: "Armazenamento seguro e análise de documentos jurídicos com IA.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const ALL = "todos";
const NONE = "__none__";

function fmt(value: string) {
  return new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function DocumentosPage() {
  const load = useServerFn(listDocuments);
  const loadOptions = useServerFn(listDocumentOptions);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(ALL);
  const [extension, setExtension] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [analysis, setAnalysis] = useState(ALL);
  const [uploadedBy, setUploadedBy] = useState(NONE);
  const [leadId, setLeadId] = useState(NONE);
  const [contactId, setContactId] = useState(NONE);
  const [opportunityId, setOpportunityId] = useState(NONE);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data: options } = useQuery({
    queryKey: ["documents", "options"],
    queryFn: () => loadOptions({}),
  });

  const filters = {
    search: search.trim() || undefined,
    category: category !== ALL ? category : undefined,
    extension: extension !== ALL ? extension : undefined,
    status: status !== ALL ? status : undefined,
    analysis: analysis !== ALL ? analysis : undefined,
    uploadedBy: uploadedBy !== NONE ? uploadedBy : undefined,
    leadId: leadId !== NONE ? leadId : undefined,
    contactId: contactId !== NONE ? contactId : undefined,
    opportunityId: opportunityId !== NONE ? opportunityId : undefined,
    from: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
    to: to ? new Date(`${to}T23:59:59`).toISOString() : undefined,
  };

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["documents", "list", filters],
    queryFn: () => load({ data: filters }),
  });

  const documents = (data?.documents ?? []) as DocumentRow[];
  const stats = (data?.stats ?? {
    total: 0,
    analisados: 0,
    aguardando: 0,
    processando: 0,
    erro: 0,
  }) as DocumentStats;

  const hasFilters =
    Boolean(search.trim()) ||
    [category, extension, status, analysis].some((v) => v !== ALL) ||
    [uploadedBy, leadId, contactId, opportunityId].some((v) => v !== NONE) ||
    Boolean(from || to);

  const indicators = [
    { label: "Total de documentos", value: stats.total },
    { label: "Analisados", value: stats.analisados },
    { label: "Aguardando análise", value: stats.aguardando },
    { label: "Processando", value: stats.processando },
    { label: "Com erro", value: stats.erro },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documentos"
        description="Organize, consulte e analise seus documentos com inteligência artificial."
        actions={<Button onClick={() => setUploadOpen(true)}>+ Novo documento</Button>}
      />

      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {indicators.map((item) => (
          <div key={item.label} className="surface-panel p-4">
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className="mt-1 font-display text-2xl font-semibold">{item.value}</p>
          </div>
        ))}
      </div>

      <FilterBar>
        <SearchInput
          placeholder="Buscar por nome, descrição, cliente, lead ou oportunidade"
          value={search}
          onChange={setSearch}
        />
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="sm:w-[170px]">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas as categorias</SelectItem>
            {DOCUMENT_CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={extension} onValueChange={setExtension}>
          <SelectTrigger className="sm:w-[130px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os tipos</SelectItem>
            {["pdf", "docx", "txt", "jpg", "jpeg", "png"].map((e) => (
              <SelectItem key={e} value={e}>
                {e.toUpperCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="sm:w-[190px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os status</SelectItem>
            {Object.entries(PROCESSING_LABEL).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={analysis} onValueChange={setAnalysis}>
          <SelectTrigger className="sm:w-[170px]">
            <SelectValue placeholder="Análise" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Analisados e não analisados</SelectItem>
            <SelectItem value="analisado">Analisados</SelectItem>
            <SelectItem value="nao_analisado">Não analisados</SelectItem>
          </SelectContent>
        </Select>
      </FilterBar>

      <FilterBar>
        <Select value={uploadedBy} onValueChange={setUploadedBy}>
          <SelectTrigger className="sm:w-[180px]">
            <SelectValue placeholder="Enviado por" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Toda a equipe</SelectItem>
            {(options?.team ?? []).map((t: { id: string; name: string }) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={leadId} onValueChange={setLeadId}>
          <SelectTrigger className="sm:w-[180px]">
            <SelectValue placeholder="Lead" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Todos os leads</SelectItem>
            {(options?.leads ?? []).map((l: { id: string; name: string }) => (
              <SelectItem key={l.id} value={l.id}>
                {l.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={contactId} onValueChange={setContactId}>
          <SelectTrigger className="sm:w-[180px]">
            <SelectValue placeholder="Cliente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Todos os clientes</SelectItem>
            {(options?.contacts ?? []).map((c: { id: string; name: string }) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={opportunityId} onValueChange={setOpportunityId}>
          <SelectTrigger className="sm:w-[180px]">
            <SelectValue placeholder="Oportunidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Todas as oportunidades</SelectItem>
            {(options?.opportunities ?? []).map((o: { id: string; title: string }) => (
              <SelectItem key={o.id} value={o.id}>
                {o.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          className="sm:w-[150px]"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          aria-label="Data inicial"
        />
        <Input
          type="date"
          className="sm:w-[150px]"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          aria-label="Data final"
        />
      </FilterBar>

      {isLoading ? (
        <LoadingState rows={4} />
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : documents.length === 0 ? (
        <EmptyState
          icon={<FolderOpen className="h-5 w-5" />}
          title="Nenhum documento encontrado."
          description={
            hasFilters
              ? "Ajuste a busca ou os filtros para encontrar outros documentos."
              : "Envie contratos, procurações, petições e comprovantes para consultar e analisar com IA."
          }
          action={
            hasFilters ? null : (
              <Button onClick={() => setUploadOpen(true)}>Enviar primeiro documento</Button>
            )
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="hidden bg-surface/60 px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground lg:grid lg:grid-cols-[minmax(0,2.4fr)_1fr_1fr_1.2fr_1fr]">
            <span>Documento</span>
            <span>Categoria</span>
            <span>Envio</span>
            <span>Relacionamento</span>
            <span>Status</span>
          </div>
          {documents.map((doc) => (
            <button
              key={doc.id}
              type="button"
              onClick={() => setDetailId(doc.id)}
              className="grid w-full gap-2 border-t border-border px-4 py-3 text-left text-sm transition-colors hover:bg-surface/60 lg:grid-cols-[minmax(0,2.4fr)_1fr_1fr_1.2fr_1fr] lg:items-center"
            >
              <span className="flex min-w-0 items-center gap-2">
                <FileText className="h-4 w-4 shrink-0 text-primary" />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{doc.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {doc.extension.toUpperCase()} · {formatBytes(doc.size_bytes)}
                  </span>
                </span>
              </span>
              <span className="text-xs text-muted-foreground lg:text-sm">
                {categoryLabel(doc.category)}
              </span>
              <span className="text-xs text-muted-foreground">
                {fmt(doc.created_at)}
                {doc.uploaded_name ? ` · ${doc.uploaded_name}` : ""}
              </span>
              <span className="truncate text-xs text-muted-foreground lg:text-sm">
                {doc.lead_name || doc.contact_name || doc.opportunity_title || "—"}
              </span>
              <span className="flex flex-wrap gap-1">
                <Badge variant={doc.processing_status === "processado" ? "secondary" : "outline"} className="text-[10px]">
                  {PROCESSING_LABEL[doc.processing_status]}
                </Badge>
                <Badge variant={doc.analysis_status === "analisado" ? "secondary" : "outline"} className="text-[10px]">
                  {ANALYSIS_LABEL[doc.analysis_status]}
                </Badge>
              </span>
            </button>
          ))}
        </div>
      )}

      <DocumentUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onUploaded={() => void refetch()}
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
