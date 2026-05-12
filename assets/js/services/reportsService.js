import { supabase } from "../supabaseClient.js";

function inDateRange(value, from, to) {
  const current = String(value || "").slice(0, 10);
  if (!current) {
    return false;
  }
  if (from && current < from) {
    return false;
  }
  if (to && current > to) {
    return false;
  }
  return true;
}

function normalizeFilters(filters = {}) {
  return {
    dateFrom: filters.dateFrom || "",
    dateTo: filters.dateTo || "",
    roomTypeId: filters.roomTypeId ? Number(filters.roomTypeId) : null,
    reservationStatus: filters.reservationStatus || "",
    paymentStatus: filters.paymentStatus || "",
    vipStatus: filters.vipStatus || "",
    serviceCategory: filters.serviceCategory || "",
    clubId: filters.clubId ? Number(filters.clubId) : null,
  };
}

async function fetchReservations(filters) {
  let query = supabase
    .from("reservations")
    .select(`
      *,
      guests(id, full_name, email, vip_status),
      rooms(id, room_number, status, room_types(id, name)),
      invoices(
        *,
        invoice_items(*),
        payments(*)
      ),
      club_benefit_usage(
        *,
        club_registrations(id, clubs(id, name)),
        club_benefits(id, title, discount_type)
      )
    `)
    .order("check_in", { ascending: false });

  if (filters.reservationStatus) {
    query = query.eq("status", filters.reservationStatus);
  }
  if (filters.paymentStatus) {
    query = query.eq("payment_status", filters.paymentStatus);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  let rows = data || [];
  if (filters.roomTypeId) {
    rows = rows.filter((row) => Number(row.rooms?.room_types?.id) === filters.roomTypeId);
  }
  if (filters.vipStatus === "VIP") {
    rows = rows.filter((row) => row.guests?.vip_status);
  }
  if (filters.vipStatus === "Standard") {
    rows = rows.filter((row) => !row.guests?.vip_status);
  }
  return rows;
}

async function fetchRooms() {
  const { data, error } = await supabase
    .from("rooms")
    .select("id, status, room_number, room_types(id, name)")
    .order("room_number");

  if (error) {
    throw error;
  }
  return data || [];
}

async function fetchServiceOrders(filters) {
  const { data, error } = await supabase
    .from("service_orders")
    .select(`
      *,
      hotel_services(id, name, category, is_chargeable),
      guests(id, full_name, vip_status),
      reservations(id, confirmation_number),
      club_benefit_usage(id, amount_discounted, benefit_id)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  let rows = data || [];
  rows = rows.filter((row) => inDateRange(row.requested_at || row.created_at, filters.dateFrom, filters.dateTo));
  if (filters.serviceCategory) {
    rows = rows.filter((row) => row.hotel_services?.category === filters.serviceCategory);
  }
  return rows;
}

async function fetchHousekeeping(filters) {
  const { data, error } = await supabase
    .from("housekeeping_tasks")
    .select(`
      *,
      rooms(id, room_number, status),
      staff(id, full_name)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []).filter((row) => inDateRange(row.created_at || row.due_date, filters.dateFrom, filters.dateTo));
}

async function fetchAudit(filters) {
  const { data, error } = await supabase
    .from("audit_logs")
    .select(`
      *,
      users_profile(full_name, role)
    `)
    .order("created_at", { ascending: false })
    .limit(300);

  if (error) {
    throw error;
  }

  return (data || []).filter((row) => inDateRange(row.created_at, filters.dateFrom, filters.dateTo));
}

async function fetchClubs(filters) {
  const [registrationsResult, transactionsResult, usageResult] = await Promise.all([
    supabase.from("club_registrations").select("*, guests(id, full_name), clubs(id, name, membership_fee)"),
    supabase.from("club_transactions").select("*, club_registrations(id, club_id, membership_level), guests(id, full_name)"),
    supabase.from("club_benefit_usage").select(`
      *,
      guests(id, full_name),
      club_registrations(id, membership_level, clubs(id, name)),
      club_benefits(id, title)
    `),
  ]);

  if (registrationsResult.error) {
    throw registrationsResult.error;
  }
  if (transactionsResult.error) {
    throw transactionsResult.error;
  }
  if (usageResult.error) {
    throw usageResult.error;
  }

  let registrations = registrationsResult.data || [];
  let transactions = transactionsResult.data || [];
  let benefitUsage = usageResult.data || [];

  if (filters.clubId) {
    registrations = registrations.filter((row) => Number(row.club_id) === filters.clubId);
    transactions = transactions.filter((row) => Number(row.club_registrations?.club_id) === filters.clubId);
    benefitUsage = benefitUsage.filter((row) => Number(row.club_registrations?.clubs?.id) === filters.clubId);
  }

  registrations = registrations.filter((row) => inDateRange(row.created_at || row.start_date, filters.dateFrom, filters.dateTo));
  transactions = transactions.filter((row) => inDateRange(row.created_at, filters.dateFrom, filters.dateTo));
  benefitUsage = benefitUsage.filter((row) => inDateRange(row.used_at, filters.dateFrom, filters.dateTo));

  return { registrations, transactions, benefitUsage };
}

export async function getReportsFiltersData() {
  const [roomTypesResult, clubsResult] = await Promise.all([
    supabase.from("room_types").select("id, name").order("name"),
    supabase.from("clubs").select("id, name").order("name"),
  ]);

  if (roomTypesResult.error) {
    throw roomTypesResult.error;
  }
  if (clubsResult.error) {
    throw clubsResult.error;
  }

  return {
    roomTypes: roomTypesResult.data || [],
    clubs: clubsResult.data || [],
  };
}

export async function getReportsSnapshot(rawFilters = {}) {
  const filters = normalizeFilters(rawFilters);
  const [reservations, rooms, serviceOrders, housekeeping, audit, clubs] = await Promise.all([
    fetchReservations(filters),
    fetchRooms(),
    fetchServiceOrders(filters),
    fetchHousekeeping(filters),
    fetchAudit(filters),
    fetchClubs(filters),
  ]);

  const arrivals = reservations.filter((row) => inDateRange(row.check_in, filters.dateFrom, filters.dateTo));
  const departures = reservations.filter((row) => inDateRange(row.check_out, filters.dateFrom, filters.dateTo));
  const invoices = reservations.flatMap((row) => row.invoices || []);
  const occupiedRooms = rooms.filter((room) => room.status === "Occupied");
  const availableRooms = rooms.filter((room) => room.status === "Available");
  const reservedRooms = rooms.filter((room) => room.status === "Reserved");
  const cleaningRooms = rooms.filter((room) => room.status === "Cleaning");
  const maintenanceRooms = rooms.filter((room) => ["Maintenance", "Out of Service"].includes(room.status));
  const occupancyByRoomType = Object.values(rooms.reduce((acc, room) => {
    const key = room.room_types?.name || "Unassigned";
    if (!acc[key]) {
      acc[key] = { roomType: key, totalRooms: 0, occupiedRooms: 0 };
    }
    acc[key].totalRooms += 1;
    if (room.status === "Occupied") {
      acc[key].occupiedRooms += 1;
    }
    return acc;
  }, {})).map((item) => ({
    ...item,
    occupancyPercentage: item.totalRooms ? Number(((item.occupiedRooms / item.totalRooms) * 100).toFixed(1)) : 0,
  }));

  const outstandingBalances = invoices.map((invoice) => {
    const paidAmount = (invoice.payments || []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const balanceDue = Math.max(Number(invoice.total || 0) - paidAmount, 0);
    return {
      ...invoice,
      paidAmount,
      balanceDue,
      lastPaymentDate: (invoice.payments || []).slice().sort((a, b) => new Date(b.paid_at || b.created_at) - new Date(a.paid_at || a.created_at))[0]?.paid_at || null,
    };
  }).filter((invoice) => invoice.balanceDue > 0);

  const discounts = invoices.reduce((sum, invoice) => {
    const itemDiscounts = (invoice.invoice_items || [])
      .filter((item) => Number(item.total || 0) < 0)
      .reduce((itemSum, item) => itemSum + Math.abs(Number(item.total || 0)), 0);
    return sum + itemDiscounts;
  }, 0);

  const revenue = {
    roomRevenue: invoices.reduce((sum, invoice) => {
      const roomLines = (invoice.invoice_items || []).filter((item) => /room/i.test(item.description || ""));
      return sum + roomLines.reduce((lineSum, item) => lineSum + Number(item.total || 0), 0);
    }, 0),
    serviceRevenue: serviceOrders.reduce((sum, row) => sum + Number(row.total_amount || 0), 0),
    amenityRevenue: invoices.reduce((sum, invoice) => {
      const amenityLines = (invoice.invoice_items || []).filter((item) => /amenity/i.test(item.description || ""));
      return sum + amenityLines.reduce((lineSum, item) => lineSum + Number(item.total || 0), 0);
    }, 0),
    clubRevenue: clubs.transactions.reduce((sum, row) => sum + Number(row.amount || 0), 0),
    discounts,
    taxes: invoices.reduce((sum, invoice) => sum + Number(invoice.tax || 0), 0),
    paymentsCollected: invoices.reduce((sum, invoice) => sum + (invoice.payments || []).reduce((paymentSum, payment) => paymentSum + Number(payment.amount || 0), 0), 0),
    outstandingBalances: outstandingBalances.reduce((sum, invoice) => sum + Number(invoice.balanceDue || 0), 0),
    refunds: invoices.reduce((sum, invoice) => sum + (invoice.payments || [])
      .filter((payment) => payment.payment_status === "Refunded")
      .reduce((paymentSum, payment) => paymentSum + Number(payment.amount || 0), 0), 0),
  };
  revenue.netRevenue = revenue.roomRevenue + revenue.serviceRevenue + revenue.amenityRevenue + revenue.clubRevenue - revenue.discounts;

  const serviceRevenueReport = Object.values(serviceOrders.reduce((acc, row) => {
    const key = row.hotel_services?.name || "Service";
    if (!acc[key]) {
      acc[key] = {
        serviceName: key,
        category: row.hotel_services?.category || "Other",
        quantitySold: 0,
        grossRevenue: 0,
        discountsApplied: 0,
        netRevenue: 0,
      };
    }
    acc[key].quantitySold += Number(row.quantity || 0);
    acc[key].grossRevenue += Number(row.total_amount || 0);
    acc[key].discountsApplied += (row.club_benefit_usage || []).reduce((sum, usage) => sum + Number(usage.amount_discounted || 0), 0);
    acc[key].netRevenue = acc[key].grossRevenue - acc[key].discountsApplied;
    return acc;
  }, {}));

  const vipReport = {
    activeMembers: clubs.registrations.filter((row) => row.status === "Active").length,
    newRegistrations: clubs.registrations.length,
    expiringMemberships: clubs.registrations.filter((row) => row.status === "Active").filter((row) => {
      const end = new Date(row.end_date);
      const now = new Date();
      const diff = Math.ceil((end - now) / 86400000);
      return diff >= 0 && diff <= 30;
    }).length,
    clubRevenue: clubs.transactions.reduce((sum, row) => sum + Number(row.amount || 0), 0),
    benefitUsageCount: clubs.benefitUsage.length,
    totalDiscountsGiven: clubs.benefitUsage.reduce((sum, row) => sum + Number(row.amount_discounted || 0), 0),
    membersByLevel: Object.entries(clubs.registrations.reduce((acc, row) => {
      acc[row.membership_level] = (acc[row.membership_level] || 0) + 1;
      return acc;
    }, {})).map(([level, count]) => ({ level, count })),
  };

  const housekeepingReport = {
    pendingTasks: housekeeping.filter((row) => row.status === "Pending").length,
    inProgressTasks: housekeeping.filter((row) => row.status === "In Progress").length,
    completedTasks: housekeeping.filter((row) => row.status === "Completed").length,
    overdueTasks: housekeeping.filter((row) => row.status !== "Completed" && row.due_date && String(row.due_date) < new Date().toISOString().slice(0, 10)).length,
    tasksByStaff: Object.entries(housekeeping.reduce((acc, row) => {
      const key = row.staff?.full_name || "Unassigned";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {})).map(([staffName, count]) => ({ staffName, count })),
    roomsNeedingCleaning: housekeeping.filter((row) => row.status !== "Completed").map((row) => row.rooms?.room_number).filter(Boolean),
  };

  return {
    filters,
    arrivals,
    departures,
    occupancy: {
      totalRooms: rooms.length,
      occupiedRooms: occupiedRooms.length,
      availableRooms: availableRooms.length,
      reservedRooms: reservedRooms.length,
      cleaningRooms: cleaningRooms.length,
      maintenanceRooms: maintenanceRooms.length,
      occupancyPercentage: rooms.length ? Number(((occupiedRooms.length / rooms.length) * 100).toFixed(1)) : 0,
      occupancyByRoomType,
    },
    revenue,
    outstandingBalances,
    serviceRevenueReport,
    vipReport,
    housekeepingReport,
    audit,
    housekeeping,
    clubs,
  };
}
