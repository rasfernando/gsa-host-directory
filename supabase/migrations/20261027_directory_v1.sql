-- Directory V1 (Heather's requirements, 27 Oct 2026).
--
-- Apply in the Supabase SQL editor for project bryuqdnfobncfclomtti BEFORE
-- deploying feature/directory-v1. Everything here is additive and idempotent:
-- safe to run twice, touches no existing rows.
--
-- The app tolerates this not having been applied yet (admin saves skip the
-- new columns, panels show a notice), but the new features only work after it.

-- ── host_profiles: fields the internal database and the catalogue need ──────
alter table public.host_profiles
  add column if not exists postcode               text,
  add column if not exists host_multiple_per_year boolean,
  add column if not exists school_type            text,   -- e.g. "Mixed secondary and Sixth Form (academy)"
  add column if not exists prospectus_url         text,
  add column if not exists overview               text,   -- catalogue: Overview
  add column if not exists culture                text,   -- catalogue: Student body & culture
  add column if not exists curriculum             text,   -- catalogue: Curriculum & subjects
  add column if not exists enrichment             text,   -- catalogue: Enrichment & extracurricular
  add column if not exists standout               text;   -- catalogue: What makes the school stand out

-- ── schools: contact phone (name, email, role, website already exist) ───────
alter table public.schools
  add column if not exists contact_phone text;

-- ── Availability windows: dates a host can take a group, available/reserved ─
create table if not exists public.host_availability (
  id              uuid primary key default gen_random_uuid(),
  host_profile_id uuid not null references public.host_profiles(id) on delete cascade,
  starts_on       date not null,
  ends_on         date not null,
  status          text not null default 'available'
                  check (status in ('available', 'reserved')),
  reserved_for    text,            -- who it's held for (agent / school / trip), free text
  note            text,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  constraint host_availability_window check (ends_on >= starts_on)
);
create index if not exists host_availability_profile_idx
  on public.host_availability (host_profile_id, starts_on);

-- ── Internal notes / log per school ─────────────────────────────────────────
create table if not exists public.host_notes (
  id              uuid primary key default gen_random_uuid(),
  host_profile_id uuid not null references public.host_profiles(id) on delete cascade,
  body            text not null,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);
create index if not exists host_notes_profile_idx
  on public.host_notes (host_profile_id, created_at desc);

-- ── RLS: GSA admins only. Both tables are internal; schools never see them. ─
alter table public.host_availability enable row level security;
alter table public.host_notes        enable row level security;

drop policy if exists "gsa admins manage host_availability" on public.host_availability;
create policy "gsa admins manage host_availability" on public.host_availability
  for all to authenticated
  using (public.is_gsa_admin()) with check (public.is_gsa_admin());

drop policy if exists "gsa admins manage host_notes" on public.host_notes;
create policy "gsa admins manage host_notes" on public.host_notes
  for all to authenticated
  using (public.is_gsa_admin()) with check (public.is_gsa_admin());
