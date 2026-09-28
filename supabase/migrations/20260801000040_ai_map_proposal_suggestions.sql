-- AI-MAP-001: AI proposal suggestions tables
create table public.ai_map_proposal_landmark (
  id uuid primary key default gen_random_uuid(),
  proposal_package_id uuid not null references public.ai_map_proposal_package(id),
  clinic_id uuid not null references public.clinic(id),
  patient_id uuid not null references public.patient(id),
  consultation_id uuid not null references public.consultation(id),
  landmark_code text not null check (landmark_code in ('glabella_reference', 'frontal_midline_reference', 'left_temporal_reference', 'right_temporal_reference', 'crown_center_reference', 'left_occipital_reference', 'right_occipital_reference', 'donor_center_reference', 'custom_technical_reference')),
  normalized_coordinate numeric[] not null check (cardinality(normalized_coordinate) = 3),
  surface_reference text check (surface_reference is null or surface_reference ~ '^[A-Za-z0-9._:-]{1,128}$'),
  coordinate_frame_version text not null check (coordinate_frame_version = 'graftvision-model-normalization-v1'),
  
  confidence numeric not null check (confidence >= 0 and confidence <= 1),
  quality_state text not null check (quality_state in ('high', 'medium', 'low', 'insufficient')),
  source_view_count integer not null check (source_view_count >= 0),
  
  created_at timestamptz not null default clock_timestamp()
);

create table public.ai_map_proposal_curve (
  id uuid primary key default gen_random_uuid(),
  proposal_package_id uuid not null references public.ai_map_proposal_package(id),
  clinic_id uuid not null references public.clinic(id),
  patient_id uuid not null references public.patient(id),
  consultation_id uuid not null references public.consultation(id),
  curve_code text not null check (curve_code in ('current_hairline', 'proposed_hairline', 'frontal_boundary', 'left_temporal_boundary', 'right_temporal_boundary', 'donor_upper_boundary', 'donor_lower_boundary', 'donor_left_boundary', 'donor_right_boundary', 'crown_boundary')),
  control_points jsonb not null check (jsonb_typeof(control_points) = 'array' and jsonb_array_length(control_points) between 2 and 128),
  closed boolean not null default false,
  smoothing_mode text not null default 'linear' check (smoothing_mode in ('linear', 'smooth')),
  
  confidence numeric not null check (confidence >= 0 and confidence <= 1),
  per_point_confidence numeric[] check (per_point_confidence is null or cardinality(per_point_confidence) = jsonb_array_length(control_points)),
  quality_state text not null check (quality_state in ('high', 'medium', 'low', 'insufficient')),
  source_view_count integer not null check (source_view_count >= 0),
  
  created_at timestamptz not null default clock_timestamp()
);

create table public.ai_map_proposal_region (
  id uuid primary key default gen_random_uuid(),
  proposal_package_id uuid not null references public.ai_map_proposal_package(id),
  clinic_id uuid not null references public.clinic(id),
  patient_id uuid not null references public.patient(id),
  consultation_id uuid not null references public.consultation(id),
  region_code text not null check (region_code in ('frontal_recipient_region', 'mid_scalp_region', 'crown_region', 'left_temporal_region', 'right_temporal_region', 'donor_rear_region', 'donor_left_region', 'donor_right_region', 'exclusion_region')),
  boundary_points jsonb not null check (jsonb_typeof(boundary_points) = 'array' and jsonb_array_length(boundary_points) between 3 and 256),
  closed boolean not null check (closed),
  
  confidence numeric not null check (confidence >= 0 and confidence <= 1),
  per_point_confidence numeric[] check (per_point_confidence is null or cardinality(per_point_confidence) = jsonb_array_length(boundary_points)),
  quality_state text not null check (quality_state in ('high', 'medium', 'low', 'insufficient')),
  source_view_count integer not null check (source_view_count >= 0),
  
  created_at timestamptz not null default clock_timestamp()
);

alter table public.ai_map_proposal_landmark enable row level security;
alter table public.ai_map_proposal_landmark force row level security;
alter table public.ai_map_proposal_curve enable row level security;
alter table public.ai_map_proposal_curve force row level security;
alter table public.ai_map_proposal_region enable row level security;
alter table public.ai_map_proposal_region force row level security;

revoke all on public.ai_map_proposal_landmark, public.ai_map_proposal_curve, public.ai_map_proposal_region from public, anon, authenticated;

create trigger ai_map_proposal_landmark_controlled before insert or update or delete on public.ai_map_proposal_landmark for each row execute function graftvision_private.enforce_controlled_scan_mutation();
create trigger ai_map_proposal_curve_controlled before insert or update or delete on public.ai_map_proposal_curve for each row execute function graftvision_private.enforce_controlled_scan_mutation();
create trigger ai_map_proposal_region_controlled before insert or update or delete on public.ai_map_proposal_region for each row execute function graftvision_private.enforce_controlled_scan_mutation();
