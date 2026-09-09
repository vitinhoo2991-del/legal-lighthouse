import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, Check, Edit3, Plus, Search, Trash2, X } from "lucide-react";

import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  KNOWLEDGE_TYPES,
  deleteKnowledgeItem,
  listKnowledgeItems,
  saveKnowledgeItem,
  toggleKnowledgeItem,
  type KnowledgeItem,
  type KnowledgeType,
} from "@/lib/knowledge.functions";

export const Route = createFileRoute("/_authenticated/_app/base-conhecimento")({
  component: BaseConhecimentoPage,
});

type FormState = {
  id?: string;
  title: string;
  content: string;
  contentType: KnowledgeType;
  tags: string;
  enabled: boolean;
  priority: number;
};

const EMPTY_FORM: FormState = {
  title: "",
  content: "",
  contentType: "orientacao",
  tags: "",
  enabled: true,
  priority: 50,
};

function typeLabel(type: string) {
  return KNOWLEDGE_TYPES.find((item) => item.value === type)?.label ?? "Outro";
}

function BaseConhecimentoPage() {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const rows = await listKnowledgeItems({ data: { search: search.trim() || undefined } });
      setItems(rows);
    } catch {
      setError("Não foi possível carregar a base de conhecimento.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const enabledCount = useMemo(() => items.filter((item) => item.enabled).length, [items]);

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
    });
    setEditorOpen(true);
    setError(null);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await saveKnowledgeItem({
        data: {
          id: form.id,
          title: form.title,
          content: form.content,
          contentType: form.contentType,
          tags: form.tags.split(","),
          enabled: form.enabled,
          priority: form.priority,
        },
      });
      setEditorOpen(false);
      setForm(EMPTY_FORM);
      await load();
    } catch (err) {
      setError(err instanceof Error && err.message === "FORBIDDEN" ? "Apenas administradores podem alterar a base." : "Não foi possível salvar o conteúdo.");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(item: KnowledgeItem) {
    try {
      await toggleKnowledgeItem({ data: { id: item.id, enabled: !item.enabled } });
      await load();
    } catch {
      setError("Não foi possível alterar o status do conteúdo.");
    }
  }

  async function remove(item: KnowledgeItem) {
    if (!window.confirm(`Excluir "${item.title}" da base de conhecimento?`)) return;
    try {
      await deleteKnowledgeItem({ data: { id: item.id } });
      await load();
    } catch {
      setError("Não foi possível excluir o conteúdo.");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Base de conhecimento"
        description="Conteúdos internos que podem orientar a inteligência artificial e padronizar o atendimento do escritório."
        actions={
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Adicionar conteúdo
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Conteúdos</p>
          <p className="mt-1 text-2xl font-semibold">{items.length}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Ativos</p>
          <p className="mt-1 text-2xl font-semibold">{enabledCount}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Uso da IA</p>
          <p className="mt-1 text-sm font-medium">Somente conteúdos ativos e pertinentes</p>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-xl border bg-card px-3">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por título ou conteúdo..."
          className="border-0 px-1 shadow-none focus-visible:ring-0"
        />
      </div>

      {error ? (
        <div className="flex items-center justify-between rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Fechar erro"><X className="h-4 w-4" /></button>
        </div>
      ) : null}

      {editorOpen ? (
        <form onSubmit={submit} className="space-y-4 rounded-xl border bg-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">{form.id ? "Editar conteúdo" : "Novo conteúdo"}</h2>
              <p className="text-sm text-muted-foreground">Escreva apenas informações oficiais do escritório.</p>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={() => setEditorOpen(false)}><X className="h-4 w-4" /></Button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium">Título</label>
              <Input required maxLength={180} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex.: Documentos necessários para consulta" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo</label>
              <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.contentType} onChange={(e) => setForm({ ...form, contentType: e.target.value as KnowledgeType })}>
                {KNOWLEDGE_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Prioridade (0–100)</label>
              <Input type="number" min={0} max={100} value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium">Conteúdo</label>
              <Textarea required maxLength={30000} rows={10} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="Informe a orientação completa, procedimento, resposta ou política..." />
              <p className="text-xs text-muted-foreground">{form.content.length}/30.000 caracteres</p>
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium">Tags</label>
              <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="Ex.: consulta, documentos, atendimento" />
            </div>
            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
              Conteúdo ativo para uso da IA
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setEditorOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar conteúdo"}</Button>
          </div>
        </form>
      ) : null}

      <div className="space-y-3">
        {loading ? (
          <div className="rounded-xl border p-8 text-center text-sm text-muted-foreground">Carregando base de conhecimento...</div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border p-10 text-center">
            <BookOpen className="mx-auto h-8 w-8 text-muted-foreground" />
            <h2 className="mt-3 font-semibold">Nenhum conteúdo encontrado</h2>
            <p className="mt-1 text-sm text-muted-foreground">Cadastre FAQs, orientações e procedimentos oficiais do escritório.</p>
            <Button className="mt-4" onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Adicionar conteúdo</Button>
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="rounded-xl border bg-card p-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{item.title}</h3>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{typeLabel(item.content_type)}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${item.enabled ? "bg-emerald-500/10 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                      {item.enabled ? "Ativo" : "Inativo"}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">{item.content}</p>
                  {item.tags.length ? <div className="mt-3 flex flex-wrap gap-1">{item.tags.map((tag) => <span key={tag} className="rounded bg-muted px-2 py-0.5 text-xs">#{tag}</span>)}</div> : null}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => void toggle(item)} title={item.enabled ? "Desativar" : "Ativar"}>
                    <Check className={`mr-1 h-4 w-4 ${item.enabled ? "" : "opacity-40"}`} />{item.enabled ? "Ativo" : "Ativar"}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(item)} title="Editar"><Edit3 className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => void remove(item)} title="Excluir"><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
