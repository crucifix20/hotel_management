export const APP_NAME = "Grand Millado Hotel";
export const APP_TAGLINE = "Executive hotel operations platform";
export const HOTEL_ADDRESS = "Prk. Waling-waling Arellano St., Brgy. Zone II, Koronadal City, South Cotabato, Philippines";
export const HOTEL_CONTACT = "+63 (2) 8123 4567 | concierge@grandmilladohotel.com";

export const SUPABASE_URL = "https://sqlcqgubkgtinqsjxnqq.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxbGNxZ3Via2d0aW5xc2p4bnFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1NzMyODgsImV4cCI6MjA5NDE0OTI4OH0.e2BoKZqHzbhMm_d7Y7u1WxMIP7Q6aAtCCpE7U8MFUzY";

export const ROLES = {
  ADMIN: "Admin",
  STAFF: "Staff",
};

export const ROOM_STATUSES = [
  "Available",
  "Occupied",
  "Reserved",
  "Cleaning",
  "Maintenance",
  "Out of Service",
];

export const RESERVATION_STATUSES = [
  "Pending",
  "Confirmed",
  "Checked In",
  "Checked Out",
  "Cancelled",
  "No Show",
];

export const PAYMENT_STATUSES = [
  "Unpaid",
  "Partial",
  "Paid",
  "Refunded",
];

export const DOWNPAYMENT_STATUSES = [
  "Not Required",
  "Required",
  "Partially Paid",
  "Paid",
  "Refunded",
];

export const PAYMENT_METHODS = [
  "Cash",
  "Card",
  "Bank Transfer",
  "E-Wallet",
  "Online Payment",
];

export const PAYMENT_TRANSACTION_TYPES = [
  "Reservation Downpayment",
  "Check-In Payment",
  "Checkout Payment",
  "Service Charge Payment",
  "Incidental Deposit",
  "Refund",
  "Adjustment",
];

export const SERVICE_ORDER_STATUSES = [
  "Requested",
  "In Progress",
  "Completed",
  "Cancelled",
  "Charged",
];

export const HOTEL_SERVICE_CATEGORIES = [
  "Room Service",
  "Housekeeping",
  "Food & Beverage",
  "Spa",
  "Transport",
  "Laundry",
  "Other",
];

export const HOUSEKEEPING_STATUSES = [
  "Pending",
  "In Progress",
  "Completed",
  "Cancelled",
];

export const HOUSEKEEPING_PRIORITIES = [
  "Low",
  "Medium",
  "High",
  "Urgent",
];

export const CLUB_LEVELS = [
  "Standard",
  "Silver",
  "Gold",
  "Platinum",
  "Diamond",
  "Presidential",
];

export const CLUB_REGISTRATION_STATUSES = [
  "Active",
  "Pending",
  "Expired",
  "Cancelled",
  "Suspended",
];

export const NAV_ITEMS = [
  { key: "dashboard", label: "Executive Dashboard", icon: "dashboard", href: "dashboard.html", roles: [ROLES.ADMIN, ROLES.STAFF] },
  { key: "rooms", label: "Room Management", icon: "bed", href: "rooms.html", roles: [ROLES.ADMIN, ROLES.STAFF] },
  { key: "reservations", label: "Reservations", icon: "event_note", href: "reservations.html", roles: [ROLES.ADMIN, ROLES.STAFF] },
  { key: "reservation-calendar", label: "Reservation Calendar", icon: "calendar_month", href: "reservation-calendar.html", roles: [ROLES.ADMIN, ROLES.STAFF] },
  { key: "guests", label: "Guest Profiles", icon: "badge", href: "guests.html", roles: [ROLES.ADMIN, ROLES.STAFF] },
  { key: "housekeeping", label: "Housekeeping", icon: "cleaning_services", href: "housekeeping.html", roles: [ROLES.ADMIN, ROLES.STAFF] },
  { key: "staff-accounting", label: "Cashier Closing", icon: "receipt_long", href: "staff-accounting.html", roles: [ROLES.ADMIN, ROLES.STAFF] },
  { key: "staff", label: "Staff Directory", icon: "groups", href: "staff.html", roles: [ROLES.ADMIN] },
  { key: "billing", label: "Accounting", icon: "analytics", href: "billing.html", roles: [ROLES.ADMIN] },
  { key: "amenities", label: "Amenities & Services", icon: "room_service", href: "amenities.html", roles: [ROLES.ADMIN] },
  { key: "clubs", label: "VIP Clubs", icon: "workspace_premium", href: "clubs.html", roles: [ROLES.ADMIN] },
  { key: "reports", label: "Reports", icon: "assessment", href: "reports.html", roles: [ROLES.ADMIN] },
  { key: "settings", label: "Settings", icon: "settings", href: "settings.html", roles: [ROLES.ADMIN] },
];

export const PAGE_ACCESS = {
  dashboard: [ROLES.ADMIN, ROLES.STAFF],
  rooms: [ROLES.ADMIN, ROLES.STAFF],
  "room-details": [ROLES.ADMIN, ROLES.STAFF],
  reservations: [ROLES.ADMIN, ROLES.STAFF],
  "reservation-calendar": [ROLES.ADMIN, ROLES.STAFF],
  guests: [ROLES.ADMIN, ROLES.STAFF],
  "guest-details": [ROLES.ADMIN, ROLES.STAFF],
  housekeeping: [ROLES.ADMIN, ROLES.STAFF],
  "staff-accounting": [ROLES.ADMIN, ROLES.STAFF],
  staff: [ROLES.ADMIN],
  billing: [ROLES.ADMIN],
  amenities: [ROLES.ADMIN],
  clubs: [ROLES.ADMIN],
  reports: [ROLES.ADMIN],
  settings: [ROLES.ADMIN],
  "booking-confirmation": [ROLES.ADMIN, ROLES.STAFF],
  "guest-folio": [ROLES.ADMIN, ROLES.STAFF],
  "checkout-receipt": [ROLES.ADMIN, ROLES.STAFF],
};

export const WIDE_PAGES = [
  "dashboard",
  "rooms",
  "reservations",
  "reservation-calendar",
  "guests",
  "housekeeping",
  "staff-accounting",
  "billing",
  "clubs",
  "reports",
];

export const PAGE_META = {
  dashboard: { title: "Executive Dashboard", subtitle: "Live performance, arrivals, revenue, and operational visibility." },
  rooms: { title: "Room Management", subtitle: "Inventory, room status, rates, and operational readiness." },
  reservations: { title: "Reservation Management", subtitle: "Bookings, arrivals, departures, and payment progress." },
  "reservation-calendar": { title: "Reservation Calendar", subtitle: "Seven-day occupancy view across room inventory." },
  guests: { title: "Guest Management", subtitle: "Profiles, stay history, preferences, and VIP relationship detail." },
  housekeeping: { title: "Housekeeping Operations", subtitle: "Tasks, assignments, priorities, and room turnaround." },
  "staff-accounting": { title: "Cashier Closing", subtitle: "Front desk payment activity, cashier closing filters, and print-ready accounting records." },
  staff: { title: "Staff Management", subtitle: "Departments, shifts, directory information, and task coverage." },
  billing: { title: "Billing & Accounting", subtitle: "Invoices, payments, balances, and revenue performance." },
  amenities: { title: "Amenities & Services", subtitle: "Premium services, guest bookings, and ancillary revenue." },
  clubs: { title: "VIP Club Management", subtitle: "Premium memberships, benefits, registrations, and club revenue." },
  reports: { title: "Reports", subtitle: "Executive hotel reporting, operational exports, and print-ready summaries." },
  settings: { title: "Settings", subtitle: "Hotel profile, tax defaults, room types, and access placeholders." },
  "booking-confirmation": { title: "Booking Confirmation", subtitle: "Print-ready booking summary for guest operations." },
  "guest-folio": { title: "Guest Folio", subtitle: "Pre-checkout folio review, signatures, and settlement handoff." },
  "checkout-receipt": { title: "Checkout Receipt", subtitle: "Final stay folio, charges, payments, and settlement receipt." },
};

export const SETTINGS_STORAGE_KEY = "tjs_settings";
export const DEFAULT_SETTINGS = {
  hotelName: APP_NAME,
  address: HOTEL_ADDRESS,
  contact: HOTEL_CONTACT,
  taxRate: 12,
};
