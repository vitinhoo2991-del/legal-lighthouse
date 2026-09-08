create type public.whatsapp_connection_status as enum ('disconnected', 'pending', 'connected', 'error');
create type public.whatsapp_direction as enum ('inbound', 'outbound');
create type public.whatsapp_message_status as enum ('queued', 'sent', 'delivered', 'read', 'failed');

create table public.whatsapp_connections (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null unique references public.offices(id) on delete cascade,
  phone_number text,
  display_name text,
  external_account_id text,
  external_phone_number_id text,
  status public.whatsapp_connection_status not null default 'disconnected',
  last_error text,
  connected_at timestamptz,
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.whatsapp_connections to authenticated;
grant all on public.whatsapp_connections to service_role;
alter table public.whatsapp_connections enable row level security;
create policy wa_conn_select_office on public.whatsapp_connections
  for select to authenticated using (office_id = public.current_office_id());
create policy wa_conn_insert_admin on public.whatsapp_connections
  for insert to authenticated with check (
    office_id = public.current_office_id()
    and (public.has_office_role('owner') or public.has_office_role('admin'))
  );
create policy wa_conn_update_admin on public.whatsapp_connections
  for update to authenticated using (
    office_id = public.current_office_id()
    and (public.has_office_role('owner') or public.has_office_role('admin'))
  ) with check (office_id = public.current_office_id());

create table public.whatsapp_credentials (
  office_id uuid primary key references public.offices(id) on delete cascade,
  access_token text not null,
  app_secret text,
  verify_token text not null,
  updated_at timestamptz not null default now()
);
revoke all on public.whatsapp_credentials from anon, authenticated;
grant all on public.whatsapp_credentials to service_role;
alter table public.whatsapp_credentials enable row level security;

create table public.whatsapp_contacts (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices(id) on delete cascade,
  phone_number text not null,
  name text,
  profile_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (office_id, phone_number)
);
grant select, insert, update on public.whatsapp_contacts to authenticated;
grant all on public.whatsapp_contacts to service_role;
alter table public.whatsapp_contacts enable row level security;
create policy wa_contacts_select_office on public.whatsapp_contacts
  for select to authenticated using (office_id = public.current_office_id());
create policy wa_contacts_insert_office on public.whatsapp_contacts
  for insert to authenticated with check (office_id = public.current_office_id());
create policy wa_contacts_update_office on public.whatsapp_contacts
  for update to authenticated using (office_id = public.current_office_id())
  with check (office_id = public.current_office_id());

create table public.whatsapp_conversations (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices(id) on delete cascade,
  contact_id uuid not null references public.whatsapp_contacts(id) on delete cascade,
  external_conversation_id text,
  status public.ai_conversation_status not null default 'ai',
  assigned_to uuid references public.profiles(id) on delete set null,
  ai_enabled boolean not null default true,
  unread_count integer not null default 0,
  handed_off_at timestamptz,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (office_id, contact_id)
);
grant select, insert, update on public.whatsapp_conversations to authenticated;
grant all on public.whatsapp_conversations to service_role;
alter table public.whatsapp_conversations enable row level security;
create policy wa_conv_select_office on public.whatsapp_conversations
  for select to authenticated using (office_id = public.current_office_id());
create policy wa_conv_insert_office on public.whatsapp_conversations
  for insert to authenticated with check (office_id = public.current_office_id());
create policy wa_conv_update_office on public.whatsapp_conversations
  for update to authenticated using (office_id = public.current_office_id())
  with check (office_id = public.current_office_id());

create table public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices(id) on delete cascade,
  conversation_id uuid not null references public.whatsapp_conversations(id) on delete cascade,
  external_message_id text,
  direction public.whatsapp_direction not null,
  message_type text not null default 'text',
  content text not null default '',
  status public.whatsapp_message_status not null default 'queued',
  error_message text,
  author_profile_id uuid references public.profiles(id) on delete set null,
  from_ai boolean not null default false,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (office_id, external_message_id)
);
grant select, insert, update on public.whatsapp_messages to authenticated;
grant all on public.whatsapp_messages to service_role;
alter table public.whatsapp_messages enable row level security;
create policy wa_msg_select_office on public.whatsapp_messages
  for select to authenticated using (office_id = public.current_office_id());
create policy wa_msg_insert_office on public.whatsapp_messages
  for insert to authenticated with check (office_id = public.current_office_id());
create policy wa_msg_update_office on public.whatsapp_messages
  for update to authenticated using (office_id = public.current_office_id())
  with check (office_id = public.current_office_id());

create table public.whatsapp_webhook_events (
  id uuid primary key default gen_random_uuid(),
  office_id uuid references public.offices(id) on delete cascade,
  external_event_id text not null unique,
  event_type text not null,
  processed boolean not null default false,
  processing_error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);
grant select on public.whatsapp_webhook_events to authenticated;
grant all on public.whatsapp_webhook_events to service_role;
alter table public.whatsapp_webhook_events enable row level security;
create policy wa_events_select_office on public.whatsapp_webhook_events
  for select to authenticated using (office_id = public.current_office_id());

create index wa_contacts_office_idx on public.whatsapp_contacts (office_id, phone_number);
create index wa_conv_office_idx on public.whatsapp_conversations (office_id, last_message_at desc);
create index wa_msg_conv_idx on public.whatsapp_messages (conversation_id, created_at);
create index wa_msg_office_idx on public.whatsapp_messages (office_id, created_at desc);
create index wa_events_office_idx on public.whatsapp_webhook_events (office_id, created_at desc);
create index wa_conn_phone_idx on public.whatsapp_connections (external_phone_number_id);

create trigger whatsapp_connections_set_updated_at before update on public.whatsapp_connections
  for each row execute function public.set_updated_at();
create trigger whatsapp_contacts_set_updated_at before update on public.whatsapp_contacts
  for each row execute function public.set_updated_at();
create trigger whatsapp_conversations_set_updated_at before update on public.whatsapp_conversations
  for each row execute function public.set_updated_at();