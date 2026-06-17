import { PAYMENT_METHODS, PAYMENT_TRANSACTION_TYPES, ROLES } from "../config.js";
import { initProtectedPage } from "../router.js";
import { listStaffTransactions, summarizeTransactions } from "../services/staffAccountingService.js";
import { buildSelectOptions, debounce, escapeHtml, formatCurrency, formatDateTime, qs, render, todayIso } from "../utils.js";
import { createEmptyState, createPageHeader, showToast } from "../ui.js";

await initProtectedPage("staff-accounting", async ({ root, auth }) => {
  const isAdmin = auth.profile.role === ROLES.ADMIN;
  const filters = {
    dateFrom: "",
    dateTo: "",
    transactionType: "",
    paymentMethod: "",
    search: "",
  };

  async function load() {
    try {
      const transactions = await listStaffTransactions({
        userId: auth.user.id,
        isAdmin,
        filters,
      });
      const summary = summarizeTransactions(transactions);

      render(root, `
        ${createPageHeader({
          title: "Cashier Closing",
          subtitle: isAdmin ? "Review and print cashier closing documents across front desk transactions." : "Close your cashier by reviewing the transactions you personally processed.",
          actions: `<button class="btn btn-primary" id="print-ledger-button" type="button">Print Cashier Closing Report</button>`,
        })}
        <section class="stitch-kpi-grid">
          <article class="stitch-kpi-card"><h3>Total Transactions</h3><div class="stitch-kpi-value">${transactions.length}</div><p class="stitch-kpi-note">Matching the current closing filters</p></article>
          <article class="stitch-kpi-card"><h3>Total Collected</h3><div class="stitch-kpi-value">${formatCurrency(summary.totalCollected)}</div><p class="stitch-kpi-note">All visible staff transaction records</p></article>
          <article class="stitch-kpi-card"><h3>Prepared By</h3><div class="stitch-kpi-value" style="font-size:1.5rem;">${escapeHtml(auth.profile.full_name || "Front Desk")}</div><p class="stitch-kpi-note">${escapeHtml(isAdmin ? "Admin / Accounting View" : "Staff Ledger View")}</p></article>
        </section>

        <section class="table-card staff-ledger-print">
          <div class="table-toolbar ledger-filters">
            <div>
              <h2 class="font-display" style="margin:0 0 8px;">Cashier Closing Filters</h2>
              <p class="table-meta">Filter by shift date, transaction type, payment method, guest, confirmation, or receipt reference.</p>
            </div>
            <div class="filter-row" style="min-width:min(900px,100%);">
              <div class="field"><label for="ledger-date-from">Date From</label><input id="ledger-date-from" type="date" value="${filters.dateFrom}"></div>
              <div class="field"><label for="ledger-date-to">Date To</label><input id="ledger-date-to" type="date" value="${filters.dateTo}"></div>
              <div class="field"><label for="ledger-transaction-type">Transaction Type</label><select id="ledger-transaction-type">${buildSelectOptions(PAYMENT_TRANSACTION_TYPES, "All types")}</select></div>
              <div class="field"><label for="ledger-payment-method">Payment Method</label><select id="ledger-payment-method">${buildSelectOptions(PAYMENT_METHODS, "All methods")}</select></div>
              <div class="field"><label for="ledger-search">Search</label><input id="ledger-search" type="search" placeholder="Guest, room, confirmation, reference" value="${escapeHtml(filters.search)}"></div>
            </div>
          </div>

          <div class="detail-grid ledger-summary-print">
            ${Object.entries(summary.totalsByMethod).map(([method, amount]) => `
              <dl class="detail-kv">
                <dt>${escapeHtml(method)}</dt>
                <dd>${escapeHtml(formatCurrency(amount))}</dd>
              </dl>
            `).join("") || `<dl class="detail-kv"><dt>No transactions</dt><dd>${escapeHtml(formatCurrency(0))}</dd></dl>`}
          </div>

          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Transaction Date/Time</th>
                  <th>Type</th>
                  <th>Confirmation</th>
                  <th>Guest</th>
                  <th>Room</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Reference</th>
                  <th>Received By</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                ${transactions.map((transaction) => `
                  <tr>
                    <td>${escapeHtml(formatDateTime(transaction.paid_at || transaction.created_at))}</td>
                    <td>${escapeHtml(transaction.transaction_type || "Payment")}</td>
                    <td>${escapeHtml(transaction.reservations?.confirmation_number || transaction.invoices?.invoice_number || "-")}</td>
                    <td>${escapeHtml(transaction.reservations?.guests?.full_name || "-")}</td>
                    <td>${escapeHtml(transaction.reservations?.rooms?.room_number || "-")}</td>
                    <td>${escapeHtml(formatCurrency(transaction.amount || 0))}</td>
                    <td>${escapeHtml(transaction.payment_method || "-")}</td>
                    <td>${escapeHtml(transaction.payment_reference || "-")}</td>
                    <td>${escapeHtml(transaction.received_by_profile?.full_name || "Front Desk")}</td>
                    <td>${escapeHtml(transaction.notes || "-")}</td>
                  </tr>
                `).join("") || `<tr><td colspan="10">${createEmptyState({ title: "No transactions found", copy: "Adjust the filters or check back after payments are recorded." })}</td></tr>`}
              </tbody>
            </table>
          </div>

          <section class="print-ledger-signatures">
            <div class="signature-block">
              <div class="signature-line"></div>
              <strong>${escapeHtml(auth.profile.full_name || "Front Desk")}</strong>
              <p class="muted">Prepared by</p>
            </div>
            <div class="signature-block">
              <div class="signature-line"></div>
              <strong>${escapeHtml(isAdmin ? auth.profile.full_name || "Accounting Officer" : "Admin / Accounting Officer")}</strong>
              <p class="muted">Reviewed by</p>
            </div>
          </section>
        </section>
      `);

      qs("#ledger-transaction-type").value = filters.transactionType;
      qs("#ledger-payment-method").value = filters.paymentMethod;
      bindEvents();
    } catch (error) {
      showToast(error.message || "Unable to load the staff ledger.", "error");
    }
  }

  function bindEvents() {
    qs("#print-ledger-button")?.addEventListener("click", () => window.print());
    qs("#ledger-date-from")?.addEventListener("change", async (event) => {
      filters.dateFrom = event.target.value;
      await load();
    });
    qs("#ledger-date-to")?.addEventListener("change", async (event) => {
      filters.dateTo = event.target.value;
      await load();
    });
    qs("#ledger-transaction-type")?.addEventListener("change", async (event) => {
      filters.transactionType = event.target.value;
      await load();
    });
    qs("#ledger-payment-method")?.addEventListener("change", async (event) => {
      filters.paymentMethod = event.target.value;
      await load();
    });
    qs("#ledger-search")?.addEventListener("input", debounce(async (event) => {
      filters.search = event.target.value.trim();
      await load();
    }, 250));
  }

  filters.dateFrom = todayIso().slice(0, 8) + "01";
  filters.dateTo = todayIso();
  await load();
});
