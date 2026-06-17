import { ROLES } from "../config.js";
import { initProtectedPage } from "../router.js";
import { createAuditLog } from "../services/auditService.js";
import { listAmenities, saveAmenityBooking } from "../services/amenitiesService.js";
import { addAmenityChargeToInvoice, getReservationInvoice } from "../services/billingService.js";
import { getDashboardData } from "../services/dashboardService.js";
import { listGuestOptions } from "../services/guestsService.js";
import { listHotelServices, saveServiceOrder } from "../services/hotelServicesService.js";
import { listReservations } from "../services/reservationsService.js";
import { closeModal, createStatusBadge, openModal, showToast } from "../ui.js";
import { buildSelectOptions, formatCurrency, formatDate, formatDateTime, friendlyError, initials, qs, render, serializeForm, todayIso, withFormBusy } from "../utils.js";

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

    ${!isAdmin ? `
      <section class="stitch-overview-card" style="margin-top:24px;">
        <div class="stitch-overview-head">
          <div>
            <h2>Guest Service Desk</h2>
            <p class="page-subtitle">Book amenities and in-stay services for active guests.</p>
          </div>
          <div class="stitch-pill-row">
            <button class="btn btn-secondary" id="staff-book-service-button" type="button">Book Guest Service</button>
            <button class="btn btn-primary" id="staff-book-amenity-button" type="button">Book Amenity</button>
          </div>
        </div>
      </section>
    ` : ""}

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

  if (!isAdmin) {
    bindStaffBookingActions(auth);
  }

  function bindStaffBookingActions(authContext) {
    qs("#staff-book-amenity-button")?.addEventListener("click", openStaffAmenityBooking);
    qs("#staff-book-service-button")?.addEventListener("click", openStaffServiceBooking);

    async function openStaffAmenityBooking() {
      try {
        const [amenities, guests, reservations] = await Promise.all([
          listAmenities(),
          listGuestOptions(),
          listReservations({}),
        ]);
        const activeAmenities = amenities.filter((amenity) => amenity.status === "Available");
        const eligibleReservations = reservations.filter((reservation) => ["Confirmed", "Checked In"].includes(reservation.status));

        openModal({
          title: "Book Amenity",
          body: `
            <form id="staff-amenity-booking-form" class="form-stack">
              <div class="filter-row">
                <div class="field">
                  <label for="amenity_id">Amenity</label>
                  <select id="amenity_id" name="amenity_id" required>
                    <option value="">Select amenity</option>
                    ${activeAmenities.map((amenity) => `<option value="${amenity.id}">${amenity.name} - ${formatCurrency(amenity.price)}</option>`).join("")}
                  </select>
                </div>
                <div class="field">
                  <label for="guest_id">Guest</label>
                  <select id="guest_id" name="guest_id" required>
                    <option value="">Select guest</option>
                    ${guests.map((guest) => `<option value="${guest.id}">${guest.full_name}</option>`).join("")}
                  </select>
                </div>
              </div>
              <div class="filter-row">
                <div class="field">
                  <label for="reservation_id">Reservation</label>
                  <select id="reservation_id" name="reservation_id">
                    <option value="">No reservation selected</option>
                    ${eligibleReservations.map((reservation) => `<option value="${reservation.id}">${reservation.confirmation_number || reservation.id} &middot; ${reservation.guests?.full_name || "Guest"} &middot; Room ${reservation.rooms?.room_number || "-"}</option>`).join("")}
                  </select>
                </div>
                <div class="field">
                  <label for="booking_date">Booking Date</label>
                  <input id="booking_date" name="booking_date" type="date" value="${todayIso()}" required>
                </div>
              </div>
              <div class="filter-row">
                <div class="field">
                  <label for="quantity">Quantity</label>
                  <input id="quantity" name="quantity" type="number" min="1" value="1" required>
                </div>
                <div class="field">
                  <label for="status">Status</label>
                  <select id="status" name="status">
                    <option value="Booked">Booked</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
              <button class="btn btn-primary" type="submit">Save Amenity Booking</button>
            </form>
          `,
        });

        qs("#staff-amenity-booking-form").addEventListener("submit", async (event) => {
          event.preventDefault();
          try {
            await withFormBusy(event.currentTarget, "Saving...", async () => {
              const payload = serializeForm(event.currentTarget);
              payload.amenity_id = Number(payload.amenity_id);
              payload.guest_id = Number(payload.guest_id);
              payload.reservation_id = payload.reservation_id ? Number(payload.reservation_id) : null;
              payload.quantity = Number(payload.quantity);
              const result = await saveAmenityBooking(payload);

              if (payload.reservation_id) {
                const invoice = await getReservationInvoice(payload.reservation_id);
                if (invoice) {
                  await addAmenityChargeToInvoice({
                    invoiceId: invoice.id,
                    amenityName: result.amenity.name,
                    quantity: payload.quantity,
                    amount: result.booking.total_amount,
                  });
                }
              }

              await createAuditLog({
                userId: authContext.user.id,
                action: "Booked amenity",
                entityType: "amenity_bookings",
                entityId: result.booking.id,
                details: `${result.amenity.name} for ${result.booking.guests?.full_name || "guest"}`,
              });
              closeModal();
              showToast("Amenity booking saved.", "success");
            });
          } catch (error) {
            showToast(friendlyError(error), "error");
          }
        });
      } catch (error) {
        showToast(friendlyError(error), "error");
      }
    }

    async function openStaffServiceBooking() {
      try {
        const [hotelServices, reservations] = await Promise.all([
          listHotelServices({ status: "Available" }),
          listReservations({}),
        ]);
        const activeReservations = reservations.filter((reservation) => reservation.status === "Checked In");

        openModal({
          title: "Book Guest Service",
          body: `
            <form id="staff-service-order-form" class="form-stack">
              <div class="field">
                <label for="reservation_id">Checked-In Guest</label>
                <select id="reservation_id" name="reservation_id" required>
                  <option value="">Select checked-in reservation</option>
                  ${activeReservations.map((reservation) => `<option value="${reservation.id}" data-room-id="${reservation.room_id}" data-guest-id="${reservation.guest_id}">${reservation.confirmation_number || reservation.id} &middot; ${reservation.guests?.full_name || "Guest"} &middot; Room ${reservation.rooms?.room_number || "-"}</option>`).join("")}
                </select>
              </div>
              <div class="filter-row">
                <div class="field">
                  <label for="service_id">Service From Catalogue</label>
                  <select id="service_id" name="service_id" required>
                    <option value="">Select available service</option>
                    ${hotelServices.map((service) => `<option value="${service.id}" data-price="${service.price}">${service.name} - ${formatCurrency(service.price)}</option>`).join("")}
                  </select>
                </div>
                <div class="field">
                  <label for="quantity">Quantity</label>
                  <input id="quantity" name="quantity" type="number" min="1" value="1" required>
                </div>
              </div>
              <div class="filter-row">
                <div class="field">
                  <label for="unit_price">Unit Price</label>
                  <input id="unit_price" name="unit_price" type="number" min="0" step="0.01" value="0" required>
                  <p class="field-help">Auto-filled from the service catalogue.</p>
                </div>
                <div class="field">
                  <label for="status">Status</label>
                  <select id="status" name="status">${buildSelectOptions(["Requested", "In Progress", "Completed", "Cancelled", "Charged"], "Select status")}</select>
                </div>
              </div>
              <div class="field"><label for="notes">Notes</label><textarea id="notes" name="notes"></textarea></div>
              <button class="btn btn-primary" type="submit">Save Guest Service</button>
            </form>
          `,
        });

        qs("#status").value = "Requested";
        qs("#service_id").addEventListener("change", (event) => {
          qs("#unit_price").value = event.target.selectedOptions[0]?.dataset.price || "0";
        });

        qs("#staff-service-order-form").addEventListener("submit", async (event) => {
          event.preventDefault();
          try {
            await withFormBusy(event.currentTarget, "Saving...", async () => {
              const payload = serializeForm(event.currentTarget);
              const reservation = activeReservations.find((item) => item.id === Number(payload.reservation_id));
              payload.reservation_id = Number(payload.reservation_id);
              payload.guest_id = reservation.guest_id;
              payload.room_id = reservation.room_id;
              payload.service_id = Number(payload.service_id);
              payload.quantity = Number(payload.quantity);
              payload.unit_price = Number(payload.unit_price);
              payload.created_by = authContext.user.id;
              const order = await saveServiceOrder(payload);

              await createAuditLog({
                userId: authContext.user.id,
                action: "Created service order",
                entityType: "service_orders",
                entityId: order.id,
                details: `${order.hotel_services?.name || "Service"} for ${reservation.guests?.full_name || "guest"}`,
              });
              closeModal();
              showToast("Guest service saved.", "success");
            });
          } catch (error) {
            showToast(friendlyError(error), "error");
          }
        });
      } catch (error) {
        showToast(friendlyError(error), "error");
      }
    }
  }
});
