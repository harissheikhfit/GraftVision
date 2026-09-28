-- SCAN-005B1: controlled, immutable deterministic quality-result recording.
create table public.scan_capture_quality_idempotency (
  clinic_id uuid not null references public.clinic(id), actor_platform_user_id uuid not null references public.platform_user(id), idempotency_key text not null,
  scan_session_id uuid not null references public.scan_session(id), asset_id uuid not null references public.scan_capture_asset(id), capture_step text not null, expected_revision integer not null, validator_version text not null, quality_state text not null, reason_code text, result_id uuid not null references public.scan_capture_quality_result(id), primary key(clinic_id,actor_platform_user_id,idempotency_key)
);
alter table public.scan_capture_quality_idempotency enable row level security; alter table public.scan_capture_quality_idempotency force row level security;
revoke all on public.scan_capture_quality_idempotency from public,anon,authenticated;
create trigger scan_capture_quality_idempotency_controlled before insert or update or delete on public.scan_capture_quality_idempotency for each row execute function graftvision_private.enforce_controlled_scan_mutation();

create function graftvision_private.save_scan_quality_result(p_session_id uuid,p_provider_identity_id uuid,p_scan_session_id uuid,p_asset_id uuid,p_capture_step text,p_asset_revision integer,p_validator_version text,p_quality_state text,p_reason_code text,p_expected_revision integer,p_idempotency_key text)
returns table(result_id uuid, revision integer, is_new boolean) language plpgsql security definer set search_path='' as $$
declare c record; ss public.scan_session%rowtype; a public.scan_capture_asset%rowtype; r public.scan_capture_quality_review%rowtype; old public.scan_capture_quality_idempotency%rowtype; nid uuid;
begin
 select * into strict c from graftvision_private.require_scan_capture_context(p_session_id,p_provider_identity_id,p_scan_session_id);
 select * into old from public.scan_capture_quality_idempotency where clinic_id=c.clinic_id and actor_platform_user_id=c.actor_id and idempotency_key=p_idempotency_key;
 if found then if old.asset_id<>p_asset_id or old.capture_step<>p_capture_step or old.expected_revision<>p_expected_revision or old.validator_version<>p_validator_version or old.quality_state<>p_quality_state or old.reason_code is distinct from p_reason_code then raise exception using errcode='40001',message='SCAN_QUALITY_IDEMPOTENCY_MISMATCH'; end if; return query select old.result_id,old.expected_revision,false; return; end if;
 if p_quality_state not in ('pending','passed','warning','retake_required','invalidated') or (p_reason_code is not null and p_reason_code not in ('IMAGE_TOO_BLURRY','IMAGE_TOO_DARK','IMAGE_TOO_BRIGHT','IMAGE_TOO_SMALL','INVALID_ORIENTATION','HEAD_OUT_OF_FRAME','SUBJECT_TOO_CLOSE','SUBJECT_TOO_FAR','DUPLICATE_ANGLE_IMAGE','ANGLE_MISMATCH','ASSET_REPLACED','QUALITY_CHECK_FAILED')) then raise exception using errcode='22023',message='SCAN_QUALITY_INVALID'; end if;
 select * into strict ss from public.scan_session where id=p_scan_session_id and clinic_id=c.clinic_id; select * into strict a from public.scan_capture_asset where id=p_asset_id and scan_session_id=p_scan_session_id and clinic_id=c.clinic_id and upload_status='uploaded';
 if a.capture_step<>p_capture_step or a.capture_revision<>p_asset_revision then raise exception using errcode='40001',message='SCAN_QUALITY_STALE_ASSET'; end if;
-- graftvision:dangerous-sql-approved task=SCAN-005
-- graftvision:dangerous-sql-reason Controlled row lock serializes quality-result revision checks.
-- graftvision:corrective-plan Forward-fix through an additive migration; immutable results remain preserved.
 select * into r from public.scan_capture_quality_review where scan_session_id=p_scan_session_id for update; if not found then perform set_config('graftvision.scan_controlled','on',true); insert into public.scan_capture_quality_review(clinic_id,patient_id,consultation_id,scan_session_id) values(c.clinic_id,ss.patient_id,ss.consultation_id,p_scan_session_id) returning * into r; end if;
 if r.revision<>p_expected_revision then raise exception using errcode='40001',message='SCAN_QUALITY_CONFLICT'; end if;
 perform set_config('graftvision.scan_controlled','on',true); insert into public.scan_capture_quality_result(review_id,clinic_id,patient_id,consultation_id,scan_session_id,asset_id,capture_step,asset_revision,validator_version,quality_state,reason_code,created_by) values(r.id,c.clinic_id,ss.patient_id,ss.consultation_id,p_scan_session_id,p_asset_id,p_capture_step,p_asset_revision,p_validator_version,p_quality_state,p_reason_code,c.actor_id) returning id into nid;
 insert into public.scan_capture_quality_event(review_id,quality_result_id,clinic_id,event_type,actor_platform_user_id,reason_code) values(r.id,nid,c.clinic_id,'result_saved',c.actor_id,p_reason_code);
-- graftvision:dangerous-sql-approved task=SCAN-005
-- graftvision:dangerous-sql-reason Controlled optimistic-concurrency revision increment follows an immutable quality result.
-- graftvision:corrective-plan Forward-fix through an additive migration; quality results and events remain append-only.
 update public.scan_capture_quality_review set revision=revision+1 where id=r.id;
 insert into public.scan_capture_quality_idempotency values(c.clinic_id,c.actor_id,p_idempotency_key,p_scan_session_id,p_asset_id,p_capture_step,p_expected_revision,p_validator_version,p_quality_state,p_reason_code,nid);
 return query select nid,r.revision+1,true;
end; $$;
revoke all on function graftvision_private.save_scan_quality_result(uuid,uuid,uuid,uuid,text,integer,text,text,text,integer,text) from public,anon,authenticated;
