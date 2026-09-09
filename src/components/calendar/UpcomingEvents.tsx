import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useProfile } from "@/lib/auth";
import { DEFAULT_TZ, formatDateTime } from "@/lib/calendar-tz";
import {
  listRelatedEvents,
  EVENT_STATUS_LABEL,
  EVENT_TYPE_LABEL,
  type CalendarEventRow,
  type EventType,
} from "@/lib/calendar.functions";
import { EventFormDialog } from "@/components/calendar/EventFormDialog";

/** Próximos compromissos vinculados a um lead, oportunidade, conversa ou contato. */
export function UpcomingEvents({
  leadId,
  opportunityId,
  conversationId,
  contactId,
  title = "Agendar atendimento",
  eventType = "atendimento",
  label = "Próximos compromissos",
}: {
  leadId?: string | null;
  opportunityId?: string | null;
  conversationId?: string | null;
  contactId?: string | null;
  title?: string;
  eventType?: EventType;
  label?: string;
}) {
  const { data: profile } = useProfile();
  const timezone = profile?.office?.timezone ?? DEFAULT_TZ;
  const load = useServerFn(listRelatedEvents);
  const [open, setOpen] = useState(false);

  const key = ["calendar", "related", leadId, opportunityId, conversationId, contactId];
  const { data: events, refetch } = useQuery({
    queryKey: key,
    queryFn: () =>
      load({
        data: {
          leadId: leadId ?? undefined,
          opportunityId: opportunityId ?? undefined,
          conversationId: conversationId ?? undefined,
          contactId: contactId ?? undefined,
        },
      }) as Promise<CalendarEventRow[]>,
    enabled: Boolean(leadId || opportunityId || conversationId || contactId),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <CalendarPlus className="mr-2 h-4 w-4" /> {title}
        </Button>
      </div>

      {events?.length ? (
        <ul className="space-y-2">
          {events.map((event) => (
            <li key={event.id} className="rounded-lg border border-border bg-surface/60 p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{event.title}</span>
                <Badge variant="outline">{EVENT_STATUS_LABEL[event.status]}</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatDateTime(event.start_at, timezone)} · {EVENT_TYPE_LABEL[event.event_type]}
                {event.assigned_name ? ` · ${event.assigned_name}` : ""}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">Nenhum compromisso agendado.</p>
      )}

      <EventFormDialog
        open={open}
        onOpenChange={setOpen}
        timezone={timezone}
        prefill={{
          eventType,
          leadId: leadId ?? null,
          contactId: contactId ?? null,
          opportunityId: opportunityId ?? null,
          conversationId: conversationId ?? null,
        }}
        onCreated={() => refetch()}
      />
    </div>
  );
}
