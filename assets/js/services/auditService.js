import { supabase } from "../supabaseClient.js";

export async function createAuditLog({ userId, action, entityType, entityId = null, details = "" }) {
  const { error } = await supabase.from("audit_logs").insert({
    user_id: userId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    details,
  });

  if (error) {
    throw error;
  }
}

export async function listRecentAuditActivity(limit = 8) {
  const { data, error } = await supabase
    .from("audit_logs")
    .select("*, users_profile(full_name, role)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return data || [];
}
