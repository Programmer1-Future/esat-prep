-- ESAT — Phase 7: auth, roles, cloud sync
-- Separate Supabase project from tmuaprep. Every object is esat_-prefixed.
-- Re-runnable: guarded creates + drop-then-create policies/triggers.
--
-- Ordering note: esat_profiles is created BEFORE esat_current_role(), because a
-- `language sql` function is validated at definition time and references the
-- table. Policies come after the function they call.
--
-- Security model (differs deliberately from TMUA's invite-allowlist):
--   * Each signed-in user owns exactly one esat_user_state row and one
--     esat_profiles row, isolated by RLS on user_id = auth.uid().
--   * Roles (admin / contributor / user) are orthogonal to isolation and
--     drive privileges, not access to other users' learning records.
--   * There are NO hardcoded admin emails anywhere — the first admin is
--     promoted with a one-line UPDATE after signup (see bottom of file).

-- ── Profiles: identity + role ────────────────────────────────────────────────
create table if not exists public.esat_profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  role       text not null default 'user' check (role in ('admin', 'contributor', 'user')),
  created_at timestamptz not null default now()
);

alter table public.esat_profiles enable row level security;

-- Role lookup (SECURITY DEFINER breaks RLS recursion). Called from policies on
-- esat_profiles; must NOT itself trigger those policies, so it runs as owner and
-- bypasses RLS. search_path is pinned to prevent table-shadowing.
create or replace function public.esat_current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.esat_profiles where id = auth.uid()
$$;

drop policy if exists "esat_profiles read own"      on public.esat_profiles;
drop policy if exists "esat_profiles read all admin" on public.esat_profiles;
drop policy if exists "esat_profiles insert self"    on public.esat_profiles;
drop policy if exists "esat_profiles admin update"   on public.esat_profiles;

create policy "esat_profiles read own" on public.esat_profiles
  for select to authenticated
  using (id = auth.uid());

create policy "esat_profiles read all admin" on public.esat_profiles
  for select to authenticated
  using (public.esat_current_role() = 'admin');

-- Self-heal only: a user may create their OWN row and only as a plain 'user'.
-- The WITH CHECK forbids self-promotion. Normal creation is the trigger below.
create policy "esat_profiles insert self" on public.esat_profiles
  for insert to authenticated
  with check (id = auth.uid() and role = 'user');

create policy "esat_profiles admin update" on public.esat_profiles
  for update to authenticated
  using (public.esat_current_role() = 'admin')
  with check (public.esat_current_role() = 'admin');

-- Auto-create a profile on signup (owner rights, bypasses the insert policy).
create or replace function public.esat_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.esat_profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists esat_on_auth_user_created on auth.users;
create trigger esat_on_auth_user_created
  after insert on auth.users
  for each row execute function public.esat_handle_new_user();

-- Never let the last admin be demoted or deleted (self-lockout guard).
create or replace function public.esat_protect_last_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'DELETE' and old.role = 'admin')
     or (tg_op = 'UPDATE' and old.role = 'admin' and new.role <> 'admin') then
    if (select count(*) from public.esat_profiles where role = 'admin') <= 1 then
      raise exception 'Cannot remove the last admin';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists esat_guard_last_admin on public.esat_profiles;
create trigger esat_guard_last_admin
  before update or delete on public.esat_profiles
  for each row execute function public.esat_protect_last_admin();

-- ── User state: one JSON blob per user (TMUA cloudSync pattern) ───────────────
create table if not exists public.esat_user_state (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.esat_user_state enable row level security;

drop policy if exists "esat_state read own"       on public.esat_user_state;
drop policy if exists "esat_state read all admin" on public.esat_user_state;
drop policy if exists "esat_state insert own"     on public.esat_user_state;
drop policy if exists "esat_state update own"     on public.esat_user_state;
drop policy if exists "esat_state delete own"     on public.esat_user_state;

create policy "esat_state read own" on public.esat_user_state
  for select to authenticated
  using (user_id = auth.uid());

-- Admins read all state for the admin dashboard analytics. Contributors cannot.
create policy "esat_state read all admin" on public.esat_user_state
  for select to authenticated
  using (public.esat_current_role() = 'admin');

create policy "esat_state insert own" on public.esat_user_state
  for insert to authenticated
  with check (user_id = auth.uid());

create policy "esat_state update own" on public.esat_user_state
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "esat_state delete own" on public.esat_user_state
  for delete to authenticated
  using (user_id = auth.uid());

-- ── Content tables: contributor-managed, readable by all signed-in users ─────
-- These give the contributor role real, DB-enforced teeth now; the content
-- CRUD/import lands on top later (notes content, spec-verified questions).
create or replace function public.esat_can_edit_content()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.esat_current_role() in ('admin', 'contributor')
$$;

create table if not exists public.esat_questions (
  id           text primary key,
  source       text,
  year         int,
  paper        text,
  module       text not null,
  topic        text not null,
  subtopic     text,
  difficulty   int check (difficulty between 1 and 5),
  question     text not null,
  options      jsonb not null,
  answer       text not null,
  technique    text,
  origin       text,
  quality_tier text,
  spec_status  text,
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.esat_notes (
  id         uuid primary key default gen_random_uuid(),
  module     text not null,
  topic      text not null,
  title      text not null,
  body       text not null default '',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.esat_questions enable row level security;
alter table public.esat_notes     enable row level security;

drop policy if exists "esat_questions read"   on public.esat_questions;
drop policy if exists "esat_questions insert" on public.esat_questions;
drop policy if exists "esat_questions update" on public.esat_questions;
drop policy if exists "esat_questions delete" on public.esat_questions;
drop policy if exists "esat_notes read"       on public.esat_notes;
drop policy if exists "esat_notes insert"     on public.esat_notes;
drop policy if exists "esat_notes update"     on public.esat_notes;
drop policy if exists "esat_notes delete"     on public.esat_notes;

create policy "esat_questions read"   on public.esat_questions for select to authenticated using (true);
create policy "esat_questions insert" on public.esat_questions for insert to authenticated with check (public.esat_can_edit_content());
create policy "esat_questions update" on public.esat_questions for update to authenticated using (public.esat_can_edit_content()) with check (public.esat_can_edit_content());
create policy "esat_questions delete" on public.esat_questions for delete to authenticated using (public.esat_can_edit_content());

create policy "esat_notes read"   on public.esat_notes for select to authenticated using (true);
create policy "esat_notes insert" on public.esat_notes for insert to authenticated with check (public.esat_can_edit_content());
create policy "esat_notes update" on public.esat_notes for update to authenticated using (public.esat_can_edit_content()) with check (public.esat_can_edit_content());
create policy "esat_notes delete" on public.esat_notes for delete to authenticated using (public.esat_can_edit_content());

-- Bump updated_at on content edits.
create or replace function public.esat_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists esat_questions_touch on public.esat_questions;
create trigger esat_questions_touch
  before update on public.esat_questions
  for each row execute function public.esat_touch_updated_at();

drop trigger if exists esat_notes_touch on public.esat_notes;
create trigger esat_notes_touch
  before update on public.esat_notes
  for each row execute function public.esat_touch_updated_at();

-- ── Grants ───────────────────────────────────────────────────────────────────
-- RLS does the row-level filtering; these are the table-level door.
-- anon (logged-out) gets NOTHING — the app is fully gated behind sign-in.
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.esat_profiles   to authenticated;
grant select, insert, update, delete on public.esat_user_state to authenticated;
grant select, insert, update, delete on public.esat_questions  to authenticated;
grant select, insert, update, delete on public.esat_notes      to authenticated;
grant execute on function public.esat_current_role()    to authenticated;
grant execute on function public.esat_can_edit_content() to authenticated;

-- Harden the API surface (Supabase advisor 0028/0029): trigger-only functions
-- need no direct EXECUTE at all; the two policy-helpers are called by the
-- `authenticated` role only, never anon.
revoke execute on function public.esat_handle_new_user()   from public, anon, authenticated;
revoke execute on function public.esat_protect_last_admin() from public, anon, authenticated;
revoke execute on function public.esat_touch_updated_at()   from public, anon, authenticated;
revoke execute on function public.esat_current_role()    from public, anon;
revoke execute on function public.esat_can_edit_content() from public, anon;

-- ── First admin ──────────────────────────────────────────────────────────────
-- After the first person signs in, promote them (no hardcoded email in code):
--   update public.esat_profiles set role = 'admin' where email = 'you@example.com';
