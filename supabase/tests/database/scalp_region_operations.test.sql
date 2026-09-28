begin;
select plan(14);

insert into auth.users (id, email) values
  ('31111111-1111-4111-8111-111111111111', 'region-doctor@example.test'),
  ('32222222-2222-4222-8222-222222222222', 'region-assistant@example.test');

insert into public.clinic (id, clinic_code, display_name, status, timezone) values
  ('31111111-0000-4000-8000-000000000001', 'region-alpha', 'Region Alpha', 'active', 'Asia/Karachi'),
  ('31111111-0000-4000-8000-000000000002', 'region-beta', 'Region Beta', 'active', 'Asia/Karachi');

insert into public.platform_user (id, external_identity_id, status) values
  ('31111111-1111-4111-8111-111111111111', 'region-doctor@example.test', 'active'),
  ('32222222-2222-4222-8222-222222222222', 'region-assistant@example.test', 'active');

insert into public.clinic_membership (id, clinic_id, platform_user_id, membership_status) values
  ('33333333-1000-4000-8000-000000000001', '31111111-0000-4000-8000-000000000001', '31111111-1111-4111-8111-111111111111', 'active'),
  ('33333333-2000-4000-8000-000000000001', '31111111-0000-4000-8000-000000000001', '32222222-2222-4222-8222-222222222222', 'active');

insert into public.clinic_membership_role (clinic_membership_id, role_code) values
  ('33333333-1000-4000-8000-000000000001', 'DOCTOR'),
  ('33333333-1000-4000-8000-000000000001', 'CLINIC_OWNER'),
  ('33333333-2000-4000-8000-000000000001', 'CLINICAL_ASSISTANT');

select set_config('graftvision.doctor_verification_transition', 'allowed', true);
insert into public.doctor_verification (id, clinic_id, platform_user_id, status, verified_at, expires_at)
values ('31111111-0000-4000-8000-000000000003', '31111111-0000-4000-8000-000000000001', '31111111-1111-4111-8111-111111111111', 'verified', clock_timestamp(), clock_timestamp() + interval '1 year');
select set_config('graftvision.doctor_verification_transition', 'denied', true);

select set_config('graftvision.clinic_onboarding_controlled', 'on', true);
insert into public.clinic_onboarding_attestation (clinic_id, attestation_code, status, actor_platform_user_id, revision)
values
  ('31111111-0000-4000-8000-000000000001', 'SECURITY_READY', 'attested', '31111111-1111-4111-8111-111111111111', 1),
  ('31111111-0000-4000-8000-000000000001', 'PROTOCOL_TEMPLATE_READY', 'attested', '31111111-1111-4111-8111-111111111111', 1);
select set_config('graftvision.clinic_onboarding_controlled', 'off', true);

select set_config('graftvision.patient_controlled', 'on', true);
insert into public.patient (id, clinic_id, patient_number, status, provenance_code, created_by, updated_by)
values ('31111111-2222-4222-8222-222222222222', '31111111-0000-4000-8000-000000000001', 'GV-000001', 'active', 'MANUAL_REGISTRATION', '31111111-1111-4111-8111-111111111111', '31111111-1111-4111-8111-111111111111');
select set_config('graftvision.patient_controlled', 'off', true);

select set_config('graftvision.consultation_controlled', 'on', true);
insert into public.consultation (id, clinic_id, patient_id, status, created_by, updated_by, revision) values
  ('31111111-3333-4333-8333-333333333333', '31111111-0000-4000-8000-000000000001', '31111111-2222-4222-8222-222222222222', 'in_progress', '31111111-1111-4111-8111-111111111111', '31111111-1111-4111-8111-111111111111', 1);
insert into public.consultation_assignment (clinic_id, consultation_id, doctor_platform_user_id, assigned_by, updated_by)
values ('31111111-0000-4000-8000-000000000001', '31111111-3333-4333-8333-333333333333', '31111111-1111-4111-8111-111111111111', '31111111-1111-4111-8111-111111111111', '31111111-1111-4111-8111-111111111111');
select set_config('graftvision.consultation_controlled', 'off', true);

select graftvision_private.create_application_session('31111111-1111-4111-8111-111111111111', 'clinic', '31111111-0000-4000-8000-000000000001', '31111111-4444-4444-8444-444444444444', clock_timestamp() + interval '1 hour', 'region-test', null) doctor_session \gset
select graftvision_private.create_application_session('32222222-2222-4222-8222-222222222222', 'clinic', '31111111-0000-4000-8000-000000000001', '32222222-4444-4444-8444-444444444444', clock_timestamp() + interval '1 hour', 'region-test', null) assistant_session \gset

select throws_like(
  format($sql$select graftvision_private.save_scalp_region(%L::uuid, '32222222-2222-4222-8222-222222222222', '31111111-3333-4333-8333-333333333333', null, 'crown_region', 'manual', null, null, 'graftvision-manual-relative-v1', 'manual_draw', 'draft', '[{"id":"71111111-1111-4111-8111-111111111111","order_index":0,"x":0,"y":0,"z":0},{"id":"71111111-1111-4111-8111-111111111112","order_index":1,"x":1,"y":0,"z":0},{"id":"71111111-1111-4111-8111-111111111113","order_index":2,"x":1,"y":1,"z":0},{"id":"71111111-1111-4111-8111-111111111114","order_index":3,"x":0,"y":1,"z":0}]'::jsonb, 0, '41111111-1111-4111-8111-111111111111'::uuid)$sql$, :'assistant_session'), '%REGION_ACCESS_DENIED%', 'Assistant cannot save a region');

select throws_like(
  format($sql$select graftvision_private.save_scalp_region(%L::uuid, '31111111-1111-4111-8111-111111111111', '31111111-3333-4333-8333-333333333333', null, 'crown_region', 'manual', null, null, 'graftvision-manual-relative-v1', 'manual_draw', 'draft', '[]'::jsonb, 0, '41111111-1111-4111-8111-111111111112'::uuid)$sql$, :'doctor_session'), '%REGION_GEOMETRY_INVALID%', 'Invalid geometry is rejected');

select * from graftvision_private.save_scalp_region(:'doctor_session', '31111111-1111-4111-8111-111111111111', '31111111-3333-4333-8333-333333333333', null, 'crown_region', 'manual', null, null, 'graftvision-manual-relative-v1', 'manual_draw', 'draft', '[{"id":"71111111-1111-4111-8111-111111111111","order_index":0,"x":0,"y":0,"z":0},{"id":"71111111-1111-4111-8111-111111111112","order_index":1,"x":1,"y":0,"z":0},{"id":"71111111-1111-4111-8111-111111111113","order_index":2,"x":1,"y":1,"z":0},{"id":"71111111-1111-4111-8111-111111111114","order_index":3,"x":0,"y":1,"z":0}]'::jsonb, 0, '41111111-1111-4111-8111-111111111113'::uuid) \gset first_

select is(:'first_revision'::integer, 1, 'Doctor can create the first region revision');
select is((select count(*)::integer from public.scalp_region where id = :'first_region_id'), 1, 'region is tenant-owned');
select is((select count(*)::integer from public.audit_event where resource_id = :'first_region_id' and action = 'region.version_created'), 1, 'region save is audited');

select * from graftvision_private.save_scalp_region(:'doctor_session', '31111111-1111-4111-8111-111111111111', '31111111-3333-4333-8333-333333333333', :'first_region_id', 'crown_region', 'manual', null, null, 'graftvision-manual-relative-v1', 'manual_draw', 'review', '[{"id":"71111111-1111-4111-8111-111111111111","order_index":0,"x":0,"y":0,"z":0},{"id":"71111111-1111-4111-8111-111111111112","order_index":1,"x":1,"y":0,"z":0},{"id":"71111111-1111-4111-8111-111111111113","order_index":2,"x":1,"y":1,"z":0},{"id":"71111111-1111-4111-8111-111111111114","order_index":3,"x":0,"y":1,"z":0}]'::jsonb, 1, '41111111-1111-4111-8111-111111111114'::uuid) \gset second_

select is(:'second_revision'::integer, 2, 'Doctor can append a new revision');
select is((select supersedes_version_id from public.scalp_region_version where id = :'second_region_version_id'), :'first_region_version_id'::uuid, 'new version preserves immutable lineage');
select throws_like(format($sql$select graftvision_private.save_scalp_region(%L::uuid, '31111111-1111-4111-8111-111111111111', '31111111-3333-4333-8333-333333333333', %L::uuid, 'crown_region', 'manual', null, null, 'graftvision-manual-relative-v1', 'manual_draw', 'draft', '[]'::jsonb, 1, '41111111-1111-4111-8111-111111111115'::uuid)$sql$, :'doctor_session', :'first_region_id'), '%REGION_GEOMETRY_INVALID%', 'Invalid follow-up input is rejected');
select throws_like(format($sql$select graftvision_private.save_scalp_region(%L::uuid, '31111111-1111-4111-8111-111111111111', '31111111-3333-4333-8333-333333333333', %L::uuid, 'crown_region', 'manual', null, null, 'graftvision-manual-relative-v1', 'manual_draw', 'draft', '[{"id":"71111111-1111-4111-8111-111111111111","order_index":0,"x":0,"y":0,"z":0},{"id":"71111111-1111-4111-8111-111111111112","order_index":1,"x":1,"y":0,"z":0},{"id":"71111111-1111-4111-8111-111111111113","order_index":2,"x":1,"y":1,"z":0},{"id":"71111111-1111-4111-8111-111111111114","order_index":3,"x":0,"y":1,"z":0}]'::jsonb, 1, '41111111-1111-4111-8111-111111111116'::uuid)$sql$, :'doctor_session', :'first_region_id'), '%REGION_REVISION_CONFLICT%', 'Stale revision is rejected');
select throws_like(format($sql$select graftvision_private.save_scalp_region(%L::uuid, '31111111-1111-4111-8111-111111111111', '31111111-3333-4333-8333-333333333333', %L::uuid, 'crown_region', 'manual', null, null, 'graftvision-manual-relative-v1', 'manual_draw', 'draft', '[{"id":"71111111-1111-4111-8111-111111111111","order_index":0,"x":0,"y":0,"z":0},{"id":"71111111-1111-4111-8111-111111111112","order_index":1,"x":1,"y":0,"z":0},{"id":"71111111-1111-4111-8111-111111111113","order_index":2,"x":1,"y":1,"z":0},{"id":"71111111-1111-4111-8111-111111111114","order_index":3,"x":0,"y":1,"z":0}]'::jsonb, 2, '41111111-1111-4111-8111-111111111113'::uuid)$sql$, :'doctor_session', :'first_region_id'), '%REGION_IDEMPOTENCY_MISMATCH%', 'Changed replay payload is rejected');

select is((select count(*)::integer from public.scalp_region_version where scalp_region_id = :'first_region_id'), 2, 'conflicts do not create extra versions');
select is((select count(*)::integer from public.audit_event where resource_id = :'first_region_id' and action = 'region.version_created'), 2, 'only successful revisions are audited');
select * from graftvision_private.save_scalp_region(:'doctor_session', '31111111-1111-4111-8111-111111111111', '31111111-3333-4333-8333-333333333333', :'first_region_id', 'crown_region', 'manual', null, null, 'graftvision-manual-relative-v1', 'manual_draw', 'review', '[{"id":"71111111-1111-4111-8111-111111111111","order_index":0,"x":0,"y":0,"z":0},{"id":"71111111-1111-4111-8111-111111111112","order_index":1,"x":1,"y":0,"z":0},{"id":"71111111-1111-4111-8111-111111111113","order_index":2,"x":1,"y":1,"z":0},{"id":"71111111-1111-4111-8111-111111111114","order_index":3,"x":0,"y":1,"z":0}]'::jsonb, 1, '41111111-1111-4111-8111-111111111114'::uuid);

select is((select result_revision from public.scalp_region_idempotency where idempotency_key = '41111111-1111-4111-8111-111111111114'::uuid), 2, 'same request is idempotent');
select is((select result_version_id from public.scalp_region_idempotency where idempotency_key = '41111111-1111-4111-8111-111111111114'::uuid), :'second_region_version_id'::uuid, 'idempotency stores the original version identity');
select * from finish();
rollback;