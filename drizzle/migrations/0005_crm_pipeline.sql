-- Etapa 06 — CRM + Pipeline

CREATE TYPE public.crm_stage_kind AS ENUM ('aberta', 'ganha', 'perdida');
CREATE TYPE public.crm_activity_type AS ENUM ('ligacao', 'mensagem', 'reuniao', 'consulta', 'proposta', 'observacao', 'tarefa');
CREATE TYPE public.crm_activity_status AS ENUM ('pendente', 'em_andamento', 'concluida', 'cancelada');
CREATE TYPE public.crm_task_priority AS ENUM ('baixa', 'media', 'alta', 'urgente');

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'opportunity_assigned';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'opportunity_transferred';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'opportunity_stage_changed';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'opportunity_won';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'opportunity_lost';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'task_assigned';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'task_due_soon';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'task_overdue';

-- Pipelines (arquitetura já preparada para múltiplos pipelines por escritório)
CREATE TABLE public.crm_pipelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.crm_pipelines TO authenticated;
GRANT ALL ON public.crm_pipelines TO service_role;
ALTER TABLE public.crm_pipelines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_pipelines_select_office" ON public.crm_pipelines
  FOR SELECT TO authenticated USING (office_id = public.current_office_id());
CREATE POLICY "crm_pipelines_insert_office" ON public.crm_pipelines
  FOR INSERT TO authenticated WITH CHECK (office_id = public.current_office_id());
CREATE POLICY "crm_pipelines_update_office" ON public.crm_pipelines
  FOR UPDATE TO authenticated USING (office_id = public.current_office_id())
  WITH CHECK (office_id = public.current_office_id());
CREATE TRIGGER crm_pipelines_set_updated_at BEFORE UPDATE ON public.crm_pipelines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE UNIQUE INDEX idx_crm_pipeline_default ON public.crm_pipelines (office_id) WHERE is_default;

-- Etapas do pipeline (configuráveis: nome, ordem, tipo)
CREATE TABLE public.crm_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  pipeline_id uuid NOT NULL REFERENCES public.crm_pipelines(id) ON DELETE CASCADE,
  name text NOT NULL,
  kind public.crm_stage_kind NOT NULL DEFAULT 'aberta',
  position integer NOT NULL DEFAULT 0,
  color text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_stages TO authenticated;
GRANT ALL ON public.crm_stages TO service_role;
ALTER TABLE public.crm_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_stages_select_office" ON public.crm_stages
  FOR SELECT TO authenticated USING (office_id = public.current_office_id());
CREATE POLICY "crm_stages_insert_office" ON public.crm_stages
  FOR INSERT TO authenticated WITH CHECK (office_id = public.current_office_id());
CREATE POLICY "crm_stages_update_office" ON public.crm_stages
  FOR UPDATE TO authenticated USING (office_id = public.current_office_id())
  WITH CHECK (office_id = public.current_office_id());
CREATE POLICY "crm_stages_delete_office" ON public.crm_stages
  FOR DELETE TO authenticated USING (office_id = public.current_office_id());
CREATE TRIGGER crm_stages_set_updated_at BEFORE UPDATE ON public.crm_stages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_crm_stages_pipeline ON public.crm_stages (pipeline_id, position);

-- Oportunidades comerciais (referenciam o lead da Etapa 04, sem duplicar contato)
CREATE TABLE public.crm_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.whatsapp_contacts(id) ON DELETE SET NULL,
  pipeline_id uuid NOT NULL REFERENCES public.crm_pipelines(id) ON DELETE CASCADE,
  stage_id uuid NOT NULL REFERENCES public.crm_stages(id) ON DELETE RESTRICT,
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  estimated_value numeric(14,2),
  currency text NOT NULL DEFAULT 'BRL',
  probability integer NOT NULL DEFAULT 0,
  expected_close_date date,
  source text,
  loss_reason text,
  won_at timestamptz,
  won_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  lost_at timestamptz,
  lost_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  stage_changed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.crm_opportunities TO authenticated;
GRANT ALL ON public.crm_opportunities TO service_role;
ALTER TABLE public.crm_opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_opps_select_office" ON public.crm_opportunities
  FOR SELECT TO authenticated USING (office_id = public.current_office_id());
CREATE POLICY "crm_opps_insert_office" ON public.crm_opportunities
  FOR INSERT TO authenticated WITH CHECK (office_id = public.current_office_id());
CREATE POLICY "crm_opps_update_office" ON public.crm_opportunities
  FOR UPDATE TO authenticated USING (office_id = public.current_office_id())
  WITH CHECK (office_id = public.current_office_id());
CREATE TRIGGER crm_opportunities_set_updated_at BEFORE UPDATE ON public.crm_opportunities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_crm_opps_office_stage ON public.crm_opportunities (office_id, stage_id, updated_at DESC);
CREATE INDEX idx_crm_opps_lead ON public.crm_opportunities (office_id, lead_id);
CREATE INDEX idx_crm_opps_assigned ON public.crm_opportunities (office_id, assigned_to);

-- Histórico de movimentação entre etapas
CREATE TABLE public.crm_stage_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  opportunity_id uuid NOT NULL REFERENCES public.crm_opportunities(id) ON DELETE CASCADE,
  from_stage_id uuid REFERENCES public.crm_stages(id) ON DELETE SET NULL,
  to_stage_id uuid REFERENCES public.crm_stages(id) ON DELETE SET NULL,
  actor_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  description text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.crm_stage_history TO authenticated;
GRANT ALL ON public.crm_stage_history TO service_role;
ALTER TABLE public.crm_stage_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_history_select_office" ON public.crm_stage_history
  FOR SELECT TO authenticated USING (office_id = public.current_office_id());
CREATE POLICY "crm_history_insert_office" ON public.crm_stage_history
  FOR INSERT TO authenticated WITH CHECK (office_id = public.current_office_id());
CREATE INDEX idx_crm_history_opp ON public.crm_stage_history (opportunity_id, created_at DESC);

-- Atividades da oportunidade
CREATE TABLE public.crm_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  opportunity_id uuid NOT NULL REFERENCES public.crm_opportunities(id) ON DELETE CASCADE,
  type public.crm_activity_type NOT NULL,
  description text NOT NULL,
  status public.crm_activity_status NOT NULL DEFAULT 'concluida',
  owner_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  activity_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.crm_activities TO authenticated;
GRANT ALL ON public.crm_activities TO service_role;
ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_activities_select_office" ON public.crm_activities
  FOR SELECT TO authenticated USING (office_id = public.current_office_id());
CREATE POLICY "crm_activities_insert_office" ON public.crm_activities
  FOR INSERT TO authenticated WITH CHECK (office_id = public.current_office_id());
CREATE POLICY "crm_activities_update_office" ON public.crm_activities
  FOR UPDATE TO authenticated USING (office_id = public.current_office_id())
  WITH CHECK (office_id = public.current_office_id());
CREATE TRIGGER crm_activities_set_updated_at BEFORE UPDATE ON public.crm_activities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_crm_activities_opp ON public.crm_activities (opportunity_id, activity_at DESC);

-- Tarefas vinculadas à oportunidade
CREATE TABLE public.crm_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  opportunity_id uuid NOT NULL REFERENCES public.crm_opportunities(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  due_at timestamptz,
  priority public.crm_task_priority NOT NULL DEFAULT 'media',
  status public.crm_activity_status NOT NULL DEFAULT 'pendente',
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.crm_tasks TO authenticated;
GRANT ALL ON public.crm_tasks TO service_role;
ALTER TABLE public.crm_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_tasks_select_office" ON public.crm_tasks
  FOR SELECT TO authenticated USING (office_id = public.current_office_id());
CREATE POLICY "crm_tasks_insert_office" ON public.crm_tasks
  FOR INSERT TO authenticated WITH CHECK (office_id = public.current_office_id());
CREATE POLICY "crm_tasks_update_office" ON public.crm_tasks
  FOR UPDATE TO authenticated USING (office_id = public.current_office_id())
  WITH CHECK (office_id = public.current_office_id());
CREATE TRIGGER crm_tasks_set_updated_at BEFORE UPDATE ON public.crm_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_crm_tasks_opp ON public.crm_tasks (opportunity_id, due_at);
CREATE INDEX idx_crm_tasks_office_status ON public.crm_tasks (office_id, status, due_at);

-- Vínculo das notificações com oportunidades e tarefas
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS opportunity_id uuid REFERENCES public.crm_opportunities(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS task_id uuid REFERENCES public.crm_tasks(id) ON DELETE CASCADE;

-- Realtime do CRM
ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_opportunities;
ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_stage_history;
ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_activities;
ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_tasks;