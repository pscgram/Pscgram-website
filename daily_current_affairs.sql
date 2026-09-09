-- PSCGram Daily Current Affairs
-- Run this once in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.current_affairs (
  id uuid primary key default gen_random_uuid(),
  category text not null default 'National',
  published_date date not null default current_date,
  title text not null,
  note text not null,
  points jsonb not null default '[]'::jsonb,
  sort_order integer not null default 1,
  is_published boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now()
);

alter table public.current_affairs enable row level security;

drop policy if exists "Public can read published current affairs" on public.current_affairs;
create policy "Public can read published current affairs"
on public.current_affairs
for select
using (is_published = true);

drop policy if exists "Admin can manage current affairs" on public.current_affairs;
create policy "Admin can manage current affairs"
on public.current_affairs
for all
to authenticated
using (auth.uid() = '60d7f743-1b0f-48ad-a72c-2e6825b863e6'::uuid)
with check (auth.uid() = '60d7f743-1b0f-48ad-a72c-2e6825b863e6'::uuid);

create index if not exists current_affairs_date_idx
on public.current_affairs (published_date desc, sort_order asc);
