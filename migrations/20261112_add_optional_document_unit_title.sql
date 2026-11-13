-- Already applied to Supabase project kkjlfvkbtcjkgourkowa.
-- Additive change: retains every existing student and document row.
alter table public.study_documents add column if not exists unit_title text;
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'study_documents_unit_title_length'
      and conrelid='public.study_documents'::regclass
  ) then
    alter table public.study_documents add constraint study_documents_unit_title_length
      check (unit_title is null or char_length(unit_title) between 1 and 90);
  end if;
end $$;
