import { supabase } from "../supabaseClient.js";

export async function listGuests(filters = {}) {
  let query = supabase
    .from("guests")
    .select(`
      *,
      club_registrations(
        id,
        membership_level,
        status,
        clubs(name)
      )
    `)
    .order("full_name");

  if (filters.search) {
    query = query.or(`full_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,phone.ilike.%${filters.search}%,company_name.ilike.%${filters.search}%,nationality.ilike.%${filters.search}%,origin.ilike.%${filters.search}%,booking_person.ilike.%${filters.search}%,guest_type.ilike.%${filters.search}%`);
  }

  if (filters.vipOnly) {
    query = query.eq("vip_status", true);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  let guests = data || [];

  if (filters.clubStatus) {
    guests = guests.filter((guest) => guest.club_registrations?.some((membership) => membership.status === filters.clubStatus));
  }

  return guests;
}

export async function listGuestOptions() {
  const { data, error } = await supabase.from("guests").select("id, full_name, email, vip_status").order("full_name");
  if (error) {
    throw error;
  }
  return data || [];
}

export async function getGuest(id) {
  const { data, error } = await supabase
    .from("guests")
    .select(`
      *,
      reservations(
        id,
        confirmation_number,
        check_in,
        check_out,
        arrival_date,
        flight_number,
        departure_date,
        status,
        payment_status,
        total_amount,
        rooms(room_number, room_types(name))
      ),
      invoices(
        *,
        invoice_items(*),
        payments(*)
      ),
      club_registrations(
        *,
        clubs(*, club_benefits(*)),
        club_transactions(*)
      ),
      club_benefit_usage(
        *,
        club_benefits(title, discount_type, discount_value, applies_to),
        club_registrations(membership_number, membership_level, clubs(name)),
        service_orders(id, total_amount, hotel_services(name))
      ),
      service_orders(
        *,
        hotel_services(name, category, price)
      ),
      amenity_bookings(
        *,
        amenities(name, price)
      )
    `)
    .eq("id", id)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function saveGuest(payload) {
  const { data, error } = await supabase
    .from("guests")
    .upsert(payload)
    .select("*")
    .single();

  if (error) {
    throw error;
  }
  return data;
}

export async function findPotentialDuplicateGuests({ email = "", phone = "", excludeId = null } = {}) {
  const filters = [];
  const normalizedEmail = String(email || "").trim();
  const normalizedPhone = String(phone || "").trim();

  if (normalizedEmail) {
    filters.push(`email.eq.${normalizedEmail}`);
  }
  if (normalizedPhone) {
    filters.push(`phone.eq.${normalizedPhone}`);
  }
  if (!filters.length) {
    return [];
  }

  let query = supabase
    .from("guests")
    .select("id, full_name, email, phone")
    .or(filters.join(","))
    .order("full_name");

  if (excludeId) {
    query = query.neq("id", excludeId);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return data || [];
}

export async function deleteGuest(id) {
  const { error } = await supabase.from("guests").delete().eq("id", id);
  if (error) {
    throw error;
  }
}
