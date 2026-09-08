-- PSCGram Online Exam: ADMIN RLS POLICIES
-- Run this once in Supabase SQL Editor after the first exam SQL.

create policy "Admin can manage exams"
on exams for all
using (auth.uid() = '60d7f743-1b0f-48ad-a72c-2e6825b863e6'::uuid)
with check (auth.uid() = '60d7f743-1b0f-48ad-a72c-2e6825b863e6'::uuid);

create policy "Admin can manage questions"
on exam_questions for all
using (auth.uid() = '60d7f743-1b0f-48ad-a72c-2e6825b863e6'::uuid)
with check (auth.uid() = '60d7f743-1b0f-48ad-a72c-2e6825b863e6'::uuid);

create policy "Admin can view all attempts"
on exam_attempts for select
using (auth.uid() = '60d7f743-1b0f-48ad-a72c-2e6825b863e6'::uuid);

create policy "Admin can view all answers"
on exam_answers for select
using (auth.uid() = '60d7f743-1b0f-48ad-a72c-2e6825b863e6'::uuid);
