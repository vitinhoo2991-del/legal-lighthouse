// Etapa 06 — CRM + Pipeline. Kanban, lista, detalhe, atividades e tarefas
// sobre as oportunidades reais do escritório. Nenhum dado é gerado localmente.
import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  CalendarClock,
  KanbanSquare,
  List,
  Loader2,
  MessageSquare,
  Plus,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { FilterBar, PageHeader, SearchInput } from "@/components/common/PageHeader";
import { EmptyState, LoadingState } from "@/components/common/states";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { listTeamOptions } from "@/lib/leads.functions";
import {
  createActivity,
  createOpportunity,
  createTask,
  getCrmBoard,
  getOpportunityDetail,
  listConvertibleLeads,
  moveOpportunityStage,
  setTaskStatus,
  updateOpportunity,
  type OpportunityRow,
  type StageRow,
} from "@/lib/crm.functions";

export const Route = createFileRoute("/_authenticated/_app/crm")({
  component: CrmPage,
  head: () => ({
    meta: [
      { title: "CRM e pipeline comercial | JurisIA" },
      {
        name: "description",
        content:
          "Acompanhe oportunidades do escritório do primeiro contato até a contratação, com lead score, atividades e tarefas.",
      },
      { property: "og:title", content: "CRM e pipeline comercial | JurisIA" },
      {
        property: "og:description",
        content: "Pipeline comercial jurídico com oportunidades reais, tarefas e histórico.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const LOSS_REASONS = [
  "Não respondeu",
  "Não tinha interesse",
  "Valor/honorários",
  "Escolheu outro escritório",
  "Caso fora da atuação",
  "Prazo expirado",
  "Problema resolvido",
  "Outro",
];

const ACTIVITY_LABEL: Record<string, string> = {
  ligacao: "Ligação",
  mensagem: "Mensagem",
  reuniao: "Reunião",
  consulta: "Consulta",
  proposta: "Proposta",
  observacao: "Observação",
  tarefa: "Tarefa",
};

const PRIORITY_LABEL: Record<string, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  urgente: "Urgente",
};

const TASK_STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

const TEMPERATURE_TONE: Record<string, string> = {
  quente: "text-rose-300",
  morno: "text-amber-300",
  frio: "text-sky-300",
};

function money(value: number | null, currency = "BRL") {
  if (value === null || value === undefined) return null;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value);
}

function shortDate(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function CrmPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const board = useServerFn(getCrmBoard);
  const team = useServerFn(listTeamOptions);
  const move = useServerFn(moveOpportunityStage);

  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("todas");
  const [assignedFilter, setAssignedFilter] = useState("todos");
  const [temperature, setTemperature] = useState<"todas" | "quente" | "morno" | "frio">("todas");
  const [result, setResult] = useState<"todas" | "abertas" | "ganhas" | "perdidas">("todas");
  const [practiceArea, setPracticeArea] = useState("");
  const [minScore, setMinScore] = useState("");
  const [source, setSource] = useState("todas");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [selected, setSelected] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [dragging, setDragging] = useState<OpportunityRow | null>(null);
  const [lossTarget, setLossTarget] = useState<{ opp: OpportunityRow; stage: StageRow } | null>(
    null,
  );

  const filters = useMemo(
    () => ({
      search,
      temperature,
      result,
      ...(stageFilter !== "todas" ? { stageId: stageFilter } : {}),
      ...(assignedFilter !== "todos" ? { assignedTo: assignedFilter } : {}),
      ...(practiceArea ? { practiceArea } : {}),
      ...(minScore ? { minScore: Number(minScore) } : {}),
      ...(source !== "todas" ? { source } : {}),
      ...(from ? { from: new Date(from).toISOString() } : {}),
      ...(to ? { to: new Date(`${to}T23:59:59`).toISOString() } : {}),
    }),
    [search, temperature, result, stageFilter, assignedFilter, practiceArea, minScore, source, from, to],
  );

  const boardQuery = useQuery({
    queryKey: ["crm-board", filters],
    queryFn: () => board({ data: filters }),
  });
  const teamQuery = useQuery({ queryKey: ["crm-team"], queryFn: () => team() });

  // Realtime: o pipeline se atualiza quando outra pessoa da equipe mexe.
  useEffect(() => {
    const channel = supabase
      .channel("crm-board")
      .on("postgres_changes", { event: "*", schema: "public", table: "crm_opportunities" }, () => {
        queryClient.invalidateQueries({ queryKey: ["crm-board"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "crm_tasks" }, () => {
        queryClient.invalidateQueries({ queryKey: ["crm-board"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const moveMutation = useMutation({
    mutationFn: (input: {
      opportunityId: string;
      stageId: string;
      expectedStageId: string;
      lossReason?: string | null;
    }) => move({ data: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-board"] });
      queryClient.invalidateQueries({ queryKey: ["crm-detail"] });
      toast.success("Oportunidade movida.");
    },
    onError: (error: Error) => {
      // Erro no banco: o card volta para a posição anterior (a lista é recarregada).
      queryClient.invalidateQueries({ queryKey: ["crm-board"] });
      if (error.message.includes("CONFLICT"))
        toast.error("Outra pessoa moveu esta oportunidade agora. Atualizamos o pipeline.");
      else if (error.message.includes("FORBIDDEN"))
        toast.error("Você não tem permissão para mover esta oportunidade.");
      else if (error.message.includes("LOSS_REASON")) toast.error("Informe o motivo da perda.");
      else toast.error("Não foi possível mover a oportunidade.");
    },
  });

  const data = boardQuery.data;
  const stages = data?.stages ?? [];
  const opportunities = data?.opportunities ?? [];
  const stats = data?.stats;

  function handleDrop(stage: StageRow) {
    const opp = dragging;
    setDragging(null);
    if (!opp || opp.stage_id === stage.id) return;
    if (stage.kind === "perdida") {
      setLossTarget({ opp, stage });
      return;
    }
    moveMutation.mutate({
      opportunityId: opp.id,
      stageId: stage.id,
      expectedStageId: opp.stage_id,
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="CRM jurídico"
        description="Do primeiro contato até a contratação, com os leads reais do seu escritório."
        actions={
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-border p-0.5">
              <Button
                size="sm"
                variant={view === "kanban" ? "secondary" : "ghost"}
                onClick={() => setView("kanban")}
              >
                <KanbanSquare className="mr-1 h-4 w-4" /> Kanban
              </Button>
              <Button
                size="sm"
                variant={view === "list" ? "secondary" : "ghost"}
                onClick={() => setView("list")}
              >
                <List className="mr-1 h-4 w-4" /> Lista
              </Button>
            </div>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Criar oportunidade
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Oportunidades", value: stats?.total ?? 0 },
          { label: "Novas (7 dias)", value: stats?.novas ?? 0 },
          { label: "Em negociação", value: stats?.emNegociacao ?? 0 },
          { label: "Ganhas", value: stats?.ganhas ?? 0 },
          { label: "Perdidas", value: stats?.perdidas ?? 0 },
          {
            label: "Valor estimado",
            value: money(stats?.valorEstimado ?? 0) ?? "—",
          },
        ].map((card) => (
          <div key={card.label} className="surface-panel p-4">
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p className="mt-1 font-display text-xl font-semibold">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="surface-panel p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Funil comercial</p>
            <p className="text-xs text-muted-foreground">
              {stats && stats.conversao !== null
                ? `Conversão: ${stats.conversao}% (${stats.ganhas} contratadas de ${stats.conversaoBase} oportunidades encerradas)`
                : "Conversão disponível quando houver oportunidades encerradas."}
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {(data?.funnel ?? []).map((step) => (
            <div
              key={step.stageId}
              className="rounded-lg border border-border bg-background/40 px-3 py-2 text-xs"
            >
              <span className="text-muted-foreground">{step.name}</span>{" "}
              <span className="font-semibold">{step.count}</span>
            </div>
          ))}
        </div>
      </div>

      <FilterBar>
        <SearchInput
          placeholder="Buscar por nome, telefone, e-mail ou título"
          value={search}
          onChange={setSearch}
        />
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-[190px]">
            <SelectValue placeholder="Etapa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as etapas</SelectItem>
            {stages.map((stage) => (
              <SelectItem key={stage.id} value={stage.id}>
                {stage.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={assignedFilter} onValueChange={setAssignedFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Responsável" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os responsáveis</SelectItem>
            {(teamQuery.data ?? []).map((member) => (
              <SelectItem key={member.id} value={member.id}>
                {member.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={temperature} onValueChange={(value) => setTemperature(value as never)}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Temperatura" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Temperatura</SelectItem>
            <SelectItem value="quente">Quente</SelectItem>
            <SelectItem value="morno">Morno</SelectItem>
            <SelectItem value="frio">Frio</SelectItem>
          </SelectContent>
        </Select>
        <Select value={result} onValueChange={(value) => setResult(value as never)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Resultado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todos os resultados</SelectItem>
            <SelectItem value="abertas">Em aberto</SelectItem>
            <SelectItem value="ganhas">Ganhas</SelectItem>
            <SelectItem value="perdidas">Perdidas</SelectItem>
          </SelectContent>
        </Select>
        <Select value={source} onValueChange={setSource}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Origem" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as origens</SelectItem>
            <SelectItem value="whatsapp">WhatsApp</SelectItem>
            <SelectItem value="ai_chat">Atendimento IA</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
          </SelectContent>
        </Select>
        <Input
          placeholder="Área jurídica"
          className="w-[160px]"
          value={practiceArea}
          onChange={(event) => setPracticeArea(event.target.value)}
        />
        <Input
          placeholder="Score mínimo"
          type="number"
          min={0}
          max={100}
          className="w-[140px]"
          value={minScore}
          onChange={(event) => setMinScore(event.target.value)}
        />
        <Input
          type="date"
          className="w-[150px]"
          value={from}
          onChange={(event) => setFrom(event.target.value)}
        />
        <Input
          type="date"
          className="w-[150px]"
          value={to}
          onChange={(event) => setTo(event.target.value)}
        />
      </FilterBar>

      {boardQuery.isLoading ? (
        <LoadingState rows={4} />
      ) : view === "kanban" ? (
        <div className="-mx-4 overflow-x-auto px-4 pb-2">
          <div className="flex min-w-max gap-4">
            {stages.map((stage) => {
              const cards = opportunities.filter((o) => o.stage_id === stage.id);
              return (
                <div
                  key={stage.id}
                  className="w-[280px] shrink-0"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => handleDrop(stage)}
                >
                  <div className="surface-panel flex h-full min-h-[380px] flex-col p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{stage.name}</span>
                      <Badge variant="outline" className="text-[11px]">
                        {cards.length}
                      </Badge>
                    </div>
                    <div className="mt-3 flex flex-1 flex-col gap-2">
                      {cards.length === 0 ? (
                        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border px-3 text-center text-xs text-muted-foreground">
                          Nenhuma oportunidade nesta etapa.
                        </div>
                      ) : (
                        cards.map((opp) => (
                          <button
                            key={opp.id}
                            draggable
                            onDragStart={() => setDragging(opp)}
                            onDragEnd={() => setDragging(null)}
                            onClick={() => setSelected(opp.id)}
                            className="w-full rounded-lg border border-border bg-background/50 p-3 text-left transition hover:border-primary/40"
                          >
                            <p className="text-sm font-medium">{opp.contact_name ?? "Sem nome"}</p>
                            <p className="text-xs text-muted-foreground">{opp.title}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                              {opp.lead_score !== null && (
                                <span
                                  className={TEMPERATURE_TONE[opp.lead_temperature ?? "frio"]}
                                >
                                  Score {opp.lead_score} · {opp.lead_temperature}
                                </span>
                              )}
                              {opp.practice_area && (
                                <span className="text-muted-foreground">{opp.practice_area}</span>
                              )}
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                              <span className="inline-flex items-center gap-1">
                                <UserRound className="h-3 w-3" />
                                {opp.assigned_name ?? "Sem responsável"}
                              </span>
                              {opp.estimated_value !== null && (
                                <span>{money(opp.estimated_value, opp.currency)}</span>
                              )}
                              {opp.expected_close_date && (
                                <span>Fech. {shortDate(opp.expected_close_date)}</span>
                              )}
                            </div>
                            {opp.overdue_tasks > 0 && (
                              <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-rose-300">
                                <AlertTriangle className="h-3 w-3" /> {opp.overdue_tasks} tarefa(s)
                                atrasada(s)
                              </p>
                            )}
                            <p className="mt-2 text-[11px] text-muted-foreground/70">
                              Última atividade: {shortDate(opp.last_activity_at)}
                            </p>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : opportunities.length === 0 ? (
        <EmptyState
          icon={<KanbanSquare className="h-5 w-5" />}
          title="Nenhuma oportunidade encontrada."
          description="Crie uma oportunidade a partir de um lead real para acompanhar a negociação aqui."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Oportunidade</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Etapa</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Previsão</TableHead>
                <TableHead>Última atividade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {opportunities.map((opp) => (
                <TableRow
                  key={opp.id}
                  className="cursor-pointer"
                  onClick={() => setSelected(opp.id)}
                >
                  <TableCell className="font-medium">{opp.title}</TableCell>
                  <TableCell>{opp.contact_name ?? "—"}</TableCell>
                  <TableCell>{stages.find((s) => s.id === opp.stage_id)?.name ?? "—"}</TableCell>
                  <TableCell className={TEMPERATURE_TONE[opp.lead_temperature ?? "frio"]}>
                    {opp.lead_score ?? "—"} {opp.lead_temperature ? `· ${opp.lead_temperature}` : ""}
                  </TableCell>
                  <TableCell>{opp.assigned_name ?? "Sem responsável"}</TableCell>
                  <TableCell>{money(opp.estimated_value, opp.currency) ?? "—"}</TableCell>
                  <TableCell>{shortDate(opp.expected_close_date) ?? "—"}</TableCell>
                  <TableCell>{shortDate(opp.last_activity_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CreateOpportunityDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        stages={stages}
        team={teamQuery.data ?? []}
        onCreated={() => queryClient.invalidateQueries({ queryKey: ["crm-board"] })}
      />

      <LossDialog
        target={lossTarget}
        onClose={() => setLossTarget(null)}
        onConfirm={(reason) => {
          if (!lossTarget) return;
          moveMutation.mutate({
            opportunityId: lossTarget.opp.id,
            stageId: lossTarget.stage.id,
            expectedStageId: lossTarget.opp.stage_id,
            lossReason: reason,
          });
          setLossTarget(null);
        }}
      />

      <OpportunitySheet
        opportunityId={selected}
        onClose={() => setSelected(null)}
        team={teamQuery.data ?? []}
        onOpenConversation={(conversationId) => {
          setSelected(null);
          navigate({ to: "/atendimento", search: { conversation: conversationId } as never });
        }}
      />
    </div>
  );
}

function CreateOpportunityDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stages: StageRow[];
  team: { id: string; name: string }[];
  onCreated: () => void;
  presetLeadId?: string | null;
}) {
  const create = useServerFn(createOpportunity);
  const leadsFn = useServerFn(listConvertibleLeads);
  const leadsQuery = useQuery({
    queryKey: ["crm-convertible"],
    queryFn: () => leadsFn(),
    enabled: props.open,
  });

  const [leadId, setLeadId] = useState<string>("nenhum");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [stageId, setStageId] = useState("");
  const [assignedTo, setAssignedTo] = useState("nenhum");
  const [value, setValue] = useState("");
  const [probability, setProbability] = useState("0");
  const [closeDate, setCloseDate] = useState("");
  const [source, setSource] = useState("manual");

  const mutation = useMutation({
    mutationFn: () =>
      create({
        data: {
          leadId: leadId === "nenhum" ? null : leadId,
          title,
          description: description || null,
          stageId: stageId || undefined,
          assignedTo: assignedTo === "nenhum" ? null : assignedTo,
          estimatedValue: value ? Number(value) : null,
          probability: Number(probability || 0),
          expectedCloseDate: closeDate || null,
          source,
        },
      }),
    onSuccess: () => {
      toast.success("Oportunidade criada.");
      props.onCreated();
      props.onOpenChange(false);
      setTitle("");
      setDescription("");
      setValue("");
      setCloseDate("");
      setLeadId("nenhum");
    },
    onError: () => toast.error("Não foi possível criar a oportunidade."),
  });

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Criar oportunidade</DialogTitle>
          <DialogDescription>
            Escolha um lead com interesse comercial ou registre uma oportunidade manual.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Lead</Label>
            <Select value={leadId} onValueChange={setLeadId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar lead" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhum">Sem lead vinculado</SelectItem>
                {(leadsQuery.data ?? []).map((lead: any) => (
                  <SelectItem key={lead.id} value={lead.id}>
                    {lead.name ?? lead.phone ?? "Lead"} · score {lead.lead_score}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {leadsQuery.data && leadsQuery.data.length === 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                Nenhum lead com intenção comercial disponível no momento.
              </p>
            )}
          </div>
          <div>
            <Label>Título</Label>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Etapa</Label>
              <Select value={stageId} onValueChange={setStageId}>
                <SelectTrigger>
                  <SelectValue placeholder="Primeira etapa" />
                </SelectTrigger>
                <SelectContent>
                  {props.stages.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      {stage.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Responsável comercial</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger>
                  <SelectValue placeholder="Sem responsável" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhum">Sem responsável</SelectItem>
                  {props.team.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Valor estimado (opcional)</Label>
              <Input
                type="number"
                min={0}
                value={value}
                onChange={(event) => setValue(event.target.value)}
              />
            </div>
            <div>
              <Label>Probabilidade (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={probability}
                onChange={(event) => setProbability(event.target.value)}
              />
            </div>
            <div>
              <Label>Previsão de fechamento</Label>
              <Input
                type="date"
                value={closeDate}
                onChange={(event) => setCloseDate(event.target.value)}
              />
            </div>
            <div>
              <Label>Origem</Label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="ai_chat">Atendimento IA</SelectItem>
                  <SelectItem value="indicacao">Indicação</SelectItem>
                  <SelectItem value="site">Site</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            disabled={title.trim().length < 2 || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Criar oportunidade
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LossDialog(props: {
  target: { opp: OpportunityRow; stage: StageRow } | null;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState(LOSS_REASONS[0]!);
  const [other, setOther] = useState("");
  const finalReason = reason === "Outro" ? other.trim() : reason;

  return (
    <Dialog open={Boolean(props.target)} onOpenChange={(open) => !open && props.onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Marcar como perdida</DialogTitle>
          <DialogDescription>O motivo da perda é obrigatório e fica no histórico.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Select value={reason} onValueChange={setReason}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LOSS_REASONS.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {reason === "Outro" && (
            <Textarea
              placeholder="Descreva o motivo"
              value={other}
              onChange={(event) => setOther(event.target.value)}
            />
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={props.onClose}>
            Cancelar
          </Button>
          <Button disabled={!finalReason} onClick={() => props.onConfirm(finalReason)}>
            Confirmar perda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OpportunitySheet(props: {
  opportunityId: string | null;
  onClose: () => void;
  team: { id: string; name: string }[];
  onOpenConversation: (conversationId: string) => void;
}) {
  const queryClient = useQueryClient();
  const detailFn = useServerFn(getOpportunityDetail);
  const updateFn = useServerFn(updateOpportunity);
  const activityFn = useServerFn(createActivity);
  const taskFn = useServerFn(createTask);
  const taskStatusFn = useServerFn(setTaskStatus);
  const moveFn = useServerFn(moveOpportunityStage);

  const detail = useQuery({
    queryKey: ["crm-detail", props.opportunityId],
    enabled: Boolean(props.opportunityId),
    queryFn: () => detailFn({ data: { opportunityId: props.opportunityId! } }),
  });

  const [activityType, setActivityType] = useState("ligacao");
  const [activityText, setActivityText] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDue, setTaskDue] = useState("");
  const [taskPriority, setTaskPriority] = useState("media");
  const [lossOpen, setLossOpen] = useState(false);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["crm-detail"] });
    queryClient.invalidateQueries({ queryKey: ["crm-board"] });
  };

  const opp = detail.data?.opportunity;
  const stages = detail.data?.stages ?? [];
  const currentStage = stages.find((s) => s.id === opp?.stage_id);

  const saveMutation = useMutation({
    mutationFn: (patch: Record<string, unknown>) =>
      updateFn({ data: { opportunityId: props.opportunityId!, ...patch } as never }),
    onSuccess: () => {
      invalidate();
      toast.success("Oportunidade atualizada.");
    },
    onError: (error: Error) =>
      toast.error(
        error.message.includes("FORBIDDEN")
          ? "Você não tem permissão para editar esta oportunidade."
          : "Não foi possível salvar.",
      ),
  });

  const stageMutation = useMutation({
    mutationFn: (input: { stageId: string; lossReason?: string }) =>
      moveFn({
        data: {
          opportunityId: props.opportunityId!,
          stageId: input.stageId,
          expectedStageId: opp!.stage_id,
          lossReason: input.lossReason ?? null,
        },
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Etapa atualizada.");
    },
    onError: (error: Error) =>
      toast.error(
        error.message.includes("CONFLICT")
          ? "Outra pessoa alterou esta oportunidade agora."
          : "Não foi possível alterar a etapa.",
      ),
  });

  return (
    <Sheet open={Boolean(props.opportunityId)} onOpenChange={(open) => !open && props.onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{opp?.title ?? "Oportunidade"}</SheetTitle>
        </SheetHeader>

        {detail.isLoading || !opp ? (
          <LoadingState rows={4} />
        ) : (
          <div className="mt-4 space-y-5 text-sm">
            <section className="space-y-1">
              <p className="text-xs uppercase text-muted-foreground">Contato</p>
              <p className="font-medium">{opp.contact_name ?? "Sem nome"}</p>
              <p className="text-muted-foreground">{opp.contact_phone ?? "Sem telefone"}</p>
              <p className="text-muted-foreground">{opp.contact_email ?? "Sem e-mail"}</p>
              {opp.whatsapp_conversation_id && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  onClick={() => props.onOpenConversation(opp.whatsapp_conversation_id!)}
                >
                  <MessageSquare className="mr-2 h-4 w-4" /> Abrir conversa
                </Button>
              )}
            </section>

            <Separator />

            <section className="space-y-1">
              <p className="text-xs uppercase text-muted-foreground">Lead (Etapa 04)</p>
              {opp.lead_id ? (
                <>
                  <p className={TEMPERATURE_TONE[opp.lead_temperature ?? "frio"]}>
                    Score {opp.lead_score} — {opp.lead_temperature}
                  </p>
                  <p className="text-muted-foreground">
                    {opp.practice_area ?? "Área não identificada"} ·{" "}
                    {opp.qualification_status ?? "—"}
                  </p>
                  {detail.data?.lead?.case_summary && (
                    <p className="text-muted-foreground">{detail.data.lead.case_summary}</p>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground">Oportunidade sem lead vinculado.</p>
              )}
            </section>

            <Separator />

            <section className="space-y-3">
              <p className="text-xs uppercase text-muted-foreground">Pipeline</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <Label className="text-xs">Etapa atual</Label>
                  <Select
                    value={opp.stage_id}
                    onValueChange={(value) => {
                      const stage = stages.find((s) => s.id === value);
                      if (stage?.kind === "perdida") setLossOpen(true);
                      else stageMutation.mutate({ stageId: value });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {stages.map((stage) => (
                        <SelectItem key={stage.id} value={stage.id}>
                          {stage.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Responsável comercial</Label>
                  <Select
                    value={opp.assigned_to ?? "nenhum"}
                    onValueChange={(value) =>
                      saveMutation.mutate({ assignedTo: value === "nenhum" ? null : value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nenhum">Sem responsável</SelectItem>
                      {props.team.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Valor estimado</Label>
                  <Input
                    type="number"
                    defaultValue={opp.estimated_value ?? ""}
                    onBlur={(event) =>
                      saveMutation.mutate({
                        estimatedValue: event.target.value ? Number(event.target.value) : null,
                      })
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">Probabilidade (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    defaultValue={opp.probability}
                    onBlur={(event) =>
                      saveMutation.mutate({ probability: Number(event.target.value || 0) })
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">Previsão de fechamento</Label>
                  <Input
                    type="date"
                    defaultValue={opp.expected_close_date ?? ""}
                    onBlur={(event) =>
                      saveMutation.mutate({ expectedCloseDate: event.target.value || null })
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">Origem</Label>
                  <Input value={opp.source ?? "—"} readOnly />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Responsável pelo atendimento (Conversas): {opp.service_assignee_name ?? "—"}. O
                responsável comercial e o responsável pelo atendimento podem ser pessoas
                diferentes.
              </p>
              {opp.loss_reason && (
                <p className="text-xs text-rose-300">Motivo da perda: {opp.loss_reason}</p>
              )}
              {currentStage?.kind !== "aberta" && (
                <p className="text-xs text-muted-foreground">
                  {currentStage?.kind === "ganha"
                    ? `Contratada em ${shortDate(opp.won_at)}`
                    : `Perdida em ${shortDate(opp.lost_at)} — mova para uma etapa aberta para reabrir.`}
                </p>
              )}
            </section>

            <Separator />

            <section className="space-y-2">
              <p className="text-xs uppercase text-muted-foreground">Tarefas</p>
              {(detail.data?.tasks ?? []).length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhuma tarefa registrada.</p>
              )}
              {(detail.data?.tasks ?? []).map((task: any) => {
                const overdue =
                  task.due_at &&
                  new Date(task.due_at).getTime() < Date.now() &&
                  (task.status === "pendente" || task.status === "em_andamento");
                return (
                  <div
                    key={task.id}
                    className="rounded-lg border border-border bg-background/40 p-3 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{task.title}</span>
                      <Badge variant="outline">{PRIORITY_LABEL[task.priority]}</Badge>
                    </div>
                    <p className={overdue ? "mt-1 text-rose-300" : "mt-1 text-muted-foreground"}>
                      {overdue ? "🔴 Tarefa atrasada · " : ""}
                      {task.due_at
                        ? `Prazo ${new Date(task.due_at).toLocaleString("pt-BR")}`
                        : "Sem prazo"}{" "}
                      · {task.assignee_name ?? "Sem responsável"} ·{" "}
                      {TASK_STATUS_LABEL[task.status]}
                    </p>
                    {task.status !== "concluida" && task.status !== "cancelada" && (
                      <div className="mt-2 flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            taskStatusFn({ data: { taskId: task.id, status: "concluida" } }).then(
                              invalidate,
                            )
                          }
                        >
                          Concluir
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            taskStatusFn({ data: { taskId: task.id, status: "cancelada" } }).then(
                              invalidate,
                            )
                          }
                        >
                          Cancelar
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="grid gap-2 sm:grid-cols-[1fr_150px_130px_auto]">
                <Input
                  placeholder="Nova tarefa"
                  value={taskTitle}
                  onChange={(event) => setTaskTitle(event.target.value)}
                />
                <Input
                  type="datetime-local"
                  value={taskDue}
                  onChange={(event) => setTaskDue(event.target.value)}
                />
                <Select value={taskPriority} onValueChange={setTaskPriority}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIORITY_LABEL).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  disabled={taskTitle.trim().length < 2}
                  onClick={() =>
                    taskFn({
                      data: {
                        opportunityId: props.opportunityId!,
                        title: taskTitle.trim(),
                        dueAt: taskDue ? new Date(taskDue).toISOString() : null,
                        priority: taskPriority as never,
                      },
                    })
                      .then(() => {
                        setTaskTitle("");
                        setTaskDue("");
                        invalidate();
                      })
                      .catch(() => toast.error("Não foi possível criar a tarefa."))
                  }
                >
                  <CalendarClock className="h-4 w-4" />
                </Button>
              </div>
            </section>

            <Separator />

            <section className="space-y-2">
              <p className="text-xs uppercase text-muted-foreground">Atividades</p>
              <div className="grid gap-2 sm:grid-cols-[150px_1fr_auto]">
                <Select value={activityType} onValueChange={setActivityType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ACTIVITY_LABEL).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Descrição da atividade"
                  value={activityText}
                  onChange={(event) => setActivityText(event.target.value)}
                />
                <Button
                  disabled={activityText.trim().length < 2}
                  onClick={() =>
                    activityFn({
                      data: {
                        opportunityId: props.opportunityId!,
                        type: activityType as never,
                        description: activityText.trim(),
                        status: "concluida",
                      },
                    })
                      .then(() => {
                        setActivityText("");
                        invalidate();
                      })
                      .catch(() => toast.error("Não foi possível registrar a atividade."))
                  }
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {(detail.data?.activities ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhuma atividade registrada.</p>
              ) : (
                <ul className="space-y-2">
                  {(detail.data?.activities ?? []).map((activity: any) => (
                    <li
                      key={activity.id}
                      className="rounded-lg border border-border bg-background/40 p-3 text-xs"
                    >
                      <span className="font-medium">{ACTIVITY_LABEL[activity.type]}</span> ·{" "}
                      {activity.description}
                      <p className="mt-1 text-muted-foreground">
                        {activity.owner_name ?? "—"} ·{" "}
                        {new Date(activity.activity_at).toLocaleString("pt-BR")}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <Separator />

            <section className="space-y-2">
              <p className="text-xs uppercase text-muted-foreground">Histórico do pipeline</p>
              {(detail.data?.history ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground">Sem movimentações registradas.</p>
              ) : (
                <ul className="space-y-2">
                  {(detail.data?.history ?? []).map((item: any) => (
                    <li key={item.id} className="text-xs text-muted-foreground">
                      {new Date(item.created_at).toLocaleString("pt-BR")} — {item.description}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}

        <LossDialog
          target={
            lossOpen && opp
              ? {
                  opp: opp as OpportunityRow,
                  stage: stages.find((s) => s.kind === "perdida") as StageRow,
                }
              : null
          }
          onClose={() => setLossOpen(false)}
          onConfirm={(reason) => {
            const lost = stages.find((s) => s.kind === "perdida");
            if (lost) stageMutation.mutate({ stageId: lost.id, lossReason: reason });
            setLossOpen(false);
          }}
        />
      </SheetContent>
    </Sheet>
  );
}
