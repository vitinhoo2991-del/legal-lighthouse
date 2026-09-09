create or replace function public.knowledge_search_document(_title text, _tags text[], _content text)
returns tsvector
language sql
immutable
set search_path to 'public'
as $$
  select setweight(to_tsvector('portuguese'::regconfig, coalesce(_title, '')), 'A')
      || setweight(to_tsvector('portuguese'::regconfig, coalesce(array_to_string(_tags, ' '), '')), 'B')
      || setweight(to_tsvector('portuguese'::regconfig, coalesce(_content, '')), 'C');
$$;

alter table public.knowledge_items
  add column search_vector tsvector generated always as (
    public.knowledge_search_document(title, tags, content)
  ) stored;

create index knowledge_items_search_idx on public.knowledge_items using gin(search_vector);