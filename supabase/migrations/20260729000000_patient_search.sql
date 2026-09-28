-- GraftVision migration
-- Task: PATIENT-003
-- Purpose: Add controlled same-clinic patient list/search with stable cursors and masked projections.
-- Created UTC: 20260729000000
-- Compatibility: Additive only; the 13-role/58-permission catalogues remain unchanged.
-- graftvision:dangerous-sql-approved task=PATIENT-003
-- graftvision:dangerous-sql-reason Reviewed server-authoritative tenant search and privacy-safe projections.
-- graftvision:corrective-plan Forward-fix with a later additive migration; historical migrations remain unchanged.

create index patient_search_clinic_created_idx
  on public.patient (clinic_id, status, created_at desc, id desc);
create index patient_search_clinic_number_idx
  on public.patient (clinic_id, patient_number text_pattern_ops);
create index patient_search_clinic_name_idx
  on public.patient_registration (clinic_id, normalised_name text_pattern_ops);
create index patient_search_clinic_phone_prefix_idx
  on public.patient_registration (clinic_id, phone text_pattern_ops);
create index patient_search_clinic_email_prefix_idx
  on public.patient_registration (clinic_id, email text_pattern_ops)
  where email is not null;

create function graftvision_private.search_patients(
  p_session_id uuid,
  p_provider_identity_id uuid,
  p_query text default null,
  p_status text default 'active',
  p_created_from date default null,
  p_created_to date default null,
  p_cursor text default null,
  p_direction text default 'next',
  p_page_size integer default 25
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clinic_id uuid;
  v_query text := nullif(lower(btrim(coalesce(p_query, ''))), '');
  v_normalised_query text;
  v_query_kind text;
  v_cursor_json jsonb;
  v_cursor_created_at timestamptz;
  v_cursor_id uuid;
  v_cursor_binding text;
  v_expected_binding text;
  v_rows jsonb;
  v_has_more boolean;
  v_first_created_at timestamptz;
  v_first_id uuid;
  v_last_created_at timestamptz;
  v_last_id uuid;
begin
  if p_status not in ('active', 'inactive')
    or p_direction not in ('next', 'previous')
    or p_page_size not between 1 and 100
    or (p_created_from is not null and p_created_to is not null and p_created_from > p_created_to)
    or char_length(coalesce(p_query, '')) > 160 then
    raise exception using errcode = '22023', message = 'INVALID_PATIENT_SEARCH';
  end if;
  if not graftvision_private.has_patient_root_authority(p_session_id, p_provider_identity_id) then
    raise exception using errcode = '42501', message = 'AUTH_PERMISSION_DENIED';
  end if;
  select s.clinic_id into v_clinic_id
  from public.application_session s where s.id = p_session_id;

  if v_query is not null then
    if v_query ~ '^gv-[0-9]*$' and char_length(v_query) >= 3 then
      v_query_kind := 'patient_number';
      v_normalised_query := upper(v_query);
    elsif regexp_replace(v_query, '[[:space:]().-]+', '', 'g') ~ '^\+[1-9][0-9]{7,14}$' then
      v_query_kind := 'phone';
      v_normalised_query := regexp_replace(v_query, '[[:space:]().-]+', '', 'g');
    elsif position('@' in v_query) > 0 and char_length(v_query) >= 3 then
      v_query_kind := 'email';
      v_normalised_query := v_query;
    elsif char_length(graftvision_private.normalise_patient_name(v_query)) >= 2 then
      v_query_kind := 'name';
      v_normalised_query := graftvision_private.normalise_patient_name(v_query);
    else
      raise exception using errcode = '22023', message = 'INVALID_PATIENT_SEARCH';
    end if;
  end if;

  v_expected_binding := encode(extensions.digest(concat_ws(
    '|', v_clinic_id::text, coalesce(v_query_kind, ''), coalesce(v_normalised_query, ''),
    p_status, coalesce(p_created_from::text, ''), coalesce(p_created_to::text, '')
  ), 'sha256'), 'hex');

  if p_cursor is not null then
    begin
      if char_length(p_cursor) > 512 then raise exception using errcode = '22023'; end if;
      v_cursor_json := convert_from(decode(p_cursor, 'base64'), 'utf8')::jsonb;
      v_cursor_created_at := (v_cursor_json->>'createdAt')::timestamptz;
      v_cursor_id := (v_cursor_json->>'id')::uuid;
      v_cursor_binding := v_cursor_json->>'binding';
    exception when others then
      raise exception using errcode = '22023', message = 'INVALID_PATIENT_CURSOR';
    end;
    if v_cursor_binding is distinct from v_expected_binding
      or not exists (
        select 1 from public.patient p
        where p.clinic_id = v_clinic_id and p.id = v_cursor_id
          and p.created_at = v_cursor_created_at and p.status = p_status
      ) then
      raise exception using errcode = '22023', message = 'INVALID_PATIENT_CURSOR';
    end if;
  end if;

  with matched as (
    select p.id, p.patient_number, p.status, p.revision, p.created_at,
      left(r.full_name, 1) ||
        repeat('•', greatest(char_length(r.full_name) - 1, 1)) as masked_name,
      true as has_phone, r.email is not null as has_email
    from public.patient p
    join public.patient_registration r
      on r.clinic_id = p.clinic_id and r.patient_id = p.id
    where p.clinic_id = v_clinic_id
      and p.status = p_status
      and (p_created_from is null or p.created_at >= p_created_from::timestamptz)
      and (p_created_to is null or p.created_at < (p_created_to + 1)::timestamptz)
      and (
        v_query is null
        or (v_query_kind = 'patient_number' and p.patient_number like v_normalised_query || '%')
        or (v_query_kind = 'name' and r.normalised_name like v_normalised_query || '%')
        or (v_query_kind = 'phone' and r.phone like v_normalised_query || '%')
        or (v_query_kind = 'email' and r.email like v_normalised_query || '%')
      )
      and (
        p_cursor is null
        or (p_direction = 'next' and (p.created_at, p.id) < (v_cursor_created_at, v_cursor_id))
        or (p_direction = 'previous' and (p.created_at, p.id) > (v_cursor_created_at, v_cursor_id))
      )
    order by
      case when p_direction = 'next' then p.created_at end desc,
      case when p_direction = 'next' then p.id end desc,
      case when p_direction = 'previous' then p.created_at end asc,
      case when p_direction = 'previous' then p.id end asc
    limit p_page_size + 1
  ), page_rows as (
    select * from matched limit p_page_size
  ), ordered_rows as (
    select * from page_rows order by created_at desc, id desc
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'id', id, 'patientNumber', patient_number, 'maskedName', masked_name,
      'hasPhone', has_phone, 'hasEmail', has_email, 'status', status,
      'revision', revision, 'createdAt', created_at
    ) order by created_at desc, id desc), '[]'::jsonb),
    (select count(*) > p_page_size from matched),
    (array_agg(created_at order by created_at desc, id desc))[1],
    (array_agg(id order by created_at desc, id desc))[1],
    (array_agg(created_at order by created_at desc, id desc))[count(*)],
    (array_agg(id order by created_at desc, id desc))[count(*)]
  into v_rows, v_has_more, v_first_created_at, v_first_id, v_last_created_at, v_last_id
  from ordered_rows;

  return jsonb_build_object(
    'patients', v_rows,
    'nextCursor', case when v_last_id is not null and (
      (p_direction = 'next' and v_has_more)
      or (p_direction = 'previous' and p_cursor is not null)
    ) then
      encode(convert_to(jsonb_build_object(
        'createdAt', v_last_created_at, 'id', v_last_id, 'binding', v_expected_binding
      )::text, 'utf8'), 'base64') end,
    'previousCursor', case when v_first_id is not null and (
      (p_direction = 'next' and p_cursor is not null)
      or (p_direction = 'previous' and v_has_more)
    ) then
      encode(convert_to(jsonb_build_object(
        'createdAt', v_first_created_at, 'id', v_first_id, 'binding', v_expected_binding
      )::text, 'utf8'), 'base64') end
  );
end;
$$;

revoke all on function graftvision_private.search_patients(
  uuid, uuid, text, text, date, date, text, text, integer
) from public, anon, authenticated;
