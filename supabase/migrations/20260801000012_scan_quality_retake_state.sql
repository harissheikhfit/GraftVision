-- SCAN-005B2a: mutable current-result pointers over immutable quality evidence.
create table public.scan_capture_quality_current (
  review_id uuid not null references public.scan_capture_quality_review(id) on delete restrict,
  clinic_id uuid not null references public.clinic(id) on delete restrict,
  patient_id uuid not null references public.patient(id) on delete restrict,
  consultation_id uuid not null,
  scan_session_id uuid not null references public.scan_session(id) on delete restrict,
  capture_step text not null check (capture_step in ('front','left_profile','right_profile','crown','donor_rear','donor_left','donor_right')),
  asset_id uuid not null references public.scan_capture_asset(id) on delete restrict,
  current_result_id uuid not null references public.scan_capture_quality_result(id) on delete restrict,
  prior_result_id uuid references public.scan_capture_quality_result(id) on delete restrict,
  revision integer not null default 1 check (revision > 0),
  updated_at timestamptz not null default clock_timestamp(),
  primary key (review_id, capture_step),
  unique (scan_session_id, capture_step)
);
alter table public.scan_capture_quality_current enable row level security;
alter table public.scan_capture_quality_current force row level security;
revoke all on public.scan_capture_quality_current from public, anon, authenticated;
create trigger scan_capture_quality_current_controlled before insert or update or delete on public.scan_capture_quality_current for each row execute function graftvision_private.enforce_controlled_scan_mutation();
