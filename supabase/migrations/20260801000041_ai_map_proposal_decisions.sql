-- AI-MAP-001: Explicit Doctor decisions and immutable provenance.
create table public.ai_map_proposal_decision (
  id uuid primary key default gen_random_uuid(),
  proposal_package_id uuid not null references public.ai_map_proposal_package(id),
  clinic_id uuid not null references public.clinic(id),
  doctor_platform_user_id uuid not null references public.platform_user(id),
  annotation_kind text not null check (annotation_kind in ('landmark', 'curve', 'region')),
  suggestion_id uuid not null,
  decision_type text not null check (decision_type in ('accepted', 'rejected', 'modified')),
  created_at timestamptz not null default clock_timestamp()
);

create table public.model_annotation_ai_provenance (
  annotation_version_id uuid not null,
  annotation_kind text not null check (annotation_kind in ('landmark', 'curve', 'region')),
  clinic_id uuid not null references public.clinic(id),
  ai_proposal_suggestion_id uuid not null,
  ai_proposal_package_id uuid not null references public.ai_map_proposal_package(id),
  created_at timestamptz not null default clock_timestamp(),
  primary key (annotation_version_id, annotation_kind)
);

alter table public.ai_map_proposal_decision enable row level security;
alter table public.ai_map_proposal_decision force row level security;
alter table public.model_annotation_ai_provenance enable row level security;
alter table public.model_annotation_ai_provenance force row level security;

revoke all on public.ai_map_proposal_decision, public.model_annotation_ai_provenance from public, anon, authenticated;

create trigger ai_map_proposal_decision_controlled before insert or update or delete on public.ai_map_proposal_decision for each row execute function graftvision_private.enforce_controlled_scan_mutation();
create trigger model_annotation_ai_provenance_controlled before insert or update or delete on public.model_annotation_ai_provenance for each row execute function graftvision_private.enforce_controlled_scan_mutation();
