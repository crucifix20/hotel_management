import { supabase } from "../supabaseClient.js";

export async function listClubs() {
  const { data, error } = await supabase
    .from("clubs")
    .select("*, club_benefits(*), club_registrations(id, status)")
    .order("name");

  if (error) {
    throw error;
  }
  return data || [];
}

export async function saveClub(payload) {
  const { data, error } = await supabase.from("clubs").upsert(payload).select("*").single();
  if (error) {
    throw error;
  }
  return data;
}

export async function deleteClub(id) {
  const { error } = await supabase.from("clubs").delete().eq("id", id);
  if (error) {
    throw error;
  }
}

export async function listClubRegistrations(filters = {}) {
  let query = supabase
    .from("club_registrations")
    .select(`
      *,
      clubs(name, membership_fee, status),
      guests(full_name, email, vip_status)
    `)
    .order("created_at", { ascending: false });

  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  if (filters.membershipLevel) {
    query = query.eq("membership_level", filters.membershipLevel);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }
  return data || [];
}

export async function generateMembershipNumber() {
  const { count, error } = await supabase
    .from("club_registrations")
    .select("*", { count: "exact", head: true });

  if (error) {
    throw error;
  }

  const next = String((count || 0) + 1).padStart(6, "0");
  return `GMH-CLUB-${new Date().getFullYear()}-${next}`;
}

export async function saveClubRegistration(payload) {
  const record = {
    ...payload,
    membership_number: payload.membership_number || await generateMembershipNumber(),
  };

  const { data, error } = await supabase
    .from("club_registrations")
    .upsert(record)
    .select("*, clubs(name, membership_fee), guests(full_name)")
    .single();

  if (error) {
    throw error;
  }
  return data;
}

export async function deleteClubRegistration(id) {
  const { error } = await supabase.from("club_registrations").delete().eq("id", id);
  if (error) {
    throw error;
  }
}

export async function listClubBenefits(clubId) {
  const { data, error } = await supabase
    .from("club_benefits")
    .select("*")
    .eq("club_id", clubId)
    .order("created_at");

  if (error) {
    throw error;
  }
  return data || [];
}

export async function saveClubBenefit(payload) {
  const { data, error } = await supabase.from("club_benefits").upsert(payload).select("*").single();
  if (error) {
    throw error;
  }
  return data;
}

export async function deleteClubBenefit(id) {
  const { error } = await supabase.from("club_benefits").delete().eq("id", id);
  if (error) {
    throw error;
  }
}

export async function listClubTransactions(registrationId) {
  const { data, error } = await supabase
    .from("club_transactions")
    .select("*")
    .eq("club_registration_id", registrationId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }
  return data || [];
}

export async function saveClubTransaction(payload) {
  const { data, error } = await supabase.from("club_transactions").insert(payload).select("*").single();
  if (error) {
    throw error;
  }
  return data;
}

export async function listActiveMembershipsForGuest(guestId) {
  const { data, error } = await supabase
    .from("club_registrations")
    .select(`
      *,
      clubs(name, club_benefits(*))
    `)
    .eq("guest_id", guestId)
    .eq("status", "Active");

  if (error) {
    throw error;
  }
  return data || [];
}

export async function listBenefitUsage(filters = {}) {
  let query = supabase
    .from("club_benefit_usage")
    .select(`
      *,
      guests(id, full_name),
      reservations(id, confirmation_number),
      service_orders(
        id,
        total_amount,
        hotel_services(name, category)
      ),
      club_registrations(
        id,
        membership_number,
        membership_level,
        status,
        clubs(id, name)
      ),
      club_benefits(
        id,
        title,
        applies_to,
        discount_type,
        discount_value,
        status
      )
    `)
    .order("used_at", { ascending: false });

  if (filters.guestId) {
    query = query.eq("guest_id", filters.guestId);
  }

  if (filters.reservationId) {
    query = query.eq("reservation_id", filters.reservationId);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  let usage = data || [];

  if (filters.clubId) {
    usage = usage.filter((item) => Number(item.club_registrations?.clubs?.id) === Number(filters.clubId));
  }

  if (filters.search) {
    const needle = String(filters.search || "").trim().toLowerCase();
    usage = usage.filter((item) => {
      const haystack = [
        item.guests?.full_name,
        item.club_benefits?.title,
        item.club_registrations?.membership_number,
        item.club_registrations?.clubs?.name,
        item.service_orders?.hotel_services?.name,
      ].join(" ").toLowerCase();
      return haystack.includes(needle);
    });
  }

  return usage;
}

export async function listApplicableBenefits({ guestId, serviceId = null }) {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("club_registrations")
    .select(`
      *,
      clubs(
        id,
        name,
        club_benefits(*)
      )
    `)
    .eq("guest_id", guestId)
    .eq("status", "Active");

  if (error) {
    throw error;
  }

  const activeRegistrations = (data || []).filter((registration) => {
    const start = String(registration.start_date || "");
    const end = String(registration.end_date || "");
    return start <= today && end >= today;
  });

  if (!activeRegistrations.length) {
    return [];
  }

  const registrationIds = activeRegistrations.map((item) => item.id);
  const { data: usageRows, error: usageError } = await supabase
    .from("club_benefit_usage")
    .select("id, club_registration_id, benefit_id")
    .in("club_registration_id", registrationIds);

  if (usageError) {
    throw usageError;
  }

  const usageCountMap = new Map();
  (usageRows || []).forEach((row) => {
    const key = `${row.club_registration_id}:${row.benefit_id}`;
    usageCountMap.set(key, (usageCountMap.get(key) || 0) + 1);
  });

  return activeRegistrations.flatMap((registration) => {
    const club = registration.clubs || {};
    return (club.club_benefits || [])
      .filter((benefit) => {
        if (benefit.status !== "Active") {
          return false;
        }
        if (!["Service", "Stay", "Billing"].includes(benefit.applies_to)) {
          return false;
        }
        if (benefit.service_id && serviceId && Number(benefit.service_id) !== Number(serviceId)) {
          return false;
        }
        if (benefit.service_id && !serviceId) {
          return false;
        }
        return true;
      })
      .map((benefit) => {
        const key = `${registration.id}:${benefit.id}`;
        const usageCount = usageCountMap.get(key) || 0;
        const maxUses = Number(benefit.max_uses || 0);
        const remainingUses = maxUses > 0 ? Math.max(maxUses - usageCount, 0) : null;
        return {
          club_registration_id: registration.id,
          club_name: club.name,
          membership_level: registration.membership_level,
          membership_number: registration.membership_number,
          registration_status: registration.status,
          start_date: registration.start_date,
          end_date: registration.end_date,
          benefit_id: benefit.id,
          title: benefit.title,
          description: benefit.description,
          applies_to: benefit.applies_to,
          discount_type: benefit.discount_type,
          discount_value: Number(benefit.discount_value || benefit.value || 0),
          service_id: benefit.service_id,
          max_uses: maxUses || null,
          usage_count: usageCount,
          remaining_uses: remainingUses,
          available: remainingUses === null || remainingUses > 0,
        };
      });
  }).filter((benefit) => benefit.available);
}

export async function applyBenefitToServiceOrder({
  clubRegistrationId,
  benefitId,
  reservationId,
  guestId,
  serviceOrderId,
  serviceId,
  serviceName,
  quantity,
  unitPrice,
}) {
  const { data: registration, error: registrationError } = await supabase
    .from("club_registrations")
    .select(`
      *,
      clubs(id, name),
      guests(id, full_name)
    `)
    .eq("id", clubRegistrationId)
    .eq("guest_id", guestId)
    .single();

  if (registrationError) {
    throw registrationError;
  }

  const today = new Date().toISOString().slice(0, 10);
  if (registration.status !== "Active" || String(registration.start_date) > today || String(registration.end_date) < today) {
    throw new Error("This club registration is not active and cannot apply benefits.");
  }

  const { data: benefit, error: benefitError } = await supabase
    .from("club_benefits")
    .select("*")
    .eq("id", benefitId)
    .eq("club_id", registration.club_id)
    .single();

  if (benefitError) {
    throw benefitError;
  }

  if (benefit.status !== "Active") {
    throw new Error("This club benefit is inactive.");
  }

  if (benefit.service_id && Number(benefit.service_id) !== Number(serviceId)) {
    throw new Error("This benefit does not apply to the selected service.");
  }

  const { count, error: countError } = await supabase
    .from("club_benefit_usage")
    .select("*", { count: "exact", head: true })
    .eq("club_registration_id", clubRegistrationId)
    .eq("benefit_id", benefitId);

  if (countError) {
    throw countError;
  }

  const maxUses = Number(benefit.max_uses || 0);
  if (maxUses > 0 && Number(count || 0) >= maxUses) {
    throw new Error("This club benefit has already reached its maximum allowed uses.");
  }

  const originalAmount = Number((Number(quantity || 0) * Number(unitPrice || 0)).toFixed(2));
  let discountAmount = 0;

  switch (benefit.discount_type) {
    case "Percentage":
      discountAmount = Number((originalAmount * (Number(benefit.discount_value || benefit.value || 0) / 100)).toFixed(2));
      break;
    case "Fixed":
      discountAmount = Math.min(originalAmount, Number(benefit.discount_value || benefit.value || 0));
      break;
    case "Complimentary":
      discountAmount = originalAmount;
      break;
    default:
      discountAmount = 0;
      break;
  }

  const { data: usage, error: usageError } = await supabase
    .from("club_benefit_usage")
    .insert({
      club_registration_id: clubRegistrationId,
      reservation_id: reservationId,
      guest_id: guestId,
      benefit_id: benefitId,
      service_order_id: serviceOrderId,
      amount_discounted: discountAmount,
      notes: `${benefit.title} applied to ${serviceName}`,
    })
    .select(`
      *,
      club_registrations(membership_number, membership_level, clubs(name)),
      club_benefits(title, discount_type, discount_value)
    `)
    .single();

  if (usageError) {
    throw usageError;
  }

  return {
    usage,
    originalAmount,
    discountAmount,
    finalAmount: Math.max(originalAmount - discountAmount, 0),
    clubName: registration.clubs?.name || "VIP Club",
    membershipNumber: registration.membership_number,
    benefitTitle: benefit.title,
    invoiceDescription:
      benefit.discount_type === "Complimentary"
        ? `Complimentary ${serviceName} - VIP Club Benefit`
        : `${benefit.title} - VIP Club Benefit`,
  };
}
