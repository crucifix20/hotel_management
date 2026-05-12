import { supabase } from "../supabaseClient.js";

export async function listHotelServices(filters = {}) {
  let query = supabase.from("hotel_services").select("*").order("name");

  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }
  return data || [];
}

export async function saveHotelService(payload) {
  const { data, error } = await supabase
    .from("hotel_services")
    .upsert(payload)
    .select("*")
    .single();

  if (error) {
    throw error;
  }
  return data;
}

export async function deleteHotelService(id) {
  const { error } = await supabase.from("hotel_services").delete().eq("id", id);
  if (error) {
    throw error;
  }
}

export async function listServiceOrders(filters = {}) {
  let query = supabase
    .from("service_orders")
    .select(`
      *,
      hotel_services(*),
      guests(id, full_name),
      rooms(id, room_number),
      reservations(id, confirmation_number, status)
    `)
    .order("created_at", { ascending: false });

  if (filters.reservationId) {
    query = query.eq("reservation_id", filters.reservationId);
  }

  if (filters.activeOnly) {
    query = query.in("status", ["Requested", "In Progress", "Completed", "Charged"]);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }
  return data || [];
}

export async function saveServiceOrder(payload) {
  const quantity = Number(payload.quantity || 0);
  const unitPrice = Number(payload.unit_price || 0);

  if (quantity <= 0) {
    throw new Error("Service quantity must be greater than zero.");
  }
  if (unitPrice < 0) {
    throw new Error("Service price cannot be negative.");
  }

  const { data: service, error: serviceError } = await supabase
    .from("hotel_services")
    .select("*")
    .eq("id", payload.service_id)
    .single();

  if (serviceError) {
    throw serviceError;
  }

  if (service.status !== "Available") {
    throw new Error("Only available services can be ordered.");
  }

  const record = {
    ...payload,
    quantity,
    unit_price: unitPrice,
    total_amount: Number((quantity * unitPrice).toFixed(2)),
  };

  const { data, error } = await supabase
    .from("service_orders")
    .upsert(record)
    .select(`
      *,
      hotel_services(*),
      guests(id, full_name),
      rooms(id, room_number),
      reservations(id, confirmation_number, status)
    `)
    .single();

  if (error) {
    throw error;
  }
  return data;
}
