alter table public.guests add column if not exists company_name text;
alter table public.guests add column if not exists nationality text;
alter table public.guests add column if not exists origin text;
alter table public.guests add column if not exists booking_person text;
alter table public.guests add column if not exists guest_type text;

alter table public.reservations add column if not exists arrival_date date;
alter table public.reservations add column if not exists flight_number text;
alter table public.reservations add column if not exists departure_date date;

update public.hotel_services
set name = 'Shuttle',
    description = 'Arrange guest shuttle transportation.'
where name = 'Transportation Out';
