create or replace function public.knowledge_search(
  _query text,
  _limit integer default 6,
  _only_enabled boolean default true
)
returns table (
  id uuid,
  title text,
  content text,
  content_type public.knowledge_content_type,
  tags text[],
  priority integer,
  enabled boolean,
  updated_at timestamptz,
  rank real
)
language sql
stable
set search_path to 'public'
as $$
  with q as (
    select
      case
        when coalesce(trim(_query), '') = '' then null
        else websearch_to_tsquery('portuguese'::regconfig, trim(_query))
      end as tsq
  )
  select k.id, k.title, k.content, k.content_type, k.tags, k.priority, k.enabled, k.updated_at,
         case when q.tsq is null then 0::real else ts_rank(k.search_vector, q.tsq) end as rank
  from public.knowledge_items k, q
  where k.office_id = public.current_office_id()
    and k.deleted_at is null
    and (_only_enabled is false or k.enabled = true)
    and (q.tsq is null or k.search_vector @@ q.tsq)
  order by rank desc, k.priority desc, k.updated_at desc
  limit greatest(1, least(coalesce(_limit, 6), 50));
$$;

grant execute on function public.knowledge_search(text, integer, boolean) to authenticated;
grant execute on function public.knowledge_search(text, integer, boolean) to service_role;