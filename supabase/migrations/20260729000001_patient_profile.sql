-- GraftVision migration
-- Task: PATIENT-004
-- Purpose: Add a controlled masked patient profile and curated lifecycle timeline projection.
-- Created UTC: 20260729000001
-- Compatibility: Additive only; the 13-role/58-permission catalogues remain unchanged.
-- graftvision:dangerous-sql-approved task=PATIENT-004
-- graftvision:dangerous-sql-reason Reviewed same-clinic profile projection, inactive visibility, timeline allowlist, and direct-call denial.
-- graftvision:corrective-plan Forward-fix with a later additive migration; historical migrations remain unchanged.

create function graftvision_private.read_patient_profile(
  p_session_id uuid,
  p_provider_identity_id uuid,
  p_patient_id uuid,
  p_include_inactive boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clinic_id uuid;
  v_profile jsonb;
  v_timeline jsonb;
begin
  if p_patient_id is null or p_include_inactive is null then
    raise exception using errcode = '22023', message = 'INVALID_PATIENT_PROFILE_REQUEST';
  end if;
  if not graftvision_private.has_patient_root_authority(p_session_id, p_provider_identity_id) then
    raise exception using errcode = '42501', message = 'AUTH_PERMISSION_DENIED';
  end if;
  select s.clinic_id into v_clinic_id
  from public.application_session s where s.id = p_session_id;

  select jsonb_build_object(
    'id', p.id,
    'patientNumber', p.patient_number,
    'maskedName', left(r.full_name, 1) ||
      repeat('•', greatest(char_length(r.full_name) - 1, 1)),
    'maskedDateOfBirth', extract(year from r.date_of_birth)::integer::text,
    'maskedPhone', repeat('•', greatest(char_length(r.phone) - 2, 1)) || right(r.phone, 2),
    'maskedEmail', case when r.email is null then null else
      left(r.email, 1) || '•••@' || split_part(r.email, '@', 2) end,
    'status', p.status,
    'revision', p.revision,
    'registeredAt', p.created_at,
    'updatedAt', p.updated_at
  ) into v_profile
  from public.patient p
  join public.patient_registration r
    on r.clinic_id = p.clinic_id and r.patient_id = p.id
  where p.clinic_id = v_clinic_id
    and p.id = p_patient_id
    and (p.status = 'active' or p_include_inactive);

  if v_profile is null then return null; end if;

  with allowed_events as (
    select h.occurred_at, h.id as reference_id,
      case h.action_code
        when 'created' then 'PATIENT_CREATED'
        else 'PATIENT_STATUS_CHANGED'
      end as event_code,
      case h.action_code
        when 'created' then 'Patient record created'
        else 'Patient status changed to ' || h.new_status
      end as label
    from public.patient_status_history h
    where h.clinic_id = v_clinic_id and h.patient_id = p_patient_id
    union all
    select h.occurred_at, h.id, 'REGISTRATION_CREATED', 'Registration details created'
    from public.patient_registration_history h
    where h.clinic_id = v_clinic_id and h.patient_id = p_patient_id
      and h.action_code = 'registration_created'
    union all
    select h.occurred_at, h.id, 'DUPLICATE_OVERRIDE',
      'Possible duplicate reviewed and confirmed as distinct'
    from public.patient_duplicate_decision_history h
    where h.clinic_id = v_clinic_id and h.patient_id = p_patient_id
      and h.decision_code = 'override'
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'eventCode', event_code,
    'label', label,
    'occurredAt', occurred_at,
    'referenceId', reference_id
  ) order by occurred_at desc, reference_id desc), '[]'::jsonb)
  into v_timeline
  from allowed_events;

  return jsonb_build_object('profile', v_profile, 'timeline', v_timeline);
end;
$$;

revoke all on function graftvision_private.read_patient_profile(uuid, uuid, uuid, boolean)
  from public, anon, authenticated;
