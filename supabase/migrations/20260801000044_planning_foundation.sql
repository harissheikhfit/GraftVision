-- PLAN-001: Doctor planning and graft-estimation foundation
create table public.planning_package (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinic(id),
  patient_id uuid not null references public.patient(id),
  consultation_id uuid not null references public.consultation(id),
  annotation_package_id uuid not null references public.model_annotation_package(id),
  model_package_id uuid not null references public.scalp_model_package(id),
  reconstruction_output_manifest_id uuid not null references public.reconstruction_output_manifest(id),
  ai_proposal_id uuid references public.ai_map_proposal_package(id),
  geometry_revision integer not null check (geometry_revision > 0),
  planning_engine_version text not null check (planning_engine_version = 'graftvision-planning-package-v1'),
  density_profile_version text not null check (density_profile_version in ('conservative', 'balanced', 'dense')),
  package_state text not null default 'draft' check (package_state in ('draft', 'calculated', 'finalized', 'superseded', 'stale')),
  revision integer not null default 1 check (revision > 0),
  donor_reserve_factor numeric not null check (donor_reserve_factor between 0.0 and 1.0),
  crown_weighting numeric not null check (crown_weighting between 0.0 and 1.0),
  temporal_weighting numeric not null check (temporal_weighting between 0.0 and 1.0),
  
  recipient_area_by_zone jsonb not null default '{}'::jsonb check (jsonb_typeof(recipient_area_by_zone) = 'object'),
  donor_area_by_zone jsonb not null default '{}'::jsonb check (jsonb_typeof(donor_area_by_zone) = 'object'),
  exclusion_area numeric not null default 0 check (exclusion_area >= 0),
  usable_donor_area numeric not null default 0 check (usable_donor_area >= 0),
  total_recipient_area numeric not null default 0 check (total_recipient_area >= 0),
  geometry_validation_status text not null default 'valid' check (geometry_validation_status in ('valid', 'invalid', 'stale', 'unsupported')),
  
  estimated_grafts_min jsonb not null default '{}'::jsonb check (jsonb_typeof(estimated_grafts_min) = 'object'),
  estimated_grafts_target jsonb not null default '{}'::jsonb check (jsonb_typeof(estimated_grafts_target) = 'object'),
  estimated_grafts_max jsonb not null default '{}'::jsonb check (jsonb_typeof(estimated_grafts_max) = 'object'),
  total_grafts_min integer not null default 0 check (total_grafts_min >= 0),
  total_grafts_target integer not null default 0 check (total_grafts_target >= 0),
  total_grafts_max integer not null default 0 check (total_grafts_max >= 0),
  donor_available_min integer not null default 0 check (donor_available_min >= 0),
  donor_available_max integer not null default 0 check (donor_available_max >= 0),
  donor_reserve integer not null default 0 check (donor_reserve >= 0),
  donor_utilization numeric not null default 0 check (donor_utilization >= 0),
  coverage_percentage numeric not null default 0 check (coverage_percentage >= 0),
  warnings text[] not null default '{}' check (array_length(warnings, 1) is null or warnings <@ array['RECIPIENT_REGION_MISSING', 'DONOR_REGION_MISSING', 'EXCLUSION_REGION_OVERLAP', 'DONOR_CAPACITY_INSUFFICIENT', 'DENSITY_TARGET_OUT_OF_RANGE', 'GEOMETRY_STALE', 'SURFACE_AREA_UNAVAILABLE', 'RECIPIENT_AREA_TOO_LARGE', 'DONOR_RESERVE_TOO_LOW', 'PLAN_REQUIRES_DOCTOR_REVIEW']),
  
  supersedes_package_id uuid references public.planning_package(id),
  created_at timestamptz not null default clock_timestamp(),
  created_by uuid not null references public.platform_user(id),
  finalized_at timestamptz
);

create table public.planning_idempotency (
  clinic_id uuid not null references public.clinic(id),
  actor_platform_user_id uuid not null references public.platform_user(id),
  request_family text not null check (request_family in ('calculate', 'finalize', 'invalidate')),
  idempotency_key uuid not null,
  payload_hash text not null check (payload_hash ~ '^[a-f0-9]{64}$'),
  result_resource_id uuid not null,
  result_status text not null check (result_status in ('created', 'replayed', 'finalized')),
  result_revision integer not null check (result_revision > 0),
  created_at timestamptz not null default clock_timestamp(),
  primary key (clinic_id, actor_platform_user_id, request_family, idempotency_key)
);

alter table public.planning_package enable row level security;
alter table public.planning_package force row level security;
alter table public.planning_idempotency enable row level security;
alter table public.planning_idempotency force row level security;

revoke all on public.planning_package, public.planning_idempotency from public, anon, authenticated;

create trigger planning_package_controlled before insert or update or delete on public.planning_package for each row execute function graftvision_private.enforce_controlled_scan_mutation();
create trigger planning_idempotency_controlled before insert or update or delete on public.planning_idempotency for each row execute function graftvision_private.enforce_controlled_scan_mutation();

create or replace function graftvision_private.upsert_planning_package(
  p_application_session_id uuid,
  p_provider_identity_id uuid,
  p_clinic_id uuid,
  p_consultation_id uuid,
  p_annotation_package_id uuid,
  p_model_package_id uuid,
  p_reconstruction_output_manifest_id uuid,
  p_ai_proposal_id uuid,
  p_geometry_revision integer,
  p_density_profile_version text,
  p_donor_reserve_factor numeric,
  p_crown_weighting numeric,
  p_temporal_weighting numeric,
  p_recipient_area_by_zone jsonb,
  p_donor_area_by_zone jsonb,
  p_exclusion_area numeric,
  p_usable_donor_area numeric,
  p_total_recipient_area numeric,
  p_geometry_validation_status text,
  p_estimated_grafts_min jsonb,
  p_estimated_grafts_target jsonb,
  p_estimated_grafts_max jsonb,
  p_total_grafts_min integer,
  p_total_grafts_target integer,
  p_total_grafts_max integer,
  p_donor_available_min integer,
  p_donor_available_max integer,
  p_donor_reserve integer,
  p_donor_utilization numeric,
  p_coverage_percentage numeric,
  p_warnings text[],
  p_idempotency_key uuid,
  p_payload_hash text
) returns table (
  package_id uuid,
  package_revision integer,
  is_new boolean
) security definer set search_path = public, pg_temp language plpgsql as $$
declare
  v_actor_user_id uuid;
  v_latest_package_id uuid;
  v_latest_revision integer;
  v_result_id uuid;
  v_result_revision integer;
begin
  select u.platform_user_id into v_actor_user_id
  from graftvision_private.assert_consultation_doctor_authority(p_application_session_id, p_provider_identity_id, p_consultation_id) u;

  if v_actor_user_id is null then
    raise exception 'Permission denied.';
  end if;

  select result_resource_id, result_revision into v_result_id, v_result_revision
  from public.planning_idempotency
  where clinic_id = p_clinic_id
    and actor_platform_user_id = v_actor_user_id
    and request_family = 'calculate'
    and idempotency_key = p_idempotency_key;

  if found then
    return query select v_result_id, v_result_revision, false;
    return;
  end if;

  select id, revision into v_latest_package_id, v_latest_revision
  from public.planning_package
  where consultation_id = p_consultation_id
    and package_state in ('draft', 'calculated')
  order by revision desc limit 1;

  if v_latest_package_id is not null then
-- graftvision:dangerous-sql-approved task=PLAN-001
-- graftvision:dangerous-sql-reason Controlled planning row locks and revision transitions serialize immutable Doctor planning calculations.
-- graftvision:corrective-plan Forward-fix through an additive migration; prior planning revisions, events, and audit history remain preserved.
    update public.planning_package set package_state = 'superseded' where id = v_latest_package_id;
  end if;

  v_result_revision := coalesce(v_latest_revision, 0) + 1;

  insert into public.planning_package (
    clinic_id, patient_id, consultation_id, annotation_package_id, model_package_id, reconstruction_output_manifest_id, ai_proposal_id, geometry_revision, planning_engine_version, density_profile_version, package_state, revision, donor_reserve_factor, crown_weighting, temporal_weighting, recipient_area_by_zone, donor_area_by_zone, exclusion_area, usable_donor_area, total_recipient_area, geometry_validation_status, estimated_grafts_min, estimated_grafts_target, estimated_grafts_max, total_grafts_min, total_grafts_target, total_grafts_max, donor_available_min, donor_available_max, donor_reserve, donor_utilization, coverage_percentage, warnings, supersedes_package_id, created_by
  ) values (
    p_clinic_id, (select patient_id from public.consultation where id = p_consultation_id), p_consultation_id, p_annotation_package_id, p_model_package_id, p_reconstruction_output_manifest_id, p_ai_proposal_id, p_geometry_revision, 'graftvision-planning-package-v1', p_density_profile_version, 'calculated', v_result_revision, p_donor_reserve_factor, p_crown_weighting, p_temporal_weighting, p_recipient_area_by_zone, p_donor_area_by_zone, p_exclusion_area, p_usable_donor_area, p_total_recipient_area, p_geometry_validation_status, p_estimated_grafts_min, p_estimated_grafts_target, p_estimated_grafts_max, p_total_grafts_min, p_total_grafts_target, p_total_grafts_max, p_donor_available_min, p_donor_available_max, p_donor_reserve, p_donor_utilization, p_coverage_percentage, p_warnings, v_latest_package_id, v_actor_user_id
  ) returning id into v_result_id;

  insert into public.planning_idempotency (
    clinic_id, actor_platform_user_id, request_family, idempotency_key, payload_hash, result_resource_id, result_status, result_revision
  ) values (
    p_clinic_id, v_actor_user_id, 'calculate', p_idempotency_key, p_payload_hash, v_result_id, 'created', v_result_revision
  );

  return query select v_result_id, v_result_revision, true;
end;
$$;
