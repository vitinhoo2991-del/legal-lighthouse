-- Enums
do $$ begin
  create type public.ai_conversation_status as enum ('ai','waiting_human','human','closed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ai_message_role as enum ('user','assistant','system');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ai_hours_mode as enum ('always','business_hours');
exception when duplicate_object then null; end $$;

-- Settings (one per office)
create table if not exists public.ai_agent_settings (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null unique references public.offices(id) on delete cascade,
  enabled boolean not null default false,
  agent_name text not null default 'Assistente Jurídico',
  greeting text not null default 'Olá! Sou a assistente virtual do escritório. Como posso ajudar você hoje?',
  tones text[] not null default array['profissional','cordial']::text[],
  objective text not null default 'Acolher o potencial cliente, entender sua necessidade, coletar informações iniciais e encaminhar o atendimento quando necessário.',
  behavior text not null default '',
  rules text not null default '',
  hours_mode public.ai_hours_mode not null default 'always',
  hours_start time not null default '09:00',
  hours_end time not null default '18:00',
  hours_days smallint[] not null default array[1,2,3,4,5]::smallint[],
  after_hours_message text not null default 'Estamos fora do horário de atendimento no momento. Deixe sua mensagem que retornaremos assim que possível.',
  handoff_message text not null default 'Vou encaminhar seu atendimento para um profissional do escritório.',
  model text not null default 'openai/gpt-6-astra',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.ai_agent_settings to authenticated;
grant all on public.ai_agent_settings to service_role;
alter table public.ai_agent_settings enable row level security;

create policy "ai_settings_select_office" on public.ai_agent_settings for select to authenticated
using (office_id = public.current_office_id());
create policy "ai_settings_insert_admin" on public.ai_agent_settings for insert to authenticated
with check (office_id = public.current_office_id() and (public.has_office_role('owner') or public.has_office_role('admin')));
create policy "ai_settings_update_admin" on public.ai_agent_settings for update to authenticated
using (office_id = public.current_office_id() and (public.has_office_role('owner') or public.has_office_role('admin')))
with check (office_id = public.current_office_id());

create trigger ai_agent_settings_set_updated_at before update on public.ai_agent_settings
for each row execute function public.set_updated_at();

-- Conversations
create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  title text not null default 'Nova conversa',
  channel text not null default 'test',
  status public.ai_conversation_status not null default 'ai',
  contact_name text,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ai_conversations_office_idx on public.ai_conversations(office_id, last_message_at desc);

grant select, insert, update, delete on public.ai_conversations to authenticated;
grant all on public.ai_conversations to service_role;
alter table public.ai_conversations enable row level security;

create policy "ai_conversations_select_office" on public.ai_conversations for select to authenticated
using (office_id = public.current_office_id());
create policy "ai_conversations_insert_office" on public.ai_conversations for insert to authenticated
with check (office_id = public.current_office_id());
create policy "ai_conversations_update_office" on public.ai_conversations for update to authenticated
using (office_id = public.current_office_id()) with check (office_id = public.current_office_id());
create policy "ai_conversations_delete_office" on public.ai_conversations for delete to authenticated
using (office_id = public.current_office_id());

create trigger ai_conversations_set_updated_at before update on public.ai_conversations
for each row execute function public.set_updated_at();

-- Messages
create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  office_id uuid not null references public.offices(id) on delete cascade,
  role public.ai_message_role not null,
  content text not null,
  author_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists ai_messages_conversation_idx on public.ai_messages(conversation_id, created_at);

grant select, insert, delete on public.ai_messages to authenticated;
grant all on public.ai_messages to service_role;
alter table public.ai_messages enable row level security;

create policy "ai_messages_select_office" on public.ai_messages for select to authenticated
using (office_id = public.current_office_id());
create policy "ai_messages_insert_office" on public.ai_messages for insert to authenticated
with check (office_id = public.current_office_id());
create policy "ai_messages_delete_office" on public.ai_messages for delete to authenticated
using (office_id = public.current_office_id());

-- Usage logs (cost control groundwork)
create table if not exists public.ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices(id) on delete cascade,
  conversation_id uuid references public.ai_conversations(id) on delete set null,
  model text not null,
  prompt_tokens integer,
  completion_tokens integer,
  total_tokens integer,
  duration_ms integer,
  status text not null default 'success',
  created_at timestamptz not null default now()
);
create index if not exists ai_usage_office_idx on public.ai_usage_logs(office_id, created_at desc);

grant select on public.ai_usage_logs to authenticated;
grant all on public.ai_usage_logs to service_role;
alter table public.ai_usage_logs enable row level security;

create policy "ai_usage_select_office" on public.ai_usage_logs for select to authenticated
using (office_id = public.current_office_id());
