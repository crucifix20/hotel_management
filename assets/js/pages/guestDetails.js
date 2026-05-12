import { initProtectedPage } from "../router.js";
import { getGuest } from "../services/guestsService.js";
import { createEmptyState, createPageHeader, createStatusBadge, createVipBadge } from "../ui.js";
import { formatCurrency, formatDate, formatDateTime, getQueryParam, render } from "../utils.js";

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

  render(root, `
    ${createPageHeader({
      title: guest.full_name,
      subtitle: guest.vip_status ? "Premium guest profile with VIP access and club activity." : "Guest profile, stay history, and billing activity.",
      actions: `
        ${isAdmin ? '<a class="btn btn-secondary" href="clubs.html">Manage VIP Clubs</a>' : ""}
        <a class="btn btn-ghost" href="guests.html">Back to Guests</a>
      `,
    })}
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
      </div>
      <div class="stitch-detail-meta">
        <div><span>Email</span><strong>${guest.email || "-"}</strong></div>
        <div><span>Phone</span><strong>${guest.phone || "-"}</strong></div>
        <div><span>VIP</span><strong>${guest.vip_status ? createVipBadge("VIP Guest") : "Standard"}</strong></div>
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
  `);
});
