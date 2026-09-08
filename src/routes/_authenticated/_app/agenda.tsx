import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader, SearchInput } from "@/components/common/PageHeader";
import { EmptyState, LoadingState } from "@/components/common/states";
import { StatCard } from "@/components/common/StatCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/auth";
import {
  dispatchDueReminders,
  getCalendarEvent,
  listCalendarEvents,
  listCalendarLinkOptions,
  setCalendarEventStatus,
  updateCalendarEvent,
  EVENT_STATUS_LABEL,
  EVENT_TYPE_LABEL,
  type CalendarEventRow,
  type EventStatus,
} from "@/lib/calendar.functions";
import { EventFormDialog } from "@/components/calendar/EventFormDialog";
import {
  DEFAULT_TZ,
  addDays,
  addMonths,
  dayKey,
  durationLabel,
  endOfMonth,
  formatDateLong,
  formatDateTime,
  formatTime,
  isoToZonedFields,
  rangeIso,
  startOfMonth,
  startOfWeek,
  todayKey,
  zonedToIso,
} from "@/lib/calendar-tz";

export const Route = createFileRoute("/_authenticated/_app/agenda")({
  component: AgendaPage,
  head: () => ({
    meta: [
      { title: "Agenda jurídica | JurisIA" },
      {
        name: "description",
        content:
          "Agenda real do escritório: consultas, audiências, prazos e retornos integrados a leads, CRM e conversas.",
      },
      { property: "og:title", content: "Agenda jurídica | JurisIA" },
      {
        property: "og:description",
        content: "Compromissos, prazos e lembretes do escritório em um só lugar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type ViewMode = "dia" | "semana" | "mes" | "lista";

const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const NONE = "__none__";

const STATUS_STYLE: Record<EventStatus, string> = {
  agendado: "border-border text-foreground/80",
  confirmado: "border-primary/40 bg-primary-soft text-primary",
  em_andamento: "border-amber-500/40 text-amber-500",
  concluido: "border-emerald-500/40 text-emerald-500",
  cancelado: "border-destructive/40 text-destructive line-through",
  nao_compareceu: "border-destructive/30 text-destructive",
};

function AgendaPage() {
  const { data: profile } = useProfile();
  const timezone = profile?.office?.timezone ?? DEFAULT_TZ;
  const queryClient = useQueryClient();

  const [view, setView] = useState<ViewMode>("semana");
  const [anchor, setAnchor] = useState(() => todayKey(timezone));
  const [onlyMine, setOnlyMine] = useState(false);
  const [assignedTo, setAssignedTo] = useState<string>(NONE);
  const [type, setType] = useState("todos");
  const [status, setStatus] = useState("todos");
  const [leadFilter, setLeadFilter] = useState<string>(NONE);
  const [opportunityFilter, setOpportunityFilter] = useState<string>(NONE);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const loadEvents = useServerFn(listCalendarEvents);
  const loadOptions = useServerFn(listCalendarLinkOptions);
  const dispatchReminders = useServerFn(dispatchDueReminders);

  const period = useMemo(() => {
    if (view === "dia") return { start: anchor, end: anchor };
    if (view === "semana") {
      const start = startOfWeek(anchor);
      return { start, end: addDays(start, 6) };
    }
    if (view === "mes") return { start: startOfMonth(anchor), end: endOfMonth(anchor) };
    return { start: anchor, end: addDays(anchor, 60) };
  }, [view, anchor]);

  const range = useMemo(
    () => rangeIso(period.start, period.end, timezone),
    [period, timezone],
  );

  const filters = {
    from: range.from,
    to: range.to,
    onlyMine,
    assignedTo: assignedTo === NONE ? undefined : assignedTo,
    type,
    status,
    leadId: leadFilter === NONE ? undefined : leadFilter,
    opportunityId: opportunityFilter === NONE ? undefined : opportunityFilter,
    search: search.trim() || undefined,
  };

  const { data, isLoading } = useQuery({
    queryKey: ["calendar", "events", filters],
    queryFn: () => loadEvents({ data: filters }),
  });

  const { data: options } = useQuery({
    queryKey: ["calendar", "link-options"],
    queryFn: () => loadOptions(),
    staleTime: 60_000,
  });

  // Lembretes vencidos viram notificações reais assim que a agenda é aberta.
  useEffect(() => {
    dispatchReminders({ data: undefined } as any).catch(() => undefined);
  }, [dispatchReminders]);

  // Realtime: novos eventos, alterações e cancelamentos do escritório.
  useEffect(() => {
    const officeId = profile?.office_id;
    if (!officeId) return;
    const channel = supabase
      .channel(`calendar-${officeId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "calendar_events", filter: `office_id=eq.${officeId}` },
        () => queryClient.invalidateQueries({ queryKey: ["calendar"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.office_id, queryClient]);

  const events = data?.events ?? [];
  const stats = data?.stats;

  const grouped = useMemo(() => {
    const map = new Map<string, CalendarEventRow[]>();
    for (const event of events) {
      const key = dayKey(event.start_at, timezone);
      const list = map.get(key) ?? [];
      list.push(event);
      map.set(key, list);
    }
    return map;
  }, [events, timezone]);

  const shift = (direction: number) => {
    if (view === "mes") setAnchor((prev) => addMonths(prev, direction));
    else if (view === "semana") setAnchor((prev) => addDays(prev, direction * 7));
    else setAnchor((prev) => addDays(prev, direction));
  };

  const periodLabel = useMemo(() => {
    if (view === "mes") {
      return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(
        new Date(`${period.start}T12:00:00Z`),
      );
    }
    if (view === "dia") return formatDateLong(`${period.start}T12:00:00Z`, "UTC");
    const fmt = (key: string) =>
      new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" }).format(
        new Date(`${key}T12:00:00Z`),
      );
    return `${fmt(period.start)} — ${fmt(period.end)}`;
  }, [view, period]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agenda"
        description="Compromissos, consultas, audiências e prazos do escritório."
        actions={
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Novo evento
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Hoje" value={stats?.hoje ?? 0} icon={CalendarDays} />
        <StatCard label="Próximos" value={stats?.proximos ?? 0} icon={Clock} />
        <StatCard label="Pendentes" value={stats?.pendentes ?? 0} icon={Clock} />
        <StatCard label="Atrasados" value={stats?.atrasados ?? 0} icon={AlertTriangle} />
        <StatCard label="Cancelados" value={stats?.cancelados ?? 0} icon={XCircle} />
      </div>

      <Card className="border-border bg-surface/60 shadow-none">
        <CardContent className="flex flex-col gap-3 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Tabs value={view} onValueChange={(v) => setView(v as ViewMode)}>
              <TabsList>
                <TabsTrigger value="dia">Dia</TabsTrigger>
                <TabsTrigger value="semana">Semana</TabsTrigger>
                <TabsTrigger value="mes">Mês</TabsTrigger>
                <TabsTrigger value="lista">Lista</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={() => shift(-1)} aria-label="Anterior">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setAnchor(todayKey(timezone))}>
                Hoje
              </Button>
              <Button variant="ghost" size="icon" onClick={() => shift(1)} aria-label="Próximo">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <span className="text-sm font-medium capitalize text-muted-foreground">{periodLabel}</span>

            <label className="ml-auto flex items-center gap-2 text-sm">
              <Switch checked={onlyMine} onCheckedChange={setOnlyMine} /> Minha agenda
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <SearchInput
              placeholder="Buscar por título ou descrição"
              value={search}
              onChange={setSearch}
              className="sm:max-w-none"
            />
            <Select value={assignedTo} onValueChange={setAssignedTo} disabled={onlyMine}>
              <SelectTrigger>
                <SelectValue placeholder="Responsável" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Todos os responsáveis</SelectItem>
                {(options?.team ?? []).map((t: any) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os tipos</SelectItem>
                {Object.entries(EVENT_TYPE_LABEL).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                {Object.entries(EVENT_STATUS_LABEL).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-3">
              <Select value={leadFilter} onValueChange={setLeadFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Lead" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Todos os leads</SelectItem>
                  {(options?.leads ?? []).map((l: any) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={opportunityFilter} onValueChange={setOpportunityFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Oportunidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Todas</SelectItem>
                  {(options?.opportunities ?? []).map((o: any) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <LoadingState rows={4} />
      ) : view === "mes" ? (
        <MonthView
          period={period}
          grouped={grouped}
          timezone={timezone}
          onSelect={setSelected}
          onCreate={(day) => {
            setAnchor(day);
            setFormOpen(true);
          }}
        />
      ) : view === "lista" ? (
        <ListView events={events} timezone={timezone} onSelect={setSelected} />
      ) : (
        <ColumnView
          days={
            view === "dia"
              ? [period.start]
              : Array.from({ length: 7 }, (_, i) => addDays(period.start, i))
          }
          grouped={grouped}
          timezone={timezone}
          onSelect={setSelected}
        />
      )}

      <EventFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        timezone={timezone}
        {...(view === "dia" ? { defaultDayKey: period.start } : {})}
      />

      <EventSheet
        eventId={selected}
        timezone={timezone}
        onClose={() => setSelected(null)}
        team={options?.team ?? []}
      />
    </div>
  );
}

function EventChip({
  event,
  timezone,
  onSelect,
}: {
  event: CalendarEventRow;
  timezone: string;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(event.id)}
      className={`w-full rounded-lg border bg-background/60 px-2 py-1.5 text-left text-xs transition-colors hover:border-primary/40 ${STATUS_STYLE[event.status]}`}
    >
      <span className="block truncate font-medium">{event.title}</span>
      <span className="block truncate text-[11px] text-muted-foreground">
        {event.all_day ? "Dia inteiro" : formatTime(event.start_at, timezone)}
        {event.assigned_name ? ` · ${event.assigned_name}` : ""}
      </span>
    </button>
  );
}

function ColumnView({
  days,
  grouped,
  timezone,
  onSelect,
}: {
  days: string[];
  grouped: Map<string, CalendarEventRow[]>;
  timezone: string;
  onSelect: (id: string) => void;
}) {
  const today = todayKey(timezone);
  const empty = days.every((d) => !(grouped.get(d) ?? []).length);

  if (empty) {
    return (
      <EmptyState
        icon={<CalendarDays className="h-5 w-5" />}
        title="Nenhum compromisso neste período"
        description="Crie um evento com o botão Novo evento ou agende direto de um lead, oportunidade ou conversa."
      />
    );
  }

  return (
    <div className={`grid gap-3 ${days.length > 1 ? "md:grid-cols-4 xl:grid-cols-7" : ""}`}>
      {days.map((day) => {
        const list = grouped.get(day) ?? [];
        const [, month, dd] = day.split("-");
        const weekday = WEEKDAYS[(new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7];
        return (
          <Card
            key={day}
            className={`border-border bg-surface/60 shadow-none ${day === today ? "border-primary/40" : ""}`}
          >
            <CardContent className="space-y-2 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {weekday} {dd}/{month}
              </p>
              {list.length ? (
                list.map((event) => (
                  <EventChip key={event.id} event={event} timezone={timezone} onSelect={onSelect} />
                ))
              ) : (
                <p className="text-xs text-muted-foreground">Sem compromissos.</p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function MonthView({
  period,
  grouped,
  timezone,
  onSelect,
  onCreate,
}: {
  period: { start: string; end: string };
  grouped: Map<string, CalendarEventRow[]>;
  timezone: string;
  onSelect: (id: string) => void;
  onCreate: (day: string) => void;
}) {
  const first = period.start;
  const lead = (new Date(`${first}T12:00:00Z`).getUTCDay() + 6) % 7;
  const total = Number(period.end.slice(8));
  const cells: (string | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: total }, (_, i) => addDays(first, i)),
  ];
  const today = todayKey(timezone);

  return (
    <Card className="border-border bg-surface/60 shadow-none">
      <CardContent className="p-3 sm:p-4">
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground sm:gap-2">
          {WEEKDAYS.map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-1 sm:gap-2">
          {cells.map((day, index) => {
            if (!day) return <div key={`empty-${index}`} className="min-h-20 rounded-lg" />;
            const list = grouped.get(day) ?? [];
            return (
              <div
                key={day}
                onDoubleClick={() => onCreate(day)}
                className={`min-h-20 space-y-1 rounded-lg border p-1.5 sm:min-h-28 ${
                  day === today ? "border-primary/40 bg-primary-soft/30" : "border-border/60 bg-background/40"
                }`}
              >
                <span className="text-[11px] text-muted-foreground">{day.slice(8)}</span>
                {list.slice(0, 3).map((event) => (
                  <EventChip key={event.id} event={event} timezone={timezone} onSelect={onSelect} />
                ))}
                {list.length > 3 ? (
                  <span className="block text-[11px] text-muted-foreground">
                    +{list.length - 3} eventos
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function ListView({
  events,
  timezone,
  onSelect,
}: {
  events: CalendarEventRow[];
  timezone: string;
  onSelect: (id: string) => void;
}) {
  if (!events.length) {
    return (
      <EmptyState
        icon={<CalendarDays className="h-5 w-5" />}
        title="Nenhum compromisso"
        description="Nenhum evento encontrado para os filtros e o período selecionados."
      />
    );
  }

  const now = Date.now();

  return (
    <div className="space-y-2">
      {events.map((event) => {
        const late =
          new Date(event.end_at).getTime() < now &&
          ["agendado", "confirmado", "em_andamento"].includes(event.status);
        return (
          <button
            key={event.id}
            type="button"
            onClick={() => onSelect(event.id)}
            className="flex w-full flex-col gap-1 rounded-xl border border-border bg-surface/60 p-4 text-left transition-colors hover:border-primary/40 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{event.title}</p>
              <p className="text-xs text-muted-foreground">
                {formatDateTime(event.start_at, timezone)} · {durationLabel(event.start_at, event.end_at)} ·{" "}
                {EVENT_TYPE_LABEL[event.event_type]}
                {event.assigned_name ? ` · ${event.assigned_name}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {late ? <Badge variant="destructive">Atrasado</Badge> : null}
              {event.is_deadline ? <Badge variant="outline">Prazo</Badge> : null}
              <Badge variant="outline" className={STATUS_STYLE[event.status]}>
                {EVENT_STATUS_LABEL[event.status]}
              </Badge>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function EventSheet({
  eventId,
  timezone,
  onClose,
  team,
}: {
  eventId: string | null;
  timezone: string;
  onClose: () => void;
  team: { id: string; name: string }[];
}) {
  const queryClient = useQueryClient();
  const load = useServerFn(getCalendarEvent);
  const update = useServerFn(updateCalendarEvent);
  const changeStatus = useServerFn(setCalendarEventStatus);

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [assignedTo, setAssignedTo] = useState<string>(NONE);
  const [conflicts, setConflicts] = useState<any[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ["calendar", "event", eventId],
    queryFn: () => load({ data: { eventId: eventId! } }),
    enabled: Boolean(eventId),
  });

  const event = data?.event;

  useEffect(() => {
    if (!event) return;
    const start = isoToZonedFields(event.start_at, timezone);
    const end = isoToZonedFields(event.end_at, timezone);
    setTitle(event.title);
    setDate(start.date);
    setStartTime(start.time);
    setEndTime(end.time);
    setAssignedTo(event.assigned_to ?? NONE);
    setEditing(false);
    setConflicts([]);
  }, [event, timezone]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["calendar"] });

  const saveMutation = useMutation({
    mutationFn: (allowConflict: boolean) =>
      update({
        data: {
          eventId: event!.id,
          expectedVersion: event!.version,
          title: title.trim(),
          start_at: zonedToIso(date, startTime, timezone),
          end_at: zonedToIso(date, endTime, timezone),
          assigned_to: assignedTo === NONE ? null : assignedTo,
          allowConflict,
        },
      }),
    onSuccess: (result: any) => {
      if (!result?.event) {
        setConflicts(result?.conflict ?? []);
        return;
      }
      toast.success("Compromisso atualizado.");
      setConflicts([]);
      setEditing(false);
      invalidate();
    },
    onError: (error: any) => {
      const message = String(error?.message ?? "");
      if (message.includes("VERSION_CONFLICT"))
        toast.error("Outra pessoa alterou este compromisso. Recarregue antes de salvar.");
      else if (message.includes("FORBIDDEN")) toast.error("Você não tem permissão para editar este evento.");
      else if (message.includes("INVALID_RANGE")) toast.error("O horário final precisa ser depois do inicial.");
      else toast.error("Não foi possível salvar.");
      invalidate();
    },
  });

  const statusMutation = useMutation({
    mutationFn: (next: EventStatus) =>
      changeStatus({
        data: {
          eventId: event!.id,
          expectedVersion: event!.version,
          status: next,
          reason: next === "cancelado" ? "Cancelado pela equipe" : undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Status atualizado.");
      invalidate();
    },
    onError: (error: any) => {
      const message = String(error?.message ?? "");
      if (message.includes("VERSION_CONFLICT"))
        toast.error("Outra pessoa alterou este compromisso. Recarregue antes de continuar.");
      else if (message.includes("FORBIDDEN")) toast.error("Você não tem permissão para alterar este evento.");
      else toast.error("Não foi possível atualizar o status.");
      invalidate();
    },
  });

  return (
    <Sheet open={Boolean(eventId)} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {isLoading || !event ? (
          <div className="p-6">
            <LoadingState rows={4} />
          </div>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle>{event.title}</SheetTitle>
              <SheetDescription>
                {formatDateTime(event.start_at, timezone)} · {durationLabel(event.start_at, event.end_at)}
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-5 px-4 pb-8">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{EVENT_TYPE_LABEL[event.event_type]}</Badge>
                <Badge variant="outline" className={STATUS_STYLE[event.status]}>
                  {EVENT_STATUS_LABEL[event.status]}
                </Badge>
                {event.is_deadline ? <Badge variant="outline">Prazo</Badge> : null}
              </div>

              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Field label="Responsável" value={event.assigned_name ?? "Sem responsável"} />
                <Field label="Criado por" value={event.created_name ?? "—"} />
                <Field label="Local" value={event.location ?? "—"} />
                <Field label="Link" value={event.meeting_url ?? "—"} />
                <Field label="Lead" value={event.lead_name ?? "—"} />
                <Field label="Contato" value={event.contact_name ?? "—"} />
                <Field label="Oportunidade" value={event.opportunity_title ?? "—"} />
                <Field label="Prioridade" value={event.priority} />
              </dl>

              {event.description ? (
                <p className="whitespace-pre-wrap rounded-lg border border-border bg-surface/60 p-3 text-sm">
                  {event.description}
                </p>
              ) : null}

              {data.participants.length ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Participantes
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {data.participants.map((p: any) => (
                      <Badge key={p.id} variant="outline">
                        {p.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}

              {data.reminders.length ? (
                <p className="text-xs text-muted-foreground">
                  Lembrete: {data.reminders.map((r: any) => `${r.minutes_before} min antes`).join(", ")}
                </p>
              ) : null}

              {data.canEdit ? (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditing((v) => !v)}>
                    {editing ? "Fechar edição" : "Editar / Reagendar"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={statusMutation.isPending}
                    onClick={() => statusMutation.mutate("confirmado")}
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" /> Confirmar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={statusMutation.isPending}
                    onClick={() => statusMutation.mutate("concluido")}
                  >
                    Concluir
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={statusMutation.isPending}
                    onClick={() => statusMutation.mutate("nao_compareceu")}
                  >
                    Não compareceu
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={statusMutation.isPending}
                    onClick={() => statusMutation.mutate("cancelado")}
                  >
                    Cancelar
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Você pode visualizar este compromisso, mas não editá-lo.
                </p>
              )}

              {editing ? (
                <div className="space-y-3 rounded-xl border border-border bg-surface/60 p-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-title">Título</Label>
                    <Input id="edit-title" value={title} onChange={(e) => setTitle(e.target.value)} />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="grid gap-2">
                      <Label htmlFor="edit-date">Data</Label>
                      <Input id="edit-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="edit-start">Início</Label>
                      <Input
                        id="edit-start"
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="edit-end">Fim</Label>
                      <Input
                        id="edit-end"
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label>Responsável</Label>
                    <Select value={assignedTo} onValueChange={setAssignedTo}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Sem responsável</SelectItem>
                        {team.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {conflicts.length ? (
                    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                      <p className="flex items-center gap-2 font-medium text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="h-4 w-4" /> Este responsável já possui um compromisso neste
                        horário.
                      </p>
                      <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                        {conflicts.map((c) => (
                          <li key={c.id}>
                            {c.title} — {formatDateTime(c.start_at, timezone)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={saveMutation.isPending}
                      onClick={() => saveMutation.mutate(false)}
                    >
                      Salvar
                    </Button>
                    {conflicts.length ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={saveMutation.isPending}
                        onClick={() => saveMutation.mutate(true)}
                      >
                        Salvar mesmo assim
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Histórico
                </p>
                <ul className="mt-2 space-y-2">
                  {data.history.map((h: any) => (
                    <li key={h.id} className="rounded-lg border border-border bg-surface/60 p-3 text-xs">
                      <span className="font-medium">{h.actor_name ?? "Sistema"}</span> — {h.action}
                      <span className="block text-muted-foreground">
                        {formatDateTime(h.created_at, timezone)}
                      </span>
                    </li>
                  ))}
                  {!data.history.length ? (
                    <li className="text-xs text-muted-foreground">Sem registros.</li>
                  ) : null}
                </ul>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate">{value}</dd>
    </div>
  );
}
