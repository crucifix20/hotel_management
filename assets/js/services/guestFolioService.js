import { PAYMENT_METHODS } from "../config.js";
import { getStoredSettings, escapeHtml, formatCurrency, formatDate, formatDateTime } from "../utils.js";
import { createInvoiceFromReservation, getCheckoutFolio, saveInvoiceItem, savePayment } from "./billingService.js";
import { saveHousekeepingTask } from "./housekeepingService.js";
import { getReservation, updateReservationStatus, validateReservationCheckOut } from "./reservationsService.js";

function buildFolioNumber(reservation) {
  return `GMH-FOL-${new Date(reservation.created_at || Date.now()).getFullYear()}-${String(reservation.id).padStart(6, "0")}`;
}

const TRANSACTION_TYPE_CHECKOUT = "Checkout Payment";

function buildPaymentMethodOptions() {
  return [`<option value="">Select payment method</option>`]
    .concat(PAYMENT_METHODS.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`))
    .join("");
}

export async function getGuestFolioData(id) {
  const reservation = await getReservation(id);
  await createInvoiceFromReservation(reservation);
  const folio = await getCheckoutFolio(id);

  if (!folio) {
    throw new Error("The guest folio could not be generated for this reservation.");
  }

  return {
    settings: getStoredSettings(),
    reservation,
    folio,
    folioNumber: buildFolioNumber(reservation),
    printedAt: new Date().toISOString(),
  };
}

export function renderGuestFolioPage({ settings, reservation, folio, folioNumber, printedAt, isAdmin = false }) {
  const room = reservation.rooms || {};
  const roomType = room.room_types || {};
  const guest = reservation.guests || {};
  const showStatusWarning = reservation.status !== "Checked In";
  const balanceDue = Number(folio.outstandingBalance || 0);

  return `
    <div class="print-shell">
      <div class="print-actions">
        <button class="btn btn-primary" id="print-folio-button" type="button">Print Guest Folio</button>
        <a class="btn btn-ghost" href="reservations.html">Back to Reservations</a>
        <button class="btn btn-secondary" id="confirm-checkout-button" type="button">Confirm Check Out</button>
      </div>
      ${showStatusWarning ? `<div class="validation-error" style="margin-bottom:16px;">Guest Folio is usually generated for checked-in reservations.</div>` : ""}
      <article class="print-card guest-folio-card">
        <header class="print-header">
          <div>
            <p class="eyebrow">Grand Millado Hotel</p>
            <h1>Guest Folio</h1>
            <p class="muted">${escapeHtml(settings.address)}</p>
            <p class="muted">${escapeHtml(settings.contact)}</p>
          </div>
          <div class="text-right">
            <p class="eyebrow">Folio Number</p>
            <h2 class="font-display mono">${escapeHtml(folioNumber)}</h2>
            <p class="muted">Printed ${escapeHtml(formatDateTime(printedAt))}</p>
          </div>
        </header>

        <section class="print-section">
          <h2>Stay Summary</h2>
          <div class="detail-grid">
            <dl class="detail-kv"><dt>Confirmation</dt><dd>${escapeHtml(reservation.confirmation_number || `Reservation #${reservation.id}`)}</dd></dl>
            <dl class="detail-kv"><dt>Guest</dt><dd>${escapeHtml(guest.full_name || "-")}</dd></dl>
            <dl class="detail-kv"><dt>Email / Phone</dt><dd>${escapeHtml(guest.email || guest.phone || "-")}</dd></dl>
            <dl class="detail-kv"><dt>Room</dt><dd>${escapeHtml(room.room_number || "-")}</dd></dl>
            <dl class="detail-kv"><dt>Room Type</dt><dd>${escapeHtml(roomType.name || "-")}</dd></dl>
            <dl class="detail-kv"><dt>Arrival</dt><dd>${escapeHtml(formatDate(reservation.check_in))}</dd></dl>
            <dl class="detail-kv"><dt>Departure</dt><dd>${escapeHtml(formatDate(reservation.check_out))}</dd></dl>
            <dl class="detail-kv"><dt>Nights</dt><dd>${escapeHtml(String(reservation.nights || 0))}</dd></dl>
            <dl class="detail-kv"><dt>Guests</dt><dd>${escapeHtml(`${reservation.adults || 0} adult(s), ${reservation.children || 0} child(ren)`)}</dd></dl>
            <dl class="detail-kv"><dt>Front Desk</dt><dd>${escapeHtml(reservation.checked_in_by_profile?.full_name || reservation.created_by_profile?.full_name || "Front Desk")}</dd></dl>
          </div>
        </section>

        <section class="print-section">
          <h2>Itemized Charges</h2>
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
        </section>

        <section class="print-section">
          <h2>Billing Arrangement</h2>
          <div class="detail-grid">
            <dl class="detail-kv"><dt>Subtotal</dt><dd>${escapeHtml(formatCurrency(folio.invoice.subtotal || 0))}</dd></dl>
            <dl class="detail-kv"><dt>Tax</dt><dd>${escapeHtml(formatCurrency(folio.invoice.tax || 0))}</dd></dl>
            <dl class="detail-kv"><dt>Discounts</dt><dd>${escapeHtml(formatCurrency(folio.invoice.discount || 0))}</dd></dl>
            <dl class="detail-kv"><dt>Folio Total</dt><dd>${escapeHtml(formatCurrency(folio.invoice.total || 0))}</dd></dl>
            <dl class="detail-kv"><dt>Downpayment Paid</dt><dd>${escapeHtml(formatCurrency(reservation.downpayment_paid || 0))}</dd></dl>
            <dl class="detail-kv"><dt>Previous Payments</dt><dd>${escapeHtml(formatCurrency(folio.totalPayments || 0))}</dd></dl>
            <dl class="detail-kv"><dt>Incidental Deposit</dt><dd>${escapeHtml(formatCurrency(reservation.incidental_deposit_paid || 0))}</dd></dl>
            <dl class="detail-kv"><dt>Refundable Deposit</dt><dd>${escapeHtml(formatCurrency(folio.refundableAmount || 0))}</dd></dl>
            <dl class="detail-kv"><dt>Balance Due</dt><dd>${escapeHtml(formatCurrency(balanceDue))}</dd></dl>
          </div>
        </section>

        <section class="print-section">
          <h2>Hotel Policies</h2>
          <div class="stack-sm muted">
            <p>1. All posted room, service, amenity, and incidental charges must be reviewed before final checkout.</p>
            <p>2. Any refundable incidental deposit is processed after room and asset inspection, subject to hotel policy.</p>
            <p>3. Disputed charges should be reported to the Front Desk before signing this folio.</p>
            <p>4. By signing, the guest confirms the folio details and authorizes the recorded settlement for this stay.</p>
          </div>
        </section>

        <section class="print-section signature-grid">
          <div class="signature-block">
            <div class="signature-line"></div>
            <strong>${escapeHtml(guest.full_name || "Guest")}</strong>
            <p class="muted">Signature over Printed Name</p>
          </div>
          <div class="signature-block">
            <div class="signature-line"></div>
            <strong>${escapeHtml(reservation.checked_in_by_profile?.full_name || reservation.created_by_profile?.full_name || "Front Desk")}</strong>
            <p class="muted">Signature over Printed Name</p>
          </div>
        </section>
      </article>

      <section id="guest-folio-settlement" class="table-card" style="display:none;">
        <div class="table-toolbar">
          <div>
            <h2 class="font-display" style="margin:0 0 8px;">Checkout Settlement</h2>
            <p class="table-meta">Review the folio, collect any remaining balance, then complete checkout.</p>
          </div>
        </div>
        <form id="guest-folio-settlement-form" class="form-stack">
          <div class="filter-row">
            <div class="field"><label for="charge_description">Last-Minute Charge Description</label><input id="charge_description" name="charge_description" placeholder="Late checkout fee"></div>
            <div class="field"><label for="charge_quantity">Quantity</label><input id="charge_quantity" name="charge_quantity" type="number" min="1" value="1"></div>
          </div>
          <div class="filter-row">
            <div class="field"><label for="charge_unit_price">Unit Price</label><input id="charge_unit_price" name="charge_unit_price" type="number" min="0" step="0.01" value="0"></div>
            <div class="field"><label for="payment_amount">Amount to Collect</label><input id="payment_amount" name="payment_amount" type="number" min="0" step="0.01" value="${balanceDue}" required></div>
          </div>
          <div class="filter-row">
            <div class="field"><label for="payment_method">Payment Method</label><select id="payment_method" name="payment_method">${buildPaymentMethodOptions()}</select></div>
            <div class="field"><label>Payment Date</label><input type="text" value="Automatic on save" readonly></div>
          </div>
          <div class="filter-row">
            <div class="field"><label for="payment_reference">Payment Reference</label><input id="payment_reference" name="payment_reference"></div>
            <div class="field"><label for="payment_notes">Notes</label><input id="payment_notes" name="payment_notes" placeholder="Checkout settlement"></div>
          </div>
          ${isAdmin ? `
            <div class="field">
              <label class="checkbox-label"><input id="allow_override" name="allow_override" type="checkbox"> Allow checkout with unpaid balance</label>
            </div>
            <div class="field">
              <label for="checkout_override_reason">Admin Override Reason</label>
              <textarea id="checkout_override_reason" name="checkout_override_reason"></textarea>
            </div>
          ` : ""}
          <div class="field">
            <label for="checkout_notes">Checkout Notes</label>
            <textarea id="checkout_notes" name="checkout_notes">${escapeHtml(reservation.checkout_notes || "")}</textarea>
          </div>
          <button class="btn btn-primary" type="submit">Complete Checkout</button>
        </form>
      </section>
    </div>
  `;
}

export async function settleGuestFolio({
  reservationId,
  userId,
  isAdmin = false,
  paymentAmount,
  paymentMethod,
  paymentReference,
  paymentNotes,
  chargeDescription,
  chargeQuantity,
  chargeUnitPrice,
  checkoutNotes,
  allowOverride,
  checkoutOverrideReason,
}) {
  const reservation = await getReservation(reservationId);
  await validateReservationCheckOut(reservation);
  const invoice = await createInvoiceFromReservation(reservation);

  const lastMinuteQuantity = Number(chargeQuantity || 0);
  const lastMinuteUnitPrice = Number(chargeUnitPrice || 0);

  if (chargeDescription && lastMinuteQuantity > 0 && lastMinuteUnitPrice >= 0) {
    await saveInvoiceItem({
      invoice_id: invoice.id,
      description: chargeDescription,
      quantity: lastMinuteQuantity,
      unit_price: lastMinuteUnitPrice,
      total: Number((lastMinuteQuantity * lastMinuteUnitPrice).toFixed(2)),
    });
  }

  let folio = await getCheckoutFolio(reservation.id);
  const balanceBeforePayment = Number(folio?.outstandingBalance || 0);
  const amountToCollect = Number(paymentAmount || 0);

  if (balanceBeforePayment > 0) {
    if (amountToCollect <= 0) {
      throw new Error("A checkout payment is required while a balance remains due.");
    }
    if (!paymentMethod) {
      throw new Error("Payment method is required.");
    }
    if (amountToCollect > balanceBeforePayment && !isAdmin) {
      throw new Error("Overpayment requires Admin handling.");
    }

    await savePayment({
      invoice_id: invoice.id,
      reservation_id: reservation.id,
      amount: amountToCollect,
      payment_method: paymentMethod,
      payment_reference: paymentReference || null,
      payment_status: "Paid",
      paid_at: new Date().toISOString(),
      notes: paymentNotes || "Checkout settlement",
      received_by: userId,
      transaction_type: TRANSACTION_TYPE_CHECKOUT,
    });
  }

  folio = await getCheckoutFolio(reservation.id);
  const outstandingBalance = Number(folio?.outstandingBalance || 0);
  if (outstandingBalance > 0) {
    if (!isAdmin) {
      throw new Error("Staff cannot complete checkout while a balance remains unpaid.");
    }
    if (!allowOverride || !String(checkoutOverrideReason || "").trim()) {
      throw new Error("Admin override requires a reason.");
    }
  }

  const updated = await updateReservationStatus(reservation.id, "Checked Out", {
    checked_out_at: new Date().toISOString(),
    checked_out_by: userId,
    checkout_notes: checkoutNotes || null,
    checkout_override_reason: allowOverride ? checkoutOverrideReason || null : null,
  });

  await saveHousekeepingTask({
    room_id: reservation.room_id,
    task_type: "Checkout Turnover",
    priority: "High",
    status: "Pending",
    due_date: new Date().toISOString().slice(0, 10),
    notes: `Auto-created after checkout for ${updated.confirmation_number || updated.id}`,
  });

  return {
    reservation: updated,
    folio: await getCheckoutFolio(reservation.id),
  };
}
