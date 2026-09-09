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
  source_document_id uuid references public.documents(id) on delete set null,
  changed_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(knowledge_item_id, version)
);
create index knowledge_item_versions_item_idx on public.knowledge_item_versions(knowledge_item_id, version desc);
create index knowledge_item_versions_office_idx on public.knowledge_item_versions(office_id, created_at desc);

create table public.knowledge_search_logs (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices(id),
  query text not null,
  result_count integer not null default 0,
  matched_item_ids uuid[] not null default '{}',
  source text not null default 'ai',
  conversation_id uuid,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint knowledge_search_logs_query_length check (char_length(query) between 1 and 300)
);
create index knowledge_search_logs_office_idx on public.knowledge_search_logs(office_id, created_at desc);

create or replace function public.set_knowledge_item_updated_at()
returns trigger language plpgsql set search_path to 'public' as $$
begin
  new.updated_at = now();
  if (new.title is distinct from old.title)
     or (new.content is distinct from old.content)
     or (new.content_type is distinct from old.content_type)
     or (new.tags is distinct from old.tags)
     or (new.enabled is distinct from old.enabled)
     or (new.priority is distinct from old.priority)
     or (new.source_document_id is distinct from old.source_document_id)
     or (new.deleted_at is distinct from old.deleted_at) then
    new.version = old.version + 1;
  else
    new.version = old.version;
  end if;
  return new;
end;
$$;

create trigger knowledge_items_set_updated_at before update on public.knowledge_items
for each row execute function public.set_knowledge_item_updated_at();

grant select, insert on public.knowledge_item_versions to authenticated;
grant select, insert on public.knowledge_search_logs to authenticated;
grant all on public.knowledge_item_versions to service_role;
grant all on public.knowledge_search_logs to service_role;

alter table public.knowledge_item_versions enable row level security;
alter table public.knowledge_search_logs enable row level security;

create policy knowledge_versions_select on public.knowledge_item_versions for select to authenticated
  using (office_id = public.current_office_id());
create policy knowledge_versions_insert on public.knowledge_item_versions for insert to authenticated
  with check (
    office_id = public.current_office_id()
    and (public.has_office_role('owner') or public.has_office_role('admin'))
  );

create policy knowledge_search_logs_select on public.knowledge_search_logs for select to authenticated
  using (office_id = public.current_office_id());
create policy knowledge_search_logs_insert on public.knowledge_search_logs for insert to authenticated
  with check (office_id = public.current_office_id());