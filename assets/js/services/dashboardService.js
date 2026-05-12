import { listRecentAuditActivity } from "./auditService.js";
import { listRecentReservations } from "./reservationsService.js";
import { listPendingHousekeeping } from "./housekeepingService.js";
import { getBillingSummary } from "./billingService.js";
import { ROLES } from "../config.js";
import { monthEndIso, monthStartIso, todayIso } from "../utils.js";
import { supabase } from "../supabaseClient.js";

export async function getDashboardData(role) {
  const today = todayIso();
  const monthStart = monthStartIso();
  const monthEnd = monthEndIso();
  const isAdmin = role === ROLES.ADMIN;

  const [
    roomsResult,
    arrivalsResult,
    departuresResult,
    housekeeping,
    recentReservations,
    auditActivity,
    billing,
    vipMembersResult,
    newRegistrationsResult,
    expiringMembershipsResult,
    serviceOrdersResult,
  ] = await Promise.all([
    supabase.from("rooms").select("id, status"),
    supabase.from("reservations").select("id").eq("check_in", today).in("status", ["Confirmed", "Checked In"]),
    supabase.from("reservations").select("id").eq("check_out", today).in("status", ["Confirmed", "Checked In", "Checked Out"]),
    isAdmin ? listPendingHousekeeping() : Promise.resolve([]),
    listRecentReservations(),
    isAdmin ? listRecentAuditActivity() : Promise.resolve([]),
    isAdmin ? getBillingSummary() : Promise.resolve({ totalRevenue: 0, outstanding: 0, clubRevenue: 0, invoices: [] }),
    isAdmin ? supabase.from("club_registrations").select("id").eq("status", "Active") : Promise.resolve({ data: [] }),
    isAdmin ? supabase.from("club_registrations").select("id").gte("created_at", `${monthStart}T00:00:00`).lte("created_at", `${monthEnd}T23:59:59`) : Promise.resolve({ data: [] }),
    isAdmin ? supabase.from("club_registrations").select("id").eq("status", "Active").gte("end_date", today).lte("end_date", monthEnd) : Promise.resolve({ data: [] }),
    isAdmin ? supabase.from("service_orders").select("id, total_amount, status").in("status", ["Completed", "Charged", "Requested", "In Progress"]) : Promise.resolve({ data: [] }),
  ]);

  const rooms = roomsResult.data || [];
  const totalRooms = rooms.length;
  const availableRooms = rooms.filter((room) => room.status === "Available").length;
  const occupiedRooms = rooms.filter((room) => room.status === "Occupied").length;
  const cleaningRooms = rooms.filter((room) => room.status === "Cleaning").length;
  const maintenanceRooms = rooms.filter((room) => ["Maintenance", "Out of Service"].includes(room.status)).length;
  const occupancyRate = totalRooms ? ((occupiedRooms / totalRooms) * 100).toFixed(1) : "0.0";
  const serviceOrders = serviceOrdersResult.data || [];

  return {
    metrics: {
      totalRooms,
      availableRooms,
      occupiedRooms,
      cleaningRooms,
      maintenanceRooms,
      arrivalsToday: arrivalsResult.data?.length || 0,
      departuresToday: departuresResult.data?.length || 0,
      activeInHouseGuests: occupiedRooms,
      pendingCheckIns: arrivalsResult.data?.length || 0,
      pendingCheckOuts: departuresResult.data?.length || 0,
      occupancyRate,
      pendingHousekeeping: housekeeping.length,
      totalRevenue: billing.totalRevenue,
      outstandingBalance: billing.outstanding,
      activeVipMembers: vipMembersResult.data?.length || 0,
      newClubRegistrations: newRegistrationsResult.data?.length || 0,
      clubRevenue: billing.clubRevenue,
      serviceRevenue: billing.serviceRevenue,
      expiringMemberships: expiringMembershipsResult.data?.length || 0,
      recentServiceOrders: serviceOrders.slice(0, 8),
    },
    housekeeping,
    recentReservations,
    auditActivity,
  };
}
