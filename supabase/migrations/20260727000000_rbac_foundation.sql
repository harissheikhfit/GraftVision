-- GraftVision migration
-- Task: RBAC-001
-- Purpose: Implement foundational RBAC exactly fulfilling 13 roles and 58 permissions.
-- Created UTC: 20260727000000
-- Category: schema creation, constraints, indexes, functions, triggers, grants, and RLS policies
-- graftvision:dangerous-sql-approved task=RBAC-001
-- graftvision:dangerous-sql-reason Reviewed RBAC seed updates and superseded broad lookup policies.
-- graftvision:corrective-plan Correct lookup visibility in the additive RBAC hardening migration.

create table public.role_definition (
  role_code text primary key,
  role_type text not null check (role_type in ('platform', 'clinic')),
  display_name text not null,
  created_at timestamptz not null default timezone('utc', statement_timestamp())
);

comment on table public.role_definition is 'Lookup table for authoritative role definitions. Avoids PostgreSQL enums for MVP control.';

create table public.permission_definition (
  permission_id text primary key,
  created_at timestamptz not null default timezone('utc', statement_timestamp())
);

comment on table public.permission_definition is 'Lookup table for the 58 exact authoritative permission IDs.';

create table public.role_permission (
  role_code text not null,
  permission_id text not null,
  created_at timestamptz not null default timezone('utc', statement_timestamp()),
  primary key (role_code, permission_id),
  constraint role_permission_role_code_fk foreign key (role_code) references public.role_definition (role_code) on update restrict on delete restrict,
  constraint role_permission_permission_id_fk foreign key (permission_id) references public.permission_definition (permission_id) on update restrict on delete restrict
);

-- Seed authoritative permissions
insert into public.permission_definition (permission_id) values
  ('TENANT-ACCESS-001'), ('TENANT-ACCESS-002'), ('TENANT-ACCESS-003'), ('TENANT-ACCESS-004'),
  ('PATIENT-PERM-001'), ('PATIENT-PERM-002'), ('PATIENT-PERM-003'),
  ('CONSULT-PERM-001'), ('CONSULT-PERM-002'),
  ('SCAN-PERM-001'), ('SCAN-PERM-002'),
  ('MODEL-PERM-001'), ('MODEL-PERM-002'),
  ('MEASURE-PERM-001'), ('MEASURE-PERM-002'),
  ('GRAFT-PERM-001'), ('GRAFT-PERM-002'),
  ('HAIRLINE-PERM-001'), ('HAIRLINE-PERM-002'),
  ('AI-PERM-001'), ('AI-PERM-002'),
  ('ROLE-001'), ('ROLE-002'), ('ROLE-003'), ('ROLE-004'), ('ROLE-005'),
  ('ROLE-006'), ('ROLE-007'), ('ROLE-008'), ('ROLE-009'), ('ROLE-010'),
  ('PROC-PERM-001'), ('PROC-PERM-002'),
  ('FOLLOW-PERM-001'), ('FOLLOW-PERM-002'),
  ('REPORT-PERM-001'), ('REPORT-PERM-002'), ('REPORT-PERM-003'), ('REPORT-PERM-004'),
  ('PRESENT-PERM-001'), ('PRESENT-PERM-002'), ('PRESENT-PERM-003'),
  ('ADMIN-PERM-001'), ('ADMIN-PERM-002'), ('ADMIN-PERM-003'), ('ADMIN-PERM-004'), ('ADMIN-PERM-005'), ('ADMIN-PERM-006'),
  ('AUDIT-PERM-001'), ('AUDIT-PERM-002'),
  ('EXPORT-PERM-001'), ('EXPORT-PERM-002'),
  ('DELETE-PERM-001'), ('DELETE-PERM-002'),
  ('SUPPORT-PERM-001'), ('SUPPORT-PERM-002'), ('SUPPORT-PERM-003'), ('SUPPORT-PERM-004');

-- Seed 13 authoritative roles
insert into public.role_definition (role_code, role_type, display_name) values
  ('PLATFORM_OWNER', 'platform', 'Platform Owner'),
  ('PLATFORM_ADMIN', 'platform', 'Platform Administrator'),
  ('PLATFORM_SUPPORT', 'platform', 'Platform Support Engineer'),
  ('CLINIC_OWNER', 'clinic', 'Clinic Owner'),
  ('CLINIC_ADMIN', 'clinic', 'Clinic Administrator'),
  ('DOCTOR', 'clinic', 'Doctor / Hair-Transplant Surgeon'),
  ('CLINICAL_ASSISTANT', 'clinic', 'Clinical Assistant'),
  ('PROCEDURE_TECHNICIAN', 'clinic', 'Procedure Technician'),
  ('RECEPTION', 'clinic', 'Reception User'),
  ('REPORT_COORDINATOR', 'clinic', 'Report Coordinator'),
  ('PRESENTATION', 'clinic', 'Presentation User'),
  ('REVIEWER', 'clinic', 'Read-Only Clinical Reviewer'),
  ('PATIENT', 'clinic', 'Patient');

alter table public.platform_user add column authorization_version integer not null default 1;
alter table public.clinic_membership add column authorization_version integer not null default 1;

create table public.platform_user_role (
  id uuid primary key default gen_random_uuid(),
  platform_user_id uuid not null,
  role_code text not null,
  created_at timestamptz not null default timezone('utc', statement_timestamp()),
  constraint platform_user_role_user_fk foreign key (platform_user_id) references public.platform_user (id) on update restrict on delete restrict,
  constraint platform_user_role_role_fk foreign key (role_code) references public.role_definition (role_code) on update restrict on delete restrict,
  constraint platform_user_role_unique unique (platform_user_id, role_code)
);

create index platform_user_role_user_idx on public.platform_user_role (platform_user_id);

create table public.clinic_membership_role (
  id uuid primary key default gen_random_uuid(),
  clinic_membership_id uuid not null,
  role_code text not null,
  created_at timestamptz not null default timezone('utc', statement_timestamp()),
  constraint clinic_membership_role_membership_fk foreign key (clinic_membership_id) references public.clinic_membership (id) on update restrict on delete restrict,
  constraint clinic_membership_role_role_fk foreign key (role_code) references public.role_definition (role_code) on update restrict on delete restrict,
  constraint clinic_membership_role_unique unique (clinic_membership_id, role_code)
);

create index clinic_membership_role_membership_idx on public.clinic_membership_role (clinic_membership_id);

-- Constraint preventing patient assignment to staff membership
create function graftvision_private.prevent_patient_role_assignment()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.role_code = 'PATIENT' then
    raise exception using
      errcode = '23514',
      message = 'PATIENT role assignment through clinic_membership_role is prohibited pending explicit patient identity model';
  end if;
  return new;
end;
$$;

revoke all on function graftvision_private.prevent_patient_role_assignment() from public;

create trigger clinic_membership_role_prevent_patient
before insert or update on public.clinic_membership_role
for each row execute function graftvision_private.prevent_patient_role_assignment();

-- Trigger to enforce clinic role type
create function graftvision_private.enforce_clinic_role_type()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  r_type text;
begin
  select role_type into r_type from public.role_definition where role_code = new.role_code;
  if r_type != 'clinic' then
    raise exception using
      errcode = '23514',
      message = 'Cannot assign a platform role through clinic_membership_role';
  end if;
  return new;
end;
$$;

revoke all on function graftvision_private.enforce_clinic_role_type() from public;

create trigger clinic_membership_role_enforce_type
before insert or update on public.clinic_membership_role
for each row execute function graftvision_private.enforce_clinic_role_type();

-- Trigger to enforce platform role type
create function graftvision_private.enforce_platform_role_type()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  r_type text;
begin
  select role_type into r_type from public.role_definition where role_code = new.role_code;
  if r_type != 'platform' then
    raise exception using
      errcode = '23514',
      message = 'Cannot assign a clinic role through platform_user_role';
  end if;
  return new;
end;
$$;

revoke all on function graftvision_private.enforce_platform_role_type() from public;

create trigger platform_user_role_enforce_type
before insert or update on public.platform_user_role
for each row execute function graftvision_private.enforce_platform_role_type();

-- Triggers for authorization_version increment
create function graftvision_private.increment_platform_user_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.platform_user
  set authorization_version = authorization_version + 1,
      updated_at = timezone('utc', statement_timestamp())
  where id = coalesce(new.platform_user_id, old.platform_user_id);
  return null;
end;
$$;

revoke all on function graftvision_private.increment_platform_user_version() from public;

create trigger platform_user_role_version_increment
after insert or delete on public.platform_user_role
for each row execute function graftvision_private.increment_platform_user_version();

create function graftvision_private.increment_clinic_membership_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.clinic_membership
  set authorization_version = authorization_version + 1,
      updated_at = timezone('utc', statement_timestamp())
  where id = coalesce(new.clinic_membership_id, old.clinic_membership_id);
  return null;
end;
$$;

revoke all on function graftvision_private.increment_clinic_membership_version() from public;

create trigger clinic_membership_role_version_increment
after insert or delete on public.clinic_membership_role
for each row execute function graftvision_private.increment_clinic_membership_version();

-- RLS Policies
alter table public.role_definition enable row level security;
alter table public.role_definition force row level security;
alter table public.permission_definition enable row level security;
alter table public.permission_definition force row level security;
alter table public.role_permission enable row level security;
alter table public.role_permission force row level security;
alter table public.platform_user_role enable row level security;
alter table public.platform_user_role force row level security;
alter table public.clinic_membership_role enable row level security;
alter table public.clinic_membership_role force row level security;

revoke all on table public.role_definition from anon, authenticated;
revoke all on table public.permission_definition from anon, authenticated;
revoke all on table public.role_permission from anon, authenticated;
revoke all on table public.platform_user_role from anon, authenticated;
revoke all on table public.clinic_membership_role from anon, authenticated;

grant select on table public.role_definition to authenticated;
grant select on table public.permission_definition to authenticated;
grant select on table public.role_permission to authenticated;
grant select, insert, delete on table public.platform_user_role to authenticated;
grant select, insert, delete on table public.clinic_membership_role to authenticated;

-- Lookup tables: Select allowed for all authenticated, write denied
create policy lookup_select on public.role_definition for select to authenticated using (true);
create policy lookup_deny_insert on public.role_definition for insert to authenticated with check (false);
create policy lookup_deny_update on public.role_definition for update to authenticated using (false) with check (false);
create policy lookup_deny_delete on public.role_definition for delete to authenticated using (false);

create policy perm_select on public.permission_definition for select to authenticated using (true);
create policy perm_deny_insert on public.permission_definition for insert to authenticated with check (false);
create policy perm_deny_update on public.permission_definition for update to authenticated using (false) with check (false);
create policy perm_deny_delete on public.permission_definition for delete to authenticated using (false);

create policy rp_select on public.role_permission for select to authenticated using (true);
create policy rp_deny_insert on public.role_permission for insert to authenticated with check (false);
create policy rp_deny_update on public.role_permission for update to authenticated using (false) with check (false);
create policy rp_deny_delete on public.role_permission for delete to authenticated using (false);

-- platform_user_role policies
create policy platform_user_role_select
on public.platform_user_role
for select
to authenticated
using (platform_user_id = graftvision_private.current_platform_user_id());

create policy platform_user_role_deny_insert
on public.platform_user_role for insert to authenticated with check (false);

create policy platform_user_role_deny_update
on public.platform_user_role for update to authenticated using (false) with check (false);

create policy platform_user_role_deny_delete
on public.platform_user_role for delete to authenticated using (false);

-- clinic_membership_role policies
create policy clinic_membership_role_select_own_clinic
on public.clinic_membership_role
for select
to authenticated
using (
  exists (
    select 1 from public.clinic_membership m
    where m.id = clinic_membership_role.clinic_membership_id
    and m.clinic_id = graftvision_private.current_clinic_id()
    and graftvision_private.has_active_clinic_membership(m.clinic_id)
  )
);

create policy clinic_membership_role_deny_insert
on public.clinic_membership_role for insert to authenticated with check (false);

create policy clinic_membership_role_deny_update
on public.clinic_membership_role for update to authenticated using (false) with check (false);

create policy clinic_membership_role_deny_delete
on public.clinic_membership_role for delete to authenticated using (false);
