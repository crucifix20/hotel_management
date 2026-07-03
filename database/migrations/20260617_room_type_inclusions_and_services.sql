alter table public.room_types add column if not exists inclusions text;

update public.room_types
set inclusions = case name
  when 'Deluxe King' then 'Complimentary breakfast, bottled water, Wi-Fi'
  when 'Executive Twin' then 'Complimentary breakfast, lounge access, Wi-Fi'
  when 'Premier Corner Suite' then 'Complimentary breakfast, lounge access, welcome amenity, Wi-Fi'
  when 'Spa Wellness Suite' then 'Complimentary breakfast, spa access, wellness minibar, Wi-Fi'
  when 'Presidential Suite' then 'Complimentary breakfast, butler service, lounge access, welcome amenity, Wi-Fi'
  else inclusions
end
where inclusions is null or inclusions = '';

insert into public.hotel_services (name, description, category, price, is_chargeable, status)
select seed.name, seed.description, seed.category, seed.price, seed.is_chargeable, seed.status
from (
  values
    ('Extra Pillow', 'Housekeeping request for an additional pillow.', 'Housekeeping', 0.00, false, 'Available'),
    ('Guest Escort', 'Bell service escort from front desk to assigned room.', 'Other', 0.00, false, 'Available'),
    ('Luggage Assistance', 'Bell service handling for guest luggage.', 'Other', 0.00, false, 'Available'),
    ('Shuttle', 'Arrange guest shuttle transportation.', 'Transport', 0.00, false, 'Available')
) as seed(name, description, category, price, is_chargeable, status)
where not exists (
  select 1
  from public.hotel_services service
  where service.name = seed.name
);
