-- =====================================================================
-- Atmos Drop: database schema for Supabase (PostgreSQL)
-- Run this whole file once in: Supabase dashboard > SQL Editor > New query
-- It is safe to run again; it will not delete your data.
--
-- Security model
--   * Visitors (the public website) can NOT read or write the tables.
--     They can only call four small functions: place_order, submit_enquiry,
--     track_order and claim_payment. Prices are calculated here on the
--     server, so a visitor cannot change them.
--   * Only people listed in the "admins" table AND signed in through
--     Supabase Auth can read, edit or delete orders and enquiries.
-- =====================================================================

-- ---------- 1. Settings (prices live here, on the server) ----------
create table if not exists public.product_config (
  id          int primary key default 1 check (id = 1),
  price       int not null default 14999,   -- launch price per unit (INR)
  plan_price  int not null default 2400,    -- yearly filter plan per unit (INR)
  reservation int not null default 999,     -- reservation per unit (INR)
  max_qty     int not null default 10       -- most units in one order
);
insert into public.product_config (id) values (1) on conflict (id) do nothing;

-- ---------- 2. Admin list ----------
create table if not exists public.admins (
  email text primary key
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins a
    where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- ---------- 3. Orders ----------
create table if not exists public.orders (
  id                 uuid primary key default gen_random_uuid(),
  ref                text unique not null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  name               text not null,
  email              text not null,
  phone              text not null,
  address            text not null,
  city               text not null,
  state              text not null,
  pin                text not null,
  qty                int  not null check (qty between 1 and 50),
  filter_plan        boolean not null default false,
  unit_price         int  not null,
  plan_price         int  not null default 0,
  reservation_amount int  not null,
  balance_amount     int  not null,
  status             text not null default 'pending_payment'
    check (status in ('pending_payment','payment_claimed','reserved','balance_paid','shipped','delivered','cancelled','refunded')),
  payment_id         text,
  notes              text,
  source             text not null default 'website'
);
create index if not exists orders_created_idx on public.orders (created_at desc);
create index if not exists orders_phone_idx   on public.orders (phone);
create index if not exists orders_status_idx  on public.orders (status);

-- ---------- 4. Enquiries ----------
create table if not exists public.leads (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name       text not null,
  email      text not null,
  city       text,
  topic      text,
  message    text,
  status     text not null default 'new' check (status in ('new','contacted','converted','closed')),
  notes      text
);
create index if not exists leads_created_idx on public.leads (created_at desc);

-- ---------- 5. Keep updated_at fresh ----------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists orders_touch on public.orders;
create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();
drop trigger if exists leads_touch on public.leads;
create trigger leads_touch before update on public.leads
  for each row execute function public.touch_updated_at();

-- ---------- 6. Row Level Security: lock everything down ----------
alter table public.orders         enable row level security;
alter table public.leads          enable row level security;
alter table public.admins         enable row level security;
alter table public.product_config enable row level security;

revoke all on public.orders from anon;
revoke all on public.leads  from anon;
revoke all on public.admins from anon, authenticated;

drop policy if exists "admins manage orders" on public.orders;
create policy "admins manage orders" on public.orders
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins manage leads" on public.leads;
create policy "admins manage leads" on public.leads
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "anyone reads config" on public.product_config;
create policy "anyone reads config" on public.product_config
  for select to anon, authenticated using (true);

drop policy if exists "admins update config" on public.product_config;
create policy "admins update config" on public.product_config
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- 7. Public functions (the only door for visitors) ----------

-- Place a pre-order. Prices are worked out here, not in the browser.
create or replace function public.place_order(
  p_name    text,
  p_email   text,
  p_phone   text,
  p_address text,
  p_city    text,
  p_state   text,
  p_pin     text,
  p_qty     int,
  p_plan    boolean default false,
  p_hp      text default null          -- hidden spam-trap field, must be empty
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg   public.product_config%rowtype;
  v_ref text;
  v_tot int;
  v_res int;
  r     public.orders%rowtype;
begin
  if coalesce(p_hp, '') <> '' then raise exception 'rejected'; end if;

  select * into cfg from public.product_config where id = 1;

  p_name    := trim(coalesce(p_name, ''));
  p_email   := lower(trim(coalesce(p_email, '')));
  p_phone   := trim(coalesce(p_phone, ''));
  p_address := trim(coalesce(p_address, ''));
  p_city    := trim(coalesce(p_city, ''));
  p_state   := trim(coalesce(p_state, ''));
  p_pin     := trim(coalesce(p_pin, ''));

  if length(p_name) < 2 or length(p_name) > 100            then raise exception 'invalid_name'; end if;
  if p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(p_email) > 150 then raise exception 'invalid_email'; end if;
  if p_phone !~ '^[6-9][0-9]{9}$'                          then raise exception 'invalid_phone'; end if;
  if length(p_address) < 6 or length(p_address) > 300     then raise exception 'invalid_address'; end if;
  if length(p_city) < 2 or length(p_city) > 80            then raise exception 'invalid_city'; end if;
  if length(p_state) < 2 or length(p_state) > 60          then raise exception 'invalid_state'; end if;
  if p_pin !~ '^[1-9][0-9]{5}$'                            then raise exception 'invalid_pin'; end if;
  if p_qty is null or p_qty < 1 or p_qty > cfg.max_qty     then raise exception 'invalid_qty'; end if;

  -- simple abuse limit: at most 5 orders per phone number per hour
  if (select count(*) from public.orders
      where phone = p_phone and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'too_many';
  end if;

  v_tot := cfg.price * p_qty;
  v_res := cfg.reservation * p_qty;
  v_ref := 'AD-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));

  insert into public.orders
    (ref, name, email, phone, address, city, state, pin, qty, filter_plan,
     unit_price, plan_price, reservation_amount, balance_amount)
  values
    (v_ref, p_name, p_email, p_phone, p_address, p_city, p_state, p_pin, p_qty, coalesce(p_plan, false),
     cfg.price, case when coalesce(p_plan, false) then cfg.plan_price else 0 end, v_res, v_tot - v_res)
  returning * into r;

  return json_build_object(
    'ref',         r.ref,
    'qty',         r.qty,
    'filter_plan', r.filter_plan,
    'total',       v_tot,
    'reservation', r.reservation_amount,
    'balance',     r.balance_amount,
    'status',      r.status
  );
end;
$$;

-- Send a message from the contact form.
create or replace function public.submit_enquiry(
  p_name    text,
  p_email   text,
  p_city    text,
  p_topic   text,
  p_message text,
  p_hp      text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(p_hp, '') <> '' then raise exception 'rejected'; end if;
  p_name  := trim(coalesce(p_name, ''));
  p_email := lower(trim(coalesce(p_email, '')));
  if length(p_name) < 2 or length(p_name) > 100 then raise exception 'invalid_name'; end if;
  if p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(p_email) > 150 then raise exception 'invalid_email'; end if;
  if (select count(*) from public.leads
      where email = p_email and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'too_many';
  end if;
  insert into public.leads (name, email, city, topic, message)
  values (p_name, p_email, left(trim(coalesce(p_city, '')), 80),
          left(trim(coalesce(p_topic, '')), 80), left(trim(coalesce(p_message, '')), 2000));
  return true;
end;
$$;

-- Let a customer check their own order (needs reference + phone number).
create or replace function public.track_order(p_ref text, p_phone text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare r public.orders%rowtype;
begin
  select * into r from public.orders
   where ref = upper(trim(coalesce(p_ref, ''))) and phone = trim(coalesce(p_phone, ''));
  if not found then return null; end if;
  return json_build_object(
    'ref',         r.ref,
    'status',      r.status,
    'qty',         r.qty,
    'filter_plan', r.filter_plan,
    'reservation', r.reservation_amount,
    'balance',     r.balance_amount,
    'created_at',  r.created_at,
    'name',        split_part(r.name, ' ', 1)
  );
end;
$$;

-- After a customer pays online, record the payment id. The status becomes
-- "payment_claimed"; you confirm it in your payment dashboard and then set
-- the order to "reserved" in the admin page.
create or replace function public.claim_payment(p_ref text, p_phone text, p_payment_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare n int;
begin
  update public.orders
     set payment_id = left(trim(coalesce(p_payment_id, '')), 100),
         status = 'payment_claimed'
   where ref = upper(trim(coalesce(p_ref, '')))
     and phone = trim(coalesce(p_phone, ''))
     and status = 'pending_payment';
  get diagnostics n = row_count;
  return n > 0;
end;
$$;

-- ---------- 8. Who may call the public functions ----------
revoke all on function public.place_order(text,text,text,text,text,text,text,int,boolean,text) from public;
revoke all on function public.submit_enquiry(text,text,text,text,text,text) from public;
revoke all on function public.track_order(text,text) from public;
revoke all on function public.claim_payment(text,text,text) from public;

grant execute on function public.place_order(text,text,text,text,text,text,text,int,boolean,text) to anon, authenticated;
grant execute on function public.submit_enquiry(text,text,text,text,text,text) to anon, authenticated;
grant execute on function public.track_order(text,text) to anon, authenticated;
grant execute on function public.claim_payment(text,text,text) to anon, authenticated;

-- =====================================================================
-- AFTER running this file, add yourself as an admin (change the email):
--
--   insert into public.admins (email) values ('you@example.com');
--
-- (First create that user in Authentication > Users > Add user.)
-- =====================================================================
