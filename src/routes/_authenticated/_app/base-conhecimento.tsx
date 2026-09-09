import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, Edit3, History, Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
  KNOWLEDGE_TYPES,
  deleteKnowledgeItem,
  getKnowledgeStats,
  listKnowledgeDocumentOptions,
  listKnowledgeItems,
  listKnowledgeVersions,
  saveKnowledgeItem,
  toggleKnowledgeItem,
  type KnowledgeItem,
  type KnowledgeStats,
  type KnowledgeType,
  type KnowledgeVersion,
} from "@/lib/knowledge.functions";

export const Route = createFileRoute("/_authenticated/_app/base-conhecimento")({
  component: BaseConhecimentoPage,
  head: () => ({
    meta: [
      { title: "Base de conhecimento | JurisIA" },
      {
        name: "description",
        content:
          "Cadastre orientações, FAQs e procedimentos oficiais do escritório para treinar a IA de atendimento do JurisIA.",
      },
      { property: "og:title", content: "Base de conhecimento | JurisIA" },
      {
        property: "og:description",
        content: "Conteúdos oficiais do escritório usados pela IA de atendimento.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type FormState = {
  id?: string;
  title: string;
  content: string;
  contentType: KnowledgeType;
  tags: string;
  enabled: boolean;
  priority: number;
  sourceDocumentId: string;
};

const EMPTY_FORM: FormState = {
  title: "",
  content: "",
  contentType: "orientacao",
  tags: "",
  enabled: true,
  priority: 50,
  sourceDocumentId: "",
};

function typeLabel(type: string) {
  return KNOWLEDGE_TYPES.find((item) => item.value === type)?.label ?? "Outro";
}

function friendlyError(err: unknown, fallback: string) {
  const message = err instanceof Error ? err.message : "";
  if (message.includes("KNOWLEDGE_TABLE_MISSING"))
    return "A base de conhecimento ainda não está disponível no banco de dados deste escritório.";
  if (message.includes("FORBIDDEN")) return "Apenas o responsável ou administradores podem alterar a base.";
  if (message.includes("NO_OFFICE")) return "Finalize a configuração do escritório para usar a base.";
  if (message.includes("INVALID_DOCUMENT")) return "O documento selecionado não pertence a este escritório.";
  if (message.includes("NOT_FOUND")) return "Este conteúdo não está mais disponível.";
  return fallback;
}

function BaseConhecimentoPage() {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [stats, setStats] = useState<KnowledgeStats | null>(null);
  const [documents, setDocuments] = useState<Array<{ id: string; name: string }>>([]);
  const [canManage, setCanManage] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | KnowledgeType>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "enabled" | "disabled">("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<KnowledgeItem | null>(null);
  const [versionsFor, setVersionsFor] = useState<KnowledgeItem | null>(null);
  const [versions, setVersions] = useState<KnowledgeVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, statsData] = await Promise.all([
        listKnowledgeItems({
          data: {
            search: search.trim() || undefined,
            ...(typeFilter === "all" ? {} : { type: typeFilter }),
            ...(statusFilter === "all" ? {} : { enabled: statusFilter === "enabled" }),
          },
        }),
        getKnowledgeStats(),
      ]);
      setItems(list.items);
      setCanManage(list.canManage);
      setStats(statsData);
    } catch (err) {
      setError(friendlyError(err, "Não foi possível carregar a base de conhecimento."));
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter, statusFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    listKnowledgeDocumentOptions()
      .then(setDocuments)
      .catch(() => setDocuments([]));
  }, []);

  const typeCounts = useMemo(() => stats?.byType ?? {}, [stats]);

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditorOpen(true);
    setError(null);
  }

  function openEdit(item: KnowledgeItem) {
    setForm({
      id: item.id,
      title: item.title,
      content: item.content,
      contentType: item.content_type,
      tags: item.tags.join(", "),
      enabled: item.enabled,
      priority: item.priority,
      sourceDocumentId: item.source_document_id ?? "",
    });
    setEditorOpen(true);
    setError(null);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.title.trim() || !form.content.trim()) {
      toast.error("Preencha o título e o conteúdo.");
      return;
    }
    setSaving(true);
    try {
      await saveKnowledgeItem({
        data: {
          ...(form.id ? { id: form.id } : {}),
          title: form.title.trim(),
          content: form.content.trim(),
          contentType: form.contentType,
          tags: form.tags.split(","),
          enabled: form.enabled,
          priority: form.priority,
          sourceDocumentId: form.sourceDocumentId || null,
        },
      });
      toast.success(form.id ? "Conteúdo atualizado." : "Conteúdo adicionado à base.");
      setEditorOpen(false);
      setForm(EMPTY_FORM);
      await load();
    } catch (err) {
      toast.error(friendlyError(err, "Não foi possível salvar o conteúdo."));
    } finally {
      setSaving(false);
    }
  }

  async function toggle(item: KnowledgeItem) {
    try {
      await toggleKnowledgeItem({ data: { id: item.id, enabled: !item.enabled } });
      toast.success(item.enabled ? "Conteúdo desativado." : "Conteúdo ativado.");
      await load();
    } catch (err) {
      toast.error(friendlyError(err, "Não foi possível alterar o status do conteúdo."));
    }
  }

  async function confirmDelete() {
    const item = pendingDelete;
    if (!item) return;
    setPendingDelete(null);
    try {
      await deleteKnowledgeItem({ data: { id: item.id } });
      toast.success("Conteúdo excluído da base.");
      await load();
    } catch (err) {
      toast.error(friendlyError(err, "Não foi possível excluir o conteúdo."));
    }
  }

  async function openVersions(item: KnowledgeItem) {
    setVersionsFor(item);
    setVersionsLoading(true);
    try {
      setVersions(await listKnowledgeVersions({ data: { id: item.id } }));
    } catch (err) {
      toast.error(friendlyError(err, "Não foi possível carregar o histórico."));
      setVersions([]);
    } finally {
      setVersionsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Base de conhecimento"
        description="Conteúdos oficiais do escritório usados pela IA de atendimento para responder com precisão."
        actions={
          canManage ? (
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Adicionar conteúdo
            </Button>
          ) : null
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Conteúdos</p>
          <p className="mt-1 text-2xl font-semibold">{stats?.total ?? 0}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Ativos para a IA</p>
          <p className="mt-1 text-2xl font-semibold">{stats?.enabled ?? 0}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Inativos</p>
          <p className="mt-1 text-2xl font-semibold">{stats?.disabled ?? 0}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Última atualização</p>
          <p className="mt-1 text-sm font-medium">
            {stats?.lastUpdatedAt
              ? new Date(stats.lastUpdatedAt).toLocaleString("pt-BR")
              : "Nenhuma alteração ainda"}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex flex-1 items-center gap-2 rounded-xl border bg-card px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por título, conteúdo ou tag..."
            className="border-0 px-1 shadow-none focus-visible:ring-0"
          />
        </div>
        <select
          className="h-10 rounded-md border bg-background px-3 text-sm"
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value as "all" | KnowledgeType)}
        >
          <option value="all">Todos os tipos</option>
          {KNOWLEDGE_TYPES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
              {typeCounts[item.value] ? ` (${typeCounts[item.value]})` : ""}
            </option>
          ))}
        </select>
        <select
          className="h-10 rounded-md border bg-background px-3 text-sm"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as "all" | "enabled" | "disabled")}
        >
          <option value="all">Todos os status</option>
          <option value="enabled">Somente ativos</option>
          <option value="disabled">Somente inativos</option>
        </select>
      </div>

      {error ? (
        <div className="flex items-center justify-between rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Fechar aviso">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {!canManage && !loading ? (
        <p className="rounded-xl border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          Você pode consultar a base. Apenas o responsável e administradores do escritório podem criar ou
          alterar conteúdos.
        </p>
      ) : null}

      <div className="space-y-3">
        {loading ? (
          <div className="rounded-xl border p-8 text-center text-sm text-muted-foreground">
            Carregando base de conhecimento...
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border p-10 text-center">
            <BookOpen className="mx-auto h-8 w-8 text-muted-foreground" />
            <h2 className="mt-3 font-semibold">Nenhum conteúdo encontrado</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Cadastre FAQs, orientações e procedimentos oficiais para a IA usar no atendimento.
            </p>
            {canManage ? (
              <Button className="mt-4" onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Adicionar conteúdo
              </Button>
            ) : null}
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="rounded-xl border bg-card p-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{item.title}</h3>
                    <Badge variant="secondary">{typeLabel(item.content_type)}</Badge>
                    <Badge variant={item.enabled ? "default" : "outline"}>
                      {item.enabled ? "Ativo" : "Inativo"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">Versão {item.version}</span>
                  </div>
                  <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">
                    {item.content}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>Prioridade {item.priority}</span>
                    {item.updated_by_name ? <span>• Atualizado por {item.updated_by_name}</span> : null}
                    <span>• {new Date(item.updated_at).toLocaleString("pt-BR")}</span>
                    {item.source_document_name ? <span>• Origem: {item.source_document_name}</span> : null}
                  </div>
                  {item.tags.length ? (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {item.tags.map((tag) => (
                        <span key={tag} className="rounded bg-muted px-2 py-0.5 text-xs">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={item.enabled}
                      disabled={!canManage}
                      onCheckedChange={() => void toggle(item)}
                      aria-label={item.enabled ? "Desativar conteúdo" : "Ativar conteúdo"}
                    />
                    <span className="text-xs text-muted-foreground">IA</span>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => void openVersions(item)} title="Histórico">
                    <History className="h-4 w-4" />
                  </Button>
                  {canManage ? (
                    <>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(item)} title="Editar">
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setPendingDelete(item)} title="Excluir">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar conteúdo" : "Novo conteúdo"}</DialogTitle>
            <DialogDescription>
              Escreva apenas informações oficiais do escritório. A IA usa esse texto exatamente como está.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Título</label>
              <Input
                required
                maxLength={180}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ex.: Documentos necessários para consulta"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Tipo</label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={form.contentType}
                  onChange={(e) => setForm({ ...form, contentType: e.target.value as KnowledgeType })}
                >
                  {KNOWLEDGE_TYPES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Prioridade (0–100)</label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Conteúdo</label>
              <Textarea
                required
                maxLength={30000}
                rows={10}
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder="Informe a orientação completa, procedimento, resposta ou política..."
              />
              <p className="text-xs text-muted-foreground">{form.content.length}/30.000 caracteres</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Tags</label>
              <Input
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                placeholder="Ex.: consulta, documentos, atendimento"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Documento de origem (opcional)</label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={form.sourceDocumentId}
                onChange={(e) => setForm({ ...form, sourceDocumentId: e.target.value })}
              >
                <option value="">Sem documento vinculado</option>
                {documents.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.name}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={form.enabled}
                onCheckedChange={(checked) => setForm({ ...form, enabled: checked })}
              />
              Conteúdo ativo para uso da IA
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditorOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Salvando..." : "Salvar conteúdo"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!versionsFor} onOpenChange={(open) => !open && setVersionsFor(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Histórico de versões</DialogTitle>
            <DialogDescription>{versionsFor?.title}</DialogDescription>
          </DialogHeader>
          {versionsLoading ? (
            <p className="text-sm text-muted-foreground">Carregando histórico...</p>
          ) : versions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma alteração registrada.</p>
          ) : (
            <div className="space-y-3">
              {versions.map((version) => (
                <div key={version.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge variant="secondary">Versão {version.version}</Badge>
                    <span className="text-muted-foreground">
                      {new Date(version.created_at).toLocaleString("pt-BR")}
                    </span>
                    {version.changed_by_name ? (
                      <span className="text-muted-foreground">• {version.changed_by_name}</span>
                    ) : null}
                    <span className="text-muted-foreground">
                      • {version.enabled ? "Ativo" : "Inativo"}
                    </span>
                  </div>
                  <p className="mt-2 font-medium">{version.title}</p>
                  <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-sm text-muted-foreground">
                    {version.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conteúdo</AlertDialogTitle>
            <AlertDialogDescription>
              "{pendingDelete?.title}" deixará de ser usado pela IA. O histórico de versões é preservado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmDelete()}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
