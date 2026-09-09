import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Download,
  Eye,
  Loader2,
  RefreshCw,
  Sparkles,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ANALYSIS_LABEL,
  DOCUMENT_CATEGORIES,
  PROCESSING_LABEL,
  analyzeDocument,
  askDocument,
  categoryLabel,
  deleteDocument,
  getDocument,
  getDocumentUrl,
  processDocument,
  updateDocument,
} from "@/lib/documents.functions";
import { formatBytes } from "@/lib/documents/upload";

const AUDIT_LABEL: Record<string, string> = {
  "document.uploaded": "Documento enviado",
  "document.processed": "Conteúdo extraído",
  "document.process_failed": "Falha no processamento",
  "document.viewed": "Documento visualizado",
  "document.downloaded": "Documento baixado",
  "document.updated": "Informações alteradas",
  "document.deleted": "Documento excluído",
  "document.analysis_started": "Análise iniciada",
  "document.analysis_completed": "Análise concluída",
  "document.analysis_failed": "Falha na análise",
  "document.question_answered": "Pergunta respondida",
};

function fmt(value: string) {
  return new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function AnalysisResult({ result }: { result: any }) {
  if (!result) return null;
  const list = (items: any[], render: (item: any) => string) =>
    items?.length ? (
      <ul className="mt-1 space-y-1 text-sm">
        {items.map((item, i) => (
          <li key={i} className="rounded-lg border border-border/60 bg-surface/60 px-3 py-2">
            {render(item)}
            {item?.origem && item.origem !== "Não identificado no documento." ? (
              <span className="ml-1 text-xs text-muted-foreground">({item.origem})</span>
            ) : null}
          </li>
        ))}
      </ul>
    ) : (
      <p className="mt-1 text-sm text-muted-foreground">Não identificado no documento.</p>
    );

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {children}
    </div>
  );

  return (
    <div className="space-y-4">
      <Section title="Resumo">
        <p className="mt-1 text-sm">{result.resumo || "Não identificado no documento."}</p>
      </Section>
      <Section title="Tipo de documento">
        <p className="mt-1 text-sm">{result.tipo_documento || "Não identificado no documento."}</p>
      </Section>
      <Section title="Partes envolvidas">
        {list(result.partes ?? [], (p) => [p.nome, p.papel].filter(Boolean).join(" — "))}
      </Section>
      <Section title="Datas importantes">
        {list(result.datas ?? [], (d) => [d.data, d.descricao].filter(Boolean).join(" — "))}
      </Section>
      <Section title="Valores">
        {list(result.valores ?? [], (v) => [v.valor, v.descricao].filter(Boolean).join(" — "))}
      </Section>
      <Section title="Obrigações">{list(result.obrigacoes ?? [], (o) => o.descricao)}</Section>
      <Section title="Prazos">{list(result.prazos ?? [], (p) => p.descricao)}</Section>
      <Section title="Pontos de atenção">{list(result.pontos_atencao ?? [], (p) => p.descricao)}</Section>
      <Section title="Riscos e alertas">{list(result.riscos ?? [], (r) => r.descricao)}</Section>
      <p className="text-xs text-muted-foreground">
        Análise assistiva gerada por IA a partir do conteúdo do documento. Não substitui a conclusão
        jurídica de um advogado.
      </p>
    </div>
  );
}

export function DocumentDetailDialog({
  documentId,
  open,
  onOpenChange,
  onChanged,
}: {
  documentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
}) {
  const load = useServerFn(getDocument);
  const sign = useServerFn(getDocumentUrl);
  const process = useServerFn(processDocument);
  const analyze = useServerFn(analyzeDocument);
  const ask = useServerFn(askDocument);
  const update = useServerFn(updateDocument);
  const remove = useServerFn(deleteDocument);

  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; mimeType: string } | null>(null);
  const [question, setQuestion] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState("outros");
  const [editDescription, setEditDescription] = useState("");

  const { data, refetch, isLoading } = useQuery({
    queryKey: ["documents", "detail", documentId],
    queryFn: () => load({ data: { documentId: documentId! } }),
    enabled: open && Boolean(documentId),
  });

  const doc = data?.document;
  const analyses = data?.analyses ?? [];
  const lastAnalysis = analyses.find((a: any) => a.kind === "analise" && a.status === "concluida");

  async function openFile(download: boolean) {
    if (!doc) return;
    setBusy(download ? "download" : "view");
    try {
      const signed = (await sign({ data: { documentId: doc.id, download } })) as {
        url: string;
        mimeType: string;
      };
      if (download) window.location.href = signed.url;
      else setPreview(signed);
      void refetch();
    } catch {
      toast.error("Não foi possível abrir o arquivo.");
    } finally {
      setBusy(null);
    }
  }

  async function runProcess() {
    if (!doc) return;
    setBusy("process");
    try {
      const result = (await process({ data: { documentId: doc.id } })) as { status: string; message?: string };
      if (result.status === "processado") toast.success("Documento pronto para análise.");
      else if (result.status === "requer_ocr")
        toast.warning("Este documento precisa de OCR para análise automática.");
      else toast.error(result.message ?? "Não foi possível processar este documento.");
      void refetch();
      onChanged?.();
    } catch {
      toast.error("Não foi possível processar este documento.");
    } finally {
      setBusy(null);
    }
  }

  async function runAnalysis() {
    if (!doc) return;
    setBusy("analyze");
    try {
      await analyze({ data: { documentId: doc.id } });
      toast.success("Análise concluída.");
      void refetch();
      onChanged?.();
    } catch (error) {
      const message = (error as Error).message ?? "";
      if (message.includes("AI_NOT_CONFIGURED")) toast.error("A IA ainda não está configurada.");
      else if (message.includes("NOT_PROCESSED"))
        toast.error("Extraia o conteúdo do documento antes de analisar.");
      else toast.error("Não foi possível concluir a análise.");
      void refetch();
    } finally {
      setBusy(null);
    }
  }

  async function runQuestion() {
    if (!doc || question.trim().length < 3) return;
    setBusy("ask");
    try {
      await ask({ data: { documentId: doc.id, question: question.trim() } });
      setQuestion("");
      void refetch();
    } catch (error) {
      const message = (error as Error).message ?? "";
      if (message.includes("AI_NOT_CONFIGURED")) toast.error("A IA ainda não está configurada.");
      else if (message.includes("NOT_PROCESSED"))
        toast.error("Extraia o conteúdo do documento antes de perguntar.");
      else toast.error("Não foi possível consultar o documento.");
    } finally {
      setBusy(null);
    }
  }

  async function saveEdit() {
    if (!doc) return;
    setBusy("save");
    try {
      await update({
        data: {
          documentId: doc.id,
          expectedVersion: doc.version,
          name: editName.trim() || doc.name,
          category: editCategory,
          description: editDescription.trim() || null,
        },
      });
      toast.success("Informações atualizadas.");
      setEditing(false);
      void refetch();
      onChanged?.();
    } catch (error) {
      if ((error as Error).message?.includes("CONFLICT"))
        toast.error("Este documento foi alterado por outra pessoa. Recarregue antes de salvar.");
      else toast.error("Não foi possível salvar as alterações.");
      void refetch();
    } finally {
      setBusy(null);
    }
  }

  async function confirmRemove() {
    if (!doc) return;
    setBusy("delete");
    try {
      await remove({ data: { documentId: doc.id, expectedVersion: doc.version } });
      toast.success("Documento excluído.");
      setConfirmDelete(false);
      onOpenChange(false);
      onChanged?.();
    } catch (error) {
      if ((error as Error).message?.includes("CONFLICT"))
        toast.error("Este documento já foi alterado ou excluído por outra pessoa.");
      else toast.error("Não foi possível excluir o documento.");
      void refetch();
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
          {isLoading || !doc ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="break-words pr-6">{doc.name}</DialogTitle>
                <DialogDescription>
                  {doc.extension.toUpperCase()} · {formatBytes(doc.size_bytes)} · enviado em {fmt(doc.created_at)}
                  {doc.uploaded_name ? ` por ${doc.uploaded_name}` : ""}
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{categoryLabel(doc.category)}</Badge>
                <Badge variant={doc.processing_status === "processado" ? "secondary" : "outline"}>
                  {PROCESSING_LABEL[doc.processing_status]}
                </Badge>
                <Badge variant={doc.analysis_status === "analisado" ? "secondary" : "outline"}>
                  {ANALYSIS_LABEL[doc.analysis_status]}
                </Badge>
              </div>

              {doc.processing_status === "falha" ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
                  <p>Não foi possível processar este documento.</p>
                  {doc.processing_error ? (
                    <p className="mt-1 text-xs text-muted-foreground">{doc.processing_error}</p>
                  ) : null}
                  <Button size="sm" variant="outline" className="mt-3" onClick={runProcess} disabled={busy === "process"}>
                    <RefreshCw className="mr-2 h-4 w-4" /> Tentar novamente
                  </Button>
                </div>
              ) : null}

              {doc.processing_status === "requer_ocr" ? (
                <div className="rounded-lg border border-border bg-surface/60 p-3 text-sm">
                  Este documento precisa de OCR para análise automática. Você pode visualizar e baixar o
                  arquivo normalmente.
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => openFile(false)} disabled={busy === "view"}>
                  <Eye className="mr-2 h-4 w-4" /> Visualizar
                </Button>
                <Button size="sm" variant="outline" onClick={() => openFile(true)} disabled={busy === "download"}>
                  <Download className="mr-2 h-4 w-4" /> Baixar
                </Button>
                <Button
                  size="sm"
                  onClick={runAnalysis}
                  disabled={busy === "analyze" || doc.processing_status !== "processado"}
                >
                  {busy === "analyze" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  Analisar com IA
                </Button>
                {doc.processing_status === "aguardando" ? (
                  <Button size="sm" variant="outline" onClick={runProcess} disabled={busy === "process"}>
                    <RefreshCw className="mr-2 h-4 w-4" /> Processar
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Excluir
                </Button>
              </div>

              <Separator />

              <Tabs defaultValue="info">
                <TabsList className="flex-wrap">
                  <TabsTrigger value="info">Informações</TabsTrigger>
                  <TabsTrigger value="analise">Análise</TabsTrigger>
                  <TabsTrigger value="perguntar">Perguntar</TabsTrigger>
                  <TabsTrigger value="historico">Histórico</TabsTrigger>
                </TabsList>

                <TabsContent value="info" className="space-y-4 pt-4">
                  {editing ? (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label>Nome</Label>
                        <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Categoria</Label>
                        <Select value={editCategory} onValueChange={setEditCategory}>
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
                        <Label>Descrição</Label>
                        <Textarea
                          rows={3}
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={saveEdit} disabled={busy === "save"}>
                          Salvar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 text-sm">
                      <p>
                        <span className="text-muted-foreground">Arquivo original: </span>
                        {doc.original_name}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Categoria: </span>
                        {categoryLabel(doc.category)}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Descrição: </span>
                        {doc.description || "—"}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Lead: </span>
                        {doc.lead_name || "—"}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Cliente/Contato: </span>
                        {doc.contact_name || "—"}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Oportunidade: </span>
                        {doc.opportunity_title || "—"}
                      </p>
                      {doc.page_count ? (
                        <p>
                          <span className="text-muted-foreground">Páginas: </span>
                          {doc.page_count}
                        </p>
                      ) : null}
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2"
                        onClick={() => {
                          setEditName(doc.name);
                          setEditCategory(doc.category);
                          setEditDescription(doc.description ?? "");
                          setEditing(true);
                        }}
                      >
                        Editar informações
                      </Button>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="analise" className="space-y-4 pt-4">
                  {lastAnalysis ? (
                    <>
                      <p className="text-xs text-muted-foreground">
                        Última análise em {fmt(lastAnalysis.created_at)} · modelo {lastAnalysis.model}
                        {lastAnalysis.total_tokens ? ` · ${lastAnalysis.total_tokens} tokens` : ""}
                      </p>
                      <AnalysisResult result={lastAnalysis.result} />
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Nenhuma análise concluída ainda para este documento.
                    </p>
                  )}
                  {analyses.filter((a: any) => a.kind === "analise").length > 1 ? (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Análises anteriores
                      </p>
                      {analyses
                        .filter((a: any) => a.kind === "analise")
                        .slice(1)
                        .map((a: any) => (
                          <div key={a.id} className="rounded-lg border border-border/60 p-3 text-xs">
                            <p className="text-muted-foreground">
                              {fmt(a.created_at)} · {a.status} · {a.model}
                            </p>
                            {a.result?.resumo ? <p className="mt-1 text-sm">{a.result.resumo}</p> : null}
                            {a.error_message ? <p className="mt-1">{a.error_message}</p> : null}
                          </div>
                        ))}
                    </div>
                  ) : null}
                </TabsContent>

                <TabsContent value="perguntar" className="space-y-3 pt-4">
                  <p className="text-sm text-muted-foreground">
                    A resposta usa apenas o conteúdo deste documento.
                  </p>
                  <Textarea
                    rows={2}
                    placeholder="Ex.: qual é o prazo previsto neste contrato?"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                  />
                  <Button
                    size="sm"
                    onClick={runQuestion}
                    disabled={busy === "ask" || doc.processing_status !== "processado" || question.trim().length < 3}
                  >
                    {busy === "ask" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Perguntar ao documento
                  </Button>
                  <div className="space-y-2">
                    {analyses
                      .filter((a: any) => a.kind === "pergunta")
                      .map((a: any) => (
                        <div key={a.id} className="rounded-lg border border-border/60 bg-surface/60 p-3 text-sm">
                          <p className="font-medium">{a.question}</p>
                          <p className="mt-1 whitespace-pre-wrap">{a.answer || a.error_message}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{fmt(a.created_at)}</p>
                        </div>
                      ))}
                  </div>
                </TabsContent>

                <TabsContent value="historico" className="space-y-2 pt-4">
                  {(data?.history ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sem registros.</p>
                  ) : (
                    (data?.history ?? []).map((h: any) => (
                      <div key={h.id} className="flex items-center justify-between gap-3 border-b border-border/60 py-2 text-sm">
                        <span>{AUDIT_LABEL[h.action] ?? h.action}</span>
                        <span className="text-xs text-muted-foreground">
                          {h.actor_name ? `${h.actor_name} · ` : ""}
                          {fmt(h.created_at)}
                        </span>
                      </div>
                    ))
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(preview)} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Visualização</DialogTitle>
          </DialogHeader>
          {preview ? (
            preview.mimeType.startsWith("image/") ? (
              <img src={preview.url} alt="Documento" className="max-h-[70vh] w-full object-contain" />
            ) : preview.mimeType === "application/pdf" || preview.mimeType.startsWith("text/") ? (
              <iframe src={preview.url} title="Documento" className="h-[70vh] w-full rounded-lg border border-border" />
            ) : (
              <div className="space-y-3 py-6 text-sm">
                <p>Este formato não pode ser exibido dentro do JurisIA.</p>
                <Button asChild size="sm">
                  <a href={preview.url}>Baixar arquivo</a>
                </Button>
              </div>
            )
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir documento?</AlertDialogTitle>
            <AlertDialogDescription>
              O arquivo será removido do armazenamento e os links antigos deixam de funcionar. Esta ação
              não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemove} disabled={busy === "delete"}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
