insert into public.staff (full_name, email, phone, department, position, shift, status)
values
  ('Elena Velez', 'e.velez@grandmilladohotel.com', '+63 917 400 1001', 'Management', 'General Manager', 'Executive', 'Active'),
  ('Mateo Dela Cruz', 'm.delacruz@grandmilladohotel.com', '+63 917 400 1002', 'Front Office', 'Front Office Supervisor', 'Morning', 'Active'),
  ('Sofia Navarro', 's.navarro@grandmilladohotel.com', '+63 917 400 1003', 'Front Office', 'Guest Relations Executive', 'Evening', 'Active'),
  ('Ariana Solis', 'a.solis@grandmilladohotel.com', '+63 917 400 1004', 'Housekeeping', 'Housekeeping Manager', 'Morning', 'Active'),
  ('Luis Mercado', 'l.mercado@grandmilladohotel.com', '+63 917 400 1005', 'Housekeeping', 'Room Attendant', 'Morning', 'Active'),
  ('Carmen Reyes', 'c.reyes@grandmilladohotel.com', '+63 917 400 1006', 'Finance', 'Revenue Accountant', 'Morning', 'Active'),
  ('Theo Zamora', 't.zamora@grandmilladohotel.com', '+63 917 400 1007', 'Engineering', 'Facilities Engineer', 'Swing', 'Active'),
  ('Bianca Santos', 'b.santos@grandmilladohotel.com', '+63 917 400 1008', 'Food & Beverage', 'Private Dining Lead', 'Evening', 'Active')
on conflict (email) do nothing;

insert into public.guests (full_name, email, phone, address, vip_status, preferences, notes)
select *
from (
  values
    ('Alexander Beaumont', 'alexander.beaumont@example.com', '+63 917 500 0101', 'Singapore', true, 'Late checkout, still water, hypoallergenic pillows', 'Presidential guest with repeat suite preference'),
    ('Isabella Navarro', 'isabella.navarro@example.com', '+63 917 500 0102', 'Makati, Philippines', false, 'Airport transfer, quiet floor', 'Corporate traveler'),
    ('Dominic Alonzo', 'dominic.alonzo@example.com', '+63 917 500 0103', 'Dubai, UAE', true, 'Executive lounge access, vegan amenities', 'Golf club prospect'),
    ('Sophie Laurent', 'sophie.laurent@example.com', '+63 917 500 0104', 'Paris, France', false, 'Spa-focused itinerary', 'Anniversary guest'),
    ('Miguel Serrano', 'miguel.serrano@example.com', '+63 917 500 0105', 'Barcelona, Spain', false, 'High floor room', 'Prefers digital invoices'),
    ('Olivia Chen', 'olivia.chen@example.com', '+63 917 500 0106', 'Hong Kong', true, 'Daily private dining breakfast', 'Loyalty elite guest'),
    ('Nathan Prescott', 'nathan.prescott@example.com', '+63 917 500 0107', 'Los Angeles, USA', false, 'Fitness and golf access', 'Potential long-stay corporate guest'),
    ('Amelia Wright', 'amelia.wright@example.com', '+63 917 500 0108', 'Sydney, Australia', true, 'Butler service and champagne setup', 'Executive club member')
) as seed(full_name, email, phone, address, vip_status, preferences, notes)
where not exists (
  select 1
  from public.guests g
  where g.email = seed.email
);

insert into public.room_types (name, description, inclusions, base_rate, capacity)
values
  ('Deluxe King', 'Warm contemporary room with city views and premium bath amenities.', 'Complimentary breakfast, bottled water, Wi-Fi', 285.00, 2),
  ('Executive Twin', 'Business-focused room with executive lounge privileges.', 'Complimentary breakfast, lounge access, Wi-Fi', 330.00, 2),
  ('Premier Corner Suite', 'Spacious corner suite with dedicated living room and butler call.', 'Complimentary breakfast, lounge access, welcome amenity, Wi-Fi', 540.00, 3),
  ('Spa Wellness Suite', 'Suite package with in-room wellness amenities and spa inclusions.', 'Complimentary breakfast, spa access, wellness minibar, Wi-Fi', 620.00, 2),
  ('Presidential Suite', 'Signature top-floor residence with formal lounge and private dining area.', 'Complimentary breakfast, butler service, lounge access, welcome amenity, Wi-Fi', 1200.00, 4)
on conflict (name) do update set
  description = excluded.description,
  inclusions = excluded.inclusions,
  base_rate = excluded.base_rate,
  capacity = excluded.capacity;

insert into public.rooms (room_number, floor, room_type_id, status, rate, amenities, notes)
values
  ('101', 1, (select id from public.room_types where name = 'Deluxe King'), 'Available', 285.00, 'Rain shower, minibar, smart TV', 'Near lobby access'),
  ('102', 1, (select id from public.room_types where name = 'Deluxe King'), 'Available', 285.00, 'Rain shower, minibar, smart TV', 'Courtyard view'),
  ('103', 1, (select id from public.room_types where name = 'Deluxe King'), 'Reserved', 285.00, 'Rain shower, minibar, smart TV', 'Arrival pending'),
  ('104', 1, (select id from public.room_types where name = 'Executive Twin'), 'Cleaning', 330.00, 'Twin beds, lounge access, espresso service', 'Priority turnover'),
  ('105', 1, (select id from public.room_types where name = 'Executive Twin'), 'Available', 330.00, 'Twin beds, lounge access, espresso service', 'Near lift core'),
  ('201', 2, (select id from public.room_types where name = 'Executive Twin'), 'Occupied', 330.00, 'Twin beds, lounge access, espresso service', 'Corporate stay in progress'),
  ('202', 2, (select id from public.room_types where name = 'Executive Twin'), 'Available', 330.00, 'Twin beds, lounge access, espresso service', 'Quiet side'),
  ('203', 2, (select id from public.room_types where name = 'Premier Corner Suite'), 'Reserved', 540.00, 'Living room, lounge access, cocktail set', 'VIP arrival'),
  ('204', 2, (select id from public.room_types where name = 'Premier Corner Suite'), 'Available', 540.00, 'Living room, lounge access, cocktail set', 'Skyline view'),
  ('205', 2, (select id from public.room_types where name = 'Premier Corner Suite'), 'Maintenance', 540.00, 'Living room, lounge access, cocktail set', 'HVAC tune-up'),
  ('301', 3, (select id from public.room_types where name = 'Spa Wellness Suite'), 'Occupied', 620.00, 'Wellness minibar, aromatherapy, soaking tub', 'Spa package guest'),
  ('302', 3, (select id from public.room_types where name = 'Spa Wellness Suite'), 'Available', 620.00, 'Wellness minibar, aromatherapy, soaking tub', 'Premium city view'),
  ('303', 3, (select id from public.room_types where name = 'Spa Wellness Suite'), 'Available', 620.00, 'Wellness minibar, aromatherapy, soaking tub', 'Late checkout ready'),
  ('304', 3, (select id from public.room_types where name = 'Spa Wellness Suite'), 'Out of Service', 620.00, 'Wellness minibar, aromatherapy, soaking tub', 'Soft refurbishment'),
  ('401', 4, (select id from public.room_types where name = 'Presidential Suite'), 'Reserved', 1200.00, 'Private pantry, formal lounge, butler pantry', 'Board delegation stay'),
  ('402', 4, (select id from public.room_types where name = 'Presidential Suite'), 'Available', 1200.00, 'Private pantry, formal lounge, butler pantry', 'Grand piano feature'),
  ('403', 4, (select id from public.room_types where name = 'Premier Corner Suite'), 'Cleaning', 540.00, 'Living room, lounge access, cocktail set', 'Deep clean scheduled'),
  ('404', 4, (select id from public.room_types where name = 'Deluxe King'), 'Available', 285.00, 'Rain shower, minibar, smart TV', 'Sunrise exposure'),
  ('405', 4, (select id from public.room_types where name = 'Executive Twin'), 'Available', 330.00, 'Twin beds, lounge access, espresso service', 'Preferred for crew stays'),
  ('406', 4, (select id from public.room_types where name = 'Premier Corner Suite'), 'Available', 540.00, 'Living room, lounge access, cocktail set', 'Reserved for premium upsell')
on conflict (room_number) do nothing;

insert into public.reservations (confirmation_number, guest_id, room_id, check_in, check_out, adults, children, status, payment_status, total_amount, special_requests, created_by)
values
  ('GMH-BOOK-2026-000901', (select id from public.guests where full_name = 'Alexander Beaumont'), (select id from public.rooms where room_number = '401'), '2026-05-12', '2026-05-16', 2, 0, 'Confirmed', 'Partial', 4800.00, 'Private boardroom breakfast service', (select id from public.users_profile where role = 'Admin' limit 1)),
  ('GMH-BOOK-2026-000902', (select id from public.guests where full_name = 'Isabella Navarro'), (select id from public.rooms where room_number = '103'), '2026-05-13', '2026-05-15', 1, 0, 'Confirmed', 'Unpaid', 570.00, 'Airport pickup at 18:30', (select id from public.users_profile where role = 'Staff' limit 1)),
  ('GMH-BOOK-2026-000903', (select id from public.guests where full_name = 'Dominic Alonzo'), (select id from public.rooms where room_number = '203'), '2026-05-14', '2026-05-18', 2, 1, 'Pending', 'Unpaid', 2160.00, 'Executive lounge dining access', (select id from public.users_profile where role = 'Staff' limit 1)),
  ('GMH-BOOK-2026-000904', (select id from public.guests where full_name = 'Sophie Laurent'), (select id from public.rooms where room_number = '301'), '2026-05-11', '2026-05-14', 2, 0, 'Checked In', 'Paid', 1860.00, 'Spa ritual on arrival day', (select id from public.users_profile where role = 'Admin' limit 1)),
  ('GMH-BOOK-2026-000905', (select id from public.guests where full_name = 'Miguel Serrano'), (select id from public.rooms where room_number = '201'), '2026-05-10', '2026-05-13', 1, 0, 'Checked In', 'Partial', 990.00, 'Digital folio only', (select id from public.users_profile where role = 'Staff' limit 1)),
  ('GMH-BOOK-2026-000906', (select id from public.guests where full_name = 'Olivia Chen'), (select id from public.rooms where room_number = '302'), '2026-05-20', '2026-05-24', 2, 0, 'Pending', 'Unpaid', 2480.00, 'Private dining breakfast daily', (select id from public.users_profile where role = 'Admin' limit 1)),
  ('GMH-BOOK-2026-000907', (select id from public.guests where full_name = 'Nathan Prescott'), (select id from public.rooms where room_number = '404'), '2026-05-08', '2026-05-10', 1, 0, 'Checked Out', 'Paid', 570.00, 'Early gym access', (select id from public.users_profile where role = 'Staff' limit 1)),
  ('GMH-BOOK-2026-000908', (select id from public.guests where full_name = 'Amelia Wright'), (select id from public.rooms where room_number = '402'), '2026-05-22', '2026-05-25', 2, 0, 'Confirmed', 'Unpaid', 3600.00, 'Champagne arrival setup', (select id from public.users_profile where role = 'Admin' limit 1))
on conflict (confirmation_number) do nothing;

insert into public.housekeeping_tasks (room_id, assigned_staff_id, task_type, priority, status, notes, due_date, completed_at)
select *
from (
  values
    ((select id from public.rooms where room_number = '104'), (select id from public.staff where email = 'l.mercado@grandmilladohotel.com'), 'Turnover Cleaning', 'High', 'In Progress', 'Arrival at 15:00', '2026-05-12'::date, null::timestamptz),
    ((select id from public.rooms where room_number = '403'), (select id from public.staff where email = 'a.solis@grandmilladohotel.com'), 'Deep Clean', 'Urgent', 'Pending', 'VIP suite inspection', '2026-05-12'::date, null::timestamptz),
    ((select id from public.rooms where room_number = '301'), (select id from public.staff where email = 'l.mercado@grandmilladohotel.com'), 'Turndown', 'Medium', 'Completed', 'Spa suite evening setup', '2026-05-11'::date, '2026-05-11 18:00:00+00'::timestamptz),
    ((select id from public.rooms where room_number = '205'), (select id from public.staff where email = 't.zamora@grandmilladohotel.com'), 'Maintenance Support', 'High', 'Pending', 'Post-engineering inspection', '2026-05-13'::date, null::timestamptz),
    ((select id from public.rooms where room_number = '401'), (select id from public.staff where email = 'a.solis@grandmilladohotel.com'), 'VIP Arrival Setup', 'Urgent', 'Pending', 'Fresh floral arrangement and turndown prep', '2026-05-12'::date, null::timestamptz)
) as seed(room_id, assigned_staff_id, task_type, priority, status, notes, due_date, completed_at)
where not exists (
  select 1
  from public.housekeeping_tasks t
  where t.room_id = seed.room_id
    and t.task_type = seed.task_type
    and t.due_date = seed.due_date
);

insert into public.amenities (name, description, price, status)
values
  ('Signature Spa Ritual', '90-minute luxury spa ritual with thermal suite access.', 180.00, 'Available'),
  ('Private Dining Experience', 'Chef-led in-suite dining service for two.', 240.00, 'Available'),
  ('Executive Airport Transfer', 'Private premium airport transfer with meet and greet.', 95.00, 'Available'),
  ('Grand Millado Golf Access', 'Preferred green fee arrangement and caddie coordination.', 220.00, 'Available'),
  ('Sunset Yacht Excursion', 'Premium off-site yacht experience with concierge handling.', 680.00, 'Paused')
on conflict (name) do nothing;

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

insert into public.clubs (name, description, membership_fee, benefits, status)
values
  ('Presidential Club', 'Top-tier circle with private butler privileges and invitation-only events.', 2500.00, 'Complimentary spa rituals, dedicated concierge, exclusive boardroom access', 'Active'),
  ('Executive Club', 'Corporate premium access with lounge and meeting support.', 1200.00, 'Executive lounge, meeting credits, transfers', 'Active'),
  ('Spa & Wellness Club', 'Wellness-centric premium membership with recurring spa privileges.', 980.00, 'Spa credits, late checkout, wellness minibar', 'Active'),
  ('Dining Club', 'Priority reservations and private dining privileges.', 750.00, 'Private dining priority, chef tastings', 'Active'),
  ('Golf Club', 'Concierge-managed golf experiences and preferred tee times.', 1100.00, 'Golf access, transport support', 'Active'),
  ('Private Members Club', 'Lifestyle access with event invitations and private host service.', 1600.00, 'Private events, concierge host, suite upgrades', 'Active'),
  ('Loyalty Rewards Club', 'Premium loyalty membership with recurring stay perks.', 500.00, 'Room upgrades, amenity discounts, member rates', 'Active')
on conflict (name) do nothing;

insert into public.club_benefits (club_id, title, description, benefit_type, value)
values
  ((select id from public.clubs where name = 'Presidential Club'), 'Signature Spa Ritual', 'Complimentary spa ritual once per stay.', 'Complimentary Amenity', 100),
  ((select id from public.clubs where name = 'Presidential Club'), 'Private Dining Discount', 'Twenty percent reduction on in-suite dining.', 'Amenity Discount', 20),
  ((select id from public.clubs where name = 'Executive Club'), 'Executive Transfer Credit', 'Preferred transfer charge reduction.', 'Amenity Discount', 15),
  ((select id from public.clubs where name = 'Executive Club'), 'Meeting Lounge Access', 'Included access to lounge work pods.', 'Access', null),
  ((select id from public.clubs where name = 'Spa & Wellness Club'), 'Spa Ritual Discount', 'Fifteen percent discount on wellness services.', 'Amenity Discount', 15),
  ((select id from public.clubs where name = 'Dining Club'), 'Private Dining Credit', 'Ten percent dining savings.', 'Amenity Discount', 10),
  ((select id from public.clubs where name = 'Golf Club'), 'Golf Concierge Access', 'Priority tee time support and course transfers.', 'Access', null),
  ((select id from public.clubs where name = 'Private Members Club'), 'Hosted Arrival', 'Private host and bespoke room setup.', 'Access', null),
  ((select id from public.clubs where name = 'Loyalty Rewards Club'), 'Amenity Savings', 'Eight percent discount on eligible amenities.', 'Amenity Discount', 8)
on conflict do nothing;

insert into public.club_registrations (club_id, guest_id, membership_number, membership_level, start_date, end_date, status, notes)
values
  ((select id from public.clubs where name = 'Presidential Club'), (select id from public.guests where full_name = 'Alexander Beaumont'), 'GMH-CLUB-2026-000001', 'Presidential', '2026-01-01', '2026-12-31', 'Active', 'Corporate board retreat privileges'),
  ((select id from public.clubs where name = 'Golf Club'), (select id from public.guests where full_name = 'Dominic Alonzo'), 'GMH-CLUB-2026-000002', 'Gold', '2026-03-15', '2027-03-14', 'Active', 'Weekend tournament access'),
  ((select id from public.clubs where name = 'Loyalty Rewards Club'), (select id from public.guests where full_name = 'Olivia Chen'), 'GMH-CLUB-2026-000003', 'Diamond', '2026-02-01', '2027-01-31', 'Active', 'High-frequency stay profile'),
  ((select id from public.clubs where name = 'Executive Club'), (select id from public.guests where full_name = 'Amelia Wright'), 'GMH-CLUB-2026-000004', 'Platinum', '2026-05-01', '2027-04-30', 'Pending', 'Awaiting payment clearance')
on conflict (membership_number) do nothing;

insert into public.club_transactions (club_registration_id, guest_id, transaction_type, amount, description)
select *
from (
  values
    ((select id from public.club_registrations where membership_number = 'GMH-CLUB-2026-000001'), (select id from public.guests where email = 'alexander.beaumont@example.com'), 'Membership Fee', 2500.00, 'Initial Presidential Club activation'),
    ((select id from public.club_registrations where membership_number = 'GMH-CLUB-2026-000002'), (select id from public.guests where email = 'dominic.alonzo@example.com'), 'Membership Fee', 1100.00, 'Golf Club annual enrollment'),
    ((select id from public.club_registrations where membership_number = 'GMH-CLUB-2026-000003'), (select id from public.guests where email = 'olivia.chen@example.com'), 'Renewal', 500.00, 'Loyalty Rewards Club renewal'),
    ((select id from public.club_registrations where membership_number = 'GMH-CLUB-2026-000004'), (select id from public.guests where email = 'amelia.wright@example.com'), 'Membership Fee', 1200.00, 'Executive Club pending enrollment')
) as seed(club_registration_id, guest_id, transaction_type, amount, description)
where not exists (
  select 1
  from public.club_transactions t
  where t.club_registration_id = seed.club_registration_id
    and t.transaction_type = seed.transaction_type
    and t.amount = seed.amount
    and t.description = seed.description
);

insert into public.invoices (reservation_id, guest_id, invoice_number, subtotal, tax, discount, total, status)
values
  ((select id from public.reservations where confirmation_number = 'GMH-BOOK-2026-000901'), (select id from public.guests where email = 'alexander.beaumont@example.com'), 'GMH-INV-2026-000001', 4800.00, 576.00, 0.00, 5376.00, 'Partial'),
  ((select id from public.reservations where confirmation_number = 'GMH-BOOK-2026-000902'), (select id from public.guests where email = 'isabella.navarro@example.com'), 'GMH-INV-2026-000002', 570.00, 68.40, 0.00, 638.40, 'Pending'),
  ((select id from public.reservations where confirmation_number = 'GMH-BOOK-2026-000904'), (select id from public.guests where email = 'sophie.laurent@example.com'), 'GMH-INV-2026-000003', 1860.00, 223.20, 60.00, 2023.20, 'Paid'),
  ((select id from public.reservations where confirmation_number = 'GMH-BOOK-2026-000905'), (select id from public.guests where email = 'miguel.serrano@example.com'), 'GMH-INV-2026-000004', 990.00, 118.80, 0.00, 1108.80, 'Partial')
on conflict (invoice_number) do nothing;

insert into public.invoice_items (invoice_id, description, quantity, unit_price, total)
select *
from (
  values
    ((select id from public.invoices where invoice_number = 'GMH-INV-2026-000001'), 'Presidential Suite room charge', 1, 4800.00, 4800.00),
    ((select id from public.invoices where invoice_number = 'GMH-INV-2026-000001'), 'Presidential Club membership fee (GMH-CLUB-2026-000001)', 1, 2500.00, 2500.00),
    ((select id from public.invoices where invoice_number = 'GMH-INV-2026-000002'), 'Deluxe King room charge', 1, 570.00, 570.00),
    ((select id from public.invoices where invoice_number = 'GMH-INV-2026-000003'), 'Spa Wellness Suite room charge', 1, 1860.00, 1860.00),
    ((select id from public.invoices where invoice_number = 'GMH-INV-2026-000003'), 'Signature Spa Ritual service charge', 1, 180.00, 180.00),
    ((select id from public.invoices where invoice_number = 'GMH-INV-2026-000004'), 'Executive Twin room charge', 1, 990.00, 990.00)
) as seed(invoice_id, description, quantity, unit_price, total)
where not exists (
  select 1
  from public.invoice_items i
  where i.invoice_id = seed.invoice_id
    and i.description = seed.description
);

insert into public.payments (invoice_id, amount, payment_method, payment_status, paid_at)
select *
from (
  values
    ((select id from public.invoices where invoice_number = 'GMH-INV-2026-000001'), 2500.00, 'Wire Transfer', 'Partial', '2026-05-12 08:00:00+00'::timestamptz),
    ((select id from public.invoices where invoice_number = 'GMH-INV-2026-000003'), 2203.20, 'Credit Card', 'Paid', '2026-05-11 15:10:00+00'::timestamptz),
    ((select id from public.invoices where invoice_number = 'GMH-INV-2026-000004'), 500.00, 'Credit Card', 'Partial', '2026-05-10 12:00:00+00'::timestamptz)
) as seed(invoice_id, amount, payment_method, payment_status, paid_at)
where not exists (
  select 1
  from public.payments p
  where p.invoice_id = seed.invoice_id
    and p.amount = seed.amount
    and p.payment_method = seed.payment_method
    and p.paid_at = seed.paid_at
);

insert into public.amenity_bookings (amenity_id, reservation_id, guest_id, booking_date, quantity, total_amount, status)
select *
from (
  values
    ((select id from public.amenities where name = 'Signature Spa Ritual'), (select id from public.reservations where confirmation_number = 'GMH-BOOK-2026-000904'), (select id from public.guests where email = 'sophie.laurent@example.com'), '2026-05-11'::date, 1, 180.00, 'Completed'),
    ((select id from public.amenities where name = 'Executive Airport Transfer'), (select id from public.reservations where confirmation_number = 'GMH-BOOK-2026-000902'), (select id from public.guests where email = 'isabella.navarro@example.com'), '2026-05-13'::date, 1, 95.00, 'Booked'),
    ((select id from public.amenities where name = 'Grand Millado Golf Access'), (select id from public.reservations where confirmation_number = 'GMH-BOOK-2026-000903'), (select id from public.guests where email = 'dominic.alonzo@example.com'), '2026-05-15'::date, 1, 187.00, 'Booked'),
    ((select id from public.amenities where name = 'Private Dining Experience'), (select id from public.reservations where confirmation_number = 'GMH-BOOK-2026-000901'), (select id from public.guests where email = 'alexander.beaumont@example.com'), '2026-05-12'::date, 1, 192.00, 'Booked')
) as seed(amenity_id, reservation_id, guest_id, booking_date, quantity, total_amount, status)
where not exists (
  select 1
  from public.amenity_bookings a
  where a.amenity_id = seed.amenity_id
    and a.reservation_id = seed.reservation_id
    and a.booking_date = seed.booking_date
);

insert into public.audit_logs (user_id, action, entity_type, entity_id, details)
select *
from (
  values
    ((select id from public.users_profile where role = 'Admin' limit 1), 'Created reservation', 'reservations', (select id from public.reservations where confirmation_number = 'GMH-BOOK-2026-000901'), 'Booking entered for Alexander Beaumont'),
    ((select id from public.users_profile where role = 'Staff' limit 1), 'Updated guest', 'guests', (select id from public.guests where email = 'isabella.navarro@example.com'), 'Profile preference update'),
    ((select id from public.users_profile where role = 'Admin' limit 1), 'Updated housekeeping task', 'housekeeping_tasks', (select id from public.housekeeping_tasks where room_id = (select id from public.rooms where room_number = '104') and task_type = 'Turnover Cleaning' limit 1), 'Turnover moved to in progress'),
    ((select id from public.users_profile where role = 'Admin' limit 1), 'Recorded payment', 'payments', (select id from public.payments where invoice_id = (select id from public.invoices where invoice_number = 'GMH-INV-2026-000003') and amount = 2203.20 limit 1), 'Credit card payment applied to spa suite invoice')
) as seed(user_id, action, entity_type, entity_id, details)
where not exists (
  select 1
  from public.audit_logs l
  where l.action = seed.action
    and l.entity_type = seed.entity_type
    and coalesce(l.entity_id, -1) = coalesce(seed.entity_id, -1)
    and l.details = seed.details
);
