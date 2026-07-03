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

async function deleteRows(table, column, values) {
  if (!values.length) {
    return 0;
  }

  const { data, error } = await supabase
    .from(table)
    .delete()
    .in(column, values)
    .select("id");

  if (error) {
    throw error;
  }

  return (data || []).length;
}

export async function deleteAllStaffTransactions() {
  const { data: staffProfiles, error } = await supabase
    .from("users_profile")
    .select("id")
    .eq("role", "Staff");

  if (error) {
    throw error;
  }

  const staffUserIds = (staffProfiles || []).map((profile) => profile.id);

  return {
    payments: await deleteRows("payments", "received_by", staffUserIds),
    serviceOrders: await deleteRows("service_orders", "created_by", staffUserIds),
    auditLogs: await deleteRows("audit_logs", "user_id", staffUserIds),
  };
}
