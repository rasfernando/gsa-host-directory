-- STEP 1 of 2: what would be deleted? Read-only. Run this first.
--
-- Clearing ALL host-school data so GSA can start from scratch (Heather confirmed
-- on 27 Oct 2026 that everything currently in the directory is test data).
--
-- Tables are checked for existence first, so this runs the same before and
-- after the Directory V1 migration (host_notes / host_availability may not
-- exist yet). "n" is null when a table isn't there.

create temp table if not exists _gsa_counts (tbl text, n bigint);
truncate _gsa_counts;

do $$
declare t text;
begin
  foreach t in array array[
    'host_notes', 'host_availability', 'block_bookings', 'enquiries',
    'verification_checks', 'evidence', 'host_applications', 'intake_invites',
    'host_profiles', 'schools'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('insert into _gsa_counts select %L, count(*) from public.%I', t, t);
    else
      insert into _gsa_counts values (t, null);
    end if;
  end loop;
end $$;

select tbl, n from _gsa_counts;
