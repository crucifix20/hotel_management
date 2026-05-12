import { supabase } from "../supabaseClient.js";

export async function listStaff(filters = {}) {
  let query = supabase
    .from("staff")
    .select(`
      *,
      housekeeping_tasks(id, task_type, priority, status, room_id),
      login_profile:users_profile!staff_auth_user_id_fkey(id, full_name, role)
    `)
    .order("full_name");

  if (filters.department) {
    query = query.eq("department", filters.department);
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

export async function listStaffOptions() {
  const { data, error } = await supabase.from("staff").select("id, full_name, department, position, status, auth_user_id").order("full_name");
  if (error) {
    throw error;
  }
  return data || [];
}

export async function saveStaff(payload) {
  const { data, error } = await supabase.from("staff").upsert(payload).select("*").single();
  if (error) {
    throw error;
  }
  return data;
}

export async function deleteStaff(id) {
  const { error } = await supabase.from("staff").delete().eq("id", id);
  if (error) {
    throw error;
  }
}
