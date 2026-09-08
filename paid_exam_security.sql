-- PSCGram Paid Exam Security Upgrade
-- Run AFTER paid_exam.sql.
-- The website no longer needs direct browser access to exam_questions.
-- This removes public SELECT policies from exam_questions and leaves an
-- admin-only SELECT policy. Questions are served by the paid-exam function
-- without exposing correct_option.

do $$
declare p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname='public'
      and tablename='exam_questions'
      and cmd='SELECT'
      and coalesce(qual,'') not like '%60d7f743-1b0f-48ad-a72c-2e6825b863e6%'
  loop
    execute format('drop policy if exists %I on public.exam_questions', p.policyname);
  end loop;
end $$;

drop policy if exists "Admin can manage questions" on public.exam_questions;
create policy "Admin can manage questions"
on public.exam_questions for all
using (auth.uid() = '60d7f743-1b0f-48ad-a72c-2e6825b863e6'::uuid)
with check (auth.uid() = '60d7f743-1b0f-48ad-a72c-2e6825b863e6'::uuid);

-- Also prevent students from reading attempts/answers directly.
do $$
declare p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname='public'
      and tablename in ('exam_attempts','exam_answers')
      and cmd='SELECT'
      and coalesce(qual,'') not like '%60d7f743-1b0f-48ad-a72c-2e6825b863e6%'
  loop
    execute format('drop policy if exists %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

-- Paid/free exam attempts and scoring are now handled by the Edge Function.
