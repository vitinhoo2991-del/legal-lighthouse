-- Etapa 09 — Treinamento / Base de conhecimento
create type public.knowledge_content_type as enum ('faq','orientacao','procedimento','politica','modelo','outro');

create table public.knowledge_items (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices(id),
  title text not null,
  content text not null,
  content_type public.knowledge_content_type not null default 'orientacao',
  tags text[] not null default '{}',
  enabled boolean not null default true,
  priority integer not null default 50,
  source_document_id uuid references public.documents(id) on delete set null,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id),
  constraint knowledge_items_title_length check (char_length(title) between 1 and 180),
  constraint knowledge_items_content_length check (char_length(content) between 1 and 30000),
  constraint knowledge_items_priority_range check (priority between 0 and 100)
);

create index knowledge_items_office_enabled_idx on public.knowledge_items(office_id, enabled, priority desc, updated_at desc);
create index knowledge_items_office_type_idx on public.knowledge_items(office_id, content_type);
create index knowledge_items_source_document_idx on public.knowledge_items(source_document_id) where source_document_id is not null;
create index knowledge_items_tags_idx on public.knowledge_items using gin(tags);

create table public.knowledge_item_versions (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices(id),
  knowledge_item_id uuid not null references public.knowledge_items(id) on delete cascade,
  version integer not null,
  title text not null,
  content text not null,
  content_type public.knowledge_content_type not null,
  tags text[] not null default '{}',
  enabled boolean not null,
  priority integer not null,
  changed_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(knowledge_item_id, version)
);
create index knowledge_item_versions_item_idx on public.knowledge_item_versions(knowledge_item_id, version desc);

create table public.knowledge_search_logs (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices(id),
  query text not null,
  matched_item_ids uuid[] not null default '{}',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index knowledge_search_logs_office_idx on public.knowledge_search_logs(office_id, created_at desc);

create or replace function public.set_knowledge_item_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger knowledge_items_set_updated_at before update on public.knowledge_items
for each row execute function public.set_knowledge_item_updated_at();

grant select, insert, update, delete on public.knowledge_items to authenticated;
grant select, insert, update, delete on public.knowledge_item_versions to authenticated;
grant select, insert on public.knowledge_search_logs to authenticated;
grant all on public.knowledge_items to service_role;
grant all on public.knowledge_item_versions to service_role;
grant all on public.knowledge_search_logs to service_role;

alter table public.knowledge_items enable row level security;
alter table public.knowledge_item_versions enable row level security;
alter table public.knowledge_search_logs enable row level security;

create policy knowledge_items_select on public.knowledge_items for select to authenticated
  using (office_id = public.current_office_id());
create policy knowledge_items_insert on public.knowledge_items for insert to authenticated
  with check (office_id = public.current_office_id());
create policy knowledge_items_update on public.knowledge_items for update to authenticated
  using (office_id = public.current_office_id())
  with check (office_id = public.current_office_id());
create policy knowledge_items_delete on public.knowledge_items for delete to authenticated
  using (office_id = public.current_office_id());

create policy knowledge_versions_select on public.knowledge_item_versions for select to authenticated
  using (office_id = public.current_office_id());
create policy knowledge_versions_insert on public.knowledge_item_versions for insert to authenticated
  with check (office_id = public.current_office_id());
create policy knowledge_versions_update on public.knowledge_item_versions for update to authenticated
  using (office_id = public.current_office_id())
  with check (office_id = public.current_office_id());
create policy knowledge_versions_delete on public.knowledge_item_versions for delete to authenticated
  using (office_id = public.current_office_id());

create policy knowledge_search_logs_select on public.knowledge_search_logs for select to authenticated
  using (office_id = public.current_office_id());
create policy knowledge_search_logs_insert on public.knowledge_search_logs for insert to authenticated
  with check (office_id = public.current_office_id());
