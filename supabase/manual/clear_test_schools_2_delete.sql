-- STEP 2 of 2: delete the host-school test data. Run step 1 first and read it.
--
-- Safety: this is a single transaction that ROLLS BACK by default. Run it once
-- as-is (it must finish without errors), then change the last line to COMMIT
-- and run it again.
--
-- Order matters: children before parents, so no foreign key is left dangling.
--   host_notes, host_availability, block_bookings, enquiries → host_profiles
--   verification_checks, evidence                          → host_applications
--   intake_invites, (unlink user_profiles)                 → schools
--
-- It deliberately does NOT touch trips, invoices, payments or the agents side.
-- If "delete from schools" fails with a foreign-key error from one of those,
-- STOP: a school has real transactions attached and needs a decision, not a
-- script.
--
-- Every table is existence-checked so this works before or after the Directory
-- V1 migration.

begin;

do $$
declare t text;
begin
  foreach t in array array[
    'host_notes', 'host_availability', 'block_bookings', 'enquiries',
    'host_profiles',
    'verification_checks', 'evidence', 'host_applications',
    'intake_invites'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('delete from public.%I', t);
    end if;
  end loop;
end $$;

-- Unlink school accounts before deleting the schools themselves, so the
-- people keep their logins and can register again.
update public.user_profiles set school_id = null where school_id is not null;
delete from public.schools;

-- Should now be all zeros.
select 'host_profiles' as tbl, count(*) as remaining from public.host_profiles
union all select 'host_applications', count(*) from public.host_applications
union all select 'schools',           count(*) from public.schools;

rollback;   -- change to COMMIT once the dry run above completes without errors
