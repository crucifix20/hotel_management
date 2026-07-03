create extension if not exists pgcrypto;

grant usage on schema public to anon, authenticated;

create table if not exists public.users_profile (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('Admin', 'Staff')),
  avatar_url text,
  created_at timestamptz not null default now()
);

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'users_profile_role_check'
      and conrelid = 'public.users_profile'::regclass
  ) then
    alter table public.users_profile drop constraint users_profile_role_check;
  end if;
end
$$;

update public.users_profile
set role = case
  when role = 'Admin' then 'Admin'
  else 'Staff'
end
where role is distinct from case
  when role = 'Admin' then 'Admin'
  else 'Staff'
end;

alter table public.users_profile
  add constraint users_profile_role_check
  check (role in ('Admin', 'Staff'));

create table if not exists public.staff (
  id bigserial primary key,
  full_name text not null,
  email text unique,
  auth_user_id uuid unique references public.users_profile (id) on delete set null,
  phone text,
  department text,
  position text,
  shift text,
  login_password text,
  status text not null default 'Active',
  created_at timestamptz not null default now()
);

alter table public.staff add column if not exists auth_user_id uuid unique references public.users_profile (id) on delete set null;
alter table public.staff add column if not exists login_password text;
alter table public.staff alter column department drop not null;

create table if not exists public.guests (
  id bigserial primary key,
  full_name text not null,
  email text unique,
  phone text,
  address text,
  company_name text,
  nationality text,
  origin text,
  booking_person text,
  guest_type text,
  vip_status boolean not null default false,
  preferences text,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.guests add column if not exists company_name text;
alter table public.guests add column if not exists nationality text;
alter table public.guests add column if not exists origin text;
alter table public.guests add column if not exists booking_person text;
alter table public.guests add column if not exists guest_type text;

create table if not exists public.room_types (
  id bigserial primary key,
  name text not null unique,
  description text,
  inclusions text,
  base_rate numeric(12, 2) not null default 0,
  capacity integer not null default 2,
  created_at timestamptz not null default now()
);

alter table public.room_types add column if not exists inclusions text;

create table if not exists public.rooms (
  id bigserial primary key,
  room_number text not null unique,
  floor integer not null,
  room_type_id bigint not null references public.room_types (id) on delete restrict,
  status text not null default 'Available' check (status in ('Available', 'Occupied', 'Reserved', 'Cleaning', 'Maintenance', 'Out of Service')),
  rate numeric(12, 2) not null default 0,
  image_base64 text,
  amenities text,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.rooms add column if not exists image_base64 text;

create table if not exists public.reservations (
  id bigserial primary key,
  confirmation_number text unique,
  guest_id bigint not null references public.guests (id) on delete restrict,
  room_id bigint not null references public.rooms (id) on delete restrict,
  check_in date not null,
  check_out date not null,
  adults integer not null default 1,
  children integer not null default 0,
  status text not null default 'Pending' check (status in ('Pending', 'Confirmed', 'Checked In', 'Checked Out', 'Cancelled', 'No Show')),
  payment_status text not null default 'Unpaid' check (payment_status in ('Unpaid', 'Partial', 'Paid', 'Refunded')),
  total_amount numeric(12, 2) not null default 0,
  downpayment_required boolean not null default true,
  downpayment_amount numeric(12, 2) not null default 0,
  downpayment_paid numeric(12, 2) not null default 0,
  downpayment_status text not null default 'Required' check (downpayment_status in ('Not Required', 'Required', 'Partially Paid', 'Paid', 'Refunded')),
  incidental_deposit_amount numeric(12, 2) not null default 0,
  incidental_deposit_paid numeric(12, 2) not null default 0,
  special_requests text,
  arrival_date date,
  flight_number text,
  departure_date date,
  internal_notes text,
  admin_notes text,
  guest_verified boolean not null default false,
  guest_id_type text,
  guest_id_number text,
  check_in_notes text,
  checkout_notes text,
  cancellation_reason text,
  cancelled_at timestamptz,
  cancelled_by uuid references public.users_profile (id) on delete set null,
  checked_in_at timestamptz,
  checked_in_by uuid references public.users_profile (id) on delete set null,
  checked_out_at timestamptz,
  checked_out_by uuid references public.users_profile (id) on delete set null,
  checkout_override_reason text,
  created_by uuid references public.users_profile (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint reservation_dates_valid check (check_out > check_in),
  constraint reservation_downpayment_amount_valid check (downpayment_amount >= 0),
  constraint reservation_downpayment_paid_valid check (downpayment_paid >= 0),
  constraint reservation_incidental_deposit_valid check (incidental_deposit_amount >= 0 and incidental_deposit_paid >= 0),
  constraint reservation_downpayment_logic_valid check (
    (not downpayment_required and downpayment_status = 'Not Required' and downpayment_amount = 0)
    or
    (downpayment_required and downpayment_amount > 0)
  ),
  constraint reservation_downpayment_capped check (downpayment_amount <= total_amount and downpayment_paid <= total_amount)
);

alter table public.reservations add column if not exists downpayment_required boolean not null default true;
alter table public.reservations add column if not exists downpayment_amount numeric(12, 2) not null default 0;
alter table public.reservations add column if not exists downpayment_paid numeric(12, 2) not null default 0;
alter table public.reservations add column if not exists downpayment_status text not null default 'Required';
alter table public.reservations add column if not exists incidental_deposit_amount numeric(12, 2) not null default 0;
alter table public.reservations add column if not exists incidental_deposit_paid numeric(12, 2) not null default 0;
alter table public.reservations add column if not exists arrival_date date;
alter table public.reservations add column if not exists flight_number text;
alter table public.reservations add column if not exists departure_date date;
alter table public.reservations add column if not exists internal_notes text;
alter table public.reservations add column if not exists admin_notes text;
alter table public.reservations add column if not exists guest_verified boolean not null default false;
alter table public.reservations add column if not exists guest_id_type text;
alter table public.reservations add column if not exists guest_id_number text;
alter table public.reservations add column if not exists check_in_notes text;
alter table public.reservations add column if not exists checkout_notes text;
alter table public.reservations add column if not exists cancellation_reason text;
alter table public.reservations add column if not exists cancelled_at timestamptz;
alter table public.reservations add column if not exists cancelled_by uuid references public.users_profile (id) on delete set null;
alter table public.reservations add column if not exists checked_in_at timestamptz;
alter table public.reservations add column if not exists checked_in_by uuid references public.users_profile (id) on delete set null;
alter table public.reservations add column if not exists checked_out_at timestamptz;
alter table public.reservations add column if not exists checked_out_by uuid references public.users_profile (id) on delete set null;
alter table public.reservations add column if not exists checkout_override_reason text;

create table if not exists public.housekeeping_tasks (
  id bigserial primary key,
  room_id bigint not null references public.rooms (id) on delete cascade,
  assigned_staff_id bigint references public.staff (id) on delete set null,
  task_type text not null,
  priority text not null default 'Medium' check (priority in ('Low', 'Medium', 'High', 'Urgent')),
  status text not null default 'Pending' check (status in ('Pending', 'In Progress', 'Completed', 'Cancelled')),
  notes text,
  due_date date not null,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id bigserial primary key,
  reservation_id bigint unique references public.reservations (id) on delete cascade,
  guest_id bigint not null references public.guests (id) on delete restrict,
  invoice_number text not null unique,
  subtotal numeric(12, 2) not null default 0,
  tax numeric(12, 2) not null default 0,
  discount numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  status text not null default 'Pending',
  created_at timestamptz not null default now()
);

create table if not exists public.invoice_items (
  id bigserial primary key,
  invoice_id bigint not null references public.invoices (id) on delete cascade,
  description text not null,
  quantity integer not null default 1,
  unit_price numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0
);

create table if not exists public.payments (
  id bigserial primary key,
  invoice_id bigint not null references public.invoices (id) on delete cascade,
  reservation_id bigint references public.reservations (id) on delete set null,
  amount numeric(12, 2) not null default 0,
  payment_method text not null,
  payment_reference text,
  transaction_type text,
  received_by uuid references public.users_profile (id) on delete set null,
  notes text,
  payment_status text not null default 'Paid' check (payment_status in ('Unpaid', 'Partial', 'Paid', 'Refunded')),
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.payments add column if not exists reservation_id bigint references public.reservations (id) on delete set null;
alter table public.payments add column if not exists payment_reference text;
alter table public.payments add column if not exists transaction_type text;
alter table public.payments add column if not exists received_by uuid references public.users_profile (id) on delete set null;
alter table public.payments add column if not exists notes text;
alter table public.reservations alter column downpayment_required set default true;
alter table public.reservations alter column downpayment_status set default 'Required';
update public.reservations
set downpayment_required = true
where downpayment_required = false;
update public.reservations
set downpayment_status = 'Required'
where downpayment_required = true
  and coalesce(downpayment_amount, 0) > 0
  and coalesce(downpayment_paid, 0) = 0
  and downpayment_status = 'Not Required';

create table if not exists public.hotel_services (
  id bigserial primary key,
  name text not null unique,
  description text,
  category text not null default 'Other' check (category in ('Room Service', 'Housekeeping', 'Food & Beverage', 'Spa', 'Transport', 'Laundry', 'Other')),
  price numeric(12, 2) not null default 0,
  is_chargeable boolean not null default true,
  status text not null default 'Available' check (status in ('Available', 'Unavailable')),
  created_at timestamptz not null default now()
);

create table if not exists public.service_orders (
  id bigserial primary key,
  reservation_id bigint not null references public.reservations (id) on delete cascade,
  guest_id bigint not null references public.guests (id) on delete cascade,
  room_id bigint not null references public.rooms (id) on delete restrict,
  service_id bigint not null references public.hotel_services (id) on delete restrict,
  quantity integer not null default 1,
  unit_price numeric(12, 2) not null default 0,
  total_amount numeric(12, 2) not null default 0,
  status text not null default 'Requested' check (status in ('Requested', 'In Progress', 'Completed', 'Cancelled', 'Charged')),
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  notes text,
  created_by uuid references public.users_profile (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint service_order_quantity_valid check (quantity > 0),
  constraint service_order_price_valid check (unit_price >= 0 and total_amount >= 0)
);

create table if not exists public.amenities (
  id bigserial primary key,
  name text not null unique,
  description text,
  price numeric(12, 2) not null default 0,
  status text not null default 'Available',
  created_at timestamptz not null default now()
);

create table if not exists public.amenity_bookings (
  id bigserial primary key,
  amenity_id bigint not null references public.amenities (id) on delete cascade,
  reservation_id bigint references public.reservations (id) on delete set null,
  guest_id bigint not null references public.guests (id) on delete cascade,
  booking_date date not null,
  quantity integer not null default 1,
  total_amount numeric(12, 2) not null default 0,
  status text not null default 'Booked',
  created_at timestamptz not null default now()
);

create table if not exists public.clubs (
  id bigserial primary key,
  name text not null unique,
  description text,
  membership_fee numeric(12, 2) not null default 0,
  benefits text,
  status text not null default 'Active',
  created_at timestamptz not null default now()
);

create table if not exists public.club_registrations (
  id bigserial primary key,
  club_id bigint not null references public.clubs (id) on delete cascade,
  guest_id bigint not null references public.guests (id) on delete cascade,
  membership_number text not null unique,
  membership_level text not null default 'Standard' check (membership_level in ('Standard', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Presidential')),
  start_date date not null,
  end_date date not null,
  status text not null default 'Pending' check (status in ('Active', 'Pending', 'Expired', 'Cancelled', 'Suspended')),
  notes text,
  created_at timestamptz not null default now(),
  constraint membership_dates_valid check (end_date >= start_date)
);

create table if not exists public.club_benefits (
  id bigserial primary key,
  club_id bigint not null references public.clubs (id) on delete cascade,
  title text not null,
  description text,
  benefit_type text,
  applies_to text not null default 'Reservation' check (applies_to in ('Reservation', 'Amenity', 'Service', 'Billing', 'Stay')),
  discount_type text check (discount_type in ('Percentage', 'Fixed', 'Complimentary', 'Access')),
  discount_value numeric(12, 2),
  service_id bigint references public.hotel_services (id) on delete set null,
  max_uses integer,
  status text not null default 'Active' check (status in ('Active', 'Inactive')),
  value numeric(12, 2),
  created_at timestamptz not null default now()
);

alter table public.club_benefits add column if not exists applies_to text not null default 'Reservation';
alter table public.club_benefits add column if not exists discount_type text;
alter table public.club_benefits add column if not exists discount_value numeric(12, 2);
alter table public.club_benefits add column if not exists service_id bigint references public.hotel_services (id) on delete set null;
alter table public.club_benefits add column if not exists max_uses integer;
alter table public.club_benefits add column if not exists status text not null default 'Active';

create table if not exists public.club_benefit_usage (
  id bigserial primary key,
  club_registration_id bigint not null references public.club_registrations (id) on delete cascade,
  reservation_id bigint references public.reservations (id) on delete cascade,
  guest_id bigint not null references public.guests (id) on delete cascade,
  benefit_id bigint not null references public.club_benefits (id) on delete cascade,
  service_order_id bigint references public.service_orders (id) on delete set null,
  amount_discounted numeric(12, 2) not null default 0,
  used_at timestamptz not null default now(),
  notes text
);

create table if not exists public.club_transactions (
  id bigserial primary key,
  club_registration_id bigint not null references public.club_registrations (id) on delete cascade,
  guest_id bigint not null references public.guests (id) on delete cascade,
  transaction_type text not null,
  amount numeric(12, 2) not null default 0,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id bigserial primary key,
  user_id uuid references public.users_profile (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id bigint,
  details text,
  created_at timestamptz not null default now()
);

create index if not exists idx_reservations_room_dates on public.reservations (room_id, check_in, check_out);
create index if not exists idx_reservations_status on public.reservations (status);
create index if not exists idx_housekeeping_tasks_room_status on public.housekeeping_tasks (room_id, status);
create index if not exists idx_invoices_reservation on public.invoices (reservation_id);
create index if not exists idx_payments_invoice on public.payments (invoice_id);
create index if not exists idx_payments_reservation on public.payments (reservation_id);
create index if not exists idx_payments_received_by on public.payments (received_by);
create index if not exists idx_payments_paid_at on public.payments (paid_at desc);
create index if not exists idx_reservations_confirmation_number on public.reservations (confirmation_number);
create index if not exists idx_reservations_guest on public.reservations (guest_id);
create index if not exists idx_reservations_room on public.reservations (room_id);
create index if not exists idx_amenity_bookings_guest on public.amenity_bookings (guest_id);
create index if not exists idx_service_orders_reservation on public.service_orders (reservation_id, status);
create index if not exists idx_service_orders_guest on public.service_orders (guest_id, status);
create index if not exists idx_club_registrations_guest on public.club_registrations (guest_id, status);
create index if not exists idx_club_transactions_registration on public.club_transactions (club_registration_id);
create index if not exists idx_club_benefit_usage_registration on public.club_benefit_usage (club_registration_id, benefit_id);
create index if not exists idx_audit_logs_created_at on public.audit_logs (created_at desc);
create unique index if not exists idx_guests_email_unique on public.guests (email) where email is not null;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users_profile (id, full_name, role, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    case
      when new.raw_user_meta_data ->> 'role' = 'Admin' then 'Admin'
      else 'Staff'
    end,
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update
    set full_name = excluded.full_name,
        role = excluded.role,
        avatar_url = excluded.avatar_url;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute procedure public.handle_new_user_profile();

insert into public.users_profile (id, full_name, role, avatar_url)
select
  au.id,
  coalesce(au.raw_user_meta_data ->> 'full_name', split_part(au.email, '@', 1)),
  case
    when au.raw_user_meta_data ->> 'role' = 'Admin' then 'Admin'
    else 'Staff'
  end,
  au.raw_user_meta_data ->> 'avatar_url'
from auth.users au
on conflict (id) do update
set
  full_name = excluded.full_name,
  role = excluded.role,
  avatar_url = excluded.avatar_url;

create or replace function public.set_reservation_confirmation_number()
returns trigger
language plpgsql
as $$
begin
  if new.confirmation_number is null or length(trim(new.confirmation_number)) = 0 then
    update public.reservations
      set confirmation_number = 'GMH-BOOK-' || to_char(new.created_at, 'YYYY') || '-' || lpad(new.id::text, 6, '0')
    where id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists reservation_confirmation_number_trigger on public.reservations;
create trigger reservation_confirmation_number_trigger
after insert on public.reservations
for each row
execute procedure public.set_reservation_confirmation_number();

create or replace function public.prevent_overlapping_reservations()
returns trigger
language plpgsql
as $$
begin
  if new.status in ('Pending', 'Confirmed', 'Checked In') then
    if exists (
      select 1
      from public.reservations r
      where r.room_id = new.room_id
        and r.id <> coalesce(new.id, -1)
        and r.status in ('Pending', 'Confirmed', 'Checked In')
        and daterange(r.check_in, r.check_out, '[)') && daterange(new.check_in, new.check_out, '[)')
    ) then
      raise exception 'This room is already booked for the selected date range.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_overlapping_reservations_trigger on public.reservations;
create trigger prevent_overlapping_reservations_trigger
before insert or update on public.reservations
for each row
execute procedure public.prevent_overlapping_reservations();

create or replace function public.recalculate_room_status(p_room_id bigint)
returns void
language plpgsql
as $$
declare
  current_status text;
begin
  select status into current_status
  from public.rooms
  where id = p_room_id;

  if current_status is null then
    return;
  end if;

  if current_status in ('Maintenance', 'Out of Service') then
    return;
  end if;

  if exists (
    select 1 from public.reservations
    where room_id = p_room_id
      and status = 'Checked In'
  ) then
    update public.rooms set status = 'Occupied' where id = p_room_id;
  elsif exists (
    select 1 from public.housekeeping_tasks
    where room_id = p_room_id
      and status in ('Pending', 'In Progress')
  ) then
    update public.rooms set status = 'Cleaning' where id = p_room_id;
  elsif exists (
    select 1 from public.reservations
    where room_id = p_room_id
      and status in ('Pending', 'Confirmed')
  ) then
    update public.rooms set status = 'Reserved' where id = p_room_id;
  else
    update public.rooms set status = 'Available' where id = p_room_id;
  end if;
end;
$$;

create or replace function public.handle_reservation_room_sync()
returns trigger
language plpgsql
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.recalculate_room_status(new.room_id);
    if tg_op = 'UPDATE' and old.room_id is distinct from new.room_id then
      perform public.recalculate_room_status(old.room_id);
    end if;
  elsif tg_op = 'DELETE' then
    perform public.recalculate_room_status(old.room_id);
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists reservation_room_sync_trigger on public.reservations;
create trigger reservation_room_sync_trigger
after insert or update or delete on public.reservations
for each row
execute procedure public.handle_reservation_room_sync();

create or replace function public.handle_housekeeping_room_sync()
returns trigger
language plpgsql
as $$
begin
  perform public.recalculate_room_status(coalesce(new.room_id, old.room_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists housekeeping_room_sync_trigger on public.housekeeping_tasks;
create trigger housekeeping_room_sync_trigger
after insert or update or delete on public.housekeeping_tasks
for each row
execute procedure public.handle_housekeeping_room_sync();

create or replace function public.recalculate_invoice_totals(p_invoice_id bigint)
returns void
language plpgsql
as $$
declare
  item_subtotal numeric(12, 2);
  paid_total numeric(12, 2);
  invoice_total numeric(12, 2);
  reservation_ref bigint;
  payment_state text;
begin
  select coalesce(sum(total), 0) into item_subtotal
  from public.invoice_items
  where invoice_id = p_invoice_id;

  update public.invoices
    set subtotal = item_subtotal,
        total = greatest(item_subtotal + tax - discount, 0)
  where id = p_invoice_id;

  select coalesce(sum(amount), 0) into paid_total
  from public.payments
  where invoice_id = p_invoice_id
    and payment_status <> 'Refunded';

  select total, reservation_id into invoice_total, reservation_ref
  from public.invoices
  where id = p_invoice_id;

  payment_state :=
    case
      when paid_total >= invoice_total and invoice_total > 0 then 'Paid'
      when paid_total > 0 and paid_total < invoice_total then 'Partial'
      when paid_total = 0 then 'Unpaid'
      else 'Refunded'
    end;

  update public.invoices
    set status = case
      when payment_state = 'Paid' then 'Paid'
      when payment_state = 'Partial' then 'Partial'
      else 'Pending'
    end
  where id = p_invoice_id;

  if reservation_ref is not null then
    update public.reservations
      set payment_status = payment_state
    where id = reservation_ref;

    perform public.sync_reservation_financials(reservation_ref);
  end if;
end;
$$;

create or replace function public.sync_reservation_financials(p_reservation_id bigint)
returns void
language plpgsql
as $$
declare
  invoice_ref record;
  paid_total numeric(12, 2);
  refundable_total numeric(12, 2);
  downpayment_total numeric(12, 2);
  derived_downpayment_status text;
begin
  select *
  into invoice_ref
  from public.invoices
  where reservation_id = p_reservation_id;

  if not found then
    return;
  end if;

  select
    coalesce(sum(case when payment_status <> 'Refunded' then amount else 0 end), 0),
    coalesce(sum(case when payment_status = 'Refunded' then amount else 0 end), 0),
    coalesce(sum(
      case
        when payment_status <> 'Refunded'
         and coalesce(transaction_type, 'Reservation Downpayment') = 'Reservation Downpayment'
        then amount
        else 0
      end
    ), 0)
  into paid_total, refundable_total, downpayment_total
  from public.payments
  where invoice_id = invoice_ref.id;

  derived_downpayment_status :=
    case
      when not exists (select 1 from public.reservations where id = p_reservation_id and downpayment_required) then 'Not Required'
      when paid_total >= (select downpayment_amount from public.reservations where id = p_reservation_id) then 'Paid'
      when paid_total > 0 then 'Partially Paid'
      else 'Required'
    end;

  update public.reservations
  set
    downpayment_paid = least(downpayment_total, total_amount),
    downpayment_status = case
      when refundable_total > 0 and paid_total = 0 then 'Refunded'
      else derived_downpayment_status
    end,
    payment_status = case
      when paid_total >= invoice_ref.total and invoice_ref.total > 0 then 'Paid'
      when paid_total > 0 then 'Partial'
      else 'Unpaid'
    end
  where id = p_reservation_id;
end;
$$;

create or replace function public.handle_invoice_item_change()
returns trigger
language plpgsql
as $$
begin
  perform public.recalculate_invoice_totals(coalesce(new.invoice_id, old.invoice_id));
  return coalesce(new, old);
end;
$$;

create or replace function public.handle_payment_change()
returns trigger
language plpgsql
as $$
begin
  perform public.recalculate_invoice_totals(coalesce(new.invoice_id, old.invoice_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists invoice_item_change_trigger on public.invoice_items;
create trigger invoice_item_change_trigger
after insert or update or delete on public.invoice_items
for each row
execute procedure public.handle_invoice_item_change();

drop trigger if exists payment_change_trigger on public.payments;
create trigger payment_change_trigger
after insert or update or delete on public.payments
for each row
execute procedure public.handle_payment_change();

create or replace function public.handle_service_order_charge()
returns trigger
language plpgsql
as $$
declare
  invoice_ref record;
  service_ref record;
begin
  if new.status not in ('Completed', 'Charged') then
    return new;
  end if;

  select * into invoice_ref
  from public.invoices
  where reservation_id = new.reservation_id;

  if not found then
    return new;
  end if;

  select * into service_ref
  from public.hotel_services
  where id = new.service_id;

  if service_ref.is_chargeable then
    insert into public.invoice_items (invoice_id, description, quantity, unit_price, total)
    values (
      invoice_ref.id,
      service_ref.name || ' service charge',
      new.quantity,
      new.unit_price,
      new.total_amount
    );
  end if;

  if new.status = 'Completed' then
    update public.service_orders
    set status = 'Charged'
    where id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists service_order_charge_trigger on public.service_orders;
create trigger service_order_charge_trigger
after insert or update on public.service_orders
for each row
when (new.status in ('Completed', 'Charged'))
execute procedure public.handle_service_order_charge();

create or replace function public.get_available_rooms(
  check_in_date date,
  check_out_date date,
  selected_room_type_id bigint,
  exclude_reservation_id bigint default null
)
returns table (
  id bigint,
  room_number text,
  floor integer,
  room_type_id bigint,
  status text,
  rate numeric(12, 2),
  room_type_name text,
  capacity integer
)
language sql
stable
as $$
  select
    r.id,
    r.room_number,
    r.floor,
    r.room_type_id,
    r.status,
    r.rate,
    rt.name as room_type_name,
    rt.capacity
  from public.rooms r
  join public.room_types rt on rt.id = r.room_type_id
  where r.room_type_id = selected_room_type_id
    and r.status not in ('Maintenance', 'Out of Service')
    and not exists (
      select 1
      from public.reservations res
      where res.room_id = r.id
        and res.status in ('Pending', 'Confirmed', 'Checked In')
        and (exclude_reservation_id is null or res.id <> exclude_reservation_id)
        and res.check_in < check_out_date
        and res.check_out > check_in_date
    )
  order by r.room_number;
$$;

create or replace function public.search_reservations(search_text text)
returns table (
  id bigint
)
language sql
stable
as $$
  select r.id
  from public.reservations r
  join public.guests g on g.id = r.guest_id
  join public.rooms rm on rm.id = r.room_id
  where coalesce(trim(lower(search_text)), '') = ''
     or lower(coalesce(g.full_name, '')) like '%' || lower(trim(search_text)) || '%'
     or lower(coalesce(g.email, '')) like '%' || lower(trim(search_text)) || '%'
     or lower(coalesce(g.phone, '')) like '%' || lower(trim(search_text)) || '%'
     or lower(coalesce(rm.room_number, '')) like '%' || lower(trim(search_text)) || '%'
     or lower(coalesce(r.confirmation_number, '')) like '%' || lower(trim(search_text)) || '%'
     or lower(coalesce(r.status, '')) like '%' || lower(trim(search_text)) || '%'
     or lower(coalesce(r.payment_status, '')) like '%' || lower(trim(search_text)) || '%'
  order by r.check_in desc;
$$;

alter table public.users_profile enable row level security;
alter table public.staff enable row level security;
alter table public.guests enable row level security;
alter table public.room_types enable row level security;
alter table public.rooms enable row level security;
alter table public.reservations enable row level security;
alter table public.housekeeping_tasks enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.payments enable row level security;
alter table public.amenities enable row level security;
alter table public.amenity_bookings enable row level security;
alter table public.hotel_services enable row level security;
alter table public.service_orders enable row level security;
alter table public.clubs enable row level security;
alter table public.club_registrations enable row level security;
alter table public.club_benefits enable row level security;
alter table public.club_transactions enable row level security;
alter table public.club_benefit_usage enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists authenticated_access_users_profile on public.users_profile;
create policy authenticated_access_users_profile on public.users_profile for all to authenticated using (true) with check (true);
drop policy if exists authenticated_access_staff on public.staff;
create policy authenticated_access_staff on public.staff for all to authenticated using (true) with check (true);
drop policy if exists authenticated_access_guests on public.guests;
create policy authenticated_access_guests on public.guests for all to authenticated using (true) with check (true);
drop policy if exists authenticated_access_room_types on public.room_types;
create policy authenticated_access_room_types on public.room_types for all to authenticated using (true) with check (true);
drop policy if exists authenticated_access_rooms on public.rooms;
create policy authenticated_access_rooms on public.rooms for all to authenticated using (true) with check (true);
drop policy if exists authenticated_access_reservations on public.reservations;
create policy authenticated_access_reservations on public.reservations for all to authenticated using (true) with check (true);
drop policy if exists authenticated_access_housekeeping_tasks on public.housekeeping_tasks;
create policy authenticated_access_housekeeping_tasks on public.housekeeping_tasks for all to authenticated using (true) with check (true);
drop policy if exists authenticated_access_invoices on public.invoices;
create policy authenticated_access_invoices on public.invoices for all to authenticated using (true) with check (true);
drop policy if exists authenticated_access_invoice_items on public.invoice_items;
create policy authenticated_access_invoice_items on public.invoice_items for all to authenticated using (true) with check (true);
drop policy if exists authenticated_access_payments on public.payments;
create policy authenticated_access_payments on public.payments for all to authenticated using (true) with check (true);
drop policy if exists authenticated_access_amenities on public.amenities;
create policy authenticated_access_amenities on public.amenities for all to authenticated using (true) with check (true);
drop policy if exists authenticated_access_amenity_bookings on public.amenity_bookings;
create policy authenticated_access_amenity_bookings on public.amenity_bookings for all to authenticated using (true) with check (true);
drop policy if exists authenticated_access_hotel_services on public.hotel_services;
create policy authenticated_access_hotel_services on public.hotel_services for all to authenticated using (true) with check (true);
drop policy if exists authenticated_access_service_orders on public.service_orders;
create policy authenticated_access_service_orders on public.service_orders for all to authenticated using (true) with check (true);
drop policy if exists authenticated_access_clubs on public.clubs;
create policy authenticated_access_clubs on public.clubs for all to authenticated using (true) with check (true);
drop policy if exists authenticated_access_club_registrations on public.club_registrations;
create policy authenticated_access_club_registrations on public.club_registrations for all to authenticated using (true) with check (true);
drop policy if exists authenticated_access_club_benefits on public.club_benefits;
create policy authenticated_access_club_benefits on public.club_benefits for all to authenticated using (true) with check (true);
drop policy if exists authenticated_access_club_transactions on public.club_transactions;
create policy authenticated_access_club_transactions on public.club_transactions for all to authenticated using (true) with check (true);
drop policy if exists authenticated_access_club_benefit_usage on public.club_benefit_usage;
create policy authenticated_access_club_benefit_usage on public.club_benefit_usage for all to authenticated using (true) with check (true);
drop policy if exists authenticated_access_audit_logs on public.audit_logs;
create policy authenticated_access_audit_logs on public.audit_logs for all to authenticated using (true) with check (true);

grant all on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated;
