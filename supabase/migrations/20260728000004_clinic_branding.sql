-- GraftVision migration
-- Task: CLINIC-003
-- Purpose: Add bounded clinic branding, private logo storage, optimistic concurrency, and history.
-- Created UTC: 20260728000004
-- graftvision:dangerous-sql-approved task=CLINIC-003
-- graftvision:dangerous-sql-reason Reviewed typed branding state, private bucket, controlled procedures, and immutable history.
-- graftvision:corrective-plan Forward-fix with a later additive migration; historical migrations remain unchanged.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'clinic-branding-private',
  'clinic-branding-private',
  false,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table public.clinic_branding (
  clinic_id uuid primary key references public.clinic(id) on update restrict on delete restrict,
  clinic_name text not null,
  report_header_text text not null,
  presentation_title_text text not null,
  primary_accent text not null default '#14532d',
  secondary_accent text not null default '#0f766e',
  link_accent text not null default '#155e75',
  selected_control_accent text not null default '#166534',
  logo_object_key text,
  logo_mime_type text,
  logo_width integer,
  logo_height integer,
  branding_revision integer not null default 1,
  updated_at timestamptz not null default timezone('utc', statement_timestamp()),
  updated_by_platform_user_id uuid
    references public.platform_user(id) on update restrict on delete restrict,
  constraint clinic_branding_name_check
    check (length(clinic_name) between 1 and 160 and clinic_name !~ '[[:cntrl:]]'),
  constraint clinic_branding_report_header_check
    check (length(report_header_text) between 1 and 120 and report_header_text !~ '[[:cntrl:]]'),
  constraint clinic_branding_presentation_title_check
    check (length(presentation_title_text) between 1 and 80 and presentation_title_text !~ '[[:cntrl:]]'),
  constraint clinic_branding_primary_accent_check check (primary_accent ~ '^#[0-9a-f]{6}$'),
  constraint clinic_branding_secondary_accent_check check (secondary_accent ~ '^#[0-9a-f]{6}$'),
  constraint clinic_branding_link_accent_check check (link_accent ~ '^#[0-9a-f]{6}$'),
  constraint clinic_branding_selected_accent_check
    check (selected_control_accent ~ '^#[0-9a-f]{6}$'),
  constraint clinic_branding_logo_complete_check check (
    (logo_object_key is null and logo_mime_type is null and logo_width is null and logo_height is null)
    or (
      logo_object_key is not null
      and logo_mime_type in ('image/png', 'image/jpeg', 'image/webp', 'image/svg+xml')
      and logo_width between 256 and 2048
      and logo_height between 256 and 2048
    )
  ),
  constraint clinic_branding_revision_check check (branding_revision >= 1)
);

insert into public.clinic_branding (
  clinic_id, clinic_name, report_header_text, presentation_title_text
)
select id, display_name, display_name, display_name
from public.clinic;

create table public.clinic_branding_history (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinic(id) on update restrict on delete restrict,
  previous_revision integer not null,
  new_revision integer not null,
  changed_fields text[] not null,
  logo_object_class text,
  logo_object_key text,
  reason_code text not null check (reason_code in ('BRANDING_UPDATED', 'LOGO_REMOVED')),
  actor_platform_user_id uuid not null
    references public.platform_user(id) on update restrict on delete restrict,
  occurred_at timestamptz not null default clock_timestamp(),
  check (new_revision = previous_revision + 1),
  check (cardinality(changed_fields) between 1 and 9),
  check (changed_fields <@ array[
    'clinic_name', 'report_header_text', 'presentation_title_text',
    'primary_accent', 'secondary_accent', 'link_accent',
    'selected_control_accent', 'logo_object_key', 'logo_removed'
  ]::text[]),
  check (logo_object_class is null or logo_object_class = 'clinic-branding'),
  check (
    logo_object_key is null
    or logo_object_key ~ '^clinics/[0-9a-f-]{36}/clinic-assets/clinic-branding/clinic-logo/[0-9a-f-]{36}/v[0-9]{4}/original\.(png|jpeg|jpg|webp|svg)$'
  )
);

create index clinic_branding_history_clinic_revision_idx
  on public.clinic_branding_history (clinic_id, new_revision desc);

alter table public.clinic_branding enable row level security;
alter table public.clinic_branding force row level security;
alter table public.clinic_branding_history enable row level security;
alter table public.clinic_branding_history force row level security;
revoke all on table public.clinic_branding from public, anon, authenticated;
revoke all on table public.clinic_branding_history from public, anon, authenticated;

create trigger clinic_branding_history_immutable
before update or delete on public.clinic_branding_history
for each row execute function graftvision_private.prevent_clinic_history_mutation();

create function graftvision_private.enforce_controlled_clinic_branding_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_setting('graftvision.clinic_branding_controlled', true) <> 'on' then
    raise exception using errcode = '55000', message = 'CLINIC_BRANDING_CONTROLLED_UPDATE_REQUIRED';
  end if;
  return new;
end;
$$;

revoke all on function graftvision_private.enforce_controlled_clinic_branding_update()
  from public, anon, authenticated;

create trigger clinic_branding_controlled_update
before insert or update or delete on public.clinic_branding
for each row execute function graftvision_private.enforce_controlled_clinic_branding_update();

create function graftvision_private.create_default_clinic_branding()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform set_config('graftvision.clinic_branding_controlled', 'on', true);
  insert into public.clinic_branding (
    clinic_id, clinic_name, report_header_text, presentation_title_text
  ) values (
    new.id, new.display_name, new.display_name, new.display_name
  );
  perform set_config('graftvision.clinic_branding_controlled', 'off', true);
  return new;
end;
$$;

revoke all on function graftvision_private.create_default_clinic_branding()
  from public, anon, authenticated;

create trigger clinic_create_default_branding
after insert on public.clinic
for each row execute function graftvision_private.create_default_clinic_branding();

create or replace function graftvision_private.is_valid_audit_action(candidate text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select candidate in (
    'audit.correct', 'audit.create', 'authority.cross_scope_denied', 'authority.scope_change',
    'authorization.version_increment', 'clinic.branding_conflict', 'clinic.branding_update',
    'clinic.branding_view', 'clinic.create', 'clinic.inactivate', 'clinic.read',
    'clinic.reactivate', 'clinic.settings_conflict', 'clinic.settings_update',
    'clinic.settings_view', 'clinic.suspend', 'doctor.verification.expired',
    'doctor.verification.pending', 'doctor.verification.rejected', 'doctor.verification.revoked',
    'doctor.verification.verified', 'invitation.accept', 'invitation.create',
    'invitation.resend', 'invitation.revoke', 'membership.create', 'membership.deactivate',
    'membership.read', 'membership.reactivate', 'membership.role_assign',
    'membership.role_remove', 'membership.suspend', 'platform.admin', 'role.assign',
    'role.remove', 'session.create', 'session.deny_inactive_user', 'session.end',
    'session.expire_absolute', 'session.expire_idle', 'session.lock',
    'session.logout_after_lock', 'session.reauthentication_failed',
    'session.revoke_authorization_change', 'session.revoke_inactive_membership',
    'session.revoke_inactive_user', 'session.revoke_other', 'session.revoke_others',
    'session.unlock', 'storage_key.validate', 'system.migration', 'user.deactivate',
    'user.reactivate'
  );
$$;

create function graftvision_private.has_clinic_branding_authority(
  p_session_id uuid,
  p_provider_identity_id uuid
)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select graftvision_private.has_application_session_permission(
    p_session_id,
    p_provider_identity_id,
    'clinic',
    (select clinic_id from public.application_session where id = p_session_id),
    'ADMIN-PERM-001'
  );
$$;

revoke all on function graftvision_private.has_clinic_branding_authority(uuid, uuid)
  from public, anon, authenticated;

create function graftvision_private.branding_relative_luminance(p_colour text)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_r numeric := ('x' || substr(p_colour, 2, 2))::bit(8)::integer / 255.0;
  v_g numeric := ('x' || substr(p_colour, 4, 2))::bit(8)::integer / 255.0;
  v_b numeric := ('x' || substr(p_colour, 6, 2))::bit(8)::integer / 255.0;
begin
  v_r := case when v_r <= 0.04045 then v_r / 12.92 else power((v_r + 0.055) / 1.055, 2.4) end;
  v_g := case when v_g <= 0.04045 then v_g / 12.92 else power((v_g + 0.055) / 1.055, 2.4) end;
  v_b := case when v_b <= 0.04045 then v_b / 12.92 else power((v_b + 0.055) / 1.055, 2.4) end;
  return 0.2126 * v_r + 0.7152 * v_g + 0.0722 * v_b;
end;
$$;

create function graftvision_private.is_safe_brand_accent(p_colour text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_luminance numeric;
  v_r integer;
  v_g integer;
  v_b integer;
begin
  if p_colour is null or p_colour !~ '^#[0-9a-f]{6}$' then return false; end if;
  v_luminance := graftvision_private.branding_relative_luminance(p_colour);
  v_r := ('x' || substr(p_colour, 2, 2))::bit(8)::integer;
  v_g := ('x' || substr(p_colour, 4, 2))::bit(8)::integer;
  v_b := ('x' || substr(p_colour, 6, 2))::bit(8)::integer;
  return greatest((1.05 / (v_luminance + 0.05)), ((v_luminance + 0.05) / 0.05)) >= 4.5
    and (1.05 / (v_luminance + 0.05)) >= 3
    and greatest(v_r, v_g, v_b) - least(v_r, v_g, v_b) <= 220;
end;
$$;

revoke all on function graftvision_private.branding_relative_luminance(text)
  from public, anon, authenticated;
revoke all on function graftvision_private.is_safe_brand_accent(text)
  from public, anon, authenticated;

create function graftvision_private.read_clinic_branding(
  p_session_id uuid,
  p_provider_identity_id uuid
)
returns table (
  clinic_id uuid,
  clinic_name text,
  report_header_text text,
  presentation_title_text text,
  primary_accent text,
  secondary_accent text,
  link_accent text,
  selected_control_accent text,
  logo_object_key text,
  logo_mime_type text,
  logo_width integer,
  logo_height integer,
  branding_revision integer,
  updated_at timestamptz,
  updated_by_platform_user_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clinic_id uuid;
begin
  if not graftvision_private.has_clinic_branding_authority(
    p_session_id, p_provider_identity_id
  ) then
    raise exception using errcode = '42501', message = 'AUTH_PERMISSION_DENIED';
  end if;
  select s.clinic_id into v_clinic_id
  from public.application_session s where s.id = p_session_id;
  insert into public.audit_event (
    audit_scope, clinic_id, actor_platform_user_id, actor_type, action,
    resource_type, resource_id, outcome, reason_code, source_application, metadata
  ) values (
    'clinic', v_clinic_id, p_provider_identity_id, 'user', 'clinic.branding_view',
    'clinic', v_clinic_id, 'success', 'BRANDING_VIEWED', 'database', '{}'::jsonb
  );
  return query
  select b.clinic_id, b.clinic_name, b.report_header_text, b.presentation_title_text,
    b.primary_accent, b.secondary_accent, b.link_accent, b.selected_control_accent,
    b.logo_object_key, b.logo_mime_type, b.logo_width, b.logo_height,
    b.branding_revision, b.updated_at, b.updated_by_platform_user_id
  from public.clinic_branding b where b.clinic_id = v_clinic_id;
end;
$$;

revoke all on function graftvision_private.read_clinic_branding(uuid, uuid)
  from public, anon, authenticated;

create function graftvision_private.update_clinic_branding(
  p_session_id uuid,
  p_provider_identity_id uuid,
  p_expected_revision integer,
  p_clinic_name text,
  p_report_header_text text,
  p_presentation_title_text text,
  p_primary_accent text,
  p_secondary_accent text,
  p_link_accent text,
  p_selected_control_accent text,
  p_logo_mode text,
  p_logo_object_key text,
  p_logo_mime_type text,
  p_logo_width integer,
  p_logo_height integer,
  p_reason_code text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_branding public.clinic_branding%rowtype;
  v_clinic_id uuid;
  v_changed_fields text[];
  v_logo_key text;
  v_logo_mime text;
  v_logo_width integer;
  v_logo_height integer;
begin
  if not graftvision_private.has_clinic_branding_authority(
    p_session_id, p_provider_identity_id
  ) then
    raise exception using errcode = '42501', message = 'AUTH_PERMISSION_DENIED';
  end if;
  if p_clinic_name is null or p_clinic_name <> btrim(p_clinic_name)
    or length(p_clinic_name) not between 1 and 160 or p_clinic_name ~ '[[:cntrl:]]'
    or p_report_header_text is null or p_report_header_text <> btrim(p_report_header_text)
    or length(p_report_header_text) not between 1 and 120 or p_report_header_text ~ '[[:cntrl:]]'
    or p_presentation_title_text is null
    or p_presentation_title_text <> btrim(p_presentation_title_text)
    or length(p_presentation_title_text) not between 1 and 80
    or p_presentation_title_text ~ '[[:cntrl:]]' then
    raise exception using errcode = '22023', message = 'INVALID_BRANDING_TEXT';
  end if;
  if not graftvision_private.is_safe_brand_accent(p_primary_accent)
    or not graftvision_private.is_safe_brand_accent(p_secondary_accent)
    or not graftvision_private.is_safe_brand_accent(p_link_accent)
    or not graftvision_private.is_safe_brand_accent(p_selected_control_accent) then
    raise exception using errcode = '22023', message = 'INVALID_BRANDING_ACCENT';
  end if;
  if p_logo_mode not in ('keep', 'replace', 'remove') then
    raise exception using errcode = '22023', message = 'INVALID_LOGO_MODE';
  end if;
  if p_reason_code not in ('BRANDING_UPDATED', 'LOGO_REMOVED') then
    raise exception using errcode = '22023', message = 'INVALID_BRANDING_REASON';
  end if;

  select s.clinic_id into v_clinic_id
  from public.application_session s where s.id = p_session_id;
  select b.* into v_branding
  from public.clinic_branding b where b.clinic_id = v_clinic_id for update;

  if v_branding.branding_revision <> p_expected_revision then
    insert into public.audit_event (
      audit_scope, clinic_id, actor_platform_user_id, actor_type, action,
      resource_type, resource_id, outcome, reason_code, source_application, metadata
    ) values (
      'clinic', v_clinic_id, p_provider_identity_id, 'user', 'clinic.branding_conflict',
      'clinic', v_clinic_id, 'denied', 'REVISION_CONFLICT', 'database', '{}'::jsonb
    );
    return 'conflict';
  end if;

  if p_logo_mode = 'replace' then
    if p_logo_object_key is null
      or p_logo_object_key !~ (
        '^clinics/' || v_clinic_id::text ||
        '/clinic-assets/clinic-branding/clinic-logo/[0-9a-f-]{36}/v[0-9]{4}/original\.(png|jpeg|jpg|webp|svg)$'
      )
      or p_logo_mime_type not in ('image/png', 'image/jpeg', 'image/webp', 'image/svg+xml')
      or p_logo_width not between 256 and 2048
      or p_logo_height not between 256 and 2048 then
      raise exception using errcode = '22023', message = 'INVALID_BRANDING_LOGO';
    end if;
    v_logo_key := p_logo_object_key;
    v_logo_mime := p_logo_mime_type;
    v_logo_width := p_logo_width;
    v_logo_height := p_logo_height;
  elsif p_logo_mode = 'remove' then
    v_logo_key := null;
    v_logo_mime := null;
    v_logo_width := null;
    v_logo_height := null;
  else
    v_logo_key := v_branding.logo_object_key;
    v_logo_mime := v_branding.logo_mime_type;
    v_logo_width := v_branding.logo_width;
    v_logo_height := v_branding.logo_height;
  end if;

  select array_agg(field_name order by field_name) into v_changed_fields
  from (
    select 'clinic_name' field_name where v_branding.clinic_name is distinct from p_clinic_name
    union all select 'report_header_text' where v_branding.report_header_text is distinct from p_report_header_text
    union all select 'presentation_title_text' where v_branding.presentation_title_text is distinct from p_presentation_title_text
    union all select 'primary_accent' where v_branding.primary_accent is distinct from p_primary_accent
    union all select 'secondary_accent' where v_branding.secondary_accent is distinct from p_secondary_accent
    union all select 'link_accent' where v_branding.link_accent is distinct from p_link_accent
    union all select 'selected_control_accent' where v_branding.selected_control_accent is distinct from p_selected_control_accent
    union all select case when p_logo_mode = 'remove' then 'logo_removed' else 'logo_object_key' end
      where v_branding.logo_object_key is distinct from v_logo_key
  ) changes;
  if coalesce(cardinality(v_changed_fields), 0) = 0 then return 'unchanged'; end if;

  perform set_config('graftvision.clinic_branding_controlled', 'on', true);
  update public.clinic_branding
  set clinic_name = p_clinic_name,
      report_header_text = p_report_header_text,
      presentation_title_text = p_presentation_title_text,
      primary_accent = p_primary_accent,
      secondary_accent = p_secondary_accent,
      link_accent = p_link_accent,
      selected_control_accent = p_selected_control_accent,
      logo_object_key = v_logo_key,
      logo_mime_type = v_logo_mime,
      logo_width = v_logo_width,
      logo_height = v_logo_height,
      branding_revision = branding_revision + 1,
      updated_at = timezone('utc', statement_timestamp()),
      updated_by_platform_user_id = p_provider_identity_id
  where clinic_id = v_clinic_id;
  perform set_config('graftvision.clinic_branding_controlled', 'off', true);

  insert into public.clinic_branding_history (
    clinic_id, previous_revision, new_revision, changed_fields,
    logo_object_class, logo_object_key, reason_code, actor_platform_user_id
  ) values (
    v_clinic_id, v_branding.branding_revision, v_branding.branding_revision + 1,
    v_changed_fields,
    case when v_logo_key is null then null else 'clinic-branding' end,
    v_logo_key, p_reason_code, p_provider_identity_id
  );
  insert into public.audit_event (
    audit_scope, clinic_id, actor_platform_user_id, actor_type, action,
    resource_type, resource_id, outcome, reason_code, source_application, metadata
  ) values (
    'clinic', v_clinic_id, p_provider_identity_id, 'user', 'clinic.branding_update',
    'clinic', v_clinic_id, 'success', p_reason_code, 'database',
    jsonb_build_object('changed_fields', v_changed_fields)
  );
  return 'updated';
end;
$$;

revoke all on function graftvision_private.update_clinic_branding(
  uuid, uuid, integer, text, text, text, text, text, text, text,
  text, text, text, integer, integer, text
) from public, anon, authenticated;
