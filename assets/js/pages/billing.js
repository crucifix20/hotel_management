import { PAYMENT_METHODS } from "../config.js";
import { initProtectedPage } from "../router.js";
import { createAuditLog } from "../services/auditService.js";
import { createInvoiceFromReservation, getBillingSummary, savePayment } from "../services/billingService.js";
import { listReservations } from "../services/reservationsService.js";
import { buildSelectOptions, friendlyError, formatCurrency, formatDate, qs, render, serializeForm, withFormBusy } from "../utils.js";
import { closeModal, createPageHeader, createStatusBadge, openModal, showToast } from "../ui.js";

await initProtectedPage("billing", async ({ root, auth }) => {
  async function load() {
    const [summary, reservations] = await Promise.all([
      getBillingSummary(),
      listReservations({}),
    ]);
    const invoices = summary.invoices;
    const recentInvoices = invoices.slice(0, 8);
    const collectionRate = summary.totalRevenue ? (((summary.totalRevenue - summary.outstanding) / summary.totalRevenue) * 100).toFixed(1) : "0.0";

    render(root, `
      ${createPageHeader({
        title: "Accounting Ledger",
        subtitle: "Invoices, collections, club revenue, and payment capture for Grand Millado Hotel.",
        actions: `
          <button class="btn btn-secondary" id="create-invoice-button" type="button">Create Invoice</button>
          <button class="btn btn-primary" id="record-payment-button" type="button">Record Payment</button>
        `,
      })}
      <section class="stitch-kpi-grid">
        <article class="stitch-kpi-card">
          <div class="stitch-kpi-iconrow"><span class="stitch-kpi-tag">Revenue</span></div>
          <h3>Total Revenue</h3>
          <div class="stitch-kpi-value">${formatCurrency(summary.totalRevenue)}</div>
          <p class="stitch-kpi-note">Invoice value across all reservations</p>
        </article>
        <article class="stitch-kpi-card">
          <div class="stitch-kpi-iconrow"><span class="stitch-kpi-tag">Outstanding</span></div>
          <h3>Balance Due</h3>
          <div class="stitch-kpi-value">${formatCurrency(summary.outstanding)}</div>
          <p class="stitch-kpi-note">${collectionRate}% collected to date</p>
        </article>
        <article class="stitch-kpi-card">
          <div class="stitch-kpi-iconrow"><span class="stitch-kpi-tag">VIP</span></div>
          <h3>Club Revenue</h3>
          <div class="stitch-kpi-value">${formatCurrency(summary.clubRevenue)}</div>
          <p class="stitch-kpi-note">Membership fees booked through invoices</p>
        </article>
        <article class="stitch-kpi-card">
          <div class="stitch-kpi-iconrow"><span class="stitch-kpi-tag">Services</span></div>
          <h3>Service Revenue</h3>
          <div class="stitch-kpi-value">${formatCurrency(summary.serviceRevenue)}</div>
          <p class="stitch-kpi-note">${invoices.length} invoice records tracked</p>
        </article>
      </section>
      <section class="stitch-main-grid" style="margin-top:24px;">
        <div class="stitch-overview-card">
          <div class="stitch-overview-head">
            <div>
              <h2>Invoice Register</h2>
              <p>${invoices.length} invoices loaded from Supabase.</p>
            </div>
          </div>
          <div class="table-wrap">
            <table class="stitch-overview-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Guest</th>
                  <th>Reservation</th>
                  <th>Status</th>
                  <th>Total</th>
                  <th>Outstanding</th>
                </tr>
              </thead>
              <tbody>
                ${recentInvoices.map((invoice) => {
                  const paid = (invoice.payments || []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
                  const outstanding = Math.max(Number(invoice.total || 0) - paid, 0);
                  return `
                    <tr${outstanding > 0 ? ` class="highlight"` : ""}>
                      <td><strong>${invoice.invoice_number}</strong><div class="muted">${formatDate(invoice.created_at)}</div></td>
                      <td>${invoice.guests?.full_name || "-"}</td>
                      <td>${invoice.reservations?.confirmation_number || "-"}</td>
                      <td>${createStatusBadge(invoice.status)}</td>
                      <td>${formatCurrency(invoice.total)}</td>
                      <td>${formatCurrency(outstanding)}</td>
                    </tr>
                  `;
                }).join("")}
              </tbody>
            </table>
          </div>
        </div>
        <aside class="stitch-arrivals-card">
          <div class="stitch-section-head">
            <div>
              <h2>Outstanding Balances</h2>
              <p>Reservations with remaining amounts due.</p>
            </div>
          </div>
          ${invoices
            .filter((invoice) => {
              const paid = (invoice.payments || []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
              return paid < Number(invoice.total || 0);
            })
            .slice(0, 6)
            .map((invoice) => {
              const paid = (invoice.payments || []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
              return `
                <article class="stitch-arrival-item">
                  <div class="stitch-arrival-copy">
                    <strong>${invoice.guests?.full_name || "Guest"}</strong>
                    <small>${invoice.invoice_number} &bull; ${invoice.reservations?.confirmation_number || "No reservation"}</small>
                  </div>
                  <div class="stitch-arrival-time">
                    <strong>${formatCurrency(Number(invoice.total || 0) - paid)}</strong>
                    <small>outstanding</small>
                  </div>
                </article>
              `;
            }).join("") || `<div class="empty-state"><h3 class="font-display">No outstanding balances</h3><p>All invoices are currently settled.</p></div>`}
        </aside>
      </section>
    `);

    qs("#create-invoice-button").addEventListener("click", () => {
      openModal({
        title: "Create Invoice from Reservation",
        body: `
          <form id="invoice-form" class="form-stack">
            <div class="field">
              <label for="reservation_id">Reservation</label>
              <select id="reservation_id" name="reservation_id" required>
                <option value="">Select reservation</option>
                ${reservations.map((reservation) => `<option value="${reservation.id}">${reservation.confirmation_number || reservation.id} &bull; ${reservation.guests?.full_name || "Guest"}</option>`).join("")}
              </select>
            </div>
            <button class="btn btn-primary" type="submit">Create Invoice</button>
          </form>
        `,
      });

      qs("#invoice-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        try {
          await withFormBusy(event.currentTarget, "Creating...", async () => {
            const reservationId = Number(new FormData(event.currentTarget).get("reservation_id"));
            const reservation = reservations.find((item) => item.id === reservationId);
            await createInvoiceFromReservation(reservation);
            await createAuditLog({
              userId: auth.user.id,
              action: "Created invoice",
              entityType: "invoices",
              details: `Reservation ${reservation.confirmation_number || reservation.id}`,
            });
            await load();
            closeModal();
            showToast("Invoice created.", "success");
          });
        } catch (error) {
          showToast(friendlyError(error), "error");
        }
      });
    });

    qs("#record-payment-button").addEventListener("click", () => {
      openModal({
        title: "Record Payment",
        body: `
          <form id="payment-form" class="form-stack">
            <div class="field">
              <label for="invoice_id">Invoice</label>
              <select id="invoice_id" name="invoice_id" required>
                <option value="">Select invoice</option>
                ${invoices.map((invoice) => `<option value="${invoice.id}">${invoice.invoice_number} &bull; ${invoice.guests?.full_name || "Guest"}</option>`).join("")}
              </select>
            </div>
            <div class="filter-row">
              <div class="field">
                <label for="amount">Amount</label>
                <input id="amount" name="amount" type="number" min="0" step="0.01" required>
              </div>
              <div class="field">
                <label for="payment_method">Method</label>
                <select id="payment_method" name="payment_method" required>${buildSelectOptions(PAYMENT_METHODS, "Select payment method")}</select>
              </div>
            </div>
            <div class="field">
              <label for="payment_reference">Reference</label>
              <input id="payment_reference" name="payment_reference" placeholder="Card auth, bank transfer ref, e-wallet ref">
            </div>
            <button class="btn btn-primary" type="submit">Record Payment</button>
          </form>
        `,
      });

      qs("#payment-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        try {
          await withFormBusy(event.currentTarget, "Recording...", async () => {
            const payload = serializeForm(event.currentTarget);
            payload.invoice_id = Number(payload.invoice_id);
            payload.amount = Number(payload.amount);
            payload.payment_status = "Paid";
            payload.paid_at = new Date().toISOString();
            await savePayment(payload);
            await createAuditLog({
              userId: auth.user.id,
              action: "Recorded payment",
              entityType: "payments",
              details: `${payload.payment_method} - ${formatCurrency(payload.amount)}`,
            });
            await load();
            closeModal();
            showToast("Payment recorded.", "success");
          });
        } catch (error) {
          showToast(friendlyError(error), "error");
        }
      });
    });
  }

  await load();
});
