-- AI-MAP-001: immutable AI proposal execution tracking.
create table public.ai_map_proposal_package (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinic(id),
  patient_id uuid not null references public.patient(id),
  consultation_id uuid not null references public.consultation(id),
  scan_session_id uuid not null references public.scan_session(id),
  analyzer_handoff_id uuid not null references public.scan_analyzer_handoff(id),
  model_package_id uuid not null references public.scalp_model_package(id),
  reconstruction_output_manifest_id uuid not null references public.reconstruction_output_manifest(id),
  reconstruction_artifact_id uuid not null references public.reconstruction_artifact(id),
  reconstruction_attempt_count integer not null check (reconstruction_attempt_count > 0),
  geometry_revision integer not null check (geometry_revision > 0),
  
  ai_model_name text not null check (ai_model_name ~ '^[a-z0-9-]{1,64}$'),
  ai_model_version text not null check (ai_model_version ~ '^[a-z0-9.-]{1,64}$'),
  ai_adapter_version text not null check (ai_adapter_version = 'graftvision-ai-adapter-v1'),
  inference_pipeline_version text not null check (inference_pipeline_version = 'graftvision-inference-v1'),
  proposal_package_version text not null check (proposal_package_version = 'graftvision-ai-map-proposal-v1'),
  model_normalization_version text not null check (model_normalization_version = 'graftvision-model-normalization-v1'),
  
  package_state text not null default 'queued' check (package_state in ('queued', 'running', 'completed', 'failed', 'stale', 'superseded')),
  overall_confidence numeric check (overall_confidence is null or (overall_confidence >= 0 and overall_confidence <= 1)),
  quality_state text check (quality_state is null or quality_state in ('high', 'medium', 'low', 'insufficient')),
  failure_code text check (failure_code is null or failure_code ~ '^[A-Z0-9_]{1,64}$'),
  
  created_at timestamptz not null default clock_timestamp(),
  started_at timestamptz,
  completed_at timestamptz
);

create table public.ai_map_proposal_asset_binding (
  proposal_package_id uuid not null references public.ai_map_proposal_package(id),
  clinic_id uuid not null references public.clinic(id),
  scan_session_id uuid not null references public.scan_session(id),
  asset_ids uuid[] not null check (cardinality(asset_ids) = 7),
  quality_result_ids uuid[] not null check (cardinality(quality_result_ids) = 7),
  quality_review_revision integer not null check (quality_review_revision > 0),
  created_at timestamptz not null default clock_timestamp(),
  primary key (proposal_package_id)
);

create table public.ai_map_proposal_event (
  id uuid primary key default gen_random_uuid(),
  proposal_package_id uuid not null references public.ai_map_proposal_package(id),
  clinic_id uuid not null references public.clinic(id),
  event_type text not null check (event_type in ('proposal_created', 'proposal_running', 'proposal_completed', 'proposal_failed')),
  actor_platform_user_id uuid references public.platform_user(id),
  occurred_at timestamptz not null default clock_timestamp()
);

alter table public.ai_map_proposal_package enable row level security;
alter table public.ai_map_proposal_package force row level security;
alter table public.ai_map_proposal_asset_binding enable row level security;
alter table public.ai_map_proposal_asset_binding force row level security;
alter table public.ai_map_proposal_event enable row level security;
alter table public.ai_map_proposal_event force row level security;

revoke all on public.ai_map_proposal_package, public.ai_map_proposal_asset_binding, public.ai_map_proposal_event from public, anon, authenticated;

create trigger ai_map_proposal_package_controlled before insert or update or delete on public.ai_map_proposal_package for each row execute function graftvision_private.enforce_controlled_scan_mutation();
create trigger ai_map_proposal_asset_binding_controlled before insert or update or delete on public.ai_map_proposal_asset_binding for each row execute function graftvision_private.enforce_controlled_scan_mutation();
create trigger ai_map_proposal_event_controlled before insert or update or delete on public.ai_map_proposal_event for each row execute function graftvision_private.enforce_controlled_scan_mutation();

do $$
declare definition text;
begin
  select pg_get_functiondef('graftvision_private.is_valid_audit_action(text)'::regprocedure) into definition;
  if position('''ai_map.proposal_created''' in definition) = 0 then
    definition := replace(definition, '''model_annotation.superseded''', '''model_annotation.superseded'', ''ai_map.proposal_created'', ''ai_map.proposal_completed'', ''ai_map.proposal_failed'', ''ai_map.proposal_viewed'', ''ai_map.annotation_accepted'', ''ai_map.annotation_rejected'', ''ai_map.proposal_imported''');
    execute definition;
  end if;
  select pg_get_functiondef('graftvision_private.is_valid_audit_resource_type(text)'::regprocedure) into definition;
  if position('''ai_map_proposal_package''' in definition) = 0 then
    definition := replace(definition, '''model_annotation_package''', '''model_annotation_package'', ''ai_map_proposal_package'', ''ai_map_proposal_landmark'', ''ai_map_proposal_curve'', ''ai_map_proposal_region''');
    execute definition;
  end if;
end;
$$;
