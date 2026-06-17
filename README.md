# Grand Millado Hotel Management System

Grand Millado Hotel Management System is a browser-based hotel operations platform built from the provided luxury Stitch design package and implemented with vanilla HTML, CSS, JavaScript, and Supabase. It covers reservations, rooms, guests, housekeeping, staff administration, billing, amenities, VIP clubs, reports, settings, booking confirmations, and checkout receipts.

## Tech Stack

- HTML5
- CSS3
- Vanilla JavaScript with ES modules
- Supabase Auth
- Supabase Postgres
- Official Supabase JavaScript client

## Folder Structure

```text
hotel-management-system/
  index.html
  login.html
  dashboard.html
  rooms.html
  room-details.html
  reservations.html
  reservation-calendar.html
  guests.html
  guest-details.html
  housekeeping.html
  staff.html
  billing.html
  amenities.html
  settings.html
  clubs.html
  booking-confirmation.html
  guest-folio.html
  staff-accounting.html

  assets/
    css/
      styles.css
      tailwind.css
    js/
      config.js
      supabaseClient.js
      auth.js
      router.js
      utils.js
      ui.js
      services/
      pages/

  database/
    schema.sql
    seed.sql
```

## Implemented Features

- Supabase authentication with production-oriented session-based access control
- Two application login roles only: `Admin` and `Staff`
- Responsive executive dashboard with reservation, room, revenue, housekeeping, and VIP metrics
- Responsive sidebar, topbar, cards, tables, forms, modals, and print views
- Room inventory management, status updates, filters, and room detail view
- Reservation creation, editing, availability-based room assignment, check-in, check-out, cancellation, calendar view, and overlap prevention
- Reservation flow includes inline guest creation without leaving the reservation page
- Reservation guaranteed deposit is always required and defaults to one night's room rate
- Guest creation, editing, stay history, VIP visibility, club visibility, amenity history, and invoice history
- Housekeeping task management and room-status synchronization for Admin and Staff operational users
- Staff directory management for Admin users
- Billing with invoice creation, payment recording, downpayment support, outstanding balance visibility, and club revenue tracking
- Cashier Closing ledger for staff-processed payments and printable cashier-style reporting
- Amenities CRUD, hotel service catalogue management, service order posting, and invoice charge support
- VIP clubs with clubs, benefits, registrations, transactions, benefit usage tracking, membership fee billing support, and service-order benefit application
- Admin-only reports with filterable operational, financial, housekeeping, audit, and VIP summaries
- Print-friendly booking confirmation, guest folio, cashier closing, and checkout receipt pages with browser print and save-as-PDF flow

## Role Model

Only these application roles are valid:

- `Admin`
- `Staff`

### Admin Access

Admin users can access and manage:

- Dashboard
- Rooms
- Reservations
- Reservation Calendar
- Guests
- Housekeeping
- Staff
- Billing
- Amenities
- VIP Clubs
- Reports
- Settings

### Staff Access

Staff users can access reservation-support workflows only:

- Dashboard
- Rooms
- Reservations
- Reservation Calendar
- Guests
- Housekeeping
- Accounting

Staff users can:

- View room availability
- Create and edit reservations
- Cancel reservations
- Check guests in and out
- Create and edit guest profiles needed for reservations
- Open and print booking confirmations through reservation records
- Open and print guest folios before final checkout
- View guest club status and apply the operational reservation and stay workflows allowed by the UI
- View and print only the transactions they personally processed in the Staff Accounting ledger

Staff users cannot access:

- Staff directory management
- Billing management
- Amenities management
- VIP club structure management
- Reports
- Settings
- System-level delete workflows outside their reservation-support scope

## Overall System Report

### System Scope

The application is a premium hotel front-end operations suite for Grand Millado Hotel. Supabase provides authentication and database access. The browser application layer is implemented entirely with modular HTML, CSS, and vanilla JavaScript.

### Visual Adaptation Report

- The application shell, sidebar, top bar, editorial page headers, metric cards, and white data canvases are adapted from the uploaded Stitch luxury hotel layouts.
- The visual system keeps the original direction: deep navy, gold accents, warm off-white surfaces, serif editorial headings, glass-like top navigation, and soft-shadow hierarchy.
- The latest pass also adds responsive sidebar behavior, adaptive grids, modal resizing, fluid page widths, smoother transitions, report layouts, and print-aware operational screens.

### Functional Module Report

- Authentication: working with Supabase Auth and metadata-driven profile sync.
- Dashboard: working with role-aware presentation for Admin and Staff.
- Rooms: working; Admin can manage inventory, Staff can view availability and detail.
- Reservations: working CRUD, confirmation links, total calculation, status changes, and double-booking validation.
- Reservation Calendar: working seven-day HTML and JavaScript board without external calendar libraries.
- Guests: working create and edit flow, history, VIP visibility, invoices, memberships, and amenity history.
- Housekeeping: working room-status board for manually setting rooms as clean, dirty, occupied, blocked, reserved, or out of service.
- Staff: working Admin-only directory and department filtering.
- Billing: working Admin-only invoice listing, invoice creation from reservations, payment recording, downpayment visibility, service-charge folios, and club revenue reporting.
- Amenities and Services: working Admin-only amenity CRUD, hotel service catalogue management, amenity booking flow, service order workflow for checked-in guests, and invoice charge integration.
- VIP Clubs: working Admin-only clubs, benefits, registrations, transactions, levels, billing linkage, benefit usage support, and service-order discount application.
- Reports: working Admin-only arrivals, departures, occupancy, revenue, outstanding balances, service revenue, VIP club, housekeeping, and audit reports with CSV export and print.
- Settings: working Admin-only local hotel profile and tax defaults, plus room type management.
- Booking Confirmation and Checkout Receipt: working print-ready reservation confirmation and final folio receipt pages with browser PDF save support.

## Key Operational Workflows

### Availability-Based Reservation Filtering

- Reservation forms first require `check-in`, `check-out`, and `room type`.
- The room dropdown then loads only available rooms for the selected date range and room type.
- Rooms in `Maintenance` or `Out of Service`, and rooms blocked by overlapping `Pending`, `Confirmed`, or `Checked In` reservations, are excluded.
- Editing preserves the current room when the reservation still fits the current date and room-type selection.
- The database also exposes `get_available_rooms(...)` so availability rules are enforced consistently.

### Guaranteed Deposit Workflow

- Reservations support:
  - `downpayment_required`
  - `downpayment_amount`
  - `downpayment_paid`
  - `downpayment_status`
- Every reservation requires a guaranteed deposit.
- Required deposit defaults to one night's room rate.
- Deposit values are validated against the reservation total.
- Initial deposits are collected during reservation creation and stored in `payments`, not directly as payment-method fields on `reservations`.
- Deposit information appears in reservation financial summaries, billing, booking confirmation, and checkout folio views.
- Payment records store method, date, reference number, and notes.

### Reservation Search

- Reservation search supports:
  - guest full name
  - guest email
  - guest phone
  - room number
  - confirmation number
  - reservation status
  - payment status
- Search uses a database-side `search_reservations(...)` function for more reliable joined lookups than simple related-table `ilike` filters.

### Check-In Workflow

- Check-in opens a validation modal with:
  - reservation summary
  - guest verification
  - downpayment verification
  - optional additional payment collection
  - incidental deposit capture
- Required downpayments must be satisfied before check-in can complete.
- Successful check-in updates the reservation to `Checked In`, sets room occupancy, stores the operational metadata, and records audit activity.

### Check-Out Workflow

- Check-out opens `guest-folio.html?id=RESERVATION_ID` first.
- The Guest Folio is the pre-checkout review document and includes:
  - itemized charges
  - folio totals
  - balance due
  - front desk signature line
  - guest signature line
- From the Guest Folio page, the user can print the folio and then proceed to payment settlement.
- Staff cannot complete checkout while a balance remains unpaid.
- Successful checkout updates the reservation to `Checked Out`, moves the room to `Cleaning`, creates a turnover housekeeping task, and routes to the printable checkout receipt.

### Staff Accounting Ledger

- `staff-accounting.html` is available to Staff and Admin.
- Staff can see only transactions where they are the recorded receiver / cashier.
- Admin can review all staff-recorded payment transactions.
- The ledger supports filters by:
  - date range
  - transaction type
  - payment method
  - guest / room / confirmation / reference search
- The page includes a print-friendly transaction report with signature sections.

### Service Order Workflow

- Admin manages the operational `hotel_services` catalogue.
- Staff and Admin can add service orders to checked-in reservations.
- Chargeable completed services are posted into the folio through the database-side workflow.
- Service orders appear in guest history, billing rollups, and receipt calculations.

### VIP Club Benefit Application

- When a guest has active VIP memberships, eligible club benefits can be surfaced during the service-order workflow.
- Applicable benefit rules support:
  - percentage discounts
  - fixed discounts
  - complimentary service coverage
  - access-style benefits
- Applied benefits are recorded in `club_benefit_usage`.
- Benefit discounts are written into the folio as negative invoice line items so billing, checkout, and printed receipts remain aligned.
- Guest profiles and checkout receipts display VIP benefit usage history.

### Reports Module

- Admin-only `reports.html` provides:
  - daily arrivals
  - daily departures
  - occupancy summary
  - revenue summary
  - outstanding balance report
  - service revenue report
  - VIP club report
  - housekeeping report
  - audit activity report
- Reports support:
  - date-range filters
  - room type, reservation, payment, VIP, service-category, and club filters
  - CSV export
  - browser print output

### Responsive Behavior

- The app shell supports large desktop, laptop, tablet, and small-screen layouts.
- The sidebar collapses or becomes a drawer depending on screen size.
- Tables remain scrollable inside `table-wrap` containers.
- Filters and forms collapse into single-column layouts on narrower screens.
- Print pages hide navigation and screen-only controls during printing.

### Print Formatting

- Booking confirmations, checkout receipts, and reports are formatted for A4 printing.
- Navigation, filters, sidebars, and screen-only action buttons are hidden during printing.
- Tables and summary cards use print-safe borders and page-break rules to reduce broken sections across pages.

### Checkout Receipt Printing

- `checkout-receipt.html?id=RESERVATION_ID` renders a print-ready A4 folio summary.
- The receipt includes guest stay details, room details, itemized charges, payments, balance outcome, and Grand Millado Hotel branding.
- The page uses `window.print()` for paper or PDF output.

### VIP Club Operational Use

- Guest club memberships are visible in reservation workflows.
- Club-related billing can be attached to invoices.
- Club benefit usage has a dedicated table for traceability.
- Staff can view club status; Admin manages clubs, benefits, registrations, and fee structures.

### Data and Policy Report

- `schema.sql` creates the operational tables, VIP club tables, triggers, and authenticated-user RLS policies.
- Reservation overlap prevention is enforced in both the frontend validation layer and the database trigger layer.
- Room status recalculation is automated from reservation and housekeeping events.
- Invoice and payment rollups update reservation payment state automatically.
- Existing Supabase Auth users can be backfilled into `users_profile` by rerunning `schema.sql`.
- Only `Admin` and `Staff` are valid values for `users_profile.role`.

## Supabase Setup

1. Create a new Supabase project.
2. Open the SQL editor and run [`database/schema.sql`](database/schema.sql).
3. Create your real production users in `Authentication > Users`.
4. Run [`database/seed.sql`](database/seed.sql) if you want sample operational hotel data.
5. Update [`assets/js/config.js`](assets/js/config.js) with your project URL and anon key.

If you created auth users before running `schema.sql`, run `schema.sql` again after the trigger is installed. It includes a backfill step that syncs existing `auth.users` records into `users_profile`.

After applying schema changes such as new `payments` columns or reservation defaults, rerun [`database/schema.sql`](database/schema.sql) in the Supabase SQL editor so the database schema and Supabase schema cache are refreshed before testing the frontend.

## Configure Supabase URL and Anon Key

Edit [`assets/js/config.js`](assets/js/config.js) and replace:

```js
export const SUPABASE_URL = "YOUR_SUPABASE_URL";
export const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";
```

Use only the anon key in the frontend. Never expose the service-role key in browser code.

## Production User Setup

Create real users manually in Supabase Auth. Do not use placeholder or shared credentials in production.

This project has no demo mode and no fixed demo credentials.

Allowed metadata values:

### Admin metadata

```json
{
  "full_name": "Actual Admin Name",
  "role": "Admin"
}
```

### Staff metadata

```json
{
  "full_name": "Actual Staff Name",
  "role": "Staff"
}
```

When the user signs in, `schema.sql` syncs this metadata into `users_profile`.

## How to Create Supabase Tables

Run [`database/schema.sql`](database/schema.sql) in the Supabase SQL editor. It creates:

- `users_profile`
- `staff`
- `guests`
- `room_types`
- `rooms`
- `reservations`
- `housekeeping_tasks`
- `invoices`
- `invoice_items`
- `payments`
- `amenities`
- `amenity_bookings`
- `hotel_services`
- `service_orders`
- `clubs`
- `club_registrations`
- `club_benefits`
- `club_benefit_usage`
- `club_transactions`
- `audit_logs`

It also adds:

- Row Level Security policies for authenticated users
- Automatic profile creation from `auth.users`
- Reservation overlap protection
- Availability lookup RPC
- Reservation search RPC
- Confirmation number generation
- Room status recalculation triggers
- Invoice and reservation payment status recalculation triggers
- Service-order folio charge synchronization
- Club benefit usage tracking for operational discounts and complimentary service coverage

Recent schema alignment updates also ensure:

- reservation inserts no longer expect `payment_method` or other payment-only fields on `reservations`
- reservation downpayment defaults are enforced at the database level
- staff transaction ledger metadata can be stored on `payments` using `received_by` and `transaction_type`

## How to Import Seed Data

Run [`database/seed.sql`](database/seed.sql) if you want realistic hotel sample data for rooms, guests, reservations, housekeeping, amenities, billing, and VIP clubs.

Important:

- `seed.sql` does not create Auth users.
- `seed.sql` does not inject login credentials.
- `seed.sql` is sample operational data only.

## How to Run Locally

Because the project is plain HTML and ES modules, serve it with a local static server from the `hotel-management-system` folder.

Examples:

```bash
npx serve .
```

or

```bash
python -m http.server 8080
```

Then open `http://localhost:3000` or `http://localhost:8080` depending on the server you used.

## Business Rules Implemented

- A room cannot be double-booked for overlapping date ranges.
- Checked-in reservations move rooms to `Occupied`.
- Checked-out reservations move rooms to `Cleaning` or `Available` depending on pending housekeeping.
- Cancelled and completed reservations release room inventory when appropriate.
- Completed housekeeping tasks can move rooms back to `Available`.
- Payments roll up into invoice status and reservation payment status.
- Reservation records receive a unique `GMH-BOOK-YYYY-######` confirmation number.
- VIP membership fees can be added to invoices.
- Amenity bookings can apply club discounts or complimentary benefits when configured.

## Print-Ready Booking Confirmation

After creating a reservation:

- The reservation page opens a success modal.
- The modal links to `booking-confirmation.html?id=RESERVATION_ID`.
- The confirmation page loads reservation, guest, room, billing, and club or amenity charge detail from Supabase.
- The user can print or save as PDF through the browser print dialog.

## Notes

- The app is branded consistently as Grand Millado Hotel.
- Hotel profile details and tax-rate defaults are stored in browser local storage by the Settings page.
- Frontend role checks control navigation visibility, while database access is protected with authenticated-user RLS policies.
