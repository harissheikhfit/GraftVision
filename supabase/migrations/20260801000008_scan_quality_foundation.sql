-- SCAN-005: non-diagnostic, immutable scan capture quality foundation.
create table public.scan_capture_quality_review (
  id uuid primary key default gen_random_uuid(), clinic_id uuid not null references public.clinic(id), patient_id uuid not null references public.patient(id), consultation_id uuid not null,
  scan_session_id uuid not null unique references public.scan_session(id), revision integer not null default 1 check (revision > 0), created_at timestamptz not null default clock_timestamp()
);
create table public.scan_capture_quality_result (
  id uuid primary key default gen_random_uuid(), review_id uuid not null references public.scan_capture_quality_review(id), clinic_id uuid not null references public.clinic(id), patient_id uuid not null references public.patient(id), consultation_id uuid not null,
  scan_session_id uuid not null references public.scan_session(id), asset_id uuid not null references public.scan_capture_asset(id), capture_step text not null check (capture_step in ('front','left_profile','right_profile','crown','donor_rear','donor_left','donor_right')),
  asset_revision integer not null check (asset_revision > 0), validator_version text not null check (validator_version ~ '^[A-Za-z0-9._-]{1,64}$'), quality_state text not null check (quality_state in ('pending','passed','warning','retake_required','doctor_overridden','invalidated')),
  reason_code text check (reason_code is null or reason_code in ('IMAGE_TOO_BLURRY','IMAGE_TOO_DARK','IMAGE_TOO_BRIGHT','IMAGE_TOO_SMALL','INVALID_ORIENTATION','HEAD_OUT_OF_FRAME','SUBJECT_TOO_CLOSE','SUBJECT_TOO_FAR','DUPLICATE_ANGLE_IMAGE','ANGLE_MISMATCH','ASSET_REPLACED','QUALITY_CHECK_FAILED')),
  created_by uuid not null references public.platform_user(id), created_at timestamptz not null default clock_timestamp(), unique(review_id, asset_id, validator_version)
);
create table public.scan_capture_quality_event (
  id uuid primary key default gen_random_uuid(), review_id uuid not null references public.scan_capture_quality_review(id), quality_result_id uuid references public.scan_capture_quality_result(id), clinic_id uuid not null references public.clinic(id), event_type text not null check (event_type in ('result_saved','retake_requested','doctor_overridden','invalidated')), actor_platform_user_id uuid not null references public.platform_user(id), reason_code text check (reason_code is null or reason_code in ('IMAGE_TOO_BLURRY','IMAGE_TOO_DARK','IMAGE_TOO_BRIGHT','IMAGE_TOO_SMALL','INVALID_ORIENTATION','HEAD_OUT_OF_FRAME','SUBJECT_TOO_CLOSE','SUBJECT_TOO_FAR','DUPLICATE_ANGLE_IMAGE','ANGLE_MISMATCH','ASSET_REPLACED','QUALITY_CHECK_FAILED')), occurred_at timestamptz not null default clock_timestamp()
);
alter table public.scan_capture_quality_review enable row level security; alter table public.scan_capture_quality_review force row level security;
alter table public.scan_capture_quality_result enable row level security; alter table public.scan_capture_quality_result force row level security;
alter table public.scan_capture_quality_event enable row level security; alter table public.scan_capture_quality_event force row level security;
revoke all on public.scan_capture_quality_review, public.scan_capture_quality_result, public.scan_capture_quality_event from public, anon, authenticated;
create trigger scan_capture_quality_review_controlled before insert or update or delete on public.scan_capture_quality_review for each row execute function graftvision_private.enforce_controlled_scan_mutation();
create trigger scan_capture_quality_result_controlled before insert or update or delete on public.scan_capture_quality_result for each row execute function graftvision_private.enforce_controlled_scan_mutation();
create trigger scan_capture_quality_event_controlled before insert or update or delete on public.scan_capture_quality_event for each row execute function graftvision_private.enforce_controlled_scan_mutation();

create function graftvision_private.read_scan_package_readiness(p_scan_session_id uuid) returns boolean language sql security definer set search_path='' as $$
 select exists(select 1 from public.scan_session ss where ss.id=p_scan_session_id and ss.status='completed') and 7=(select count(*) from public.scan_capture_asset a where a.scan_session_id=p_scan_session_id and a.upload_status='uploaded') and 7=(select count(distinct r.capture_step) from public.scan_capture_quality_result r join public.scan_capture_asset a on a.id=r.asset_id where r.scan_session_id=p_scan_session_id and a.upload_status='uploaded' and r.quality_state in ('passed','doctor_overridden'));
$$;
revoke all on function graftvision_private.read_scan_package_readiness(uuid) from public, anon, authenticated;
