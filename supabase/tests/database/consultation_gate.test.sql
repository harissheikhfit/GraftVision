-- CONSULT-007 consolidated Consultation Gate policy assertions.
begin;
select plan(5);

select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid='public.consultation'::regclass),'consultation table enables and forces RLS');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid='public.consultation_status_history'::regclass),'consultation_status_history enables and forces RLS');
select has_trigger('public','consultation_status_history','consultation_status_history_immutable','consultation status history is immutable');
select ok(graftvision_private.is_valid_audit_action('consultation.create'),'consultation creation audit action remains allowed');
select ok(graftvision_private.is_valid_audit_action('consultation.status_change'),'consultation status_change audit action remains allowed');

select * from finish();
rollback;
