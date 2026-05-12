import { ROLES } from "../config.js";
import { initProtectedPage } from "../router.js";
import { getDashboardData } from "../services/dashboardService.js";
import { createStatusBadge } from "../ui.js";
import { formatCurrency, formatDate, formatDateTime, initials, render } from "../utils.js";

function chartDay(label, height, current = false) {
  return `
    <div class="stitch-chart-day">
      <div class="stitch-chart-track">
        <div class="stitch-chart-fill ${current ? "current" : ""}" style="height:${height}%;"></div>
      </div>
      <span>${label}</span>
    </div>
  `;
}

await initProtectedPage("dashboard", async ({ root, auth }) => {
  const isAdmin = auth.profile.role === ROLES.ADMIN;
  const dashboard = await getDashboardData(auth.profile.role);
  const { metrics } = dashboard;
  const arrivals = dashboard.recentReservations.slice(0, 4);
  const overviewRows = dashboard.recentReservations.slice(0, 5);
  const bars = [
    chartDay("Mon", 62),
    chartDay("Tue", 78),
    chartDay("Wed", 91),
    chartDay("Thu", 58),
    chartDay("Fri", 84),
    chartDay("Sat", 96, true),
    chartDay("Sun", 94, true),
  ].join("");

  render(root, `
    <section class="stitch-alert-grid">
      <div class="stitch-alert error">
        <div class="stitch-alert-copy">
          <span class="material-symbols-outlined icon-fill" style="color:var(--danger);">warning</span>
          <div>
            <h3>Arrival Pressure</h3>
            <p>${metrics.arrivalsToday} arrivals are scheduled today, ${metrics.pendingCheckIns} check-ins are pending, and ${metrics.availableRooms} rooms remain available for sale.</p>
          </div>
        </div>
        <a class="stitch-link-button" href="reservations.html">Review</a>
      </div>
      ${isAdmin ? `
        <div class="stitch-alert warn">
          <div class="stitch-alert-copy">
            <span class="material-symbols-outlined icon-fill" style="color:var(--secondary);">build</span>
            <div>
              <h3>Housekeeping Attention</h3>
              <p>${metrics.pendingHousekeeping} pending housekeeping tasks and ${metrics.departuresToday} departures need turnover coordination.</p>
            </div>
          </div>
          <a class="stitch-link-button" href="housekeeping.html">Dispatch</a>
        </div>
      ` : `
        <div class="stitch-alert warn">
          <div class="stitch-alert-copy">
            <span class="material-symbols-outlined icon-fill" style="color:var(--secondary);">event_available</span>
            <div>
              <h3>Departure Watch</h3>
              <p>${metrics.departuresToday} departures are expected today, with ${metrics.pendingCheckOuts} active check-outs and ${metrics.occupiedRooms} rooms still occupied.</p>
            </div>
          </div>
          <a class="stitch-link-button" href="reservation-calendar.html">Plan</a>
        </div>
      `}
    </section>

    <section class="stitch-kpi-grid">
      <article class="stitch-kpi-card">
        <div class="stitch-kpi-iconrow">
          <div class="stitch-kpi-icon"><span class="material-symbols-outlined">bed</span></div>
          <span style="font-size:0.64rem; color:#15803d; font-weight:700; letter-spacing:0.14em; text-transform:uppercase;">${metrics.occupancyRate}%</span>
        </div>
        <h3>Occupancy Rate</h3>
        <p class="stitch-kpi-value">${metrics.occupancyRate}<span style="font-size:1.2rem; opacity:.4;">%</span></p>
        <div class="stitch-progress"><span style="width:${metrics.occupancyRate}%;"></span></div>
      </article>
      <article class="stitch-kpi-card">
        <div class="stitch-kpi-tag">${isAdmin ? "Revenue Pulse" : "Desk Queue"}</div>
        <div class="stitch-kpi-iconrow">
          <div class="stitch-kpi-icon"><span class="material-symbols-outlined">${isAdmin ? "payments" : "event_note"}</span></div>
        </div>
        <h3>${isAdmin ? "Revenue Summary" : "Desk Activity"}</h3>
        <p class="stitch-kpi-value">${isAdmin ? formatCurrency(metrics.totalRevenue) : metrics.arrivalsToday + metrics.departuresToday}</p>
        <p class="stitch-kpi-note">${isAdmin ? `${formatCurrency(metrics.outstandingBalance)} outstanding balance remains open.` : "Combined arrivals and departures currently in motion."}</p>
      </article>
      <article class="stitch-kpi-card">
        <div class="stitch-kpi-iconrow">
          <div class="stitch-kpi-icon"><span class="material-symbols-outlined">hotel</span></div>
        </div>
        <h3>Live Inventory</h3>
        <p class="stitch-kpi-value">${metrics.availableRooms}<span style="font-size:1.2rem; opacity:.4;">/${metrics.totalRooms}</span></p>
        <p class="stitch-kpi-note">${metrics.occupiedRooms} occupied · ${metrics.cleaningRooms} cleaning · ${metrics.maintenanceRooms} maintenance.</p>
      </article>
      <article class="stitch-kpi-card">
        <div class="stitch-kpi-iconrow">
          <div class="stitch-kpi-icon"><span class="material-symbols-outlined">${isAdmin ? "workspace_premium" : "calendar_month"}</span></div>
        </div>
        <h3>${isAdmin ? "VIP Clubs" : "Departures Today"}</h3>
        <p class="stitch-kpi-value">${isAdmin ? metrics.activeVipMembers : metrics.departuresToday}</p>
        <p class="stitch-kpi-note">${isAdmin ? `${metrics.newClubRegistrations} new club registrations this month.` : "Reservations requiring completion today."}</p>
      </article>
    </section>

    <section class="stitch-main-grid">
      <div>
        <div class="stitch-section-head">
          <div>
            <h2>${isAdmin ? "Occupancy Trends" : "Reservation Trends"}</h2>
            <p>${isAdmin ? "Weekly performance analytics across the current hotel trading period." : "A quick weekly reservation activity snapshot for the reservations desk."}</p>
          </div>
          <div class="stitch-pill-row">
            <span class="pill">Current Week</span>
            <span class="pill">Prior Week</span>
          </div>
        </div>
        <article class="stitch-chart-card">
          <div class="stitch-chart-bars">
            ${bars}
          </div>
        </article>
      </div>

      <div>
        <div class="stitch-section-head">
          <div>
            <h2>Arrivals</h2>
            <p>Most recent arrivals and booking activity.</p>
          </div>
          <a class="stitch-link-button" href="reservations.html">View All</a>
        </div>
        <div class="stitch-arrivals-card">
          ${arrivals.map((reservation) => `
            <article class="stitch-arrival-item">
              <div class="stitch-arrival-avatar">${initials(reservation.guests?.full_name || "GMH")}</div>
              <div class="stitch-arrival-copy">
                <strong>${reservation.guests?.full_name || "Guest"}</strong>
                <small>${reservation.rooms?.room_types?.name || "Room"} - ${reservation.confirmation_number || `Reservation #${reservation.id}`}</small>
              </div>
              <div class="stitch-arrival-time">
                <strong style="display:block; font-size:.74rem; color:var(--primary);">${formatDate(reservation.check_in)}</strong>
                <small>${reservation.rooms?.room_number || "Unassigned"}</small>
              </div>
            </article>
          `).join("") || `
            <article class="stitch-arrival-item">
              <div class="stitch-arrival-copy">
                <strong>No recent arrivals</strong>
                <small>New reservations will appear here once activity is recorded.</small>
              </div>
            </article>
          `}
        </div>
      </div>
    </section>

    <section>
      <div class="stitch-overview-head">
        <div>
          <h2 style="margin:0 0 8px; font-family:'Noto Serif',serif; color:var(--primary); font-size:1.9rem;">${isAdmin ? "Room Operations Overview" : "Reservation Overview"}</h2>
          <p class="page-subtitle">${isAdmin ? "Reservation, room, and payment status at an executive glance." : "Current reservation flow, guest movement, and room assignment status."}</p>
        </div>
        <div class="stitch-pill-row">
          <a class="btn btn-ghost" href="rooms.html">Room Inventory</a>
          ${isAdmin ? '<a class="btn btn-ghost" href="billing.html">Billing Review</a>' : '<a class="btn btn-ghost" href="reservations.html">Manage Reservations</a>'}
        </div>
      </div>
      <div class="stitch-overview-card">
        <div class="table-wrap">
          <table class="stitch-overview-table">
            <thead>
              <tr>
                <th>Room No.</th>
                <th>Guest Name</th>
                <th>Category</th>
                <th>Status</th>
                <th>Arrival / Departure</th>
                <th class="text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              ${overviewRows.map((reservation, index) => `
                <tr class="${index === 1 ? "highlight" : ""}">
                  <td style="font-family:'Noto Serif',serif; font-weight:700; font-size:1.08rem;">${reservation.rooms?.room_number || "-"}</td>
                  <td>
                    <p style="margin:0; font-weight:700; color:var(--primary);">${reservation.guests?.full_name || "Guest"}</p>
                    <p style="margin:4px 0 0; color:var(--outline); font-size:.68rem;">Booked ${formatDateTime(reservation.created_at)}</p>
                  </td>
                  <td><span style="font-size:.76rem; font-style:italic; color:var(--secondary);">${reservation.rooms?.room_types?.name || "Unassigned"}</span></td>
                  <td>${createStatusBadge(reservation.status)}</td>
                  <td><span style="font-size:.72rem; color:var(--text-soft);">${formatDate(reservation.check_in)} to ${formatDate(reservation.check_out)}</span></td>
                  <td class="text-right" style="font-family:'Noto Serif',serif; font-weight:700; color:var(--primary);">${formatCurrency(reservation.total_amount)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  `);
});
