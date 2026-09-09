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
  version integer not null default 1,
  source_document_id uuid references public.documents(id) on delete set null,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id),
  constraint knowledge_items_title_length check (char_length(title) between 1 and 180),
  constraint knowledge_items_content_length check (char_length(content) between 1 and 30000),
  constraint knowledge_items_priority_range check (priority between 0 and 100),
  constraint knowledge_items_version_positive check (version >= 1)
);

create index knowledge_items_office_enabled_idx on public.knowledge_items(office_id, enabled, priority desc, updated_at desc);
create index knowledge_items_office_type_idx on public.knowledge_items(office_id, content_type);
create index knowledge_items_office_updated_idx on public.knowledge_items(office_id, updated_at desc);
create index knowledge_items_office_active_idx on public.knowledge_items(office_id) where deleted_at is null;
create index knowledge_items_source_document_idx on public.knowledge_items(source_document_id) where source_document_id is not null;
create index knowledge_items_tags_idx on public.knowledge_items using gin(tags);

grant select, insert, update on public.knowledge_items to authenticated;
grant all on public.knowledge_items to service_role;

alter table public.knowledge_items enable row level security;

create policy knowledge_items_select on public.knowledge_items for select to authenticated
  using (office_id = public.current_office_id());
create policy knowledge_items_insert on public.knowledge_items for insert to authenticated
  with check (
    office_id = public.current_office_id()
    and (public.has_office_role('owner') or public.has_office_role('admin'))
  );
create policy knowledge_items_update on public.knowledge_items for update to authenticated
  using (
    office_id = public.current_office_id()
    and (public.has_office_role('owner') or public.has_office_role('admin'))
  )
  with check (office_id = public.current_office_id());