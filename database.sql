-- Run this once in Supabase > SQL Editor.
create table if not exists public.study_hubs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  classes jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.study_hubs enable row level security;
revoke all on public.study_hubs from anon;
grant select, insert, update, delete on public.study_hubs to authenticated;
drop policy if exists "Students read own hub" on public.study_hubs;
drop policy if exists "Students insert own hub" on public.study_hubs;
drop policy if exists "Students update own hub" on public.study_hubs;
create policy "Students read own hub" on public.study_hubs for select to authenticated using ((select auth.uid()) = user_id);
create policy "Students insert own hub" on public.study_hubs for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Students update own hub" on public.study_hubs for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);