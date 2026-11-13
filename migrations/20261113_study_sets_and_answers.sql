-- Private generated review sheets, practice tests and answer history.
create table if not exists public.study_sets (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 class_id text not null,
 unit_title text not null,
 title text not null,
 source_document_ids uuid[] not null default '{}',
 content jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index if not exists study_sets_owner_unit_idx on public.study_sets(user_id,class_id,unit_title,created_at desc);
alter table public.study_sets enable row level security;
revoke all on public.study_sets from anon;
grant select,insert,update,delete on public.study_sets to authenticated;
create policy "Students select own study sets" on public.study_sets for select to authenticated using ((select auth.uid())=user_id);
create policy "Students insert own study sets" on public.study_sets for insert to authenticated with check ((select auth.uid())=user_id);
create policy "Students update own study sets" on public.study_sets for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "Students delete own study sets" on public.study_sets for delete to authenticated using ((select auth.uid())=user_id);
create table if not exists public.study_answers (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 set_id uuid not null references public.study_sets(id) on delete cascade,
 question_id text not null,
 topic text not null,
 chosen_index integer not null check (chosen_index between 0 and 3),
 correct boolean not null,
 created_at timestamptz not null default now()
);
create index if not exists study_answers_owner_date_idx on public.study_answers(user_id,created_at desc);
create index if not exists study_answers_set_idx on public.study_answers(user_id,set_id);
alter table public.study_answers enable row level security;
revoke all on public.study_answers from anon;
grant select,insert on public.study_answers to authenticated;
create policy "Students select own answers" on public.study_answers for select to authenticated using ((select auth.uid())=user_id);
create policy "Students insert own answers" on public.study_answers for insert to authenticated
 with check ((select auth.uid())=user_id and exists (
   select 1 from public.study_sets s where s.id=set_id and s.user_id=(select auth.uid())
 ));
-- No update or delete to preserve an append-only progress record.
