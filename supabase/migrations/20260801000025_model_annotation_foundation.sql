-- MODEL-001B1: immutable, Doctor-authored model annotation records.
create table public.model_annotation_package (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinic(id),
  patient_id uuid not null references public.patient(id),
  consultation_id uuid not null references public.consultation(id),
  model_package_id uuid not null references public.scalp_model_package(id),
  reconstruction_output_manifest_id uuid not null references public.reconstruction_output_manifest(id),
  model_artifact_id uuid not null references public.reconstruction_artifact(id),
  geometry_revision integer not null check (geometry_revision > 0),
  normalization_version text not null check (normalization_version = 'graftvision-model-normalization-v1'),
  annotation_package_version text not null check (annotation_package_version = 'graftvision-model-annotations-v1'),
  package_state text not null default 'draft' check (package_state in ('draft', 'finalized', 'superseded', 'stale')),
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default clock_timestamp(),
  created_by uuid not null references public.platform_user(id),
  finalized_at timestamptz
);

create table public.model_annotation_landmark_version (
  id uuid primary key default gen_random_uuid(),
  annotation_package_id uuid not null references public.model_annotation_package(id),
  clinic_id uuid not null references public.clinic(id),
  patient_id uuid not null references public.patient(id),
  consultation_id uuid not null references public.consultation(id),
  model_package_id uuid not null references public.scalp_model_package(id),
  reconstruction_output_manifest_id uuid not null references public.reconstruction_output_manifest(id),
  model_artifact_id uuid not null references public.reconstruction_artifact(id),
  geometry_revision integer not null check (geometry_revision > 0),
  landmark_code text not null check (landmark_code in ('glabella_reference', 'frontal_midline_reference', 'left_temporal_reference', 'right_temporal_reference', 'crown_center_reference', 'left_occipital_reference', 'right_occipital_reference', 'donor_center_reference', 'custom_technical_reference')),
  normalized_coordinate numeric[] not null check (cardinality(normalized_coordinate) = 3),
  surface_reference text check (surface_reference is null or surface_reference ~ '^[A-Za-z0-9._:-]{1,128}$'),
  coordinate_frame_version text not null check (coordinate_frame_version = 'graftvision-model-normalization-v1'),
  revision integer not null check (revision > 0),
  supersedes_landmark_id uuid references public.model_annotation_landmark_version(id),
  annotation_state text not null default 'current' check (annotation_state in ('current', 'superseded', 'deleted')),
  created_at timestamptz not null default clock_timestamp(),
  created_by uuid not null references public.platform_user(id)
);

create table public.model_annotation_curve_version (
  id uuid primary key default gen_random_uuid(),
  annotation_package_id uuid not null references public.model_annotation_package(id),
  clinic_id uuid not null references public.clinic(id), patient_id uuid not null references public.patient(id), consultation_id uuid not null references public.consultation(id),
  model_package_id uuid not null references public.scalp_model_package(id), reconstruction_output_manifest_id uuid not null references public.reconstruction_output_manifest(id), model_artifact_id uuid not null references public.reconstruction_artifact(id), geometry_revision integer not null check (geometry_revision > 0),
  curve_code text not null check (curve_code in ('current_hairline', 'proposed_hairline', 'frontal_boundary', 'left_temporal_boundary', 'right_temporal_boundary', 'donor_upper_boundary', 'donor_lower_boundary', 'donor_left_boundary', 'donor_right_boundary', 'crown_boundary')),
  control_points jsonb not null check (jsonb_typeof(control_points) = 'array' and jsonb_array_length(control_points) between 2 and 128),
  closed boolean not null default false, smoothing_mode text not null default 'linear' check (smoothing_mode in ('linear', 'smooth')), revision integer not null check (revision > 0), supersedes_curve_id uuid references public.model_annotation_curve_version(id), annotation_state text not null default 'current' check (annotation_state in ('current', 'superseded', 'deleted')), created_at timestamptz not null default clock_timestamp(), created_by uuid not null references public.platform_user(id)
);

create table public.model_annotation_region_version (
  id uuid primary key default gen_random_uuid(), annotation_package_id uuid not null references public.model_annotation_package(id), clinic_id uuid not null references public.clinic(id), patient_id uuid not null references public.patient(id), consultation_id uuid not null references public.consultation(id),
  model_package_id uuid not null references public.scalp_model_package(id), reconstruction_output_manifest_id uuid not null references public.reconstruction_output_manifest(id), model_artifact_id uuid not null references public.reconstruction_artifact(id), geometry_revision integer not null check (geometry_revision > 0),
  region_code text not null check (region_code in ('frontal_recipient_region', 'mid_scalp_region', 'crown_region', 'left_temporal_region', 'right_temporal_region', 'donor_rear_region', 'donor_left_region', 'donor_right_region', 'exclusion_region')),
  boundary_points jsonb not null check (jsonb_typeof(boundary_points) = 'array' and jsonb_array_length(boundary_points) between 3 and 256), closed boolean not null check (closed), revision integer not null check (revision > 0), supersedes_region_id uuid references public.model_annotation_region_version(id), annotation_state text not null default 'current' check (annotation_state in ('current', 'superseded', 'deleted')), created_at timestamptz not null default clock_timestamp(), created_by uuid not null references public.platform_user(id)
);

create table public.model_annotation_event (
  id uuid primary key default gen_random_uuid(), annotation_package_id uuid not null references public.model_annotation_package(id), clinic_id uuid not null references public.clinic(id), event_type text not null check (event_type in ('package_created', 'landmark_saved', 'curve_saved', 'region_saved', 'finalized', 'superseded')), actor_platform_user_id uuid not null references public.platform_user(id), annotation_reference_id uuid, annotation_code text check (annotation_code is null or annotation_code ~ '^[a-z][a-z0-9_]{1,63}$'), revision integer check (revision is null or revision > 0), occurred_at timestamptz not null default clock_timestamp()
);

create table public.model_annotation_idempotency (
  clinic_id uuid not null references public.clinic(id), actor_platform_user_id uuid not null references public.platform_user(id), request_family text not null check (request_family in ('package', 'landmark', 'curve', 'region', 'finalize')), idempotency_key uuid not null, payload_hash text not null check (payload_hash ~ '^[a-f0-9]{64}$'), result_resource_id uuid not null, result_status text not null check (result_status in ('created', 'replayed', 'finalized')), result_revision integer not null check (result_revision > 0), created_at timestamptz not null default clock_timestamp(), primary key (clinic_id, actor_platform_user_id, request_family, idempotency_key)
);

alter table public.model_annotation_package enable row level security; alter table public.model_annotation_package force row level security;
alter table public.model_annotation_landmark_version enable row level security; alter table public.model_annotation_landmark_version force row level security;
alter table public.model_annotation_curve_version enable row level security; alter table public.model_annotation_curve_version force row level security;
alter table public.model_annotation_region_version enable row level security; alter table public.model_annotation_region_version force row level security;
alter table public.model_annotation_event enable row level security; alter table public.model_annotation_event force row level security;
alter table public.model_annotation_idempotency enable row level security; alter table public.model_annotation_idempotency force row level security;
revoke all on public.model_annotation_package, public.model_annotation_landmark_version, public.model_annotation_curve_version, public.model_annotation_region_version, public.model_annotation_event, public.model_annotation_idempotency from public, anon, authenticated;
create trigger model_annotation_package_controlled before insert or update or delete on public.model_annotation_package for each row execute function graftvision_private.enforce_controlled_scan_mutation();
create trigger model_annotation_landmark_version_controlled before insert or update or delete on public.model_annotation_landmark_version for each row execute function graftvision_private.enforce_controlled_scan_mutation();
create trigger model_annotation_curve_version_controlled before insert or update or delete on public.model_annotation_curve_version for each row execute function graftvision_private.enforce_controlled_scan_mutation();
create trigger model_annotation_region_version_controlled before insert or update or delete on public.model_annotation_region_version for each row execute function graftvision_private.enforce_controlled_scan_mutation();
create trigger model_annotation_event_controlled before insert or update or delete on public.model_annotation_event for each row execute function graftvision_private.enforce_controlled_scan_mutation();
create trigger model_annotation_idempotency_controlled before insert or update or delete on public.model_annotation_idempotency for each row execute function graftvision_private.enforce_controlled_scan_mutation();
