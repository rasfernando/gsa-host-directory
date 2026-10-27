-- Clear ALL host-school data so GSA can start from scratch (Heather, 27 Oct 2026).
--
-- DO NOT RUN until Heather has confirmed that everything currently in the
-- directory is test data. She also sent a real Co-op Academy Bebington profile,
-- so "all of it is test" is not a safe assumption.
--
-- Safety: this runs inside a transaction that ROLLS BACK by default. Run it as-is
-- first and read the row counts it prints. When you're sure, change the final
-- ROLLBACK to COMMIT and run it again.
--
-- It deliberately does NOT touch trips, invoices, payments or enquiries. If a
-- delete below fails with a foreign-key error from one of those, STOP: that means
-- a school has real transactions attached and needs a decision, not a script.

begin;

select 'host_notes'          as tbl, count(*) from public.host_notes
union all select 'host_availability',  count(*) from public.host_availability
union all select 'block_bookings',     count(*) from public.block_bookings
union all select 'verification_checks',count(*) from public.verification_checks
union all select 'applications',       count(*) from public.applications
union all select 'host_profiles',      count(*) from public.host_profiles
union all select 'schools',            count(*) from public.schools;

delete from public.host_notes;
delete from public.host_availability;
delete from public.block_bookings;
delete from public.verification_checks;
delete from public.applications;
delete from public.host_profiles;

-- Unlink school accounts before deleting the schools themselves, so the
-- people keep their logins and can register again.
update public.user_profiles set school_id = null where school_id is not null;
delete from public.schools;

rollback;   -- change to COMMIT once the counts above look right
