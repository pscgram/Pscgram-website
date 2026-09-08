-- PSCGram Paid Online Exams
-- Run this once in Supabase SQL Editor before using paid exams.

alter table exams add column if not exists is_paid boolean not null default false;
alter table exams add column if not exists price numeric(10,2) not null default 0;

create table if not exists exam_access (
  id uuid primary key default gen_random_uuid(),
  exam_id text not null,
  student_name text not null,
  student_email text not null,
  razorpay_order_id text not null unique,
  razorpay_payment_id text not null unique,
  access_token uuid not null default gen_random_uuid() unique,
  created_at timestamptz not null default now()
);

alter table exam_access enable row level security;

-- Students must not read/write payment access records directly.
-- The paid-exam Edge Function uses the service role key server-side.
drop policy if exists "No direct student access to exam_access" on exam_access;
create policy "No direct student access to exam_access"
on exam_access for all
using (false)
with check (false);

-- Existing exam RLS can remain for the free exam flow.
-- For paid exams, the Edge Function deliberately fetches questions
-- server-side and never sends correct_option to the browser.
