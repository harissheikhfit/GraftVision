-- REGION-001: versioned, clinic-owned scalp-region domain.
-- The region taxonomy is provisional and remains subject to clinical review.

create table public.scalp_region (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinic(id),
  patient_id uuid not null references public.patient(id),
  consultation_id uuid not null references public.consultation(id),
  region_code text not null check (region_code in ('frontal_recipient_region', 'mid_scalp_region', 'crown_region', 'left_temporal_region', 'right_temporal_region', 'donor_rear_region', 'donor_left_region', 'donor_right_region', 'exclusion_region')),
  current_version_id uuid,
  revision integer not null default 0 check (revision >= 0),
  lifecycle_state text not null default 'active' check (lifecycle_state in ('active', 'superseded', 'archived')),
  created_at timestamptz not null default clock_timestamp(),
  created_by uuid not null references public.platform_user(id),
  updated_at timestamptz not null default clock_timestamp(),
  updated_by uuid not null references public.platform_user(id),
  unique (clinic_id, id),
  unique (clinic_id, consultation_id, region_code),
  foreign key (clinic_id, consultation_id) references public.consultation(clinic_id, id)
);

create table public.scalp_region_version (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinic(id),
  patient_id uuid not null references public.patient(id),
  consultation_id uuid not null references public.consultation(id),
  scalp_region_id uuid not null,
  region_code text not null check (region_code in ('frontal_recipient_region', 'mid_scalp_region', 'crown_region', 'left_temporal_region', 'right_temporal_region', 'donor_rear_region', 'donor_left_region', 'donor_right_region', 'exclusion_region')),
  version_number integer not null check (version_number > 0),
  source_kind text not null check (source_kind in ('model', 'image', 'manual')),
  source_reference_id uuid,
  source_revision integer check (source_revision is null or source_revision > 0),
  coordinate_frame_version text not null check (coordinate_frame_version in ('graftvision-model-normalization-v1', 'graftvision-image-coordinate-v1', 'graftvision-manual-relative-v1')),
  authoring_method text not null check (authoring_method in ('manual_draw', 'doctor_corrected')),
  region_status text not null check (region_status in ('draft', 'review', 'approved', 'rejected', 'superseded')),
  supersedes_version_id uuid,
  created_at timestamptz not null default clock_timestamp(),
  created_by uuid not null references public.platform_user(id),
  unique (clinic_id, id),
  unique (scalp_region_id, version_number),
  foreign key (clinic_id, scalp_region_id) references public.scalp_region(clinic_id, id),
  foreign key (clinic_id, consultation_id) references public.consultation(clinic_id, id),
  foreign key (clinic_id, supersedes_version_id) references public.scalp_region_version(clinic_id, id),
  check ((source_kind = 'manual' and source_reference_id is null) or (source_kind in ('model', 'image') and source_reference_id is not null)),
  check ((source_kind = 'manual' and coordinate_frame_version = 'graftvision-manual-relative-v1') or (source_kind = 'model' and coordinate_frame_version = 'graftvision-model-normalization-v1') or (source_kind = 'image' and coordinate_frame_version = 'graftvision-image-coordinate-v1'))
);

create table public.scalp_region_geometry (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinic(id),
  scalp_region_version_id uuid not null,
  coordinate_frame_version text not null check (coordinate_frame_version in ('graftvision-model-normalization-v1', 'graftvision-image-coordinate-v1', 'graftvision-manual-relative-v1')),
  boundary_points jsonb not null check (jsonb_typeof(boundary_points) = 'array' and jsonb_array_length(boundary_points) between 4 and 128),
  geometry_status text not null check (geometry_status in ('valid', 'invalidated')),
  created_at timestamptz not null default clock_timestamp(),
  unique (clinic_id, scalp_region_version_id),
  foreign key (clinic_id, scalp_region_version_id) references public.scalp_region_version(clinic_id, id),
  check (coordinate_frame_version <> '')
);

create table public.scalp_region_idempotency (
  clinic_id uuid not null references public.clinic(id),
  actor_platform_user_id uuid not null references public.platform_user(id),
  request_family text not null check (request_family = 'save'),
  idempotency_key uuid not null,
  payload_hash text not null check (payload_hash ~ '^[a-f0-9]{64}$'),
  result_resource_id uuid not null,
  result_version_id uuid not null,
  result_revision integer not null check (result_revision > 0),
  created_at timestamptz not null default clock_timestamp(),
  primary key (clinic_id, actor_platform_user_id, request_family, idempotency_key)
);

create index scalp_region_context_idx on public.scalp_region(clinic_id, patient_id, consultation_id);
create index scalp_region_version_context_idx on public.scalp_region_version(clinic_id, consultation_id, region_code, version_number desc);

alter table public.scalp_region enable row level security;
alter table public.scalp_region force row level security;
alter table public.scalp_region_version enable row level security;
alter table public.scalp_region_version force row level security;
alter table public.scalp_region_geometry enable row level security;
alter table public.scalp_region_geometry force row level security;
alter table public.scalp_region_idempotency enable row level security;
alter table public.scalp_region_idempotency force row level security;
revoke all on public.scalp_region, public.scalp_region_version, public.scalp_region_geometry, public.scalp_region_idempotency from public, anon, authenticated;

create trigger scalp_region_controlled before insert or update or delete on public.scalp_region for each row execute function graftvision_private.enforce_controlled_consultation_mutation();
create trigger scalp_region_version_controlled before insert or update or delete on public.scalp_region_version for each row execute function graftvision_private.enforce_controlled_consultation_mutation();
create trigger scalp_region_geometry_controlled before insert or update or delete on public.scalp_region_geometry for each row execute function graftvision_private.enforce_controlled_consultation_mutation();
create trigger scalp_region_idempotency_controlled before insert or update or delete on public.scalp_region_idempotency for each row execute function graftvision_private.enforce_controlled_consultation_mutation();

create or replace function graftvision_private.is_valid_audit_action(candidate text)
returns boolean language sql immutable set search_path = '' as $$
  select candidate in (
    'audit.correct', 'audit.create', 'authority.cross_scope_denied', 'authority.scope_change',
    'authorization.version_increment', 'clinic.branding_conflict', 'clinic.branding_update',
    'clinic.branding_view', 'clinic.create', 'clinic.inactivate', 'clinic.onboarding_attest',
    'clinic.onboarding_blocked', 'clinic.onboarding_ready', 'clinic.onboarding_reopened',
    'clinic.read', 'clinic.reactivate', 'clinic.settings_conflict', 'clinic.settings_update',
    'clinic.settings_view', 'clinic.suspend', 'consultation.concurrency_conflict',
    'consultation.create', 'consultation.doctor_assign', 'consultation.doctor_reassign',
    'consultation.status_change', 'clinical_history.version_create', 'clinical_history.material_amend',
    'clinical_history.submit_review', 'clinical_history.doctor_review', 'clinical_history.amendment_request',
    'clinical_history.supersede', 'clinical_history.retract', 'doctor_private_note.create',
    'doctor_private_note.amend', 'doctor_private_note.retract', 'doctor_private_note.sensitive_read',
    'doctor.verification.expired', 'doctor.verification.pending', 'doctor.verification.rejected',
    'doctor.verification.revoked', 'doctor.verification.verified', 'invitation.accept', 'invitation.create',
    'invitation.resend', 'invitation.revoke', 'membership.create', 'membership.deactivate',
    'membership.read', 'membership.reactivate', 'membership.role_assign', 'membership.role_remove',
    'membership.suspend', 'patient.archive', 'patient.create', 'patient.duplicate_override',
    'patient.duplicate_warning', 'patient.privacy_acknowledge', 'patient.privacy_withdraw',
    'patient.registration_create', 'patient.restore', 'patient.status_change', 'platform.admin',
    'role.assign', 'role.remove', 'session.create', 'session.deny_inactive_user', 'session.end',
    'session.expire_absolute', 'session.expire_idle', 'session.lock', 'session.logout_after_lock',
    'session.reauthentication_failed', 'session.revoke_authorization_change', 'session.revoke_inactive_membership',
    'session.revoke_inactive_user', 'session.revoke_other', 'session.revoke_others', 'session.unlock',
    'storage_key.validate', 'system.migration', 'user.deactivate', 'user.reactivate',
    'preliminary_assessment.version_create', 'preliminary_assessment.doctor_review',
    'preliminary_assessment.supersede', 'preliminary_assessment.retract', 'consultation.complete',
    'consultation.reopen', 'planning.finalized', 'planning.invalidated', 'scan_session.create',
    'scan_session.complete', 'scan_session.expire', 'scan_session.pair', 'scan_session.revoke',
    'scan_session.transition', 'session.unlock', 'reconstruction.job_created', 'reconstruction.job_claimed',
    'reconstruction.job_progressed', 'reconstruction.job_retried', 'reconstruction.job_succeeded',
    'reconstruction.job_failed', 'reconstruction.job_cancelled', 'reconstruction.input_accessed',
    'reconstruction.asset_normalized', 'reconstruction.prepared_manifest_created',
    'reconstruction.preparation_failed', 'reconstruction.execution_started',
    'reconstruction.execution_succeeded', 'reconstruction.execution_failed',
    'reconstruction.artifact_recorded', 'reconstruction.output_manifest_created', 'region.version_created'
  );
$$;

create or replace function graftvision_private.is_valid_audit_resource_type(candidate text)
returns boolean language sql immutable set search_path = '' as $$
  select candidate in (
    'audit_event', 'application_session', 'clinic', 'clinic_invitation', 'clinic_membership',
    'clinic_membership_role', 'consultation', 'consultation_assignment', 'clinical_history',
    'doctor_private_note', 'doctor_verification', 'patient', 'patient_privacy_acknowledgement',
    'platform_user', 'platform_user_role', 'storage_object_key', 'system', 'preliminary_assessment',
    'consultation_lifecycle_event', 'planning_package', 'scan_session', 'reconstruction_job',
    'reconstruction_input_manifest', 'reconstruction_prepared_asset', 'reconstruction_prepared_manifest',
    'reconstruction_output_manifest', 'reconstruction_artifact', 'reconstruction_preview',
    'scalp_region', 'scalp_region_version'
  );
$$;

create or replace function graftvision_private.save_scalp_region(
  p_session_id uuid, p_provider_identity_id uuid, p_consultation_id uuid, p_region_id uuid,
  p_region_code text, p_source_kind text, p_source_reference_id uuid, p_source_revision integer,
  p_coordinate_frame_version text, p_authoring_method text, p_region_status text,
  p_boundary_points jsonb, p_expected_revision integer, p_idempotency_key uuid
) returns table (region_id uuid, region_version_id uuid, revision integer, is_new boolean)
language plpgsql security definer set search_path = '' as $$
declare
  v_context record;
  v_consultation public.consultation%rowtype;
  v_region public.scalp_region%rowtype;
  v_existing public.scalp_region_idempotency%rowtype;
  v_version_id uuid;
  v_hash text;
  v_revision integer;
  v_count integer;
begin
  select * into strict v_context from graftvision_private.require_active_application_session(p_session_id, p_provider_identity_id);
  select * into strict v_consultation from public.consultation where id = p_consultation_id and clinic_id = v_context.clinic_id;
  if not graftvision_private.is_assigned_verified_doctor(p_session_id, p_provider_identity_id, p_consultation_id, 'CONSULT-PERM-001') then
    raise exception using errcode = '42501', message = 'REGION_ACCESS_DENIED';
  end if;
  if p_idempotency_key is null then raise exception using errcode = '22023', message = 'REGION_IDEMPOTENCY_REQUIRED'; end if;
  if p_region_code not in ('frontal_recipient_region', 'mid_scalp_region', 'crown_region', 'left_temporal_region', 'right_temporal_region', 'donor_rear_region', 'donor_left_region', 'donor_right_region', 'exclusion_region')
    or p_source_kind not in ('model', 'image', 'manual')
    or p_coordinate_frame_version not in ('graftvision-model-normalization-v1', 'graftvision-image-coordinate-v1', 'graftvision-manual-relative-v1')
    or p_authoring_method not in ('manual_draw', 'doctor_corrected')
    or p_region_status not in ('draft', 'review')
    or jsonb_typeof(p_boundary_points) <> 'array' then
    raise exception using errcode = '22023', message = 'REGION_INVALID';
  end if;
  if (p_source_kind = 'manual' and p_source_reference_id is not null) or (p_source_kind in ('model', 'image') and p_source_reference_id is null)
    or (p_source_kind = 'manual' and p_coordinate_frame_version <> 'graftvision-manual-relative-v1')
    or (p_source_kind = 'model' and p_coordinate_frame_version <> 'graftvision-model-normalization-v1')
    or (p_source_kind = 'image' and p_coordinate_frame_version <> 'graftvision-image-coordinate-v1') then
    raise exception using errcode = '22023', message = 'REGION_SOURCE_INVALID';
  end if;
  v_count := jsonb_array_length(p_boundary_points);
  if v_count < 4 or v_count > 128 or exists (select 1 from jsonb_array_elements(p_boundary_points) x where jsonb_typeof(x) <> 'object' or x->>'id' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' or x->>'order_index' !~ '^(0|[1-9][0-9]*)$' or x->>'x' !~ '^-?(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)$' or x->>'y' !~ '^-?(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)$' or x->>'z' !~ '^-?(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)$' or (x->>'x')::numeric not between -2 and 2 or (x->>'y')::numeric not between -2 and 2 or (x->>'z')::numeric not between -2 and 2) or (select count(distinct x->>'id') from jsonb_array_elements(p_boundary_points) x) <> v_count or (select count(distinct (x->>'order_index')::integer) from jsonb_array_elements(p_boundary_points) x) <> v_count or (select min((x->>'order_index')::integer) from jsonb_array_elements(p_boundary_points) x) <> 0 or (select max((x->>'order_index')::integer) from jsonb_array_elements(p_boundary_points) x) <> v_count - 1 then
    raise exception using errcode = '22023', message = 'REGION_GEOMETRY_INVALID';
  end if;
  v_hash := encode(extensions.digest(concat_ws(':', coalesce(p_region_id::text, 'new'), p_consultation_id, p_region_code, p_source_kind, coalesce(p_source_reference_id::text, ''), coalesce(p_source_revision::text, ''), p_coordinate_frame_version, p_authoring_method, p_region_status, p_boundary_points::text, p_expected_revision), 'sha256'), 'hex');
  select * into v_existing from public.scalp_region_idempotency where clinic_id = v_context.clinic_id and actor_platform_user_id = v_context.actor_id and request_family = 'save' and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.payload_hash <> v_hash then raise exception using errcode = '40001', message = 'REGION_IDEMPOTENCY_MISMATCH'; end if;
    return query select v_existing.result_resource_id, v_existing.result_version_id, v_existing.result_revision, false;
    return;
  end if;

  perform set_config('graftvision.consultation_controlled', 'on', true);
  if p_region_id is null then
    if p_expected_revision <> 0 then raise exception using errcode = '40001', message = 'REGION_REVISION_CONFLICT'; end if;
    insert into public.scalp_region (clinic_id, patient_id, consultation_id, region_code, created_by, updated_by)
    values (v_context.clinic_id, v_consultation.patient_id, p_consultation_id, p_region_code, v_context.actor_id, v_context.actor_id)
    returning * into v_region;
    v_revision := 1;
  else
    select * into strict v_region from public.scalp_region where id = p_region_id for update;
    if v_region.clinic_id <> v_context.clinic_id or v_region.consultation_id <> p_consultation_id or v_region.region_code <> p_region_code then raise exception using errcode = '42501', message = 'REGION_ACCESS_DENIED'; end if;
    if v_region.revision <> p_expected_revision then raise exception using errcode = '40001', message = 'REGION_REVISION_CONFLICT'; end if;
    v_revision := v_region.revision + 1;
  end if;

  insert into public.scalp_region_version (clinic_id, patient_id, consultation_id, scalp_region_id, region_code, version_number, source_kind, source_reference_id, source_revision, coordinate_frame_version, authoring_method, region_status, supersedes_version_id, created_by)
  values (v_context.clinic_id, v_region.patient_id, p_consultation_id, v_region.id, p_region_code, v_revision, p_source_kind, p_source_reference_id, p_source_revision, p_coordinate_frame_version, p_authoring_method, p_region_status, v_region.current_version_id, v_context.actor_id)
  returning id into v_version_id;
  insert into public.scalp_region_geometry (clinic_id, scalp_region_version_id, coordinate_frame_version, boundary_points, geometry_status)
  values (v_context.clinic_id, v_version_id, p_coordinate_frame_version, p_boundary_points, 'valid');
-- graftvision:dangerous-sql-approved task=REGION-001
-- graftvision:dangerous-sql-reason Controlled row lock and exact revision update prevent silent last-write-wins for clinical region lineage.
-- graftvision:corrective-plan Forward-fix through an additive migration; immutable region versions, geometry, and audit history remain preserved.
  update public.scalp_region set current_version_id = v_version_id, revision = v_revision, updated_at = clock_timestamp(), updated_by = v_context.actor_id where id = v_region.id;
  insert into public.audit_event (audit_scope, clinic_id, actor_platform_user_id, actor_type, action, resource_type, resource_id, outcome, request_id, source_application, metadata)
  values ('clinic', v_context.clinic_id, v_context.actor_id, 'user', 'region.version_created', 'scalp_region', v_region.id, 'success', p_idempotency_key, 'web', jsonb_build_object('new_status', p_region_status, 'route_family', p_region_code));
  insert into public.scalp_region_idempotency (clinic_id, actor_platform_user_id, request_family, idempotency_key, payload_hash, result_resource_id, result_version_id, result_revision)
  values (v_context.clinic_id, v_context.actor_id, 'save', p_idempotency_key, v_hash, v_region.id, v_version_id, v_revision);
  return query select v_region.id, v_version_id, v_revision, true;
end;
$$;

revoke all on function graftvision_private.save_scalp_region(uuid, uuid, uuid, uuid, text, text, uuid, integer, text, text, text, jsonb, integer, uuid) from public, anon, authenticated;