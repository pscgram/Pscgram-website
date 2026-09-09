-- PSCGram Premium Membership
-- One-time payment: ₹999 INR
-- Membership duration: 1 year from successful payment.

create table if not exists public.premium_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active',
  plan text not null default 'premium_yearly',
  amount integer not null default 99900,
  currency text not null default 'INR',
  razorpay_order_id text,
  razorpay_payment_id text,
  starts_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists premium_memberships_order_uidx
on public.premium_memberships (razorpay_order_id)
where razorpay_order_id is not null;

create index if not exists premium_memberships_user_idx
on public.premium_memberships (user_id, expires_at desc);

alter table public.premium_memberships enable row level security;

drop policy if exists "Members can read own premium membership" on public.premium_memberships;
create policy "Members can read own premium membership"
on public.premium_memberships
for select
to authenticated
using (auth.uid() = user_id);

-- No public insert/update/delete policies: the secure Edge Function handles payment records.
