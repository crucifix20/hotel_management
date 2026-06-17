import { PAYMENT_STATUSES, RESERVATION_STATUSES, HOTEL_SERVICE_CATEGORIES } from "../config.js";
import { initProtectedPage } from "../router.js";
import { getReportsFiltersData, getReportsSnapshot } from "../services/reportsService.js";
import { buildSelectOptions, createOptionList, escapeHtml, formatCurrency, formatDate, formatDateTime, monthStartIso, render, serializeForm, todayIso } from "../utils.js";
import { createEmptyState, createPageHeader, createStatusBadge, showToast } from "../ui.js";

function toCsv(rows) {
  return rows.map((row) => row.map((value) => {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
  }).join(",")).join("\n");
}

function exportCsv(filename, rows) {
  const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function tableSection({ id, title, subtitle, headers, rows, emptyCopy }) {
  return `
    <section class="stitch-overview-card report-section" data-report-section="${id}">
      <div class="stitch-overview-head">
        <div>
          <h2>${title}</h2>
          <p>${subtitle}</p>
        </div>
        <div class="button-row report-actions">
          <button class="btn btn-ghost report-export-button" data-report-id="${id}" type="button">Export CSV</button>
        </div>
      </div>
      ${rows.length ? `
        <div class="table-wrap">
          <table class="stitch-overview-table">
            <thead><tr>${headers.map((header) => `<th>${header}</th>`).join("")}</tr></thead>
            <tbody>
              ${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}
            </tbody>
          </table>
        </div>
      ` : createEmptyState({ title: "No data", copy: emptyCopy })}
    </section>
  `;
}

await initProtectedPage("reports", async ({ root }) => {
  const filterOptions = await getReportsFiltersData();
  let filters = {
    dateFrom: monthStartIso(),
    dateTo: todayIso(),
    roomTypeId: "",
    reservationStatus: "",
    paymentStatus: "",
    vipStatus: "",
    serviceCategory: "",
    clubId: "",
  };

  async function load() {
    const snapshot = await getReportsSnapshot(filters);

    const arrivalsRows = snapshot.arrivals.map((row) => ([
      escapeHtml(row.confirmation_number || row.id),
      escapeHtml(row.guests?.full_name || "-"),
      escapeHtml(row.rooms?.room_number || "-"),
      escapeHtml(row.rooms?.room_types?.name || "-"),
      escapeHtml(formatDate(row.check_in)),
      createStatusBadge(row.status),
      createStatusBadge(row.downpayment_status || "Not Required"),
      escapeHtml(formatCurrency(row.balance_due || 0)),
    ]));

    const departuresRows = snapshot.departures.map((row) => {
      const invoice = (row.invoices || [])[0];
      const paid = (invoice?.payments || []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
      return [
        escapeHtml(row.confirmation_number || row.id),
        escapeHtml(row.guests?.full_name || "-"),
        escapeHtml(row.rooms?.room_number || "-"),
        escapeHtml(row.rooms?.room_types?.name || "-"),
        escapeHtml(formatDate(row.check_out)),
        escapeHtml(formatCurrency(invoice?.total || 0)),
        escapeHtml(formatCurrency(Math.max(Number(invoice?.total || 0) - paid, 0))),
        createStatusBadge(row.status),
      ];
    });

    const outstandingRows = snapshot.outstandingBalances.map((invoice) => ([
      escapeHtml(invoice.guests?.full_name || "-"),
      escapeHtml(invoice.reservations?.confirmation_number || "-"),
      escapeHtml(invoice.invoice_number || "-"),
      escapeHtml(formatCurrency(invoice.total || 0)),
      escapeHtml(formatCurrency(invoice.paidAmount || 0)),
      escapeHtml(formatCurrency(invoice.balanceDue || 0)),
      createStatusBadge(invoice.status),
      escapeHtml(formatDate(invoice.lastPaymentDate)),
    ]));

    const serviceRows = snapshot.serviceRevenueReport.map((item) => ([
      escapeHtml(item.serviceName),
      escapeHtml(item.category),
      escapeHtml(String(item.quantitySold)),
      escapeHtml(formatCurrency(item.grossRevenue)),
      escapeHtml(formatCurrency(item.discountsApplied)),
      escapeHtml(formatCurrency(item.netRevenue)),
    ]));

    const auditRows = snapshot.audit.map((row) => ([
      escapeHtml(row.users_profile?.full_name || "-"),
      escapeHtml(row.users_profile?.role || "-"),
      escapeHtml(row.action),
      escapeHtml(row.entity_type),
      escapeHtml(String(row.entity_id || "-")),
      escapeHtml(formatDateTime(row.created_at)),
      escapeHtml(row.details || "-"),
    ]));

    const housekeepingRows = snapshot.housekeeping.map((row) => ([
      escapeHtml(row.rooms?.room_number || "-"),
      escapeHtml(row.task_type || "-"),
      escapeHtml(row.staff?.full_name || "Unassigned"),
      createStatusBadge(row.status),
      escapeHtml(row.priority || "-"),
      escapeHtml(formatDate(row.due_date)),
    ]));

    const benefitUsageRows = snapshot.clubs.benefitUsage.map((row) => ([
      escapeHtml(row.guests?.full_name || "-"),
      escapeHtml(row.club_registrations?.clubs?.name || "-"),
      escapeHtml(row.club_benefits?.title || "-"),
      escapeHtml(formatCurrency(row.amount_discounted || 0)),
      escapeHtml(formatDateTime(row.used_at)),
    ]));

    render(root, `
      ${createPageHeader({
        title: "Reports",
        subtitle: "Operational reporting, print-ready summaries, and exportable executive views.",
        actions: `
          <button class="btn btn-secondary" id="print-report-button" type="button">Print Report</button>
          <button class="btn btn-primary" id="reload-reports-button" type="button">Refresh</button>
        `,
      })}
      <section class="stitch-overview-card report-filters">
        <div class="stitch-overview-head">
          <div>
            <h2>Report Filters</h2>
            <p>Apply a date range and operational filters across all Admin reports.</p>
          </div>
        </div>
        <form id="report-filter-form" class="form-stack">
          <div class="report-filter-grid">
            <div class="field"><label for="dateFrom">Date From</label><input id="dateFrom" name="dateFrom" type="date" value="${filters.dateFrom}"></div>
            <div class="field"><label for="dateTo">Date To</label><input id="dateTo" name="dateTo" type="date" value="${filters.dateTo}"></div>
            <div class="field"><label for="roomTypeId">Room Type</label><select id="roomTypeId" name="roomTypeId">${createOptionList(filterOptions.roomTypes, "id", "name", "All room types")}</select></div>
            <div class="field"><label for="reservationStatus">Reservation Status</label><select id="reservationStatus" name="reservationStatus">${buildSelectOptions(RESERVATION_STATUSES, "All statuses")}</select></div>
            <div class="field"><label for="paymentStatus">Payment Status</label><select id="paymentStatus" name="paymentStatus">${buildSelectOptions(PAYMENT_STATUSES, "All payment states")}</select></div>
            <div class="field"><label for="vipStatus">Guest / VIP Status</label><select id="vipStatus" name="vipStatus"><option value="">All guests</option><option value="VIP">VIP only</option><option value="Standard">Standard only</option></select></div>
            <div class="field"><label for="serviceCategory">Service Category</label><select id="serviceCategory" name="serviceCategory">${buildSelectOptions(HOTEL_SERVICE_CATEGORIES, "All service categories")}</select></div>
            <div class="field"><label for="clubId">Club</label><select id="clubId" name="clubId">${createOptionList(filterOptions.clubs, "id", "name", "All clubs")}</select></div>
          </div>
          <div class="button-row">
            <button class="btn btn-primary" type="submit">Apply Filters</button>
            <button class="btn btn-ghost" id="clear-report-filters-button" type="button">Clear Filters</button>
          </div>
        </form>
      </section>
      <section class="stitch-kpi-grid">
        <article class="stitch-kpi-card"><h3>Arrivals</h3><div class="stitch-kpi-value">${snapshot.arrivals.length}</div><p class="stitch-kpi-note">Arrivals within the selected range</p></article>
        <article class="stitch-kpi-card"><h3>Departures</h3><div class="stitch-kpi-value">${snapshot.departures.length}</div><p class="stitch-kpi-note">Departures within the selected range</p></article>
        <article class="stitch-kpi-card"><h3>Occupancy</h3><div class="stitch-kpi-value">${snapshot.occupancy.occupancyPercentage}%</div><p class="stitch-kpi-note">${snapshot.occupancy.occupiedRooms} occupied of ${snapshot.occupancy.totalRooms} rooms</p></article>
        <article class="stitch-kpi-card"><h3>Net Revenue</h3><div class="stitch-kpi-value">${formatCurrency(snapshot.revenue.netRevenue)}</div><p class="stitch-kpi-note">${formatCurrency(snapshot.revenue.outstandingBalances)} still outstanding</p></article>
      </section>
      <section class="split-grid report-summary-grid" style="margin-top:24px;">
        <div class="stitch-overview-card">
          <div class="stitch-overview-head"><div><h2>Occupancy Summary</h2><p>Current room distribution and room-type performance.</p></div></div>
          <div class="detail-grid">
            <dl class="detail-kv"><dt>Total Rooms</dt><dd>${snapshot.occupancy.totalRooms}</dd></dl>
            <dl class="detail-kv"><dt>Available</dt><dd>${snapshot.occupancy.availableRooms}</dd></dl>
            <dl class="detail-kv"><dt>Reserved</dt><dd>${snapshot.occupancy.reservedRooms}</dd></dl>
            <dl class="detail-kv"><dt>Cleaning</dt><dd>${snapshot.occupancy.cleaningRooms}</dd></dl>
            <dl class="detail-kv"><dt>Maintenance</dt><dd>${snapshot.occupancy.maintenanceRooms}</dd></dl>
            <dl class="detail-kv"><dt>Occupied</dt><dd>${snapshot.occupancy.occupiedRooms}</dd></dl>
          </div>
          <div class="table-wrap" style="margin-top:18px;">
            <table class="stitch-overview-table">
              <thead><tr><th>Room Type</th><th>Total Rooms</th><th>Occupied</th><th>Occupancy %</th></tr></thead>
              <tbody>
                ${snapshot.occupancy.occupancyByRoomType.map((item) => `
                  <tr><td>${escapeHtml(item.roomType)}</td><td>${item.totalRooms}</td><td>${item.occupiedRooms}</td><td>${item.occupancyPercentage}%</td></tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>
        <div class="stitch-overview-card">
          <div class="stitch-overview-head"><div><h2>Revenue Summary</h2><p>Room, service, amenity, club, tax, and discount rollups.</p></div></div>
          <div class="detail-grid">
            <dl class="detail-kv"><dt>Room Revenue</dt><dd>${formatCurrency(snapshot.revenue.roomRevenue)}</dd></dl>
            <dl class="detail-kv"><dt>Service Revenue</dt><dd>${formatCurrency(snapshot.revenue.serviceRevenue)}</dd></dl>
            <dl class="detail-kv"><dt>Amenity Revenue</dt><dd>${formatCurrency(snapshot.revenue.amenityRevenue)}</dd></dl>
            <dl class="detail-kv"><dt>Club Revenue</dt><dd>${formatCurrency(snapshot.revenue.clubRevenue)}</dd></dl>
            <dl class="detail-kv"><dt>Discounts</dt><dd>${formatCurrency(snapshot.revenue.discounts)}</dd></dl>
            <dl class="detail-kv"><dt>Taxes</dt><dd>${formatCurrency(snapshot.revenue.taxes)}</dd></dl>
            <dl class="detail-kv"><dt>Payments Collected</dt><dd>${formatCurrency(snapshot.revenue.paymentsCollected)}</dd></dl>
            <dl class="detail-kv"><dt>Refunds</dt><dd>${formatCurrency(snapshot.revenue.refunds)}</dd></dl>
          </div>
        </div>
      </section>
      ${tableSection({ id: "arrivals", title: "Daily Arrivals Report", subtitle: "Operational arrivals, downpayments, and balances.", headers: ["Confirmation", "Guest", "Room", "Room Type", "Check-In", "Status", "Downpayment", "Balance"], rows: arrivalsRows, emptyCopy: "No arrivals matched the selected filters." })}
      ${tableSection({ id: "departures", title: "Daily Departures Report", subtitle: "Departure ledger, folio totals, and checkout progress.", headers: ["Confirmation", "Guest", "Room", "Room Type", "Check-Out", "Folio Total", "Balance", "Checkout Status"], rows: departuresRows, emptyCopy: "No departures matched the selected filters." })}
      ${tableSection({ id: "outstanding", title: "Outstanding Balance Report", subtitle: "Open invoices requiring follow-up.", headers: ["Guest", "Reservation", "Invoice", "Total", "Paid", "Balance Due", "Status", "Last Payment"], rows: outstandingRows, emptyCopy: "No outstanding balances for this filter set." })}
      ${tableSection({ id: "services", title: "Service Revenue Report", subtitle: "Quantity sold, gross revenue, discounts, and net revenue by service.", headers: ["Service", "Category", "Qty", "Gross", "Discounts", "Net"], rows: serviceRows, emptyCopy: "No service revenue rows were found." })}
      <section class="split-grid report-summary-grid" style="margin-top:24px;">
        <div class="stitch-overview-card">
          <div class="stitch-overview-head"><div><h2>VIP Club Report</h2><p>Membership and benefit usage performance.</p></div></div>
          <div class="detail-grid">
            <dl class="detail-kv"><dt>Active Members</dt><dd>${snapshot.vipReport.activeMembers}</dd></dl>
            <dl class="detail-kv"><dt>New Registrations</dt><dd>${snapshot.vipReport.newRegistrations}</dd></dl>
            <dl class="detail-kv"><dt>Expiring</dt><dd>${snapshot.vipReport.expiringMemberships}</dd></dl>
            <dl class="detail-kv"><dt>Club Revenue</dt><dd>${formatCurrency(snapshot.vipReport.clubRevenue)}</dd></dl>
            <dl class="detail-kv"><dt>Benefit Uses</dt><dd>${snapshot.vipReport.benefitUsageCount}</dd></dl>
            <dl class="detail-kv"><dt>Total Discounts</dt><dd>${formatCurrency(snapshot.vipReport.totalDiscountsGiven)}</dd></dl>
          </div>
          <div class="table-wrap" style="margin-top:18px;">
            <table class="stitch-overview-table">
              <thead><tr><th>Level</th><th>Members</th></tr></thead>
              <tbody>
                ${snapshot.vipReport.membersByLevel.map((item) => `<tr><td>${escapeHtml(item.level)}</td><td>${item.count}</td></tr>`).join("") || `<tr><td colspan="2">No level data.</td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
        <div class="stitch-overview-card">
          <div class="stitch-overview-head"><div><h2>Housekeeping Summary</h2><p>Operational housekeeping workload snapshot.</p></div></div>
          <div class="detail-grid">
            <dl class="detail-kv"><dt>Pending</dt><dd>${snapshot.housekeepingReport.pendingTasks}</dd></dl>
            <dl class="detail-kv"><dt>In Progress</dt><dd>${snapshot.housekeepingReport.inProgressTasks}</dd></dl>
            <dl class="detail-kv"><dt>Completed</dt><dd>${snapshot.housekeepingReport.completedTasks}</dd></dl>
            <dl class="detail-kv"><dt>Overdue</dt><dd>${snapshot.housekeepingReport.overdueTasks}</dd></dl>
          </div>
          <div class="table-wrap" style="margin-top:18px;">
            <table class="stitch-overview-table">
              <thead><tr><th>Staff</th><th>Tasks</th></tr></thead>
              <tbody>
                ${snapshot.housekeepingReport.tasksByStaff.map((item) => `<tr><td>${escapeHtml(item.staffName)}</td><td>${item.count}</td></tr>`).join("") || `<tr><td colspan="2">No staff task data.</td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
      </section>
      ${tableSection({ id: "benefit-usage", title: "VIP Benefit Usage", subtitle: "Discounts and complimentary benefits applied to stays and services.", headers: ["Guest", "Club", "Benefit", "Discount", "Used At"], rows: benefitUsageRows, emptyCopy: "No club benefit usage matched the selected range." })}
      ${tableSection({ id: "housekeeping", title: "Housekeeping Report", subtitle: "Task status, assignment, and room readiness follow-up.", headers: ["Room", "Task", "Staff", "Status", "Priority", "Due"], rows: housekeepingRows, emptyCopy: "No housekeeping activity matched the selected filters." })}
      ${tableSection({ id: "audit", title: "Night Audit / Activity Report", subtitle: "Evidence of reservation, cashiering, checkout, room, and staff actions by user and time.", headers: ["User", "Role", "Action", "Entity Type", "Entity ID", "Date / Time", "Details"], rows: auditRows, emptyCopy: "No audit activity matched the selected range." })}
    `);

    document.getElementById("roomTypeId").value = filters.roomTypeId;
    document.getElementById("reservationStatus").value = filters.reservationStatus;
    document.getElementById("paymentStatus").value = filters.paymentStatus;
    document.getElementById("vipStatus").value = filters.vipStatus;
    document.getElementById("serviceCategory").value = filters.serviceCategory;
    document.getElementById("clubId").value = filters.clubId;

    document.getElementById("report-filter-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      filters = { ...filters, ...serializeForm(event.currentTarget) };
      await load();
    });

    document.getElementById("clear-report-filters-button").addEventListener("click", async () => {
      filters = {
        dateFrom: monthStartIso(),
        dateTo: todayIso(),
        roomTypeId: "",
        reservationStatus: "",
        paymentStatus: "",
        vipStatus: "",
        serviceCategory: "",
        clubId: "",
      };
      await load();
    });

    document.getElementById("print-report-button").addEventListener("click", () => window.print());
    document.getElementById("reload-reports-button").addEventListener("click", async () => {
      await load();
      showToast("Reports refreshed.", "success");
    });

    const exports = {
      arrivals: [["Confirmation", "Guest", "Room", "Room Type", "Check-In", "Status", "Downpayment", "Balance"], ...snapshot.arrivals.map((row) => [row.confirmation_number || row.id, row.guests?.full_name || "-", row.rooms?.room_number || "-", row.rooms?.room_types?.name || "-", formatDate(row.check_in), row.status, row.downpayment_status || "Not Required", row.balance_due || 0])],
      departures: [["Confirmation", "Guest", "Room", "Room Type", "Check-Out", "Folio Total", "Balance", "Checkout Status"], ...snapshot.departures.map((row) => { const invoice = (row.invoices || [])[0]; const paid = (invoice?.payments || []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0); return [row.confirmation_number || row.id, row.guests?.full_name || "-", row.rooms?.room_number || "-", row.rooms?.room_types?.name || "-", formatDate(row.check_out), invoice?.total || 0, Math.max(Number(invoice?.total || 0) - paid, 0), row.status]; })],
      outstanding: [["Guest", "Reservation", "Invoice", "Total", "Paid", "Balance Due", "Status", "Last Payment"], ...snapshot.outstandingBalances.map((invoice) => [invoice.guests?.full_name || "-", invoice.reservations?.confirmation_number || "-", invoice.invoice_number || "-", invoice.total || 0, invoice.paidAmount || 0, invoice.balanceDue || 0, invoice.status, formatDate(invoice.lastPaymentDate)])],
      services: [["Service", "Category", "Qty", "Gross", "Discounts", "Net"], ...snapshot.serviceRevenueReport.map((item) => [item.serviceName, item.category, item.quantitySold, item.grossRevenue, item.discountsApplied, item.netRevenue])],
      "benefit-usage": [["Guest", "Club", "Benefit", "Discount", "Used At"], ...snapshot.clubs.benefitUsage.map((row) => [row.guests?.full_name || "-", row.club_registrations?.clubs?.name || "-", row.club_benefits?.title || "-", row.amount_discounted || 0, formatDateTime(row.used_at)])],
      housekeeping: [["Room", "Task", "Staff", "Status", "Priority", "Due"], ...snapshot.housekeeping.map((row) => [row.rooms?.room_number || "-", row.task_type || "-", row.staff?.full_name || "Unassigned", row.status, row.priority, formatDate(row.due_date)])],
      audit: [["User", "Role", "Action", "Entity Type", "Entity ID", "Date / Time", "Details"], ...snapshot.audit.map((row) => [row.users_profile?.full_name || "-", row.users_profile?.role || "-", row.action, row.entity_type, row.entity_id || "-", formatDateTime(row.created_at), row.details || "-"])],
    };

    root.querySelectorAll(".report-export-button").forEach((button) => button.addEventListener("click", () => {
      const reportId = button.dataset.reportId;
      exportCsv(`grand-millado-${reportId}-report.csv`, exports[reportId] || [["No data"]]);
      showToast("CSV export generated.", "success");
    }));
  }

  await load();
});
