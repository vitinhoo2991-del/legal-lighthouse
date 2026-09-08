-- Etapa 05 — Multiatendimento

CREATE TYPE public.conversation_service_status AS ENUM (
  'aberta', 'em_atendimento', 'aguardando_cliente', 'aguardando_equipe', 'encerrada'
);

CREATE TYPE public.conversation_event_type AS ENUM (
  'assumed', 'transferred', 'returned_to_queue', 'status_changed',
  'closed', 'reopened', 'ai_enabled', 'ai_disabled', 'note_created', 'message_sent'
);

CREATE TYPE public.notification_type AS ENUM (
  'new_conversation', 'new_message', 'conversation_assigned', 'conversation_transferred', 'hot_lead'
);

ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS service_status public.conversation_service_status NOT NULL DEFAULT 'aberta',
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS max_concurrent_conversations integer,
  ADD COLUMN IF NOT EXISTS notification_sound_enabled boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_wa_conversations_service_status
  ON public.whatsapp_conversations (office_id, service_status, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_conversations_assigned
  ON public.whatsapp_conversations (office_id, assigned_to);

-- Histórico de atribuições
CREATE TABLE public.conversation_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  unassigned_at timestamptz,
  transfer_reason text
);
GRANT SELECT, INSERT, UPDATE ON public.conversation_assignments TO authenticated;
GRANT ALL ON public.conversation_assignments TO service_role;
ALTER TABLE public.conversation_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "assignments_select_office" ON public.conversation_assignments
  FOR SELECT TO authenticated USING (office_id = public.current_office_id());
CREATE POLICY "assignments_insert_office" ON public.conversation_assignments
  FOR INSERT TO authenticated WITH CHECK (office_id = public.current_office_id());
CREATE POLICY "assignments_update_office" ON public.conversation_assignments
  FOR UPDATE TO authenticated USING (office_id = public.current_office_id())
  WITH CHECK (office_id = public.current_office_id());
CREATE INDEX idx_conv_assignments_conv ON public.conversation_assignments (conversation_id, assigned_at DESC);

-- Histórico de eventos do atendimento
CREATE TABLE public.conversation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  actor_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type public.conversation_event_type NOT NULL,
  description text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.conversation_events TO authenticated;
GRANT ALL ON public.conversation_events TO service_role;
ALTER TABLE public.conversation_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "conv_events_select_office" ON public.conversation_events
  FOR SELECT TO authenticated USING (office_id = public.current_office_id());
CREATE POLICY "conv_events_insert_office" ON public.conversation_events
  FOR INSERT TO authenticated WITH CHECK (office_id = public.current_office_id());
CREATE INDEX idx_conv_events_conv ON public.conversation_events (conversation_id, created_at DESC);

-- Notas internas (nunca enviadas ao cliente)
CREATE TABLE public.conversation_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  author_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.conversation_notes TO authenticated;
GRANT ALL ON public.conversation_notes TO service_role;
ALTER TABLE public.conversation_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "conv_notes_select_office" ON public.conversation_notes
  FOR SELECT TO authenticated USING (office_id = public.current_office_id());
CREATE POLICY "conv_notes_insert_office" ON public.conversation_notes
  FOR INSERT TO authenticated WITH CHECK (office_id = public.current_office_id());
CREATE INDEX idx_conv_notes_conv ON public.conversation_notes (conversation_id, created_at DESC);

-- Notificações reais da equipe
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  type public.notification_type NOT NULL,
  title text NOT NULL,
  body text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications_select_own_office" ON public.notifications
  FOR SELECT TO authenticated
  USING (office_id = public.current_office_id()
         AND (profile_id IS NULL OR profile_id IN (
              SELECT id FROM public.profiles WHERE auth_user_id = auth.uid())));
CREATE POLICY "notifications_insert_office" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (office_id = public.current_office_id());
CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE TO authenticated
  USING (office_id = public.current_office_id()
         AND (profile_id IS NULL OR profile_id IN (
              SELECT id FROM public.profiles WHERE auth_user_id = auth.uid())))
  WITH CHECK (office_id = public.current_office_id());
CREATE INDEX idx_notifications_profile ON public.notifications (office_id, profile_id, created_at DESC);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_notes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Backfill do status de atendimento a partir do status existente (IA/humano)
UPDATE public.whatsapp_conversations
SET service_status = CASE
  WHEN status = 'closed' THEN 'encerrada'::public.conversation_service_status
  WHEN status = 'human' THEN 'em_atendimento'::public.conversation_service_status
  WHEN status = 'waiting_human' THEN 'aguardando_equipe'::public.conversation_service_status
  ELSE 'aberta'::public.conversation_service_status
END;