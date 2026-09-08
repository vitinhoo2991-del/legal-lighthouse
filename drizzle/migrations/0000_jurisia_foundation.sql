-- ENUMS
create type public.app_role as enum ('owner','admin','lawyer','assistant');
create type public.office_status as enum ('active','suspended','cancelled');
create type public.profile_status as enum ('active','invited','inactive');

-- OFFICES
create table public.offices (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  document text,
  email text,
  phone text,
  website text,
  logo_url text,
  address text,
  city text,
  state text,
  zip_code text,
  timezone text not null default 'America/Sao_Paulo',
  status public.office_status not null default 'active',
  practice_areas text[] not null default '{}',
  goals text[] not null default '{}',
  onboarding_completed boolean not null default false,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- PROFILES
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique,
  office_id uuid references public.offices(id) on delete cascade,
  name text not null,
  email text not null,
  phone text,
  avatar_url text,
  role public.app_role not null default 'owner',
  status public.profile_status not null default 'active',
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_office_id_idx on public.profiles(office_id);
create index offices_created_by_idx on public.offices(created_by);

-- AUDIT LOGS
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  office_id uuid references public.offices(id) on delete cascade,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_office_id_idx on public.audit_logs(office_id, created_at desc);

-- HELPERS
create or replace function public.current_office_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select office_id from public.profiles where auth_user_id = auth.uid() limit 1;
$$;

create or replace function public.has_office_role(_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where auth_user_id = auth.uid() and role = _role
  );
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger offices_set_updated_at before update on public.offices
for each row execute function public.set_updated_at();
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

-- GRANTS
grant select, insert, update, delete on public.offices to authenticated;
grant all on public.offices to service_role;
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
grant select, insert on public.audit_logs to authenticated;
grant all on public.audit_logs to service_role;

-- RLS
alter table public.offices enable row level security;
alter table public.profiles enable row level security;
alter table public.audit_logs enable row level security;

create policy "offices_select_own" on public.offices for select to authenticated
using (id = public.current_office_id() or created_by = auth.uid());

create policy "offices_insert_self" on public.offices for insert to authenticated
with check (created_by = auth.uid());

create policy "offices_update_admins" on public.offices for update to authenticated
using (id = public.current_office_id() and (public.has_office_role('owner') or public.has_office_role('admin')))
with check (id = public.current_office_id());

create policy "profiles_select_same_office" on public.profiles for select to authenticated
using (auth_user_id = auth.uid() or (office_id is not null and office_id = public.current_office_id()));

create policy "profiles_insert_self" on public.profiles for insert to authenticated
with check (auth_user_id = auth.uid());

create policy "profiles_update_self_or_admin" on public.profiles for update to authenticated
using (auth_user_id = auth.uid() or (office_id = public.current_office_id() and (public.has_office_role('owner') or public.has_office_role('admin'))))
with check (auth_user_id = auth.uid() or office_id = public.current_office_id());

create policy "audit_select_office" on public.audit_logs for select to authenticated
using (office_id = public.current_office_id());

create policy "audit_insert_office" on public.audit_logs for insert to authenticated
with check (office_id = public.current_office_id());