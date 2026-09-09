import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

import {
  createCalendarEvent,
  listCalendarLinkOptions,
  EVENT_TYPE_LABEL,
  REMINDER_OPTIONS,
  type EventType,
} from "@/lib/calendar.functions";
import { formatDateTime, isoToZonedFields, zonedToIso } from "@/lib/calendar-tz";

const NONE = "__none__";

export interface EventPrefill {
  title?: string;
  eventType?: EventType;
  leadId?: string | null;
  contactId?: string | null;
  opportunityId?: string | null;
  conversationId?: string | null;
}

export function EventFormDialog({
  open,
  onOpenChange,
  timezone,
  prefill,
  defaultDayKey,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  timezone: string;
  prefill?: EventPrefill;
  defaultDayKey?: string;
  onCreated?: (eventId: string) => void;
}) {
  const queryClient = useQueryClient();
  const loadOptions = useServerFn(listCalendarLinkOptions);
  const create = useServerFn(createCalendarEvent);

  const { data: options } = useQuery({
    queryKey: ["calendar", "link-options"],
    queryFn: () => loadOptions(),
    enabled: open,
    staleTime: 60_000,
  });

  const initialDate = useMemo(
    () => defaultDayKey ?? isoToZonedFields(new Date().toISOString(), timezone).date,
    [defaultDayKey, timezone],
  );

  const [title, setTitle] = useState("");
  const [eventType, setEventType] = useState<EventType>("consulta");
  const [isDeadline, setIsDeadline] = useState(false);
  const [priority, setPriority] = useState("media");
  const [date, setDate] = useState(initialDate);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [allDay, setAllDay] = useState(false);
  const [assignedTo, setAssignedTo] = useState<string>(NONE);
  const [participants, setParticipants] = useState<string[]>([]);
  const [location, setLocation] = useState("");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [description, setDescription] = useState("");
  const [leadId, setLeadId] = useState<string>(NONE);
  const [contactId, setContactId] = useState<string>(NONE);
  const [opportunityId, setOpportunityId] = useState<string>(NONE);
  const [processRef, setProcessRef] = useState("");
  const [reminder, setReminder] = useState<string>("30");
  const [conflicts, setConflicts] = useState<any[]>([]);

  useEffect(() => {
    if (!open) return;
    setTitle(prefill?.title ?? "");
    setEventType(prefill?.eventType ?? "consulta");
    setIsDeadline(false);
    setPriority("media");
    setDate(initialDate);
    setStartTime("09:00");
    setEndTime("10:00");
    setAllDay(false);
    setParticipants([]);
    setLocation("");
    setMeetingUrl("");
    setDescription("");
    setProcessRef("");
    setReminder("30");
    setConflicts([]);
    setLeadId(prefill?.leadId ?? NONE);
    setContactId(prefill?.contactId ?? NONE);
    setOpportunityId(prefill?.opportunityId ?? NONE);
  }, [open, prefill, initialDate]);

  const mutation = useMutation({
    mutationFn: async (allowConflict: boolean) => {
      const start = allDay
        ? zonedToIso(date, "00:00", timezone)
        : zonedToIso(date, startTime, timezone);
      const end = allDay ? zonedToIso(date, "23:59", timezone) : zonedToIso(date, endTime, timezone);
      return create({
        data: {
          title: title.trim(),
          description: description.trim() || undefined,
          event_type: eventType,
          is_deadline: isDeadline || eventType === "prazo",
          priority: priority as any,
          start_at: start,
          end_at: end,
          all_day: allDay,
          location: location.trim() || undefined,
          meeting_url: meetingUrl.trim() || undefined,
          process_reference: processRef.trim() || undefined,
          lead_id: leadId === NONE ? null : leadId,
          contact_id: contactId === NONE ? null : contactId,
          opportunity_id: opportunityId === NONE ? null : opportunityId,
          conversation_id: prefill?.conversationId ?? null,
          assigned_to: assignedTo === NONE ? null : assignedTo,
          participants,
          reminders: reminder === "none" ? [] : [Number(reminder)],
          allowConflict,
        },
      });
    },
    onSuccess: (result: any) => {
      if (!result?.event) {
        setConflicts(result?.conflict ?? []);
        return;
      }
      setConflicts([]);
      toast.success("Compromisso agendado.");
      queryClient.invalidateQueries({ queryKey: ["calendar"] });
      onCreated?.(result.event.id);
      onOpenChange(false);
    },
    onError: (error: any) => {
      const message = String(error?.message ?? "");
      if (message.includes("INVALID_RANGE")) toast.error("O horário final precisa ser depois do inicial.");
      else if (message.includes("INVALID_ASSIGNEE")) toast.error("Responsável inválido.");
      else toast.error("Não foi possível salvar o compromisso.");
    },
  });

  const teamName = (id: string) => options?.team.find((t) => t.id === id)?.name ?? "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo compromisso</DialogTitle>
          <DialogDescription>
            Os horários seguem o fuso do escritório ({timezone}).
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="ev-title">Título</Label>
            <Input
              id="ev-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Consulta inicial — Maria Silva"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Tipo</Label>
              <Select value={eventType} onValueChange={(v) => setEventType(v as EventType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(EVENT_TYPE_LABEL).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Prioridade</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="urgente">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="ev-date">Data</Label>
              <Input id="ev-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ev-start">Início</Label>
              <Input
                id="ev-start"
                type="time"
                value={startTime}
                disabled={allDay}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ev-end">Fim</Label>
              <Input
                id="ev-end"
                type="time"
                value={endTime}
                disabled={allDay}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={allDay} onCheckedChange={setAllDay} /> Dia inteiro
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={isDeadline || eventType === "prazo"} onCheckedChange={setIsDeadline} />{" "}
              É um prazo
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Responsável</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger>
                  <SelectValue placeholder="Sem responsável" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Sem responsável</SelectItem>
                  {(options?.team ?? []).map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Lembrete</Label>
              <Select value={reminder} onValueChange={setReminder}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem lembrete</SelectItem>
                  {REMINDER_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={String(o.value)}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Participantes da equipe</Label>
            <div className="flex flex-wrap gap-2">
              {(options?.team ?? []).map((t) => {
                const active = participants.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() =>
                      setParticipants((prev) =>
                        active ? prev.filter((p) => p !== t.id) : [...prev, t.id],
                      )
                    }
                    className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                      active
                        ? "border-primary/40 bg-primary-soft text-primary"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t.name}
                  </button>
                );
              })}
              {!options?.team.length ? (
                <span className="text-xs text-muted-foreground">Nenhum membro cadastrado.</span>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="ev-local">Local</Label>
              <Input id="ev-local" value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ev-url">Link da reunião</Label>
              <Input id="ev-url" value={meetingUrl} onChange={(e) => setMeetingUrl(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label>Lead</Label>
              <Select value={leadId} onValueChange={setLeadId}>
                <SelectTrigger>
                  <SelectValue placeholder="Nenhum" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Nenhum</SelectItem>
                  {(options?.leads ?? []).map((l: any) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Contato</Label>
              <Select value={contactId} onValueChange={setContactId}>
                <SelectTrigger>
                  <SelectValue placeholder="Nenhum" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Nenhum</SelectItem>
                  {(options?.contacts ?? []).map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Oportunidade</Label>
              <Select value={opportunityId} onValueChange={setOpportunityId}>
                <SelectTrigger>
                  <SelectValue placeholder="Nenhuma" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Nenhuma</SelectItem>
                  {(options?.opportunities ?? []).map((o: any) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isDeadline || eventType === "prazo" ? (
            <div className="grid gap-2">
              <Label htmlFor="ev-proc">Referência do processo (opcional)</Label>
              <Input
                id="ev-proc"
                value={processRef}
                onChange={(e) => setProcessRef(e.target.value)}
                placeholder="Número ou identificação interna"
              />
            </div>
          ) : null}

          <div className="grid gap-2">
            <Label htmlFor="ev-desc">Descrição</Label>
            <Textarea
              id="ev-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {conflicts.length ? (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              <p className="flex items-center gap-2 font-medium text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4" />
                Este responsável já possui um compromisso neste horário.
              </p>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {conflicts.map((c) => (
                  <li key={c.id}>
                    {c.title} — {formatDateTime(c.start_at, timezone)}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                Escolha outro horário/responsável ou confirme para agendar mesmo assim.
              </p>
            </div>
          ) : null}

          {assignedTo !== NONE ? (
            <Badge variant="outline" className="w-fit">
              Responsável: {teamName(assignedTo)}
            </Badge>
          ) : null}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          {conflicts.length ? (
            <Button
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate(true)}
            >
              Agendar mesmo assim
            </Button>
          ) : null}
          <Button
            disabled={mutation.isPending || title.trim().length < 2}
            onClick={() => mutation.mutate(false)}
          >
            Salvar compromisso
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
