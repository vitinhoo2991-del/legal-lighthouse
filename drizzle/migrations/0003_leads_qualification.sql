create type public.lead_qualification_status as enum ('novo','em_qualificacao','qualificado','incompleto','desqualificado','atendimento_humano');
create type public.lead_temperature as enum ('frio','morno','quente');
create type public.lead_urgency as enum ('desconhecida','baixa','media','alta','critica');
create type public.lead_intent as enum ('desconhecida','informacao','avaliando','contratar');
create type public.lead_score_source as enum ('ai','user','system');

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices(id) on delete cascade,
  contact_id uuid references public.whatsapp_contacts(id) on delete set null,
  whatsapp_conversation_id uuid references public.whatsapp_conversations(id) on delete set null,
  ai_conversation_id uuid references public.ai_conversations(id) on delete set null,
  source text not null default 'whatsapp',
  name text,
  phone text,
  email text,
  practice_area text,
  practice_area_match boolean,
  case_type text,
  case_summary text,
  urgency public.lead_urgency not null default 'desconhecida',
  intent public.lead_intent not null default 'desconhecida',
  location text,
  has_deadline boolean,
  deadline text,
  budget_signal text,
  decision_maker boolean,
  qualification_status public.lead_qualification_status not null default 'novo',
  lead_score integer not null default 0 check (lead_score between 0 and 100),
  lead_temperature public.lead_temperature not null default 'frio',
  score_reason text,
  qualification_summary text,
  missing_information text[] not null default '{}',
  assigned_to uuid references public.profiles(id) on delete set null,
  last_interaction_at timestamptz not null default now(),
  last_qualified_at timestamptz,
  last_qualified_message_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index leads_office_contact_uniq on public.leads(office_id, contact_id) where contact_id is not null;
create unique index leads_office_ai_conversation_uniq on public.leads(office_id, ai_conversation_id) where ai_conversation_id is not null;
create index leads_office_created_idx on public.leads(office_id, created_at desc);
create index leads_office_status_idx on public.leads(office_id, qualification_status);
create index leads_office_score_idx on public.leads(office_id, lead_score desc);

grant select, insert, update, delete on public.leads to authenticated;
grant all on public.leads to service_role;
alter table public.leads enable row level security;

create policy leads_select_office on public.leads for select to authenticated using (office_id = public.current_office_id());
create policy leads_insert_office on public.leads for insert to authenticated with check (office_id = public.current_office_id());
create policy leads_update_office on public.leads for update to authenticated using (office_id = public.current_office_id()) with check (office_id = public.current_office_id());

create trigger leads_set_updated_at before update on public.leads for each row execute function public.set_updated_at();

create table public.lead_score_history (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  office_id uuid not null references public.offices(id) on delete cascade,
  previous_score integer,
  new_score integer not null,
  reason text,
  source public.lead_score_source not null default 'ai',
  created_at timestamptz not null default now()
);

create index lead_score_history_lead_idx on public.lead_score_history(lead_id, created_at desc);

grant select, insert on public.lead_score_history to authenticated;
grant all on public.lead_score_history to service_role;
alter table public.lead_score_history enable row level security;

create policy lead_score_history_select_office on public.lead_score_history for select to authenticated using (office_id = public.current_office_id());
create policy lead_score_history_insert_office on public.lead_score_history for insert to authenticated with check (office_id = public.current_office_id());