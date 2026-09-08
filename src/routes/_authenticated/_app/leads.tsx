import { useMemo, useState } from "react";
import { UpcomingEvents } from "@/components/calendar/UpcomingEvents";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Flame, Loader2, MessageSquare, Users, X } from "lucide-react";
import { toast } from "sonner";

import { FilterBar, PageHeader, SearchInput } from "@/components/common/PageHeader";
import { EmptyState, LoadingState } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
import {
  assignLead,
  getLeadDetail,
  listLeads,
  listTeamOptions,
  setLeadStatus,
  updateLead,
  type LeadRow,
  type LeadStatus,
  type LeadTemperature,
} from "@/lib/leads.functions";
import { createOpportunity } from "@/lib/crm.functions";

export const Route = createFileRoute("/_authenticated/_app/leads")({
  component: LeadsPage,
});

const STATUS_LABEL: Record<LeadStatus, string> = {
  novo: "Novo",
  em_qualificacao: "Em qualificação",
  qualificado: "Qualificado",
  incompleto: "Qualificação incompleta",
  desqualificado: "Desqualificado",
  atendimento_humano: "Atendimento humano",
};

const STATUS_TONE: Record<LeadStatus, string> = {
  novo: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  em_qualificacao: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  qualificado: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  incompleto: "border-orange-500/30 bg-orange-500/10 text-orange-300",
  desqualificado: "border-border bg-muted/30 text-muted-foreground",
  atendimento_humano: "border-primary/30 bg-primary-soft text-primary",
};

const TEMPERATURE: Record<LeadTemperature, { label: string; dot: string; tone: string }> = {
  quente: { label: "Quente", dot: "bg-rose-400", tone: "text-rose-300" },
  morno: { label: "Morno", dot: "bg-amber-400", tone: "text-amber-300" },
  frio: { label: "Frio", dot: "bg-sky-400", tone: "text-sky-300" },
};

const URGENCY_LABEL: Record<string, string> = {
  desconhecida: "Não identificada",
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  critica: "Crítica",
};

const INTENT_LABEL: Record<string, string> = {
  desconhecida: "Não identificada",
  informacao: "Buscando informação",
  avaliando: "Avaliando",
  contratar: "Quer contratar",
};

const SCORE_RANGES = [
  { value: "todos", label: "Qualquer score" },
  { value: "70-100", label: "70 a 100" },
  { value: "40-69", label: "40 a 69" },
  { value: "0-39", label: "0 a 39" },
];

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function ScoreBar({ score, temperature }: { score: number; temperature: LeadTemperature }) {
  const t = TEMPERATURE[temperature];
  return (
    <div className="flex items-center gap-2">
      <span className="w-8 text-right font-display text-sm font-semibold tabular-nums">
        {score}
      </span>
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted/40">
        <span
          className={`block h-full rounded-full ${t.dot}`}
          style={{ width: `${Math.max(4, score)}%` }}
        />
      </span>
    </div>
  );
}

function TemperatureTag({ temperature }: { temperature: LeadTemperature }) {
  const t = TEMPERATURE[temperature];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${t.tone}`}>
      <span className={`h-2 w-2 rounded-full ${t.dot}`} />
      {t.label}
    </span>
  );
}

function LeadsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("todos");
  const [temperature, setTemperature] = useState<string>("todas");
  const [practiceArea, setPracticeArea] = useState<string>("todas");
  const [assignedTo, setAssignedTo] = useState<string>("todos");
  const [scoreRange, setScoreRange] = useState<string>("todos");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [openLead, setOpenLead] = useState<string | null>(null);

  const fetchLeads = useServerFn(listLeads);
  const fetchTeam = useServerFn(listTeamOptions);

  const filters = useMemo(() => {
    const [min, max] = scoreRange === "todos" ? [undefined, undefined] : scoreRange.split("-");
    return {
      status: status as any,
      temperature: temperature as any,
      practiceArea: practiceArea === "todas" ? undefined : practiceArea,
      assignedTo: assignedTo === "todos" ? undefined : assignedTo,
      minScore: min ? Number(min) : undefined,
      maxScore: max ? Number(max) : undefined,
      from: from ? new Date(from).toISOString() : undefined,
      to: to ? new Date(`${to}T23:59:59`).toISOString() : undefined,
      search: search.trim() || undefined,
    };
  }, [status, temperature, practiceArea, assignedTo, scoreRange, from, to, search]);

  const leadsQuery = useQuery({
    queryKey: ["leads", filters],
    queryFn: () => fetchLeads({ data: filters }),
  });

  const teamQuery = useQuery({ queryKey: ["team-options"], queryFn: () => fetchTeam({}) });

  const leads: LeadRow[] = (leadsQuery.data?.leads ?? []) as LeadRow[];
  const areas: string[] = (leadsQuery.data?.practiceAreas ?? []) as string[];

  const hasFilters =
    status !== "todos" ||
    temperature !== "todas" ||
    practiceArea !== "todas" ||
    assignedTo !== "todos" ||
    scoreRange !== "todos" ||
    Boolean(from || to || search.trim());

  function clearFilters() {
    setStatus("todos");
    setTemperature("todas");
    setPracticeArea("todas");
    setAssignedTo("todos");
    setScoreRange("todos");
    setFrom("");
    setTo("");
    setSearch("");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leads"
        description="Contatos captados pelo escritório, qualificados automaticamente pela IA de atendimento."
        actions={
          leads.some((l) => l.lead_temperature === "quente") ? (
            <Badge
              variant="outline"
              className="gap-1.5 border-rose-500/30 bg-rose-500/10 text-rose-300"
            >
              <Flame className="h-3.5 w-3.5" />
              {leads.filter((l) => l.lead_temperature === "quente").length} lead(s) quente(s)
            </Badge>
          ) : null
        }
      />

      <FilterBar>
        <SearchInput
          placeholder="Buscar por nome, telefone, e-mail ou área"
          value={search}
          onChange={setSearch}
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="sm:w-[190px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {(Object.keys(STATUS_LABEL) as LeadStatus[]).map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={temperature} onValueChange={setTemperature}>
          <SelectTrigger className="sm:w-[150px]">
            <SelectValue placeholder="Temperatura" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            <SelectItem value="quente">Quente</SelectItem>
            <SelectItem value="morno">Morno</SelectItem>
            <SelectItem value="frio">Frio</SelectItem>
          </SelectContent>
        </Select>
        <Select value={practiceArea} onValueChange={setPracticeArea}>
          <SelectTrigger className="sm:w-[170px]">
            <SelectValue placeholder="Área" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as áreas</SelectItem>
            {areas.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={scoreRange} onValueChange={setScoreRange}>
          <SelectTrigger className="sm:w-[160px]">
            <SelectValue placeholder="Score" />
          </SelectTrigger>
          <SelectContent>
            {SCORE_RANGES.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={assignedTo} onValueChange={setAssignedTo}>
          <SelectTrigger className="sm:w-[170px]">
            <SelectValue placeholder="Responsável" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {(teamQuery.data ?? []).map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="sm:w-[150px]"
          />
          <span className="text-xs text-muted-foreground">até</span>
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="sm:w-[150px]"
          />
        </div>
        {hasFilters ? (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
            <X className="h-3.5 w-3.5" /> Limpar
          </Button>
        ) : null}
      </FilterBar>

      {leadsQuery.isLoading ? (
        <LoadingState rows={4} />
      ) : leads.length === 0 ? (
        <EmptyState
          icon={<Users className="h-5 w-5" />}
          title={hasFilters ? "Nenhum lead com esses filtros." : "Você ainda não possui leads."}
          description={
            hasFilters
              ? "Ajuste os filtros para ver outros contatos."
              : "Assim que um contato conversar com o atendimento, ele aparece aqui já qualificado pela IA."
          }
          action={
            hasFilters ? (
              <Button variant="outline" onClick={clearFilters}>
                Limpar filtros
              </Button>
            ) : (
              <Button onClick={() => navigate({ to: "/atendimento-ia" })}>
                Configurar atendimento
              </Button>
            )
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                {[
                  "Nome",
                  "Telefone",
                  "Área",
                  "Status",
                  "Score",
                  "Temperatura",
                  "Intenção",
                  "Urgência",
                  "Responsável",
                  "Última interação",
                  "Criado em",
                ].map((c) => (
                  <TableHead key={c} className="whitespace-nowrap">
                    {c}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((lead) => (
                <TableRow
                  key={lead.id}
                  className="cursor-pointer"
                  onClick={() => setOpenLead(lead.id)}
                >
                  <TableCell className="whitespace-nowrap font-medium">
                    {lead.name ?? "Sem nome"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{lead.phone ?? "—"}</TableCell>
                  <TableCell className="whitespace-nowrap">{lead.practice_area ?? "—"}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Badge variant="outline" className={STATUS_TONE[lead.qualification_status]}>
                      {STATUS_LABEL[lead.qualification_status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <ScoreBar score={lead.lead_score} temperature={lead.lead_temperature} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <TemperatureTag temperature={lead.lead_temperature} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {INTENT_LABEL[lead.intent]}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {URGENCY_LABEL[lead.urgency]}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {lead.assigned_name ?? "—"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {formatDate(lead.last_interaction_at)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {formatDate(lead.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <LeadDetailSheet
        leadId={openLead}
        onClose={() => setOpenLead(null)}
        team={teamQuery.data ?? []}
        onChanged={() => queryClient.invalidateQueries({ queryKey: ["leads"] })}
      />
    </div>
  );
}

function LeadDetailSheet({
  leadId,
  onClose,
  team,
  onChanged,
}: {
  leadId: string | null;
  onClose: () => void;
  team: { id: string; name: string }[];
  onChanged: () => void;
}) {
  const navigate = useNavigate();
  const fetchDetail = useServerFn(getLeadDetail);
  const saveLead = useServerFn(updateLead);
  const changeStatus = useServerFn(setLeadStatus);
  const changeAssignee = useServerFn(assignLead);
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Partial<LeadRow>>({});

  const detailQuery = useQuery({
    queryKey: ["lead", leadId],
    queryFn: () => fetchDetail({ data: { leadId: leadId! } }),
    enabled: Boolean(leadId),
  });

  const lead = detailQuery.data?.lead as LeadRow | undefined;
  const history = detailQuery.data?.history ?? [];

  const saveMutation = useMutation({
    mutationFn: (payload: any) => saveLead({ data: { leadId: leadId!, ...payload } }),
    onSuccess: () => {
      toast.success("Lead atualizado.");
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
      onChanged();
    },
    onError: () => toast.error("Não foi possível salvar o lead."),
  });

  const statusMutation = useMutation({
    mutationFn: (status: LeadStatus) => changeStatus({ data: { leadId: leadId!, status } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
      onChanged();
    },
  });

  const assignMutation = useMutation({
    mutationFn: (profileId: string | null) =>
      changeAssignee({ data: { leadId: leadId!, profileId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
      onChanged();
    },
  });

  // Etapa 06 — converte o lead real em oportunidade comercial no CRM.
  const newOpportunity = useServerFn(createOpportunity);
  const opportunityMutation = useMutation({
    mutationFn: () =>
      newOpportunity({
        data: {
          leadId: leadId!,
          title: lead?.practice_area
            ? `${lead.practice_area} — ${lead?.name ?? "novo contato"}`
            : `Oportunidade — ${lead?.name ?? "novo contato"}`,
          description: lead?.case_summary ?? null,
          assignedTo: lead?.assigned_to ?? null,
          probability: 0,
          source: lead?.source ?? "manual",
        },
      }),
    onSuccess: () => {
      toast.success("Oportunidade criada no CRM.");
      navigate({ to: "/crm" });
    },
    onError: () => toast.error("Não foi possível criar a oportunidade."),
  });


  return (
    <Sheet open={Boolean(leadId)} onOpenChange={(open) => (!open ? onClose() : null)}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{lead?.name ?? "Detalhes do lead"}</SheetTitle>
        </SheetHeader>

        {detailQuery.isLoading || !lead ? (
          <div className="flex justify-center p-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6 p-4">
            <Card className="border-border bg-surface/70 shadow-none">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-display text-3xl font-semibold tabular-nums">
                      {lead.lead_score}
                    </p>
                    <TemperatureTag temperature={lead.lead_temperature} />
                  </div>
                  <Badge variant="outline" className={STATUS_TONE[lead.qualification_status]}>
                    {STATUS_LABEL[lead.qualification_status]}
                  </Badge>
                </div>
                {lead.score_reason ? (
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {lead.score_reason}
                  </p>
                ) : null}
              </CardContent>
            </Card>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-sm font-semibold">Contato e caso</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditing((v) => !v);
                    setDraft(lead);
                  }}
                >
                  {editing ? "Cancelar" : "Editar"}
                </Button>
              </div>

              {editing ? (
                <div className="space-y-3">
                  {[
                    ["name", "Nome"] as const,
                    ["phone", "Telefone"],
                    ["email", "E-mail"],
                    ["practice_area", "Área jurídica"],
                    ["case_type", "Tipo de caso"],
                    ["location", "Localização"],
                    ["deadline", "Prazo"],
                    ["budget_signal", "Sinais de honorários"],
                  ].map(([field, label]) => (
                    <div key={field} className="space-y-1.5">
                      <Label className="text-xs">{label}</Label>
                      <Input
                        value={(draft as any)[field as string] ?? ""}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, [field as string]: e.target.value || null }))
                        }
                      />
                    </div>
                  ))}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Resumo do caso</Label>
                    <Textarea
                      rows={4}
                      value={draft.case_summary ?? ""}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, case_summary: e.target.value || null }))
                      }
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Urgência</Label>
                      <Select
                        value={draft.urgency ?? "desconhecida"}
                        onValueChange={(v) => setDraft((d) => ({ ...d, urgency: v as any }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(URGENCY_LABEL).map(([v, l]) => (
                            <SelectItem key={v} value={v}>
                              {l}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Intenção</Label>
                      <Select
                        value={draft.intent ?? "desconhecida"}
                        onValueChange={(v) => setDraft((d) => ({ ...d, intent: v as any }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(INTENT_LABEL).map(([v, l]) => (
                            <SelectItem key={v} value={v}>
                              {l}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button
                    className="w-full"
                    disabled={saveMutation.isPending}
                    onClick={() =>
                      saveMutation.mutate({
                        name: draft.name ?? null,
                        phone: draft.phone ?? null,
                        email: draft.email ?? null,
                        practice_area: draft.practice_area ?? null,
                        case_type: draft.case_type ?? null,
                        case_summary: draft.case_summary ?? null,
                        location: draft.location ?? null,
                        deadline: draft.deadline ?? null,
                        budget_signal: draft.budget_signal ?? null,
                        urgency: draft.urgency ?? "desconhecida",
                        intent: draft.intent ?? "desconhecida",
                      })
                    }
                  >
                    {saveMutation.isPending ? "Salvando..." : "Salvar alterações"}
                  </Button>
                </div>
              ) : (
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    ["Telefone", lead.phone],
                    ["E-mail", lead.email],
                    ["Área jurídica", lead.practice_area],
                    ["Tipo de caso", lead.case_type],
                    ["Urgência", URGENCY_LABEL[lead.urgency]],
                    ["Intenção", INTENT_LABEL[lead.intent]],
                    ["Localização", lead.location],
                    ["Prazo", lead.deadline],
                    ["Honorários", lead.budget_signal],
                    ["Origem", lead.source === "whatsapp" ? "WhatsApp" : "Atendimento IA"],
                  ].map(([label, value]) => (
                    <div key={label as string}>
                      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                        {label}
                      </dt>
                      <dd className="mt-0.5">{(value as string) || "—"}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </section>

            {lead.case_summary ? (
              <section className="space-y-2">
                <h3 className="font-display text-sm font-semibold">Resumo do caso</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {lead.case_summary}
                </p>
              </section>
            ) : null}

            {lead.missing_information.length ? (
              <section className="space-y-2">
                <h3 className="font-display text-sm font-semibold">Informações que faltam</h3>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {lead.missing_information.map((m) => (
                    <li key={m}>• {m}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            <Separator />

            <section className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Status</Label>
                <Select
                  value={lead.qualification_status}
                  onValueChange={(v) => statusMutation.mutate(v as LeadStatus)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STATUS_LABEL) as LeadStatus[]).map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Responsável</Label>
                <Select
                  value={lead.assigned_to ?? "none"}
                  onValueChange={(v) => assignMutation.mutate(v === "none" ? null : v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem responsável</SelectItem>
                    {team.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </section>

            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() =>
                  navigate({
                    to: lead.whatsapp_conversation_id ? "/atendimento" : "/atendimento-ia",
                  })
                }
              >
                <MessageSquare className="h-4 w-4" />
                Abrir conversa original
              </Button>
              <Button
                className="w-full gap-2"
                disabled={opportunityMutation.isPending}
                onClick={() => opportunityMutation.mutate()}
              >
                {opportunityMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                Criar oportunidade
              </Button>
            </div>

            <section className="rounded-xl border border-border bg-surface/60 p-4">
              <UpcomingEvents
                leadId={lead.id}
                contactId={lead.contact_id ?? null}
                conversationId={lead.whatsapp_conversation_id ?? null}
                title="Agendar atendimento"
                eventType="consulta"
              />
            </section>


            {history.length ? (
              <section className="space-y-2">
                <h3 className="font-display text-sm font-semibold">Histórico do score</h3>
                <ul className="space-y-2">
                  {history.map((h: any) => (
                    <li key={h.id} className="rounded-lg border border-border bg-surface/60 p-3">
                      <p className="text-sm">
                        {h.previous_score === null
                          ? `Score inicial ${h.new_score}`
                          : `${h.previous_score} → ${h.new_score}`}
                        <span className="ml-2 text-xs text-muted-foreground">
                          {h.source === "ai" ? "IA" : "Equipe"} · {formatDate(h.created_at)}
                        </span>
                      </p>
                      {h.reason ? (
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                          {h.reason}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
