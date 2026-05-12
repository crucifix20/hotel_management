import { supabase } from "../supabaseClient.js";

export async function listHousekeepingTasks(filters = {}) {
  let query = supabase
    .from("housekeeping_tasks")
    .select(`
      *,
      rooms(room_number, status),
      staff(full_name, department)
    `)
    .order("due_date", { ascending: true });

  if (filters.roomId) {
    query = query.eq("room_id", filters.roomId);
  }
  if (filters.priority) {
    query = query.eq("priority", filters.priority);
  }
  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }
  return data || [];
}

export async function listPendingHousekeeping(limit = 6) {
  const { data, error } = await supabase
    .from("housekeeping_tasks")
    .select("*, rooms(room_number), staff(full_name)")
    .in("status", ["Pending", "In Progress"])
    .order("priority", { ascending: false })
    .order("due_date", { ascending: true })
    .limit(limit);

  if (error) {
    throw error;
  }
  return data || [];
}

export async function saveHousekeepingTask(payload) {
  const { data, error } = await supabase
    .from("housekeeping_tasks")
    .upsert(payload)
    .select("*, rooms(room_number), staff(full_name)")
    .single();

  if (error) {
    throw error;
  }
  return data;
}

export async function updateHousekeepingTaskStatus(id, status) {
  const payload = {
    status,
    completed_at: status === "Completed" ? new Date().toISOString() : null,
  };

  const { data, error } = await supabase
    .from("housekeeping_tasks")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw error;
  }
  return data;
}

export async function deleteHousekeepingTask(id) {
  const { error } = await supabase.from("housekeeping_tasks").delete().eq("id", id);
  if (error) {
    throw error;
  }
}
