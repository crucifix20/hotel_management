import { initProtectedPage } from "../router.js";
import { getGuest } from "../services/guestsService.js";
import { createEmptyState, createPageHeader, createStatusBadge, createVipBadge } from "../ui.js";
import { escapeHtml, formatCurrency, formatDate, formatDateTime, getQueryParam, render } from "../utils.js";

function renderPrintRows(rows, emptyMessage, colspan = 4) {
  return rows.length
    ? rows.join("")
    : `<tr><td colspan="${colspan}" class="muted">${escapeHtml(emptyMessage)}</td></tr>`;
}

function renderGuestProfileFolio({ guest, memberships, stays, amenities, serviceOrders, benefitUsage, printedBy }) {
  const latestStay = stays.slice().sort((a, b) => new Date(b.check_in || 0) - new Date(a.check_in || 0))[0];
  const guestName = guest.full_name || "Guest";

  return `
    <section class="print-shell guest-profile-print">
      <article class="print-card">
        <header class="print-header">
          <div>
            <p class="eyebrow">Grand Millado Hotel</p>
            <h1>Guest Profile</h1>
            <p class="muted">Professional guest information, booking history, and service activity.</p>
          </div>
          <div class="text-right">
            <p class="eyebrow">Printed</p>
            <h2 class="font-display">${escapeHtml(formatDateTime(new Date().toISOString()))}</h2>
            <p class="muted">Prepared by ${escapeHtml(printedBy || "FO Staff")}</p>
          </div>
        </header>

        <section class="print-section">
          <h2>Guest Information</h2>
          <div class="detail-grid">
            <dl class="detail-kv"><dt>Guest Name</dt><dd>${escapeHtml(guestName)}</dd></dl>
            <dl class="detail-kv"><dt>Email</dt><dd>${escapeHtml(guest.email || "-")}</dd></dl>
            <dl class="detail-kv"><dt>Phone</dt><dd>${escapeHtml(guest.phone || "-")}</dd></dl>
            <dl class="detail-kv"><dt>VIP Status</dt><dd>${guest.vip_status ? "VIP Guest" : "Standard"}</dd></dl>
            <dl class="detail-kv"><dt>Address</dt><dd>${escapeHtml(guest.address || "-")}</dd></dl>
            <dl class="detail-kv"><dt>Company</dt><dd>${escapeHtml(guest.company_name || "-")}</dd></dl>
            <dl class="detail-kv"><dt>Nationality</dt><dd>${escapeHtml(guest.nationality || "-")}</dd></dl>
            <dl class="detail-kv"><dt>Origin</dt><dd>${escapeHtml(guest.origin || "-")}</dd></dl>
            <dl class="detail-kv"><dt>Booking Person</dt><dd>${escapeHtml(guest.booking_person || "-")}</dd></dl>
            <dl class="detail-kv"><dt>Guest Type</dt><dd>${escapeHtml(guest.guest_type || "-")}</dd></dl>
            <dl class="detail-kv"><dt>Preferences</dt><dd>${escapeHtml(guest.preferences || "-")}</dd></dl>
            <dl class="detail-kv"><dt>Total Reservations</dt><dd>${escapeHtml(String(stays.length))}</dd></dl>
            <dl class="detail-kv"><dt>Memberships</dt><dd>${escapeHtml(String(memberships.length))}</dd></dl>
          </div>
        </section>

        <section class="print-section">
          <h2>Booking History</h2>
          <div class="detail-grid">
            <dl class="detail-kv"><dt>Latest Reservation</dt><dd>${escapeHtml(latestStay?.confirmation_number || "-")}</dd></dl>
            <dl class="detail-kv"><dt>Latest Room</dt><dd>${escapeHtml(latestStay ? `Room ${latestStay.rooms?.room_number || "-"} - ${latestStay.rooms?.room_types?.name || "-"}` : "-")}</dd></dl>
            <dl class="detail-kv"><dt>Latest Check-In</dt><dd>${escapeHtml(formatDate(latestStay?.check_in))}</dd></dl>
            <dl class="detail-kv"><dt>Latest Check-Out</dt><dd>${escapeHtml(formatDate(latestStay?.check_out))}</dd></dl>
          </div>
          <div class="table-wrap" style="margin-top:18px;">
            <table>
              <thead>
                <tr><th>Confirmation</th><th>Room</th><th>Booking Dates</th><th>Travel</th><th>Status</th></tr>
              </thead>
              <tbody>
                ${renderPrintRows(stays.map((reservation) => `
                  <tr>
                    <td>${escapeHtml(reservation.confirmation_number || `Reservation #${reservation.id}`)}</td>
                    <td>${escapeHtml(`Room ${reservation.rooms?.room_number || "-"} - ${reservation.rooms?.room_types?.name || "-"}`)}</td>
                    <td>${escapeHtml(`${formatDate(reservation.check_in)} to ${formatDate(reservation.check_out)}`)}</td>
                    <td>${escapeHtml(`${formatDate(reservation.arrival_date)} / ${reservation.flight_number || "-"} / ${formatDate(reservation.departure_date)}`)}</td>
                    <td>${escapeHtml(reservation.status || "-")}</td>
                  </tr>
                `), "No reservation history recorded.", 5)}
              </tbody>
            </table>
          </div>
        </section>

        <section class="print-section">
          <h2>Memberships, Services & Benefits</h2>
          <div class="table-wrap">
            <table>
              <thead>
                <tr><th>Category</th><th>Description</th><th>Date / Term</th><th>Status</th></tr>
              </thead>
              <tbody>
                ${renderPrintRows([
                  ...memberships.map((membership) => `
                    <tr>
                      <td>Club</td>
                      <td>${escapeHtml(`${membership.clubs?.name || "VIP Club"} - ${membership.membership_level || "Member"}`)}</td>
                      <td>${escapeHtml(`${formatDate(membership.start_date)} to ${formatDate(membership.end_date)}`)}</td>
                      <td>${escapeHtml(membership.status || "-")}</td>
                    </tr>
                  `),
                  ...amenities.map((booking) => `
                    <tr>
                      <td>Amenity</td>
                      <td>${escapeHtml(`${booking.amenities?.name || "Amenity"} x ${booking.quantity || 1}`)}</td>
                      <td>${escapeHtml(formatDate(booking.booking_date))}</td>
                      <td>${escapeHtml(booking.status || "-")}</td>
                    </tr>
                  `),
                  ...serviceOrders.map((order) => `
                    <tr>
                      <td>Service</td>
                      <td>${escapeHtml(`${order.hotel_services?.name || "Service"} x ${order.quantity || 1}`)}</td>
                      <td>${escapeHtml(formatDateTime(order.created_at))}</td>
                      <td>${escapeHtml(order.status || "-")}</td>
                    </tr>
                  `),
                  ...benefitUsage.map((usage) => `
                    <tr>
                      <td>Benefit</td>
                      <td>${escapeHtml(`${usage.club_benefits?.title || "VIP Benefit"} - ${usage.club_registrations?.clubs?.name || "VIP Club"}`)}</td>
                      <td>${escapeHtml(formatDateTime(usage.used_at))}</td>
                      <td>${escapeHtml(usage.club_registrations?.membership_level || "Member")}</td>
                    </tr>
                  `),
                ], "No memberships, services, amenities, or benefits recorded.")}
              </tbody>
            </table>
          </div>
        </section>

        <section class="print-section signature-grid guest-profile-signatures">
          <div class="signature-block">
            <div class="signature-line">
              <strong>${escapeHtml(guestName)}</strong><br>
              Guest Signature
            </div>
          </div>
          <div class="signature-block">
            <div class="signature-line">
              <strong>${escapeHtml(printedBy || "FO Staff")}</strong><br>
              FO Staff
            </div>
          </div>
        </section>
      </article>
    </section>
  `;
}

await initProtectedPage("guests", async ({ root, auth }) => {
  const isAdmin = auth.profile.role === "Admin";
  const guestId = Number(getQueryParam("id"));
  if (!guestId) {
    render(root, createEmptyState({ title: "Guest not found", copy: "A valid guest ID is required to open the guest profile." }));
    return;
  }

  const guest = await getGuest(guestId);
  const memberships = guest.club_registrations || [];
  const stays = guest.reservations || [];
  const invoices = guest.invoices || [];
  const amenities = guest.amenity_bookings || [];
  const serviceOrders = guest.service_orders || [];
  const benefitUsage = guest.club_benefit_usage || [];
  const printedBy = auth.profile.full_name || "FO Staff";

  render(root, `
    ${createPageHeader({
      title: guest.full_name,
      subtitle: guest.vip_status ? "Premium guest profile with VIP access and club activity." : "Guest profile, stay history, and billing activity.",
      actions: `
        <button class="btn btn-primary" id="print-guest-profile-button" type="button">Print Guest Profile</button>
        ${isAdmin ? '<a class="btn btn-secondary" href="clubs.html">Manage VIP Clubs</a>' : ""}
        <a class="btn btn-ghost" href="guests.html">Back to Guests</a>
      `,
    })}
    <div class="guest-profile-screen">
    <section class="stitch-kpi-grid">
      <article class="stitch-kpi-card">
        <div class="stitch-kpi-iconrow"><span class="stitch-kpi-tag">Profile</span></div>
        <h3>VIP Status</h3>
        <div class="stitch-kpi-value" style="font-size:1.9rem;">${guest.vip_status ? "VIP" : "Standard"}</div>
        <p class="stitch-kpi-note">${guest.vip_status ? "Premium guest relationship" : "Standard guest profile"}</p>
      </article>
      <article class="stitch-kpi-card">
        <div class="stitch-kpi-iconrow"><span class="stitch-kpi-tag">Stays</span></div>
        <h3>Reservations</h3>
        <div class="stitch-kpi-value">${stays.length}</div>
        <p class="stitch-kpi-note">Historical and current bookings</p>
      </article>
      <article class="stitch-kpi-card">
        <div class="stitch-kpi-iconrow"><span class="stitch-kpi-tag">Clubs</span></div>
        <h3>Memberships</h3>
        <div class="stitch-kpi-value">${memberships.length}</div>
        <p class="stitch-kpi-note">VIP club registrations linked to this guest</p>
      </article>
      <article class="stitch-kpi-card">
        <div class="stitch-kpi-iconrow"><span class="stitch-kpi-tag">Billing</span></div>
        <h3>Invoices</h3>
        <div class="stitch-kpi-value">${invoices.length}</div>
        <p class="stitch-kpi-note">${formatCurrency(invoices.reduce((sum, invoice) => sum + Number(invoice.total || 0), 0))} billed</p>
      </article>
    </section>
    <section class="stitch-detail-hero" style="margin-top:24px;">
      <div>
        <p class="eyebrow">Guest Profile</p>
        <h2>${guest.full_name}</h2>
        <p class="detail-copy">${guest.preferences || "No stated preferences have been recorded for this guest yet."}</p>
        <div class="button-row" style="margin-top:16px;">
          <button class="btn btn-primary print-guest-profile-trigger" type="button">Print Guest Profile</button>
        </div>
      </div>
      <div class="stitch-detail-meta">
        <div><span>Email</span><strong>${guest.email || "-"}</strong></div>
        <div><span>Phone</span><strong>${guest.phone || "-"}</strong></div>
        <div><span>VIP</span><strong>${guest.vip_status ? createVipBadge("VIP Guest") : "Standard"}</strong></div>
        <div><span>Company</span><strong>${guest.company_name || "-"}</strong></div>
        <div><span>Nationality</span><strong>${guest.nationality || "-"}</strong></div>
        <div><span>Origin</span><strong>${guest.origin || "-"}</strong></div>
        <div><span>Booking Person</span><strong>${guest.booking_person || "-"}</strong></div>
        <div><span>Guest Type</span><strong>${guest.guest_type || "-"}</strong></div>
        <div><span>Address</span><strong>${guest.address || "-"}</strong></div>
      </div>
    </section>
    <section class="stitch-main-grid" style="margin-top:24px;">
      <div class="stitch-overview-card">
        <div class="stitch-overview-head">
          <div>
            <h2>Stay History</h2>
            <p>Reservation history and payment outcomes.</p>
          </div>
        </div>
        ${stays.length ? `
          <div class="timeline">
            ${stays.map((reservation) => `
              <article class="timeline-item">
                <strong>${reservation.confirmation_number || `Reservation #${reservation.id}`}</strong>
                <p class="muted" style="margin:8px 0;">Room ${reservation.rooms?.room_number || "-"} &bull; ${reservation.rooms?.room_types?.name || ""}</p>
                <div class="button-row">
                  ${createStatusBadge(reservation.status)}
                  ${createStatusBadge(reservation.payment_status)}
                </div>
                <small class="muted">${formatDate(reservation.check_in)} to ${formatDate(reservation.check_out)} &bull; ${formatCurrency(reservation.total_amount)}</small>
              </article>
            `).join("")}
          </div>
        ` : createEmptyState({ title: "No stays yet", copy: "This guest does not have reservation history yet." })}
      </div>
      <aside class="stitch-arrivals-card">
        <div class="stitch-section-head">
          <div>
            <h2>Club Memberships</h2>
            <p>Current memberships and benefits.</p>
          </div>
        </div>
        ${memberships.length ? memberships.map((membership) => `
          <article class="timeline-item">
            <strong>${membership.clubs?.name || "VIP Club"} ${createVipBadge(membership.membership_level || "Member")}</strong>
            <p class="muted" style="margin:8px 0;">Membership No. ${membership.membership_number || "-"} &bull; ${createStatusBadge(membership.status)}</p>
            <small class="muted">Active ${formatDate(membership.start_date)} to ${formatDate(membership.end_date)}</small>
            <div class="stack-sm" style="margin-top:12px;">
              ${(membership.clubs?.club_benefits || []).slice(0, 3).map((benefit) => `<div>${benefit.title} &bull; ${benefit.description}</div>`).join("") || "<div class='muted'>No benefits recorded.</div>"}
            </div>
          </article>
        `).join("") : `<div class="empty-state"><h3 class="font-display">No club memberships</h3><p>This guest is not currently registered in any VIP club.</p></div>`}
      </aside>
    </section>
    <section class="split-grid" style="margin-top:24px;">
      <div class="stitch-overview-card">
        <div class="stitch-overview-head">
          <div>
            <h2>Amenity Bookings</h2>
            <p>Premium services booked by this guest.</p>
          </div>
        </div>
        ${amenities.length ? `
          <div class="timeline">
            ${amenities.map((booking) => `
              <article class="timeline-item">
                <strong>${booking.amenities?.name || "Amenity"}</strong>
                <p class="muted" style="margin:8px 0;">${booking.quantity} qty &bull; ${createStatusBadge(booking.status)}</p>
                <small class="muted">${formatDate(booking.booking_date)} &bull; ${formatCurrency(booking.total_amount)}</small>
              </article>
            `).join("")}
          </div>
        ` : createEmptyState({ title: "No amenity bookings", copy: "No amenity bookings were found for this guest." })}
      </div>
      <div class="stitch-overview-card">
        <div class="stitch-overview-head">
          <div>
            <h2>Invoices & Club Charges</h2>
            <p>Guest invoices, payments, and club-related invoice items.</p>
          </div>
        </div>
        ${invoices.length ? `
          <div class="timeline">
            ${invoices.map((invoice) => `
              <article class="timeline-item">
                <strong>${invoice.invoice_number}</strong>
                <p class="muted" style="margin:8px 0;">${createStatusBadge(invoice.status)} &bull; ${formatCurrency(invoice.total)}</p>
                <div>${(invoice.invoice_items || []).map((item) => `<div>${item.description} &bull; ${formatCurrency(item.total)}</div>`).join("")}</div>
                <div style="margin-top:10px;">${(invoice.payments || []).map((payment) => `<div class="muted">Payment &bull; ${formatCurrency(payment.amount)} &bull; ${formatDateTime(payment.created_at || payment.paid_at)}</div>`).join("")}</div>
              </article>
            `).join("")}
          </div>
        ` : createEmptyState({ title: "No invoices", copy: "This guest does not have invoices recorded yet." })}
      </div>
    </section>
    <section class="stitch-overview-card" style="margin-top:24px;">
      <div class="stitch-overview-head">
        <div>
          <h2>In-Stay Services</h2>
          <p>Additional service orders posted during the guest stay.</p>
        </div>
      </div>
      ${serviceOrders.length ? `
        <div class="timeline">
          ${serviceOrders.map((order) => `
            <article class="timeline-item">
              <strong>${order.hotel_services?.name || "Service"}</strong>
              <p class="muted" style="margin:8px 0;">${order.quantity} qty · ${createStatusBadge(order.status)}</p>
              <small class="muted">${formatCurrency(order.total_amount)} · ${formatDateTime(order.created_at)}</small>
            </article>
          `).join("")}
        </div>
      ` : createEmptyState({ title: "No service orders", copy: "No in-stay service orders have been recorded for this guest." })}
    </section>
    <section class="stitch-overview-card" style="margin-top:24px;">
      <div class="stitch-overview-head">
        <div>
          <h2>VIP Benefit Usage</h2>
          <p>Discounts and complimentary benefits applied during stays.</p>
        </div>
      </div>
      ${benefitUsage.length ? `
        <div class="timeline">
          ${benefitUsage.map((usage) => `
            <article class="timeline-item">
              <strong>${usage.club_benefits?.title || "VIP Benefit"} · ${usage.club_registrations?.clubs?.name || "VIP Club"}</strong>
              <p class="muted" style="margin:8px 0;">${usage.service_orders?.hotel_services?.name || "Stay benefit"} · ${usage.club_registrations?.membership_level || "Member"}</p>
              <small class="muted">${formatCurrency(usage.amount_discounted)} · ${formatDateTime(usage.used_at)}</small>
            </article>
          `).join("")}
        </div>
      ` : createEmptyState({ title: "No benefit usage yet", copy: "No VIP club benefits have been applied for this guest yet." })}
    </section>
    </div>
    ${renderGuestProfileFolio({ guest, memberships, stays, amenities, serviceOrders, benefitUsage, printedBy })}
  `);

  document.getElementById("print-guest-profile-button")?.addEventListener("click", () => window.print());
  document.querySelectorAll(".print-guest-profile-trigger").forEach((button) => {
    button.addEventListener("click", () => window.print());
  });
});
