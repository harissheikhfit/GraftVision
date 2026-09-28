-- GraftVision migration
-- Task: CONSULT-003
-- Purpose: Add versioned synthetic-only medical/hair-loss history and Doctor-private notes.
-- Compatibility: Additive only. No roles or permissions are added or remapped.
-- Production: Real-patient use remains blocked by DOC-009 and DOC-010.

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
    'consultation.status_change', 'clinical_history.version_create',
    'clinical_history.material_amend', 'clinical_history.submit_review',
    'clinical_history.doctor_review', 'clinical_history.amendment_request',
    'clinical_history.supersede', 'clinical_history.retract',
    'doctor_private_note.create', 'doctor_private_note.amend',
    'doctor_private_note.retract', 'doctor_private_note.sensitive_read',
    'doctor.verification.expired', 'doctor.verification.pending',
    'doctor.verification.rejected', 'doctor.verification.revoked',
    'doctor.verification.verified', 'invitation.accept', 'invitation.create',
    'invitation.resend', 'invitation.revoke', 'membership.create',
    'membership.deactivate', 'membership.read', 'membership.reactivate',
    'membership.role_assign', 'membership.role_remove', 'membership.suspend',
    'patient.archive', 'patient.create', 'patient.duplicate_override',
    'patient.duplicate_warning', 'patient.privacy_acknowledge',
    'patient.privacy_withdraw', 'patient.registration_create', 'patient.restore',
    'patient.status_change', 'platform.admin', 'role.assign', 'role.remove',
    'session.create', 'session.deny_inactive_user', 'session.end',
    'session.expire_absolute', 'session.expire_idle', 'session.lock',
    'session.logout_after_lock', 'session.reauthentication_failed',
    'session.revoke_authorization_change', 'session.revoke_inactive_membership',
    'session.revoke_inactive_user', 'session.revoke_other',
    'session.revoke_others', 'session.unlock', 'storage_key.validate',
    'system.migration', 'user.deactivate', 'user.reactivate'
  );
$$;

create or replace function graftvision_private.is_valid_audit_resource_type(candidate text)
returns boolean language sql immutable set search_path = '' as $$
  select candidate in (
    'audit_event', 'application_session', 'clinic', 'clinic_invitation',
    'clinic_membership', 'clinic_membership_role', 'consultation',
    'consultation_assignment', 'clinical_history', 'doctor_private_note',
    'doctor_verification', 'patient', 'patient_privacy_acknowledgement',
    'platform_user', 'platform_user_role', 'storage_object_key', 'system'
  );
$$;

create table public.patient_medical_history (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null,
  patient_id uuid not null,
  current_version_id uuid,
  revision integer not null default 0 check (revision >= 0),
  review_state text not null default 'draft' check (review_state in (
    'draft', 'submitted_for_review', 'doctor_reviewed', 'amendment_required',
    'superseded', 'retracted'
  )),
  updated_at timestamptz not null default clock_timestamp(),
  updated_by uuid not null references public.platform_user(id),
  unique (clinic_id, id),
  unique (clinic_id, patient_id),
  foreign key (clinic_id, patient_id) references public.patient(clinic_id, id)
);

create table public.patient_medical_history_version (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null,
  history_id uuid not null,
  patient_id uuid not null,
  version integer not null check (version > 0),
  supersedes_version_id uuid,
  medical_condition_status text not null check (medical_condition_status in (
    'no_known_significant_condition', 'condition_reported', 'uncertain', 'not_assessed'
  )),
  medical_condition_clarification text check (
    medical_condition_clarification is null or char_length(medical_condition_clarification) <= 500
  ),
  allergy_status text not null check (allergy_status in (
    'none_reported', 'allergy_reported', 'uncertain', 'not_assessed'
  )),
  allergy_substance text check (allergy_substance is null or char_length(allergy_substance) <= 500),
  medication_status text not null check (medication_status in (
    'none_reported', 'medication_reported', 'uncertain', 'not_assessed'
  )),
  medication_name text check (medication_name is null or char_length(medication_name) <= 500),
  previous_operation_status text not null check (previous_operation_status in (
    'none_reported', 'procedure_reported', 'uncertain', 'not_assessed'
  )),
  anaesthesia_issue_status text not null check (anaesthesia_issue_status in (
    'none_reported', 'issue_reported', 'uncertain', 'not_assessed'
  )),
  bleeding_concern_status text not null check (bleeding_concern_status in (
    'none_reported', 'concern_reported', 'uncertain', 'not_assessed'
  )),
  healing_concern_status text not null check (healing_concern_status in (
    'none_reported', 'concern_reported', 'uncertain', 'not_assessed'
  )),
  source_code text not null check (source_code in (
    'patient_reported', 'caregiver_reported', 'prior_record', 'clinician_observed',
    'clinician_measured', 'device_generated', 'imported', 'system_suggested', 'unknown'
  )),
  certainty_code text not null check (certainty_code in (
    'reported', 'observed', 'measured', 'documented', 'verified',
    'uncertain', 'not_assessed', 'contradicted'
  )),
  warning_codes text[] not null default '{}',
  section_summary text check (section_summary is null or char_length(section_summary) <= 1500),
  material_change boolean not null,
  created_at timestamptz not null default clock_timestamp(),
  created_by uuid not null references public.platform_user(id),
  unique (clinic_id, history_id, version),
  unique (clinic_id, id),
  foreign key (clinic_id, history_id) references public.patient_medical_history(clinic_id, id),
  foreign key (clinic_id, patient_id) references public.patient(clinic_id, id),
  check (
    warning_codes <@ array[
      'cardiovascular_concern', 'blood_pressure_concern',
      'diabetes_glucose_control_concern', 'immune_inflammatory_concern',
      'active_infection_concern', 'active_scalp_disorder_concern',
      'bleeding_clotting_concern', 'anaesthesia_concern',
      'psychiatric_expectation_concern', 'other_doctor_reviewed_concern'
    ]::text[]
  ),
  check (
    (allergy_status = 'allergy_reported' and nullif(btrim(allergy_substance), '') is not null)
    or (allergy_status <> 'allergy_reported' and allergy_substance is null)
  ),
  check (
    (medication_status = 'medication_reported' and nullif(btrim(medication_name), '') is not null)
    or (medication_status <> 'medication_reported' and medication_name is null)
  )
);

alter table public.patient_medical_history
  add constraint patient_medical_history_current_version_fk
  foreign key (clinic_id, current_version_id)
  references public.patient_medical_history_version(clinic_id, id);

create table public.consultation_hair_loss_history (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null,
  consultation_id uuid not null,
  current_version_id uuid,
  revision integer not null default 0 check (revision >= 0),
  review_state text not null default 'draft' check (review_state in (
    'draft', 'submitted_for_review', 'doctor_reviewed', 'amendment_required',
    'superseded', 'retracted'
  )),
  updated_at timestamptz not null default clock_timestamp(),
  updated_by uuid not null references public.platform_user(id),
  unique (clinic_id, id),
  unique (clinic_id, consultation_id),
  foreign key (clinic_id, consultation_id) references public.consultation(clinic_id, id)
);

create table public.consultation_hair_loss_history_version (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null,
  history_id uuid not null,
  consultation_id uuid not null,
  version integer not null check (version > 0),
  supersedes_version_id uuid,
  primary_concern text not null check (primary_concern in (
    'frontal_recession', 'temporal_recession', 'frontal_thinning',
    'mid_scalp_thinning', 'crown_thinning', 'diffuse_thinning', 'patchy_loss',
    'donor_area_thinning', 'hairline_shape_concern', 'previous_transplant_concern',
    'other', 'uncertain'
  )),
  onset_kind text not null check (onset_kind in ('age', 'year', 'uncertain')),
  onset_value integer,
  progression text not null check (progression in (
    'stable', 'slowly_progressive', 'rapidly_progressive', 'episodic',
    'improved', 'uncertain', 'not_assessed'
  )),
  previous_hair_procedure_status text not null check (previous_hair_procedure_status in (
    'none_reported', 'procedure_reported', 'uncertain', 'not_assessed'
  )),
  pattern_classification text not null check (pattern_classification in (
    'hamilton_norwood', 'ludwig', 'christmas_tree',
    'other_clinician_defined', 'unclassified', 'uncertain'
  )),
  scalp_symptom_status text not null check (scalp_symptom_status in (
    'none_reported', 'symptoms_reported', 'uncertain', 'not_assessed'
  )),
  scalp_symptom_codes text[] not null default '{}',
  patient_goal_codes text[] not null default '{}',
  source_code text not null check (source_code in (
    'patient_reported', 'caregiver_reported', 'prior_record', 'clinician_observed',
    'clinician_measured', 'device_generated', 'imported', 'system_suggested', 'unknown'
  )),
  certainty_code text not null check (certainty_code in (
    'reported', 'observed', 'measured', 'documented', 'verified',
    'uncertain', 'not_assessed', 'contradicted'
  )),
  section_clarification text check (
    section_clarification is null or char_length(section_clarification) <= 1500
  ),
  material_change boolean not null,
  created_at timestamptz not null default clock_timestamp(),
  created_by uuid not null references public.platform_user(id),
  unique (clinic_id, history_id, version),
  unique (clinic_id, id),
  foreign key (clinic_id, history_id) references public.consultation_hair_loss_history(clinic_id, id),
  foreign key (clinic_id, consultation_id) references public.consultation(clinic_id, id),
  check (
    (onset_kind = 'uncertain' and onset_value is null)
    or (onset_kind = 'age' and onset_value between 0 and 120)
    or (onset_kind = 'year' and onset_value between 1900 and 2100)
  ),
  check (
    scalp_symptom_codes <@ array[
      'itching', 'pain_tenderness', 'burning', 'scaling_flaking', 'redness',
      'pustules_discharge', 'crusting', 'scarring'
    ]::text[]
  ),
  check (
    patient_goal_codes <@ array[
      'restore_frontal_hairline', 'increase_frontal_density',
      'improve_mid_scalp_density', 'improve_crown_coverage',
      'repair_previous_transplant', 'improve_temporal_points',
      'preserve_donor_area', 'understand_candidacy',
      'understand_realistic_options', 'other'
    ]::text[]
  ),
  check (
    (scalp_symptom_status = 'symptoms_reported' and cardinality(scalp_symptom_codes) > 0)
    or (scalp_symptom_status <> 'symptoms_reported' and cardinality(scalp_symptom_codes) = 0)
  )
);

alter table public.consultation_hair_loss_history
  add constraint consultation_hair_history_current_version_fk
  foreign key (clinic_id, current_version_id)
  references public.consultation_hair_loss_history_version(clinic_id, id);

create table public.consultation_history_binding (
  clinic_id uuid not null,
  consultation_id uuid not null,
  medical_history_version_id uuid not null,
  hair_loss_history_version_id uuid not null,
  bound_at timestamptz not null default clock_timestamp(),
  bound_by uuid not null references public.platform_user(id),
  primary key (clinic_id, consultation_id),
  foreign key (clinic_id, consultation_id) references public.consultation(clinic_id, id),
  foreign key (clinic_id, medical_history_version_id)
    references public.patient_medical_history_version(clinic_id, id),
  foreign key (clinic_id, hair_loss_history_version_id)
    references public.consultation_hair_loss_history_version(clinic_id, id)
);

create table public.clinical_history_change_event (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null,
  consultation_id uuid not null,
  aggregate_type text not null check (aggregate_type in ('medical_history', 'hair_loss_history')),
  version_id uuid not null,
  material_change boolean not null,
  downstream_stale boolean not null,
  changed_section_codes text[] not null,
  actor_platform_user_id uuid not null references public.platform_user(id),
  occurred_at timestamptz not null default clock_timestamp(),
  foreign key (clinic_id, consultation_id) references public.consultation(clinic_id, id)
);

create table public.clinical_history_review_event (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null,
  consultation_id uuid not null,
  aggregate_type text not null check (aggregate_type in ('medical_history', 'hair_loss_history')),
  version_id uuid not null,
  previous_state text not null,
  new_state text not null check (new_state in (
    'submitted_for_review', 'doctor_reviewed', 'amendment_required', 'retracted'
  )),
  reason_code text not null check (reason_code ~ '^[A-Z][A-Z0-9_]{2,63}$'),
  actor_platform_user_id uuid not null references public.platform_user(id),
  occurred_at timestamptz not null default clock_timestamp(),
  foreign key (clinic_id, consultation_id) references public.consultation(clinic_id, id)
);

create table public.doctor_private_note (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null,
  consultation_id uuid not null,
  author_platform_user_id uuid not null references public.platform_user(id),
  current_version_id uuid,
  revision integer not null default 0 check (revision >= 0),
  status text not null default 'active' check (status in ('active', 'retracted')),
  updated_at timestamptz not null default clock_timestamp(),
  unique (clinic_id, id),
  foreign key (clinic_id, consultation_id) references public.consultation(clinic_id, id)
);

create table public.doctor_private_note_version (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null,
  note_id uuid not null,
  consultation_id uuid not null,
  version integer not null check (version > 0),
  supersedes_version_id uuid,
  note_text text not null check (char_length(note_text) between 1 and 3000),
  action_code text not null check (action_code in ('created', 'amended', 'retracted')),
  reason_code text,
  created_at timestamptz not null default clock_timestamp(),
  created_by uuid not null references public.platform_user(id),
  unique (clinic_id, note_id, version),
  unique (clinic_id, id),
  foreign key (clinic_id, note_id) references public.doctor_private_note(clinic_id, id),
  foreign key (clinic_id, consultation_id) references public.consultation(clinic_id, id),
  check (
    (action_code = 'retracted' and reason_code ~ '^[A-Z][A-Z0-9_]{2,63}$')
    or (action_code <> 'retracted' and reason_code is null)
  )
);

alter table public.doctor_private_note
  add constraint doctor_private_note_current_version_fk
  foreign key (clinic_id, current_version_id)
  references public.doctor_private_note_version(clinic_id, id);

create table public.clinical_operation_idempotency (
  clinic_id uuid not null,
  actor_platform_user_id uuid not null references public.platform_user(id),
  aggregate_id uuid not null,
  request_family text not null,
  idempotency_key uuid not null,
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  result_resource_id uuid not null,
  result_version_id uuid not null,
  result_revision integer not null check (result_revision > 0),
  result_status text not null,
  created_at timestamptz not null default clock_timestamp(),
  primary key (clinic_id, actor_platform_user_id, aggregate_id, request_family, idempotency_key)
);

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'patient_medical_history', 'patient_medical_history_version',
    'consultation_hair_loss_history', 'consultation_hair_loss_history_version',
    'consultation_history_binding', 'clinical_history_change_event',
    'clinical_history_review_event', 'doctor_private_note',
    'doctor_private_note_version', 'clinical_operation_idempotency'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format('revoke all on table public.%I from public, anon, authenticated', table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated using (false) with check (false)',
      table_name || '_deny_direct', table_name
    );
  end loop;
end;
$$;

create function graftvision_private.prevent_clinical_immutable_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception using errcode = '42501', message = 'CLINICAL_HISTORY_IMMUTABLE';
end;
$$;
revoke all on function graftvision_private.prevent_clinical_immutable_mutation()
  from public, anon, authenticated;

create trigger medical_version_immutable before update or delete
on public.patient_medical_history_version for each row
execute function graftvision_private.prevent_clinical_immutable_mutation();
create trigger hair_version_immutable before update or delete
on public.consultation_hair_loss_history_version for each row
execute function graftvision_private.prevent_clinical_immutable_mutation();
create trigger clinical_change_immutable before update or delete
on public.clinical_history_change_event for each row
execute function graftvision_private.prevent_clinical_immutable_mutation();
create trigger clinical_review_immutable before update or delete
on public.clinical_history_review_event for each row
execute function graftvision_private.prevent_clinical_immutable_mutation();
create trigger private_note_version_immutable before update or delete
on public.doctor_private_note_version for each row
execute function graftvision_private.prevent_clinical_immutable_mutation();
create trigger clinical_idempotency_immutable before update or delete
on public.clinical_operation_idempotency for each row
execute function graftvision_private.prevent_clinical_immutable_mutation();

create function graftvision_private.clinical_context(
  p_session_id uuid, p_actor_id uuid, p_consultation_id uuid, p_permission_id text
)
returns table (clinic_id uuid, patient_id uuid, status text)
language sql stable security definer set search_path = '' as $$
  select c.clinic_id, c.patient_id, c.status
  from public.consultation c
  join public.patient p on p.clinic_id = c.clinic_id and p.id = c.patient_id
  join public.application_session s
    on s.id = p_session_id and s.platform_user_id = p_actor_id
    and s.authority_scope = 'clinic' and s.clinic_id = c.clinic_id
  where c.id = p_consultation_id
    and c.status not in ('completed', 'cancelled')
    and p.lifecycle_state = 'current'
    and graftvision_private.is_clinic_ready(c.clinic_id)
    and graftvision_private.has_application_session_permission(
      p_session_id, p_actor_id, 'clinic', c.clinic_id, p_permission_id
    );
$$;
revoke all on function graftvision_private.clinical_context(uuid, uuid, uuid, text)
  from public, anon, authenticated;

create function graftvision_private.is_assigned_verified_doctor(
  p_session_id uuid, p_actor_id uuid, p_consultation_id uuid, p_permission_id text
)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from graftvision_private.clinical_context(
      p_session_id, p_actor_id, p_consultation_id, p_permission_id
    ) x
    join public.consultation_assignment ca
      on ca.clinic_id = x.clinic_id and ca.consultation_id = p_consultation_id
    join public.clinic_membership m
      on m.clinic_id = x.clinic_id and m.platform_user_id = p_actor_id
    join public.clinic_membership_role mr
      on mr.clinic_membership_id = m.id and mr.role_code = 'DOCTOR'
    join public.doctor_verification dv
      on dv.clinic_id = x.clinic_id and dv.platform_user_id = p_actor_id
    where ca.doctor_platform_user_id = p_actor_id
      and m.membership_status = 'active'
      and dv.status = 'verified' and dv.expires_at > clock_timestamp()
  );
$$;
revoke all on function graftvision_private.is_assigned_verified_doctor(uuid, uuid, uuid, text)
  from public, anon, authenticated;

create function graftvision_private.save_patient_medical_history(
  p_session_id uuid, p_actor_id uuid, p_consultation_id uuid,
  p_expected_revision integer, p_idempotency_key uuid,
  p_medical_condition_status text, p_medical_condition_clarification text,
  p_allergy_status text, p_allergy_substance text,
  p_medication_status text, p_medication_name text,
  p_previous_operation_status text, p_anaesthesia_issue_status text,
  p_bleeding_concern_status text, p_healing_concern_status text,
  p_source_code text, p_certainty_code text, p_warning_codes text[],
  p_section_summary text
)
returns table (
  outcome_code text, history_id uuid, version_id uuid, revision integer,
  review_state text, material_change boolean, changed_fields text[]
)
language plpgsql security definer set search_path = '' as $$
declare
  v_context record; v_root public.patient_medical_history%rowtype;
  v_previous public.patient_medical_history_version%rowtype;
  v_payload_hash text; v_existing public.clinical_operation_idempotency%rowtype;
  v_history_id uuid; v_version_id uuid := gen_random_uuid(); v_material boolean := false;
begin
  select * into v_context from graftvision_private.clinical_context(
    p_session_id, p_actor_id, p_consultation_id, 'CONSULT-PERM-001'
  );
  if not found or not graftvision_private.has_application_session_permission(
    p_session_id, p_actor_id, 'clinic', v_context.clinic_id, 'PATIENT-PERM-002'
  ) then raise exception using errcode = '42501', message = 'CLINICAL_HISTORY_ACCESS_DENIED'; end if;
  if p_idempotency_key is null then raise exception using errcode = '22023', message = 'IDEMPOTENCY_REQUIRED'; end if;
  v_payload_hash := encode(digest(concat_ws('|', p_consultation_id, p_medical_condition_status,
    coalesce(p_medical_condition_clarification,''), p_allergy_status, coalesce(p_allergy_substance,''),
    p_medication_status, coalesce(p_medication_name,''), p_previous_operation_status,
    p_anaesthesia_issue_status, p_bleeding_concern_status, p_healing_concern_status,
    p_source_code, p_certainty_code, array_to_string(p_warning_codes,','), coalesce(p_section_summary,'')), 'sha256'), 'hex');
  select * into v_existing from public.clinical_operation_idempotency
  where clinic_id = v_context.clinic_id and actor_platform_user_id = p_actor_id
    and aggregate_id = v_context.patient_id and request_family = 'medical_history.save'
    and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.payload_hash <> v_payload_hash then raise exception using errcode = '22023', message = 'IDEMPOTENCY_PAYLOAD_MISMATCH'; end if;
    return query select 'success', v_existing.result_resource_id, v_existing.result_version_id,
      v_existing.result_revision, v_existing.result_status, false, array[]::text[]; return;
  end if;
  select * into v_root from public.patient_medical_history
  where clinic_id = v_context.clinic_id and patient_id = v_context.patient_id for update;
  if not found then
    if p_expected_revision <> 0 then return query select 'stale_revision', null::uuid, null::uuid, 0, 'draft', false, array['medical_history']::text[]; return; end if;
    v_history_id := gen_random_uuid();
    insert into public.patient_medical_history(id, clinic_id, patient_id, updated_by)
    values(v_history_id, v_context.clinic_id, v_context.patient_id, p_actor_id);
    v_root.revision := 0; v_root.review_state := 'draft'; v_root.current_version_id := null;
  else
    v_history_id := v_root.id;
    if v_root.revision <> p_expected_revision then
      return query select 'stale_revision', v_root.id, v_root.current_version_id,
        v_root.revision, v_root.review_state, false, array['medical_history']::text[]; return;
    end if;
    select * into v_previous from public.patient_medical_history_version
      where id = v_root.current_version_id;
    v_material := v_previous.medical_condition_status is distinct from p_medical_condition_status
      or v_previous.allergy_status is distinct from p_allergy_status
      or v_previous.allergy_substance is distinct from p_allergy_substance
      or v_previous.medication_status is distinct from p_medication_status
      or v_previous.medication_name is distinct from p_medication_name
      or v_previous.previous_operation_status is distinct from p_previous_operation_status
      or v_previous.anaesthesia_issue_status is distinct from p_anaesthesia_issue_status
      or v_previous.bleeding_concern_status is distinct from p_bleeding_concern_status
      or v_previous.healing_concern_status is distinct from p_healing_concern_status
      or v_previous.source_code is distinct from p_source_code
      or v_previous.certainty_code is distinct from p_certainty_code
      or v_previous.warning_codes is distinct from p_warning_codes;
  end if;
  insert into public.patient_medical_history_version values (
    v_version_id, v_context.clinic_id, v_history_id, v_context.patient_id, v_root.revision + 1,
    v_root.current_version_id, p_medical_condition_status, nullif(btrim(p_medical_condition_clarification),''),
    p_allergy_status, nullif(btrim(p_allergy_substance),''), p_medication_status,
    nullif(btrim(p_medication_name),''), p_previous_operation_status, p_anaesthesia_issue_status,
    p_bleeding_concern_status, p_healing_concern_status, p_source_code, p_certainty_code,
    coalesce(p_warning_codes,'{}'), nullif(btrim(p_section_summary),''), v_material,
    clock_timestamp(), p_actor_id
  );
-- graftvision:dangerous-sql-approved task=CONSULT-003
-- graftvision:dangerous-sql-reason Root-pointer progression for immutable versioning
-- graftvision:corrective-plan Immutability triggers prevent modification; pointer updates only change current version
  update public.patient_medical_history set current_version_id = v_version_id,
    revision = v_root.revision + 1,
    review_state = case when v_material and v_root.review_state = 'doctor_reviewed'
      then 'amendment_required' else 'draft' end,
    updated_at = clock_timestamp(), updated_by = p_actor_id where id = v_history_id;
  insert into public.consultation_history_binding(
    clinic_id, consultation_id, medical_history_version_id, hair_loss_history_version_id, bound_by
  )
  select v_context.clinic_id, p_consultation_id, v_version_id, h.current_version_id, p_actor_id
  from public.consultation_hair_loss_history h
  where h.clinic_id = v_context.clinic_id and h.consultation_id = p_consultation_id
  on conflict (clinic_id, consultation_id) do update
    set medical_history_version_id = excluded.medical_history_version_id,
        bound_at = clock_timestamp(), bound_by = excluded.bound_by;
  insert into public.clinical_history_change_event values (
    gen_random_uuid(), v_context.clinic_id, p_consultation_id, 'medical_history',
    v_version_id, v_material, v_material,
    array['medical_conditions','allergies','medications','procedures','safety'],
    p_actor_id, clock_timestamp()
  );
  insert into public.clinical_operation_idempotency(
    clinic_id, actor_platform_user_id, aggregate_id, request_family, idempotency_key,
    payload_hash, result_resource_id, result_version_id, result_revision, result_status
  ) values (
    v_context.clinic_id, p_actor_id, v_context.patient_id, 'medical_history.save',
    p_idempotency_key, v_payload_hash, v_history_id, v_version_id,
    v_root.revision + 1, 'draft'
  );
  insert into public.audit_event(
    audit_scope, clinic_id, actor_platform_user_id, actor_type, action, resource_type,
    resource_id, outcome, request_id, source_application, metadata
  ) values (
    'clinic', v_context.clinic_id, p_actor_id, 'user',
    case when v_material then 'clinical_history.material_amend' else 'clinical_history.version_create' end,
    'clinical_history', v_history_id, 'success', p_idempotency_key, 'database',
    jsonb_build_object('new_version', v_root.revision + 1,
      'changed_fields', array['medical_conditions','allergies','medications','procedures','safety'])
  );
  return query select 'success', v_history_id, v_version_id, v_root.revision + 1,
    case when v_material and v_root.review_state = 'doctor_reviewed' then 'amendment_required' else 'draft' end,
    v_material, array['medical_conditions','allergies','medications','procedures','safety']::text[];
end;
$$;

revoke all on function graftvision_private.save_patient_medical_history(
  uuid,uuid,uuid,integer,uuid,text,text,text,text,text,text,text,text,text,text,text,text,text[],text
) from public, anon, authenticated;

-- Hair-loss saves use a bounded typed JSON projection at the function boundary only; JSON is not stored.
create function graftvision_private.save_consultation_hair_loss_history(
  p_session_id uuid, p_actor_id uuid, p_consultation_id uuid,
  p_expected_revision integer, p_idempotency_key uuid,
  p_primary_concern text, p_onset_kind text, p_onset_value integer,
  p_progression text, p_previous_hair_procedure_status text,
  p_pattern_classification text, p_scalp_symptom_status text,
  p_scalp_symptom_codes text[], p_patient_goal_codes text[],
  p_source_code text, p_certainty_code text, p_section_clarification text
)
returns table (
  outcome_code text, history_id uuid, version_id uuid, revision integer,
  review_state text, material_change boolean, changed_fields text[]
)
language plpgsql security definer set search_path = '' as $$
declare
  v_context record; v_root public.consultation_hair_loss_history%rowtype;
  v_previous public.consultation_hair_loss_history_version%rowtype;
  v_payload_hash text; v_existing public.clinical_operation_idempotency%rowtype;
  v_history_id uuid; v_version_id uuid := gen_random_uuid(); v_material boolean := false;
begin
  select * into v_context from graftvision_private.clinical_context(
    p_session_id, p_actor_id, p_consultation_id, 'CONSULT-PERM-001'
  );
  if not found or not graftvision_private.has_application_session_permission(
    p_session_id, p_actor_id, 'clinic', v_context.clinic_id, 'PATIENT-PERM-002'
  ) then raise exception using errcode = '42501', message = 'CLINICAL_HISTORY_ACCESS_DENIED'; end if;
  v_payload_hash := encode(digest(concat_ws('|', p_consultation_id, p_primary_concern,
    p_onset_kind, coalesce(p_onset_value::text,''), p_progression,
    p_previous_hair_procedure_status, p_pattern_classification, p_scalp_symptom_status,
    array_to_string(p_scalp_symptom_codes,','), array_to_string(p_patient_goal_codes,','),
    p_source_code, p_certainty_code, coalesce(p_section_clarification,'')), 'sha256'), 'hex');
  select * into v_existing from public.clinical_operation_idempotency
  where clinic_id = v_context.clinic_id and actor_platform_user_id = p_actor_id
    and aggregate_id = p_consultation_id and request_family = 'hair_loss_history.save'
    and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.payload_hash <> v_payload_hash then raise exception using errcode = '22023', message = 'IDEMPOTENCY_PAYLOAD_MISMATCH'; end if;
    return query select 'success', v_existing.result_resource_id, v_existing.result_version_id,
      v_existing.result_revision, v_existing.result_status, false, array[]::text[]; return;
  end if;
  select * into v_root from public.consultation_hair_loss_history
    where clinic_id = v_context.clinic_id and consultation_id = p_consultation_id for update;
  if not found then
    if p_expected_revision <> 0 then return query select 'stale_revision', null::uuid, null::uuid, 0, 'draft', false, array['hair_loss_history']::text[]; return; end if;
    v_history_id := gen_random_uuid();
    insert into public.consultation_hair_loss_history(
      id, clinic_id, consultation_id, updated_by
    ) values(v_history_id, v_context.clinic_id, p_consultation_id, p_actor_id);
    v_root.revision := 0; v_root.review_state := 'draft'; v_root.current_version_id := null;
  else
    v_history_id := v_root.id;
    if v_root.revision <> p_expected_revision then
      return query select 'stale_revision', v_root.id, v_root.current_version_id,
        v_root.revision, v_root.review_state, false, array['hair_loss_history']::text[]; return;
    end if;
    select * into v_previous from public.consultation_hair_loss_history_version
      where id = v_root.current_version_id;
    v_material := v_previous.primary_concern is distinct from p_primary_concern
      or v_previous.onset_kind is distinct from p_onset_kind
      or v_previous.onset_value is distinct from p_onset_value
      or v_previous.progression is distinct from p_progression
      or v_previous.previous_hair_procedure_status is distinct from p_previous_hair_procedure_status
      or v_previous.pattern_classification is distinct from p_pattern_classification
      or v_previous.scalp_symptom_status is distinct from p_scalp_symptom_status
      or v_previous.scalp_symptom_codes is distinct from p_scalp_symptom_codes
      or v_previous.patient_goal_codes is distinct from p_patient_goal_codes
      or v_previous.source_code is distinct from p_source_code
      or v_previous.certainty_code is distinct from p_certainty_code;
  end if;
  insert into public.consultation_hair_loss_history_version values (
    v_version_id, v_context.clinic_id, v_history_id, p_consultation_id,
    v_root.revision + 1, v_root.current_version_id, p_primary_concern,
    p_onset_kind, p_onset_value, p_progression, p_previous_hair_procedure_status,
    p_pattern_classification, p_scalp_symptom_status, coalesce(p_scalp_symptom_codes,'{}'),
    coalesce(p_patient_goal_codes,'{}'), p_source_code, p_certainty_code,
    nullif(btrim(p_section_clarification),''), v_material, clock_timestamp(), p_actor_id
  );
-- graftvision:dangerous-sql-approved task=CONSULT-003
-- graftvision:dangerous-sql-reason Root-pointer progression for immutable versioning
-- graftvision:corrective-plan Immutability triggers prevent modification; pointer updates only change current version
  update public.consultation_hair_loss_history set current_version_id = v_version_id,
    revision = v_root.revision + 1,
    review_state = case when v_material and v_root.review_state = 'doctor_reviewed'
      then 'amendment_required' else 'draft' end,
    updated_at = clock_timestamp(), updated_by = p_actor_id where id = v_history_id;
  insert into public.consultation_history_binding(
    clinic_id, consultation_id, medical_history_version_id, hair_loss_history_version_id, bound_by
  )
  select v_context.clinic_id, p_consultation_id, m.current_version_id, v_version_id, p_actor_id
  from public.patient_medical_history m where m.clinic_id = v_context.clinic_id
    and m.patient_id = v_context.patient_id
  on conflict (clinic_id, consultation_id) do update
    set hair_loss_history_version_id = excluded.hair_loss_history_version_id,
        bound_at = clock_timestamp(), bound_by = excluded.bound_by;
  insert into public.clinical_history_change_event values (
    gen_random_uuid(), v_context.clinic_id, p_consultation_id, 'hair_loss_history',
    v_version_id, v_material, v_material,
    array['concern','onset','progression','procedure','pattern','scalp_symptoms','goals'],
    p_actor_id, clock_timestamp()
  );
  insert into public.clinical_operation_idempotency(
    clinic_id, actor_platform_user_id, aggregate_id, request_family, idempotency_key,
    payload_hash, result_resource_id, result_version_id, result_revision, result_status
  ) values (
    v_context.clinic_id, p_actor_id, p_consultation_id, 'hair_loss_history.save',
    p_idempotency_key, v_payload_hash, v_history_id, v_version_id,
    v_root.revision + 1, 'draft'
  );
  insert into public.audit_event(
    audit_scope, clinic_id, actor_platform_user_id, actor_type, action, resource_type,
    resource_id, outcome, request_id, source_application, metadata
  ) values (
    'clinic', v_context.clinic_id, p_actor_id, 'user',
    case when v_material then 'clinical_history.material_amend' else 'clinical_history.version_create' end,
    'clinical_history', v_history_id, 'success', p_idempotency_key, 'database',
    jsonb_build_object('new_version', v_root.revision + 1,
      'changed_fields', array['concern','onset','progression','procedure','pattern','scalp_symptoms','goals'])
  );
  return query select 'success', v_history_id, v_version_id, v_root.revision + 1,
    case when v_material and v_root.review_state = 'doctor_reviewed' then 'amendment_required' else 'draft' end,
    v_material, array['concern','onset','progression','procedure','pattern','scalp_symptoms','goals']::text[];
end;
$$;
revoke all on function graftvision_private.save_consultation_hair_loss_history(
  uuid,uuid,uuid,integer,uuid,text,text,integer,text,text,text,text,text[],text[],text,text,text
) from public, anon, authenticated;

create function graftvision_private.transition_clinical_history_review(
  p_session_id uuid, p_actor_id uuid, p_consultation_id uuid,
  p_aggregate_type text, p_expected_revision integer, p_new_state text,
  p_reason_code text, p_idempotency_key uuid
)
returns table (outcome_code text, revision integer, review_state text)
language plpgsql security definer set search_path = '' as $$
declare v_context record; v_root_id uuid; v_version_id uuid; v_revision integer;
  v_previous_state text; v_action text; v_payload_hash text;
  v_existing public.clinical_operation_idempotency%rowtype;
begin
  select * into v_context from graftvision_private.clinical_context(
    p_session_id, p_actor_id, p_consultation_id,
    case when p_new_state = 'submitted_for_review' then 'CONSULT-PERM-001' else 'CONSULT-PERM-002' end
  );
  if not found or not graftvision_private.has_application_session_permission(
    p_session_id, p_actor_id, 'clinic', v_context.clinic_id, 'PATIENT-PERM-002'
  ) then raise exception using errcode = '42501', message = 'CLINICAL_REVIEW_DENIED'; end if;
  if p_idempotency_key is null then
    raise exception using errcode = '22023', message = 'IDEMPOTENCY_REQUIRED';
  end if;
  if p_new_state <> 'submitted_for_review'
    and not graftvision_private.is_assigned_verified_doctor(
      p_session_id, p_actor_id, p_consultation_id, 'CONSULT-PERM-002'
    ) then raise exception using errcode = '42501', message = 'ASSIGNED_VERIFIED_DOCTOR_REQUIRED'; end if;
  if p_aggregate_type = 'medical_history' then
    select h.id, h.current_version_id, h.revision, h.review_state
      into v_root_id, v_version_id, v_revision, v_previous_state
    from public.patient_medical_history h where h.clinic_id = v_context.clinic_id
      and h.patient_id = v_context.patient_id for update;
  elsif p_aggregate_type = 'hair_loss_history' then
    select h.id, h.current_version_id, h.revision, h.review_state
      into v_root_id, v_version_id, v_revision, v_previous_state
    from public.consultation_hair_loss_history h where h.clinic_id = v_context.clinic_id
      and h.consultation_id = p_consultation_id for update;
  else raise exception using errcode = '22023', message = 'INVALID_CLINICAL_AGGREGATE'; end if;
  v_payload_hash := encode(digest(concat_ws('|', p_consultation_id, p_aggregate_type,
    p_expected_revision, p_new_state, p_reason_code), 'sha256'), 'hex');
  select * into v_existing from public.clinical_operation_idempotency
  where clinic_id = v_context.clinic_id and actor_platform_user_id = p_actor_id
    and aggregate_id = v_root_id and request_family = 'clinical_history.review'
    and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.payload_hash <> v_payload_hash then
      raise exception using errcode = '22023', message = 'IDEMPOTENCY_PAYLOAD_MISMATCH';
    end if;
    return query select 'success', v_existing.result_revision, v_existing.result_status;
    return;
  end if;
  if v_revision <> p_expected_revision then
    return query select 'stale_revision', v_revision, v_previous_state; return;
  end if;
  if not (
    (p_new_state = 'submitted_for_review' and v_previous_state in ('draft','amendment_required'))
    or (p_new_state in ('doctor_reviewed','amendment_required') and v_previous_state = 'submitted_for_review')
    or (p_new_state = 'retracted' and v_previous_state = 'doctor_reviewed')
  ) then raise exception using errcode = '22023', message = 'INVALID_REVIEW_TRANSITION'; end if;
  if p_aggregate_type = 'medical_history' then
-- graftvision:dangerous-sql-approved task=CONSULT-003
-- graftvision:dangerous-sql-reason Review state progression for root
-- graftvision:corrective-plan Immutability triggers prevent modification; pointer updates only change state
    update public.patient_medical_history set review_state = p_new_state,
      revision = revision + 1, updated_at = clock_timestamp(), updated_by = p_actor_id
    where id = v_root_id;
  else
-- graftvision:dangerous-sql-approved task=CONSULT-003
-- graftvision:dangerous-sql-reason Review state progression for root
-- graftvision:corrective-plan Immutability triggers prevent modification; pointer updates only change state
    update public.consultation_hair_loss_history set review_state = p_new_state,
      revision = revision + 1, updated_at = clock_timestamp(), updated_by = p_actor_id
    where id = v_root_id;
  end if;
  insert into public.clinical_history_review_event values (
    gen_random_uuid(), v_context.clinic_id, p_consultation_id, p_aggregate_type,
    v_version_id, v_previous_state, p_new_state, p_reason_code, p_actor_id, clock_timestamp()
  );
  insert into public.clinical_operation_idempotency(
    clinic_id, actor_platform_user_id, aggregate_id, request_family, idempotency_key,
    payload_hash, result_resource_id, result_version_id, result_revision, result_status
  ) values (
    v_context.clinic_id, p_actor_id, v_root_id, 'clinical_history.review',
    p_idempotency_key, v_payload_hash, v_root_id, v_version_id,
    v_revision + 1, p_new_state
  );
  v_action := case p_new_state when 'submitted_for_review' then 'clinical_history.submit_review'
    when 'doctor_reviewed' then 'clinical_history.doctor_review'
    when 'amendment_required' then 'clinical_history.amendment_request'
    else 'clinical_history.retract' end;
  insert into public.audit_event(
    audit_scope, clinic_id, actor_platform_user_id, actor_type, action, resource_type,
    resource_id, outcome, reason_code, request_id, source_application, metadata
  ) values (
    'clinic', v_context.clinic_id, p_actor_id, 'user', v_action, 'clinical_history',
    v_root_id, 'success', p_reason_code, p_idempotency_key, 'database',
    jsonb_build_object('new_version', v_revision + 1, 'new_status', p_new_state)
  );
  return query select 'success', v_revision + 1, p_new_state;
end;
$$;
revoke all on function graftvision_private.transition_clinical_history_review(
  uuid,uuid,uuid,text,integer,text,text,uuid
) from public, anon, authenticated;

create function graftvision_private.mutate_doctor_private_note(
  p_session_id uuid, p_actor_id uuid, p_consultation_id uuid, p_note_id uuid,
  p_expected_revision integer, p_action text, p_note_text text,
  p_reason_code text, p_idempotency_key uuid
)
returns table (outcome_code text, note_id uuid, version_id uuid, revision integer, status text)
language plpgsql security definer set search_path = '' as $$
declare v_context record; v_note public.doctor_private_note%rowtype;
  v_note_id uuid := coalesce(p_note_id, gen_random_uuid()); v_version_id uuid := gen_random_uuid();
  v_action text; v_idempotency_aggregate uuid; v_payload_hash text;
  v_existing public.clinical_operation_idempotency%rowtype;
begin
  select * into v_context from graftvision_private.clinical_context(
    p_session_id, p_actor_id, p_consultation_id, 'PATIENT-PERM-003'
  );
  if not found or not graftvision_private.is_assigned_verified_doctor(
    p_session_id, p_actor_id, p_consultation_id, 'PATIENT-PERM-003'
  ) then raise exception using errcode = '42501', message = 'PRIVATE_NOTE_ACCESS_DENIED'; end if;
  if p_action not in ('create','amend','retract') then raise exception using errcode = '22023', message = 'INVALID_PRIVATE_NOTE_ACTION'; end if;
  if p_idempotency_key is null then
    raise exception using errcode = '22023', message = 'IDEMPOTENCY_REQUIRED';
  end if;
  v_idempotency_aggregate := coalesce(p_note_id, p_consultation_id);
  v_payload_hash := encode(digest(concat_ws('|', p_consultation_id, coalesce(p_note_id::text,''),
    p_expected_revision, p_action, coalesce(p_note_text,''), coalesce(p_reason_code,'')),
    'sha256'), 'hex');
  select * into v_existing from public.clinical_operation_idempotency
  where clinic_id = v_context.clinic_id and actor_platform_user_id = p_actor_id
    and aggregate_id = v_idempotency_aggregate
    and request_family = 'doctor_private_note.' || p_action
    and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.payload_hash <> v_payload_hash then
      raise exception using errcode = '22023', message = 'IDEMPOTENCY_PAYLOAD_MISMATCH';
    end if;
    return query select 'success', v_existing.result_resource_id,
      v_existing.result_version_id, v_existing.result_revision, v_existing.result_status;
    return;
  end if;
  if p_action = 'create' then
    if p_note_id is not null or p_expected_revision <> 0 then raise exception using errcode = '22023', message = 'INVALID_PRIVATE_NOTE_CREATE'; end if;
    insert into public.doctor_private_note(
      id, clinic_id, consultation_id, author_platform_user_id
    ) values(v_note_id, v_context.clinic_id, p_consultation_id, p_actor_id);
    v_note.revision := 0; v_note.current_version_id := null;
  else
    select * into strict v_note from public.doctor_private_note
      where clinic_id = v_context.clinic_id and id = p_note_id
        and consultation_id = p_consultation_id for update;
    if v_note.revision <> p_expected_revision then
      return query select 'stale_revision', v_note.id, v_note.current_version_id,
        v_note.revision, v_note.status; return;
    end if;
  end if;
  if p_action = 'retract' and (p_reason_code is null or p_note_text is not null) then
    raise exception using errcode = '22023', message = 'PRIVATE_NOTE_RETRACTION_REASON_REQUIRED';
  elsif p_action <> 'retract' and (p_note_text is null or p_reason_code is not null) then
    raise exception using errcode = '22023', message = 'PRIVATE_NOTE_TEXT_REQUIRED';
  end if;
  insert into public.doctor_private_note_version values (
    v_version_id, v_context.clinic_id, v_note_id, p_consultation_id,
    v_note.revision + 1, v_note.current_version_id,
    case when p_action = 'retract' then '[retracted]' else btrim(p_note_text) end,
    case p_action when 'create' then 'created' when 'amend' then 'amended' else 'retracted' end,
    p_reason_code, clock_timestamp(), p_actor_id
  );
-- graftvision:dangerous-sql-approved task=CONSULT-003
-- graftvision:dangerous-sql-reason Root-pointer progression for private note versioning
-- graftvision:corrective-plan Immutability triggers prevent modification; pointer updates only change current version
  update public.doctor_private_note set current_version_id = v_version_id,
    revision = v_note.revision + 1,
    status = case when p_action = 'retract' then 'retracted' else 'active' end,
    updated_at = clock_timestamp() where id = v_note_id;
  insert into public.clinical_operation_idempotency(
    clinic_id, actor_platform_user_id, aggregate_id, request_family, idempotency_key,
    payload_hash, result_resource_id, result_version_id, result_revision, result_status
  ) values (
    v_context.clinic_id, p_actor_id, v_idempotency_aggregate,
    'doctor_private_note.' || p_action, p_idempotency_key, v_payload_hash,
    v_note_id, v_version_id, v_note.revision + 1,
    case when p_action = 'retract' then 'retracted' else 'active' end
  );
  v_action := case p_action when 'create' then 'doctor_private_note.create'
    when 'amend' then 'doctor_private_note.amend' else 'doctor_private_note.retract' end;
  insert into public.audit_event(
    audit_scope, clinic_id, actor_platform_user_id, actor_type, action, resource_type,
    resource_id, outcome, reason_code, request_id, source_application, metadata
  ) values (
    'clinic', v_context.clinic_id, p_actor_id, 'user', v_action, 'doctor_private_note',
    v_note_id, 'success', p_reason_code, p_idempotency_key, 'database',
    jsonb_build_object('new_version', v_note.revision + 1)
  );
  return query select 'success', v_note_id, v_version_id, v_note.revision + 1,
    case when p_action = 'retract' then 'retracted' else 'active' end;
end;
$$;
revoke all on function graftvision_private.mutate_doctor_private_note(
  uuid,uuid,uuid,uuid,integer,text,text,text,uuid
) from public, anon, authenticated;

create function graftvision_private.read_consultation_clinical_history(
  p_session_id uuid, p_actor_id uuid, p_consultation_id uuid
)
returns table (
  medical_history_id uuid, medical_version_id uuid, medical_revision integer,
  medical_review_state text, hair_history_id uuid, hair_version_id uuid,
  hair_revision integer, hair_review_state text, preliminary_ready boolean,
  doctor_finalisation_ready boolean, downstream_stale boolean
)
language plpgsql security definer set search_path = '' as $$
declare v_context record;
begin
  select * into v_context from graftvision_private.clinical_context(
    p_session_id, p_actor_id, p_consultation_id, 'PATIENT-PERM-002'
  );
  if not found then raise exception using errcode = '42501', message = 'CLINICAL_HISTORY_ACCESS_DENIED'; end if;
  return query
  select m.id, m.current_version_id, m.revision, m.review_state,
    h.id, h.current_version_id, h.revision, h.review_state,
    (
      mv.medical_condition_status is not null and mv.allergy_status is not null
      and mv.medication_status is not null and mv.source_code is not null
      and hv.primary_concern is not null
      and (hv.onset_kind = 'uncertain' or hv.onset_value is not null)
      and hv.progression is not null and hv.previous_hair_procedure_status is not null
      and hv.scalp_symptom_status is not null and hv.source_code is not null
    ),
    (m.review_state = 'doctor_reviewed' and h.review_state = 'doctor_reviewed'),
    exists (
      select 1 from public.clinical_history_change_event e
      where e.clinic_id = v_context.clinic_id and e.consultation_id = p_consultation_id
        and e.downstream_stale
    )
  from public.patient_medical_history m
  join public.patient_medical_history_version mv on mv.id = m.current_version_id
  join public.consultation_hair_loss_history h
    on h.clinic_id = v_context.clinic_id and h.consultation_id = p_consultation_id
  join public.consultation_hair_loss_history_version hv on hv.id = h.current_version_id
  where m.clinic_id = v_context.clinic_id and m.patient_id = v_context.patient_id;
end;
$$;
revoke all on function graftvision_private.read_consultation_clinical_history(uuid,uuid,uuid)
  from public, anon, authenticated;

create function graftvision_private.read_current_medical_history(
  p_session_id uuid, p_actor_id uuid, p_consultation_id uuid
)
returns table (
  history_id uuid, version_id uuid, revision integer, review_state text,
  medical_condition_status text, medical_condition_clarification text,
  allergy_status text, allergy_substance text, medication_status text,
  medication_name text, previous_operation_status text, anaesthesia_issue_status text,
  bleeding_concern_status text, healing_concern_status text, source_code text,
  certainty_code text, warning_codes text[], section_summary text
)
language sql stable security definer set search_path = '' as $$
  select h.id, v.id, h.revision, h.review_state, v.medical_condition_status,
    v.medical_condition_clarification, v.allergy_status, v.allergy_substance,
    v.medication_status, v.medication_name, v.previous_operation_status,
    v.anaesthesia_issue_status, v.bleeding_concern_status, v.healing_concern_status,
    v.source_code, v.certainty_code, v.warning_codes, v.section_summary
  from graftvision_private.clinical_context(
    p_session_id, p_actor_id, p_consultation_id, 'PATIENT-PERM-002'
  ) x
  join public.patient_medical_history h
    on h.clinic_id = x.clinic_id and h.patient_id = x.patient_id
  join public.patient_medical_history_version v on v.id = h.current_version_id;
$$;
revoke all on function graftvision_private.read_current_medical_history(uuid,uuid,uuid)
  from public, anon, authenticated;

create function graftvision_private.read_current_hair_loss_history(
  p_session_id uuid, p_actor_id uuid, p_consultation_id uuid
)
returns table (
  history_id uuid, version_id uuid, revision integer, review_state text,
  primary_concern text, onset_kind text, onset_value integer, progression text,
  previous_hair_procedure_status text, pattern_classification text,
  scalp_symptom_status text, scalp_symptom_codes text[], patient_goal_codes text[],
  source_code text, certainty_code text, section_clarification text
)
language sql stable security definer set search_path = '' as $$
  select h.id, v.id, h.revision, h.review_state, v.primary_concern, v.onset_kind,
    v.onset_value, v.progression, v.previous_hair_procedure_status,
    v.pattern_classification, v.scalp_symptom_status, v.scalp_symptom_codes,
    v.patient_goal_codes, v.source_code, v.certainty_code, v.section_clarification
  from graftvision_private.clinical_context(
    p_session_id, p_actor_id, p_consultation_id, 'PATIENT-PERM-002'
  ) x
  join public.consultation_hair_loss_history h
    on h.clinic_id = x.clinic_id and h.consultation_id = p_consultation_id
  join public.consultation_hair_loss_history_version v on v.id = h.current_version_id;
$$;
revoke all on function graftvision_private.read_current_hair_loss_history(uuid,uuid,uuid)
  from public, anon, authenticated;

create function graftvision_private.read_active_doctor_private_notes(
  p_session_id uuid, p_actor_id uuid, p_consultation_id uuid
)
returns table (
  note_id uuid, version_id uuid, revision integer, note_text text,
  author_platform_user_id uuid, updated_at timestamptz
)
language plpgsql security definer set search_path = '' as $$
declare v_context record;
begin
  select * into v_context from graftvision_private.clinical_context(
    p_session_id, p_actor_id, p_consultation_id, 'PATIENT-PERM-003'
  );
  if not found or not graftvision_private.is_assigned_verified_doctor(
    p_session_id, p_actor_id, p_consultation_id, 'PATIENT-PERM-003'
  ) then raise exception using errcode = '42501', message = 'PRIVATE_NOTE_ACCESS_DENIED'; end if;
  insert into public.audit_event(
    audit_scope, clinic_id, actor_platform_user_id, actor_type, action, resource_type,
    resource_id, outcome, source_application, metadata
  )
  select 'clinic', v_context.clinic_id, p_actor_id, 'user',
    'doctor_private_note.sensitive_read', 'doctor_private_note', n.id,
    'success', 'database', jsonb_build_object('operation_code', 'continuity_read')
  from public.doctor_private_note n
  where n.clinic_id = v_context.clinic_id and n.consultation_id = p_consultation_id
    and n.status = 'active' and n.author_platform_user_id <> p_actor_id;
  return query
  select n.id, v.id, n.revision, v.note_text, n.author_platform_user_id, n.updated_at
  from public.doctor_private_note n
  join public.doctor_private_note_version v on v.id = n.current_version_id
  where n.clinic_id = v_context.clinic_id and n.consultation_id = p_consultation_id
    and n.status = 'active'
  order by n.updated_at desc, n.id;
end;
$$;
revoke all on function graftvision_private.read_active_doctor_private_notes(uuid,uuid,uuid)
  from public, anon, authenticated;

create index patient_medical_history_patient_idx
  on public.patient_medical_history(clinic_id, patient_id);
create index hair_loss_history_consultation_idx
  on public.consultation_hair_loss_history(clinic_id, consultation_id);
create index clinical_change_consultation_idx
  on public.clinical_history_change_event(clinic_id, consultation_id, occurred_at desc);
create index private_note_consultation_idx
  on public.doctor_private_note(clinic_id, consultation_id, updated_at desc);
