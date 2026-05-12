import { listActiveMembershipsForGuest } from "./clubsService.js";
import { supabase } from "../supabaseClient.js";

export async function listAmenities() {
  const { data, error } = await supabase
    .from("amenities")
    .select("*, amenity_bookings(id, status)")
    .order("name");

  if (error) {
    throw error;
  }
  return data || [];
}

export async function saveAmenity(payload) {
  const { data, error } = await supabase.from("amenities").upsert(payload).select("*").single();
  if (error) {
    throw error;
  }
  return data;
}

export async function deleteAmenity(id) {
  const { error } = await supabase.from("amenities").delete().eq("id", id);
  if (error) {
    throw error;
  }
}

export async function listAmenityBookings() {
  const { data, error } = await supabase
    .from("amenity_bookings")
    .select(`
      *,
      amenities(name, price),
      reservations(confirmation_number),
      guests(full_name)
    `)
    .order("booking_date", { ascending: false });

  if (error) {
    throw error;
  }
  return data || [];
}

async function getAmenityCharge({ guestId, amenityId, quantity }) {
  const { data: amenity, error } = await supabase
    .from("amenities")
    .select("*")
    .eq("id", amenityId)
    .single();

  if (error) {
    throw error;
  }

  const baseAmount = Number(amenity.price || 0) * Number(quantity || 1);
  const memberships = guestId ? await listActiveMembershipsForGuest(guestId) : [];
  const benefits = memberships.flatMap((membership) => membership.clubs?.club_benefits || []);

  let discountedAmount = baseAmount;

  for (const benefit of benefits) {
    if (benefit.benefit_type === "Complimentary Amenity" && benefit.title.toLowerCase().includes(amenity.name.toLowerCase())) {
      discountedAmount = 0;
      break;
    }

    if (benefit.benefit_type === "Amenity Discount") {
      discountedAmount = discountedAmount * (1 - Number(benefit.value || 0) / 100);
    }
  }

  return {
    amenity,
    totalAmount: Number(discountedAmount.toFixed(2)),
  };
}

export async function saveAmenityBooking(payload) {
  const charge = await getAmenityCharge({
    guestId: payload.guest_id,
    amenityId: payload.amenity_id,
    quantity: payload.quantity,
  });

  const record = {
    ...payload,
    total_amount: charge.totalAmount,
  };

  const { data, error } = await supabase
    .from("amenity_bookings")
    .upsert(record)
    .select("*, amenities(name, price), guests(full_name), reservations(confirmation_number)")
    .single();

  if (error) {
    throw error;
  }

  return { booking: data, amenity: charge.amenity };
}
