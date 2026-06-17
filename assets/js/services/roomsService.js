import { supabase } from "../supabaseClient.js";

function roomsQuery() {
  return supabase
    .from("rooms")
    .select("*, room_types(*)");
}

export async function listRoomTypes() {
  const { data, error } = await supabase.from("room_types").select("*").order("name");
  if (error) {
    throw error;
  }
  return data || [];
}

export async function listRooms(filters = {}) {
  let query = roomsQuery().order("room_number");

  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  if (filters.roomTypeId) {
    query = query.eq("room_type_id", filters.roomTypeId);
  }

  if (filters.search) {
    query = query.ilike("room_number", `%${filters.search}%`);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }
  return data || [];
}

export async function getRoom(id) {
  const { data, error } = await supabase
    .from("rooms")
    .select(`
      *,
      room_types(*),
      reservations(id, confirmation_number, check_in, check_out, status, payment_status, total_amount, guests(full_name)),
      housekeeping_tasks(id, task_type, priority, status, due_date, notes, assigned_staff_id, staff(full_name))
    `)
    .eq("id", id)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function saveRoom(payload) {
  const { data, error } = await supabase
    .from("rooms")
    .upsert(payload)
    .select("*, room_types(*)")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function deleteRoom(id) {
  const { error } = await supabase.from("rooms").delete().eq("id", id);
  if (error) {
    throw error;
  }
}

export async function updateRoomStatus(id, status) {
  const { data, error } = await supabase
    .from("rooms")
    .update({ status })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw error;
  }
  return data;
}

export async function saveRoomType(payload) {
  const { data, error } = await supabase
    .from("room_types")
    .upsert(payload)
    .select("*")
    .single();

  if (error) {
    throw error;
  }
  return data;
}

export async function deleteRoomType(id) {
  const { error } = await supabase.from("room_types").delete().eq("id", id);
  if (error) {
    throw error;
  }
}
