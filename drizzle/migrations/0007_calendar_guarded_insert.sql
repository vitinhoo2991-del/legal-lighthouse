-- Inserção/atualização de eventos com verificação atômica de conflito de horário.
CREATE OR REPLACE FUNCTION public.calendar_check_conflict(
  _office_id uuid,
  _assigned_to uuid,
  _start_at timestamptz,
  _end_at timestamptz,
  _ignore_event_id uuid DEFAULT NULL
)
RETURNS TABLE (id uuid, title text, start_at timestamptz, end_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  select e.id, e.title, e.start_at, e.end_at
  from public.calendar_events e
  where e.office_id = _office_id
    and _assigned_to is not null
    and e.assigned_to = _assigned_to
    and e.status not in ('cancelado','concluido')
    and (_ignore_event_id is null or e.id <> _ignore_event_id)
    and e.start_at < _end_at
    and e.end_at > _start_at
  order by e.start_at
  limit 5;
$$;

CREATE OR REPLACE FUNCTION public.calendar_create_event(
  _payload jsonb,
  _allow_conflict boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  _office uuid := (_payload->>'office_id')::uuid;
  _assigned uuid := nullif(_payload->>'assigned_to','')::uuid;
  _start timestamptz := (_payload->>'start_at')::timestamptz;
  _end timestamptz := (_payload->>'end_at')::timestamptz;
  _conflict jsonb;
  _row public.calendar_events;
begin
  if _office is null or _office <> public.current_office_id() then
    raise exception 'FORBIDDEN';
  end if;

  if _assigned is not null then
    perform pg_advisory_xact_lock(hashtext(_office::text || ':' || _assigned::text));
    select jsonb_agg(to_jsonb(c)) into _conflict
    from public.calendar_check_conflict(_office, _assigned, _start, _end, null) c;
    if _conflict is not null and not _allow_conflict then
      return jsonb_build_object('conflict', _conflict);
    end if;
  end if;

  insert into public.calendar_events (
    office_id, title, description, event_type, status, is_deadline, priority,
    start_at, end_at, all_day, location, meeting_url,
    lead_id, contact_id, opportunity_id, conversation_id, process_reference,
    assigned_to, created_by
  ) values (
    _office,
    _payload->>'title',
    nullif(_payload->>'description',''),
    coalesce(nullif(_payload->>'event_type',''),'consulta')::public.calendar_event_type,
    coalesce(nullif(_payload->>'status',''),'agendado')::public.calendar_event_status,
    coalesce((_payload->>'is_deadline')::boolean, false),
    coalesce(nullif(_payload->>'priority',''),'media')::public.calendar_priority,
    _start, _end,
    coalesce((_payload->>'all_day')::boolean, false),
    nullif(_payload->>'location',''),
    nullif(_payload->>'meeting_url',''),
    nullif(_payload->>'lead_id','')::uuid,
    nullif(_payload->>'contact_id','')::uuid,
    nullif(_payload->>'opportunity_id','')::uuid,
    nullif(_payload->>'conversation_id','')::uuid,
    nullif(_payload->>'process_reference',''),
    _assigned,
    nullif(_payload->>'created_by','')::uuid
  ) returning * into _row;

  return jsonb_build_object('event', to_jsonb(_row), 'conflict', _conflict);
end;
$$;

GRANT EXECUTE ON FUNCTION public.calendar_check_conflict(uuid, uuid, timestamptz, timestamptz, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calendar_create_event(jsonb, boolean) TO authenticated;
