-- Etapa 07 — Agenda inteligente

CREATE TYPE public.calendar_event_type AS ENUM (
  'consulta','reuniao','atendimento','audiencia','retorno','ligacao','videoconferencia','prazo','tarefa','outro'
);
CREATE TYPE public.calendar_event_status AS ENUM (
  'agendado','confirmado','em_andamento','concluido','cancelado','nao_compareceu'
);
CREATE TYPE public.calendar_priority AS ENUM ('baixa','media','alta','urgente');

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'event_assigned';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'event_updated';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'event_cancelled';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'event_reminder';

CREATE TABLE public.calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  event_type public.calendar_event_type NOT NULL DEFAULT 'consulta',
  status public.calendar_event_status NOT NULL DEFAULT 'agendado',
  is_deadline boolean NOT NULL DEFAULT false,
  priority public.calendar_priority NOT NULL DEFAULT 'media',
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  all_day boolean NOT NULL DEFAULT false,
  location text,
  meeting_url text,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.whatsapp_contacts(id) ON DELETE SET NULL,
  opportunity_id uuid REFERENCES public.crm_opportunities(id) ON DELETE SET NULL,
  conversation_id uuid REFERENCES public.whatsapp_conversations(id) ON DELETE SET NULL,
  process_reference text,
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  cancel_reason text,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.calendar_events TO authenticated;
GRANT ALL ON public.calendar_events TO service_role;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "calendar_events_select_office" ON public.calendar_events
  FOR SELECT TO authenticated USING (office_id = public.current_office_id());
CREATE POLICY "calendar_events_insert_office" ON public.calendar_events
  FOR INSERT TO authenticated WITH CHECK (office_id = public.current_office_id());
CREATE POLICY "calendar_events_update_office" ON public.calendar_events
  FOR UPDATE TO authenticated USING (office_id = public.current_office_id())
  WITH CHECK (office_id = public.current_office_id());
CREATE TRIGGER calendar_events_set_updated_at BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_calendar_events_office_range ON public.calendar_events (office_id, start_at, end_at);
CREATE INDEX idx_calendar_events_assigned ON public.calendar_events (office_id, assigned_to, start_at);
CREATE INDEX idx_calendar_events_status ON public.calendar_events (office_id, status, start_at);
CREATE INDEX idx_calendar_events_lead ON public.calendar_events (lead_id, start_at);
CREATE INDEX idx_calendar_events_contact ON public.calendar_events (contact_id, start_at);
CREATE INDEX idx_calendar_events_opportunity ON public.calendar_events (opportunity_id, start_at);
CREATE INDEX idx_calendar_events_conversation ON public.calendar_events (conversation_id, start_at);

-- Validação de intervalo (trigger em vez de CHECK, conforme padrão do projeto)
CREATE OR REPLACE FUNCTION public.calendar_events_validate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
begin
  if new.end_at <= new.start_at then
    raise exception 'INVALID_RANGE';
  end if;
  return new;
end;
$$;
CREATE TRIGGER calendar_events_validate_range BEFORE INSERT OR UPDATE ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.calendar_events_validate();

-- Participantes/convidados
CREATE TABLE public.calendar_event_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  external_name text,
  external_email text,
  external_phone text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_event_participants TO authenticated;
GRANT ALL ON public.calendar_event_participants TO service_role;
ALTER TABLE public.calendar_event_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "calendar_participants_select_office" ON public.calendar_event_participants
  FOR SELECT TO authenticated USING (office_id = public.current_office_id());
CREATE POLICY "calendar_participants_insert_office" ON public.calendar_event_participants
  FOR INSERT TO authenticated WITH CHECK (office_id = public.current_office_id());
CREATE POLICY "calendar_participants_update_office" ON public.calendar_event_participants
  FOR UPDATE TO authenticated USING (office_id = public.current_office_id())
  WITH CHECK (office_id = public.current_office_id());
CREATE POLICY "calendar_participants_delete_office" ON public.calendar_event_participants
  FOR DELETE TO authenticated USING (office_id = public.current_office_id());
CREATE INDEX idx_calendar_participants_event ON public.calendar_event_participants (event_id);

-- Lembretes (geram notificações reais dentro do JurisIA)
CREATE TABLE public.calendar_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  minutes_before integer NOT NULL DEFAULT 15,
  remind_at timestamptz NOT NULL,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_reminders TO authenticated;
GRANT ALL ON public.calendar_reminders TO service_role;
ALTER TABLE public.calendar_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "calendar_reminders_select_office" ON public.calendar_reminders
  FOR SELECT TO authenticated USING (office_id = public.current_office_id());
CREATE POLICY "calendar_reminders_insert_office" ON public.calendar_reminders
  FOR INSERT TO authenticated WITH CHECK (office_id = public.current_office_id());
CREATE POLICY "calendar_reminders_update_office" ON public.calendar_reminders
  FOR UPDATE TO authenticated USING (office_id = public.current_office_id())
  WITH CHECK (office_id = public.current_office_id());
CREATE POLICY "calendar_reminders_delete_office" ON public.calendar_reminders
  FOR DELETE TO authenticated USING (office_id = public.current_office_id());
CREATE INDEX idx_calendar_reminders_pending ON public.calendar_reminders (office_id, remind_at) WHERE sent_at IS NULL;

-- Vínculo das notificações com eventos
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES public.calendar_events(id) ON DELETE CASCADE;

ALTER PUBLICATION supabase_realtime ADD TABLE public.calendar_events;
