import { addDays, differenceInNights, parseNumber, todayIso, toIsoDate } from "../utils.js";
import { supabase } from "../supabaseClient.js";

const BLOCKING_RESERVATION_STATUSES = ["Pending", "Confirmed", "Checked In"];
const NON_BLOCKING_RESERVATION_STATUSES = ["Cancelled", "Checked Out", "No Show"];
const RESERVATION_COLUMNS = [
  "id",
  "guest_id",
  "room_id",
  "check_in",
  "check_out",
  "adults",
  "children",
  "status",
  "payment_status",
  "total_amount",
  "downpayment_required",
  "downpayment_amount",
  "downpayment_paid",
  "downpayment_status",
  "incidental_deposit_amount",
  "incidental_deposit_paid",
  "special_requests",
  "arrival_date",
  "flight_number",
  "departure_date",
  "internal_notes",
  "admin_notes",
  "guest_verified",
  "guest_id_type",
  "guest_id_number",
  "check_in_notes",
  "checkout_notes",
  "cancellation_reason",
  "cancelled_at",
  "cancelled_by",
  "checked_in_at",
  "checked_in_by",
  "checked_out_at",
  "checked_out_by",
  "checkout_override_reason",
  "created_by",
];

function reservationsQuery(detailed = false) {
  const guestSelection = detailed
    ? `guests(
        *,
        amenity_bookings(*, amenities(name, price)),
        club_registrations(*, clubs(*, club_benefits(*)), club_transactions(*))
      )`
    : "guests(id, full_name, email, phone, vip_status)";

  const serviceSelection = detailed
    ? `service_orders(
        *,
        hotel_services(id, name, category, is_chargeable, status)
      )`
    : "service_orders(id, status, total_amount)";

  const benefitUsageSelection = detailed
    ? `club_benefit_usage(
        *,
        club_benefits(title, applies_to, discount_type, discount_value),
        club_registrations(membership_number, membership_level, clubs(name)),
        service_orders(id, total_amount, hotel_services(name))
      )`
    : "club_benefit_usage(id, amount_discounted)";

  return supabase.from("reservations").select(`
    *,
    ${guestSelection},
    rooms(id, room_number, status, floor, rate, room_types(*)),
    ${serviceSelection},
    ${benefitUsageSelection},
    created_by_profile:users_profile!reservations_created_by_fkey(full_name, role),
    checked_in_by_profile:users_profile!reservations_checked_in_by_fkey(full_name, role),
    checked_out_by_profile:users_profile!reservations_checked_out_by_fkey(full_name, role),
    cancelled_by_profile:users_profile!reservations_cancelled_by_fkey(full_name, role)
  `);
}

function normalizeSearchValue(value) {
  return String(value || "").trim().toLowerCase();
}

function roundCurrency(value) {
  return Number(Number(value || 0).toFixed(2));
}

function pickReservationColumns(payload) {
  return RESERVATION_COLUMNS.reduce((record, key) => {
    if (payload[key] !== undefined) {
      record[key] = payload[key];
    }
    return record;
  }, {});
}

function computeDownpaymentStatus(record) {
  if (!record.downpayment_required) {
    return "Not Required";
  }

  const amount = Number(record.downpayment_amount || 0);
  const paid = Number(record.downpayment_paid || 0);

  if (paid >= amount && amount > 0) {
    return "Paid";
  }
  if (paid > 0) {
    return "Partially Paid";
  }
  return "Required";
}

function addReservationComputedFields(record) {
  const nights = differenceInNights(record.check_in, record.check_out);
  const totalAmount = Number(record.total_amount || 0);
  const downpaymentPaid = Number(record.downpayment_paid || 0);

  return {
    ...record,
    nights,
    room_rate: Number(record.rooms?.rate || 0),
    service_total: (record.service_orders || []).reduce((sum, item) => sum + Number(item.total_amount || 0), 0),
    downpayment_amount: Number(record.downpayment_amount || 0),
    downpayment_paid: downpaymentPaid,
    downpayment_status: computeDownpaymentStatus(record),
    balance_due: Math.max(totalAmount - downpaymentPaid, 0),
  };
}

async function listReservationIdsBySearch(search) {
  const needle = normalizeSearchValue(search);
  if (!needle) {
    return null;
  }

  const { data, error } = await supabase.rpc("search_reservations", {
    search_text: needle,
  });

  if (error) {
    throw error;
  }

  return (data || []).map((row) => row.id);
}

export async function listReservations(filters = {}) {
  let query = reservationsQuery().order("check_in", { ascending: false });

  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  const searchIds = await listReservationIdsBySearch(filters.search);
  if (Array.isArray(searchIds)) {
    if (!searchIds.length) {
      return [];
    }
    query = query.in("id", searchIds);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return (data || []).map(addReservationComputedFields);
}

export async function listRecentReservations(limit = 6) {
  const { data, error } = await reservationsQuery()
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }
  return (data || []).map(addReservationComputedFields);
}

export async function getReservation(id) {
  const { data, error } = await reservationsQuery(true)
    .eq("id", id)
    .single();

  if (error) {
    throw error;
  }

  return addReservationComputedFields(data);
}

export async function calculateReservationTotal(roomId, checkIn, checkOut) {
  const { data, error } = await supabase
    .from("rooms")
    .select("id, rate, room_types(capacity)")
    .eq("id", roomId)
    .single();

  if (error) {
    throw error;
  }

  const nights = differenceInNights(checkIn, checkOut);
  return {
    nights,
    rate: Number(data.rate || 0),
    capacity: Number(data.room_types?.capacity || 0),
    total: Number((Number(data.rate || 0) * nights).toFixed(2)),
  };
}

export async function getAvailableRooms({ checkIn, checkOut, roomTypeId, excludeReservationId = null }) {
  if (!checkIn || !checkOut || !roomTypeId) {
    return [];
  }

  const { data, error } = await supabase.rpc("get_available_rooms", {
    check_in_date: checkIn,
    check_out_date: checkOut,
    selected_room_type_id: Number(roomTypeId),
    exclude_reservation_id: excludeReservationId ? Number(excludeReservationId) : null,
  });

  if (error) {
    throw error;
  }

  return data || [];
}

async function validateGuest(payload) {
  if (!payload.guest_id) {
    throw new Error("Guest is required.");
  }

  const { data, error } = await supabase
    .from("guests")
    .select("id, full_name, email, phone")
    .eq("id", payload.guest_id)
    .single();

  if (error) {
    throw error;
  }

  if (!data.full_name?.trim()) {
    throw new Error("Guest full name is required.");
  }
}

async function validateRoomCapacity(payload) {
  const { data, error } = await supabase
    .from("rooms")
    .select("id, status, room_types(capacity)")
    .eq("id", payload.room_id)
    .single();

  if (error) {
    throw error;
  }

  if (["Maintenance", "Out of Service"].includes(data.status)) {
    throw new Error("Rooms under maintenance or out of service cannot be booked.");
  }

  const capacity = Number(data.room_types?.capacity || 0);
  const totalOccupants = Number(payload.adults || 0) + Number(payload.children || 0);

  if (capacity > 0 && totalOccupants > capacity) {
    throw new Error(`Room capacity exceeded. Selected room supports up to ${capacity} guest(s).`);
  }
}

function validateDownpaymentFields(payload) {
  const totalAmount = Number(payload.total_amount || 0);
  const downpaymentAmount = Number(payload.downpayment_amount || 0);
  const downpaymentPaid = Number(payload.downpayment_paid || 0);

  if (downpaymentAmount < 0 || downpaymentPaid < 0) {
    throw new Error("Downpayment values cannot be negative.");
  }

  if (downpaymentAmount > totalAmount || downpaymentPaid > totalAmount) {
    throw new Error("Downpayment cannot exceed the reservation total.");
  }

  if (downpaymentAmount <= 0) {
    throw new Error("Required downpayment must be greater than zero.");
  }

  if (downpaymentPaid <= 0) {
    throw new Error("Downpayment paid must be greater than zero.");
  }

  if (downpaymentPaid < downpaymentAmount && payload.status === "Confirmed") {
    throw new Error("Reservation cannot be confirmed until the required downpayment is fully paid.");
  }
}

async function validateDoubleBooking(payload) {
  if (!payload.room_id || !payload.check_in || !payload.check_out) {
    return;
  }

  const availableRooms = await getAvailableRooms({
    checkIn: payload.check_in,
    checkOut: payload.check_out,
    roomTypeId: payload.room_type_id,
    excludeReservationId: payload.id || null,
  });

  if (!availableRooms.some((room) => Number(room.id) === Number(payload.room_id))) {
    throw new Error("This room is not available for the selected date range.");
  }
}

function normalizeReservationPayload(payload, calc) {
  const totalAmount = roundCurrency(calc.total || 0);
  const downpaymentRequired = true;
  const fallbackDownpaymentAmount = roundCurrency(calc.rate || totalAmount);
  const downpaymentAmount = roundCurrency(parseNumber(payload.downpayment_amount, fallbackDownpaymentAmount) || fallbackDownpaymentAmount);
  const downpaymentPaid = roundCurrency(parseNumber(payload.downpayment_paid, 0));
  const paymentStatus = downpaymentPaid >= totalAmount && totalAmount > 0
    ? "Paid"
    : downpaymentPaid > 0
      ? "Partial"
      : "Unpaid";
  const reservationStatus = payload.status
    || (downpaymentPaid >= downpaymentAmount && downpaymentAmount > 0 ? "Confirmed" : "Pending");
  const downpaymentStatus = downpaymentPaid >= downpaymentAmount && downpaymentAmount > 0
    ? "Paid"
    : downpaymentPaid > 0
      ? "Partially Paid"
      : "Required";

  return {
    ...payload,
    guest_id: Number(payload.guest_id),
    room_id: Number(payload.room_id),
    adults: Number(payload.adults),
    children: Number(payload.children || 0),
    total_amount: totalAmount,
    downpayment_required: downpaymentRequired,
    downpayment_amount: downpaymentAmount,
    downpayment_paid: downpaymentPaid,
    downpayment_status: downpaymentStatus,
    incidental_deposit_amount: roundCurrency(parseNumber(payload.incidental_deposit_amount, 0)),
    incidental_deposit_paid: roundCurrency(parseNumber(payload.incidental_deposit_paid, 0)),
    arrival_date: payload.arrival_date || null,
    flight_number: payload.flight_number || null,
    departure_date: payload.departure_date || null,
    guest_verified: payload.guest_verified === true || payload.guest_verified === "true" || payload.guest_verified === "on",
    payment_status: payload.payment_status || paymentStatus,
    status: reservationStatus,
  };
}

export async function saveReservation(payload) {
  if (!payload.guest_id || !payload.room_id || !payload.check_in || !payload.check_out) {
    throw new Error("Guest, room, check-in, and check-out are required.");
  }

  if (Number(payload.adults || 0) < 1) {
    throw new Error("At least one adult is required.");
  }

  if (Number(payload.children || 0) < 0) {
    throw new Error("Children cannot be negative.");
  }

  if (payload.check_out <= payload.check_in) {
    throw new Error("Check-out must be after check-in.");
  }

  if (payload.check_in < todayIso()) {
    throw new Error("Check-in date cannot be in the past.");
  }

  const calc = await calculateReservationTotal(payload.room_id, payload.check_in, payload.check_out);
  const record = normalizeReservationPayload(payload, calc);

  await validateGuest(record);
  await validateRoomCapacity(record);
  validateDownpaymentFields(record);
  await validateDoubleBooking(record);

  const upsertRecord = pickReservationColumns(record);
  if (!upsertRecord.id) {
    delete upsertRecord.id;
  } else {
    upsertRecord.id = Number(upsertRecord.id);
  }

  const { data, error } = await supabase
    .from("reservations")
    .upsert(upsertRecord)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return getReservation(data.id);
}

export async function updateReservationStatus(id, status, extraFields = {}) {
  const { data, error } = await supabase
    .from("reservations")
    .update({ status, ...extraFields })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw error;
  }
  return getReservation(data.id);
}

export async function deleteReservation(id) {
  const { error } = await supabase.from("reservations").delete().eq("id", id);
  if (error) {
    throw error;
  }
}

export async function listCalendarReservations(startDate, endDate) {
  const endExclusive = toIsoDate(addDays(endDate, 1));
  const { data, error } = await reservationsQuery()
    .lt("check_in", endExclusive)
    .gt("check_out", startDate)
    .in("status", BLOCKING_RESERVATION_STATUSES);

  if (error) {
    throw error;
  }

  return (data || []).map(addReservationComputedFields);
}

export async function validateReservationCheckIn(reservation) {
  if (!reservation) {
    throw new Error("Reservation not found.");
  }

  if (["Cancelled", "Checked Out", "No Show"].includes(reservation.status)) {
    throw new Error("This reservation cannot be checked in.");
  }

  if (!reservation.room_id) {
    throw new Error("Reservation must have an assigned room.");
  }

  if (["Maintenance", "Out of Service"].includes(reservation.rooms?.status)) {
    throw new Error("This room is not available for check-in.");
  }

  if (reservation.downpayment_required && Number(reservation.downpayment_paid || 0) < Number(reservation.downpayment_amount || 0)) {
    throw new Error("Required downpayment must be fully paid before check-in.");
  }
}

export async function validateReservationCheckOut(reservation) {
  if (!reservation) {
    throw new Error("Reservation not found.");
  }

  if (reservation.status !== "Checked In") {
    throw new Error("Only checked-in reservations can be checked out.");
  }
}

export { BLOCKING_RESERVATION_STATUSES, NON_BLOCKING_RESERVATION_STATUSES };
