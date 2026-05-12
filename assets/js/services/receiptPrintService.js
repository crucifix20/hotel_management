import { getStoredSettings, escapeHtml, formatCurrency, formatDate, formatDateTime } from "../utils.js";
import { getCheckoutFolio } from "./billingService.js";
import { getReservation } from "./reservationsService.js";

function buildReceiptNumber(reservation) {
  return `GMH-RCT-${new Date(reservation.checked_out_at || reservation.created_at || Date.now()).getFullYear()}-${String(reservation.id).padStart(6, "0")}`;
}

export async function getCheckoutReceiptData(id) {
  const reservation = await getReservation(id);
  const folio = await getCheckoutFolio(id);

  if (!folio) {
    throw new Error("A checkout folio could not be generated for this reservation.");
  }

  return {
    settings: getStoredSettings(),
    reservation,
    folio,
    receiptNumber: buildReceiptNumber(reservation),
  };
}

export function renderCheckoutReceiptPage({ settings, reservation, folio, receiptNumber }) {
  const room = reservation.rooms || {};
  const roomType = room.room_types || {};
  const guest = reservation.guests || {};
  const lastPayment = (folio.payments || []).slice().sort((a, b) => new Date(b.paid_at || b.created_at) - new Date(a.paid_at || a.created_at))[0];
  const benefitUsage = reservation.club_benefit_usage || [];

  return `
    <div class="print-shell">
      <div class="print-actions">
        <button class="btn btn-primary" id="print-receipt-button" type="button">Print / Save as PDF</button>
        <a class="btn btn-ghost" href="reservations.html">Back to Reservations</a>
        <a class="btn btn-secondary" href="booking-confirmation.html?id=${reservation.id}">Booking Confirmation</a>
      </div>
      <article class="print-card">
        <header class="print-header">
          <div>
            <p class="eyebrow">Grand Millado Hotel</p>
            <h1>Checkout Receipt</h1>
            <p class="muted">${escapeHtml(settings.address)}</p>
            <p class="muted">${escapeHtml(settings.contact)}</p>
          </div>
          <div class="text-right">
            <p class="eyebrow">Receipt Number</p>
            <h2 class="font-display mono">${escapeHtml(receiptNumber)}</h2>
            <p class="muted">Printed ${escapeHtml(formatDateTime(new Date().toISOString()))}</p>
          </div>
        </header>
        <section class="print-section">
          <h2>Stay Summary</h2>
          <div class="detail-grid">
            <dl class="detail-kv"><dt>Confirmation</dt><dd>${escapeHtml(reservation.confirmation_number || `Reservation #${reservation.id}`)}</dd></dl>
            <dl class="detail-kv"><dt>Guest</dt><dd>${escapeHtml(guest.full_name || "-")}</dd></dl>
            <dl class="detail-kv"><dt>Room</dt><dd>${escapeHtml(room.room_number || "-")}</dd></dl>
            <dl class="detail-kv"><dt>Room Type</dt><dd>${escapeHtml(roomType.name || "-")}</dd></dl>
            <dl class="detail-kv"><dt>Check-In</dt><dd>${escapeHtml(formatDate(reservation.check_in))}</dd></dl>
            <dl class="detail-kv"><dt>Check-Out</dt><dd>${escapeHtml(formatDate(reservation.check_out))}</dd></dl>
            <dl class="detail-kv"><dt>Nights Stayed</dt><dd>${escapeHtml(String(reservation.nights || 0))}</dd></dl>
            <dl class="detail-kv"><dt>Cashier</dt><dd>${escapeHtml(reservation.checked_out_by_profile?.full_name || reservation.created_by_profile?.full_name || "Front Office")}</dd></dl>
          </div>
        </section>
        <section class="print-section">
          <h2>Itemized Folio</h2>
          <div class="table-wrap">
            <table>
              <thead>
                <tr><th>Description</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr>
              </thead>
              <tbody>
                ${(folio.lineItems || []).map((item) => `
                  <tr>
                    <td>${escapeHtml(item.description)}</td>
                    <td>${escapeHtml(String(item.quantity || 1))}</td>
                    <td>${escapeHtml(formatCurrency(item.unit_price || 0))}</td>
                    <td>${escapeHtml(formatCurrency(item.total || 0))}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
          <div class="detail-grid" style="margin-top:18px;">
            <dl class="detail-kv"><dt>Room Charges / Folio Total</dt><dd>${escapeHtml(formatCurrency(folio.invoice.total || 0))}</dd></dl>
            <dl class="detail-kv"><dt>Downpayment</dt><dd>${escapeHtml(formatCurrency(reservation.downpayment_paid || 0))}</dd></dl>
            <dl class="detail-kv"><dt>Incidental Deposit</dt><dd>${escapeHtml(formatCurrency(reservation.incidental_deposit_paid || 0))}</dd></dl>
            <dl class="detail-kv"><dt>Payments</dt><dd>${escapeHtml(formatCurrency(folio.totalPayments || 0))}</dd></dl>
            <dl class="detail-kv"><dt>Refundable Amount</dt><dd>${escapeHtml(formatCurrency(folio.refundableAmount || 0))}</dd></dl>
            <dl class="detail-kv"><dt>Final Balance</dt><dd>${escapeHtml(formatCurrency(folio.outstandingBalance || 0))}</dd></dl>
          </div>
        </section>
        <section class="print-section">
          <h2>Payment Summary</h2>
          <div class="detail-grid">
            <dl class="detail-kv"><dt>Last Payment Method</dt><dd>${escapeHtml(lastPayment?.payment_method || "-")}</dd></dl>
            <dl class="detail-kv"><dt>Reference</dt><dd>${escapeHtml(lastPayment?.payment_reference || "-")}</dd></dl>
            <dl class="detail-kv"><dt>Payment Time</dt><dd>${escapeHtml(formatDateTime(lastPayment?.paid_at || lastPayment?.created_at))}</dd></dl>
            <dl class="detail-kv"><dt>Invoice Status</dt><dd>${escapeHtml(folio.invoice.status || "-")}</dd></dl>
          </div>
        </section>
        ${benefitUsage.length ? `
          <section class="print-section">
            <h2>VIP Club Benefits Used</h2>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr><th>Club</th><th>Benefit</th><th>Service</th><th>Discount</th></tr>
                </thead>
                <tbody>
                  ${benefitUsage.map((usage) => `
                    <tr>
                      <td>${escapeHtml(usage.club_registrations?.clubs?.name || "-")} · ${escapeHtml(usage.club_registrations?.membership_level || "-")}</td>
                      <td>${escapeHtml(usage.club_benefits?.title || "-")}</td>
                      <td>${escapeHtml(usage.service_orders?.hotel_services?.name || "Stay benefit")}</td>
                      <td>${escapeHtml(formatCurrency(usage.amount_discounted || 0))}</td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
          </section>
        ` : ""}
        <section class="print-section">
          <h2>Thank You</h2>
          <p class="muted">Thank you for staying with Grand Millado Hotel. Please retain this receipt for your records. Refundable deposits, if any, are reflected above and processed according to the recorded settlement.</p>
          <div class="signature-line">Grand Millado Hotel Front Office Signature</div>
        </section>
      </article>
    </div>
  `;
}
