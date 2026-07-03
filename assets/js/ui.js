import { APP_NAME, APP_TAGLINE, NAV_ITEMS, WIDE_PAGES } from "./config.js";
import { escapeHtml, formatCurrency, formatDate, formatDateTime, getStoredSettings, initials, normalizeStatus } from "./utils.js";

let modalRoot;
let toastRoot;
let confirmRoot;
const SIDEBAR_STATE_KEY = "tjs_sidebar_state";

function ensureHeadAssets() {
  if (!document.querySelector('link[data-tjs-icons="material-symbols"]')) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap";
    link.dataset.tjsIcons = "material-symbols";
    document.head.appendChild(link);
  }
}

export function ensureUiRoots() {
  ensureHeadAssets();
  modalRoot = document.getElementById("modal-root");
  toastRoot = document.getElementById("toast-root");
  confirmRoot = document.getElementById("confirm-root");

  if (!modalRoot) {
    modalRoot = document.createElement("div");
    modalRoot.id = "modal-root";
    modalRoot.className = "modal-root";
    document.body.appendChild(modalRoot);
  }

  if (!toastRoot) {
    toastRoot = document.createElement("div");
    toastRoot.id = "toast-root";
    toastRoot.className = "toast-root";
    document.body.appendChild(toastRoot);
  }

  if (!confirmRoot) {
    confirmRoot = document.createElement("div");
    confirmRoot.id = "confirm-root";
    confirmRoot.className = "confirm-root";
    document.body.appendChild(confirmRoot);
  }
}

export function enhanceFormAccessibility(scope = document) {
  scope.querySelectorAll("input, select, textarea").forEach((field) => {
    const label = field.id ? scope.querySelector(`label[for="${field.id}"]`) : null;
    if (field.required && label && !label.querySelector(".required-indicator")) {
      label.insertAdjacentHTML("beforeend", ' <span class="required-indicator" aria-hidden="true">*</span>');
    }

    field.addEventListener("invalid", () => field.setAttribute("aria-invalid", "true"));
    field.addEventListener("input", () => field.removeAttribute("aria-invalid"));
    field.addEventListener("change", () => field.removeAttribute("aria-invalid"));
  });
}

function getPreferredShellState() {
  return localStorage.getItem(SIDEBAR_STATE_KEY);
}

function setPreferredShellState(value) {
  localStorage.setItem(SIDEBAR_STATE_KEY, value);
}

function bindShellInteractions() {
  const shell = document.getElementById("app-shell");
  const toggle = document.getElementById("sidebar-toggle");
  const closeTargets = [...document.querySelectorAll("[data-sidebar-close]")];
  const navLinks = [...document.querySelectorAll(".sidebar-link")];

  if (!shell || !toggle) {
    return;
  }

  const desktopQuery = window.matchMedia("(min-width: 1024px)");
  const largeDesktopQuery = window.matchMedia("(min-width: 1440px)");

  const closeSidebar = () => {
    shell.classList.remove("sidebar-open");
    toggle.setAttribute("aria-expanded", "false");
  };

  const openSidebar = () => {
    shell.classList.add("sidebar-open");
    toggle.setAttribute("aria-expanded", "true");
  };

  const syncShellState = () => {
    const preferred = getPreferredShellState();
    const isDesktop = desktopQuery.matches;
    const isLargeDesktop = largeDesktopQuery.matches;

    shell.classList.remove("sidebar-open");

    if (!isDesktop) {
      shell.classList.remove("sidebar-collapsed");
      toggle.setAttribute("aria-expanded", "false");
      return;
    }

    const collapsed = preferred
      ? preferred === "collapsed"
      : !isLargeDesktop;

    shell.classList.toggle("sidebar-collapsed", collapsed);
    toggle.setAttribute("aria-expanded", "false");
  };

  toggle.addEventListener("click", () => {
    if (!desktopQuery.matches) {
      if (shell.classList.contains("sidebar-open")) {
        closeSidebar();
      } else {
        openSidebar();
      }
      return;
    }

    const willCollapse = !shell.classList.contains("sidebar-collapsed");
    shell.classList.toggle("sidebar-collapsed", willCollapse);
    setPreferredShellState(willCollapse ? "collapsed" : "expanded");
  });

  closeTargets.forEach((target) => target.addEventListener("click", closeSidebar));
  navLinks.forEach((link) => link.addEventListener("click", () => {
    if (!desktopQuery.matches) {
      closeSidebar();
    }
  }));

  desktopQuery.addEventListener("change", syncShellState);
  largeDesktopQuery.addEventListener("change", syncShellState);
  syncShellState();
}

export function renderAppShell({ root, profile, currentPage, navItems }) {
  const pageBodyClass = WIDE_PAGES.includes(currentPage) ? "page-body page-wide" : "page-body";

  root.innerHTML = `
    <div class="app-shell" id="app-shell">
      <button class="sidebar-backdrop" type="button" aria-label="Close navigation" data-sidebar-close></button>
      <aside class="sidebar" aria-label="Primary navigation">
        <div class="sidebar-brand">
          <div class="sidebar-brand-mark">
            <span class="material-symbols-outlined icon-fill">hotel_class</span>
          </div>
          <div>
            <h1>${escapeHtml(APP_NAME)}</h1>
            <p>Executive concierge operations</p>
          </div>
        </div>
        <nav class="sidebar-nav">
          ${navItems.map((item) => `
            <a class="sidebar-link ${item.key === currentPage ? "active" : ""}" href="${escapeHtml(item.href)}">
              <span class="material-symbols-outlined ${item.key === currentPage ? "icon-fill" : ""}">${escapeHtml(item.icon || "circle")}</span>
              <span>${escapeHtml(item.label)}</span>
            </a>
          `).join("")}
        </nav>
        <div class="sidebar-footer">
          <a class="btn btn-primary sidebar-cta" href="reservations.html">
            <span class="material-symbols-outlined icon-fill">add_circle</span>
            <span>New Reservation</span>
          </a>
          <div class="sidebar-meta-links">
            ${navItems.some((item) => item.key === "settings") ? `
              <a class="sidebar-meta-link" href="settings.html">
                <span class="material-symbols-outlined">settings</span>
                <span>Settings</span>
              </a>
            ` : ""}
            <button class="sidebar-meta-link" id="logout-button" type="button">
              <span class="material-symbols-outlined">logout</span>
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>
      <div class="content-shell">
        <header class="topbar">
          <button class="icon-button sidebar-toggle" id="sidebar-toggle" type="button" aria-label="Toggle navigation" aria-expanded="false">
            <span class="material-symbols-outlined">menu</span>
          </button>
          <div class="topbar-search-wrap">
            <div class="search-pill">
              <span class="material-symbols-outlined">search</span>
              <input id="global-search" type="search" placeholder="Search reservations, guests, rooms, or confirmations">
            </div>
          </div>
          <div class="topbar-actions">
            <div class="topbar-icons">
              <button class="icon-button" type="button" aria-label="Notifications">
                <span class="material-symbols-outlined">notifications</span>
              </button>
              <button class="icon-button" type="button" aria-label="Calendar">
                <span class="material-symbols-outlined">calendar_month</span>
              </button>
            </div>
            <div class="topbar-divider"></div>
            <div class="profile-chip">
              <div class="profile-copy">
                <strong>${escapeHtml(profile.full_name || "Team Member")}</strong>
                <div class="muted">${escapeHtml(profile.role || "")}</div>
              </div>
              <div class="avatar">${escapeHtml(initials(profile.full_name))}</div>
            </div>
          </div>
        </header>
        <main class="${pageBodyClass}">
          <div id="page-content"></div>
        </main>
      </div>
    </div>
  `;

  ensureUiRoots();
  enhanceFormAccessibility(root);
  bindShellInteractions();
}

export function createPageHeader({ title, subtitle, actions = "" }) {
  return `
    <section class="page-header">
      <div class="page-header-copy">
        <h1>${escapeHtml(title)}</h1>
        <p class="page-subtitle">${escapeHtml(subtitle)}</p>
      </div>
      <div class="button-row page-header-actions">${actions}</div>
    </section>
  `;
}

export function createMetricCard({ title, value, supporting = "" }) {
  return `
    <article class="metric-card">
      <h3>${escapeHtml(title)}</h3>
      <p class="metric-value">${value}</p>
      ${supporting ? `<p class="metric-support">${supporting}</p>` : ""}
    </article>
  `;
}

export function createStatusBadge(status) {
  const normalized = normalizeStatus(status);
  return `<span class="status-badge status-${normalized}">${escapeHtml(status || "Unknown")}</span>`;
}

export function createVipBadge(label = "VIP") {
  return `<span class="vip-badge">${escapeHtml(label)}</span>`;
}

export function createEmptyState({ title, copy }) {
  return `
    <div class="empty-state">
      <span class="material-symbols-outlined">hotel</span>
      <h3 class="font-display">${escapeHtml(title)}</h3>
      <p>${escapeHtml(copy)}</p>
    </div>
  `;
}

export function createLoadingState(message = "Loading data...") {
  return `
    <div class="loading-state">
      <span class="material-symbols-outlined">hourglass_top</span>
      <h3 class="font-display">Please wait</h3>
      <p>${escapeHtml(message)}</p>
    </div>
  `;
}

export function createPageLoadingState(title = "Loading") {
  return `
    <section class="page-header skeleton-page-head">
      <div class="page-header-copy">
        <div class="skeleton-line skeleton-line-lg"></div>
        <div class="skeleton-line skeleton-line-md"></div>
      </div>
      <div class="button-row page-header-actions">
        <div class="skeleton-button"></div>
        <div class="skeleton-button"></div>
      </div>
    </section>
    <section class="skeleton-card-grid" aria-label="${escapeHtml(title)}">
      <article class="skeleton-card"></article>
      <article class="skeleton-card"></article>
      <article class="skeleton-card"></article>
      <article class="skeleton-card"></article>
    </section>
    <section class="table-card skeleton-table-card">
      <div class="table-toolbar">
        <div style="width:100%;">
          <div class="skeleton-line skeleton-line-md"></div>
          <div class="skeleton-line skeleton-line-sm"></div>
        </div>
      </div>
      <div class="skeleton-table-rows">
        <div class="skeleton-table-row"></div>
        <div class="skeleton-table-row"></div>
        <div class="skeleton-table-row"></div>
      </div>
    </section>
  `;
}

export function createDataTable({ title, subtitle = "", toolbar = "", columns = [], rows = "", emptyState }) {
  return `
    <section class="table-card">
      <div class="table-toolbar">
        <div>
          <h2 class="font-display" style="margin:0 0 8px;">${escapeHtml(title)}</h2>
          <p class="table-meta">${escapeHtml(subtitle)}</p>
        </div>
        ${toolbar}
      </div>
      ${rows ? `
        <div class="table-wrap">
          <table>
            <thead>
              <tr>${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}</tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      ` : emptyState || createEmptyState({ title: `No ${title.toLowerCase()} found`, copy: "Adjust your filters or add a new record." })}
    </section>
  `;
}

export function createKeyValueGrid(items) {
  return `
    <div class="detail-grid">
      ${items.map((item) => `
        <dl class="detail-kv">
          <dt>${escapeHtml(item.label)}</dt>
          <dd>${item.value ?? "—"}</dd>
        </dl>
      `).join("")}
    </div>
  `;
}

export function showToast(message, type = "info") {
  ensureUiRoots();
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `<strong>${escapeHtml(APP_NAME)}</strong><div>${escapeHtml(message)}</div>`;
  toastRoot.appendChild(toast);
  window.setTimeout(() => toast.remove(), 3200);
}

export function closeModal() {
  if (!modalRoot) {
    return;
  }
  modalRoot.onclick = null;
  modalRoot.onkeydown = null;
  modalRoot.className = "modal-root";
  modalRoot.innerHTML = "";
}

export function openModal({ title, body, actions = "" }) {
  ensureUiRoots();
  modalRoot.className = "modal-root modal-open";
  modalRoot.innerHTML = `
    <div class="modal-overlay" data-close-modal></div>
    <div class="modal-container">
      <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <header>
          <div class="panel-header">
            <div>
              <p class="eyebrow">Grand Millado Hotel</p>
              <h2 id="modal-title" style="margin:6px 0 0;">${escapeHtml(title)}</h2>
            </div>
            <button class="btn btn-ghost" type="button" data-close-modal>Close</button>
          </div>
        </header>
        <div class="modal-body">
          ${body}
          ${actions ? `<div class="button-row" style="margin-top:18px;">${actions}</div>` : ""}
        </div>
      </div>
    </div>
  `;

  enhanceFormAccessibility(modalRoot);
  modalRoot.querySelector('button[data-close-modal]')?.focus();

  modalRoot.onclick = (event) => {
    if (event.target.closest("[data-close-modal]")) {
      closeModal();
    }
  };

  modalRoot.onkeydown = (event) => {
    if (event.key === "Escape") {
      closeModal();
    }
  };
}

export function confirmDialog({ title, message, confirmLabel = "Confirm", tone = "primary" }) {
  ensureUiRoots();
  return new Promise((resolve) => {
    confirmRoot.className = "confirm-root confirm-open";
    confirmRoot.innerHTML = `
      <div class="confirm-overlay"></div>
      <div class="confirm-container">
        <div class="confirm-card">
          <header>
            <p class="eyebrow">Please confirm</p>
            <h2 style="margin:6px 0 0;">${escapeHtml(title)}</h2>
          </header>
          <div class="modal-body">
            <p>${escapeHtml(message)}</p>
            <div class="button-row" style="margin-top:20px;">
              <button class="btn btn-ghost" type="button" data-confirm-cancel>Cancel</button>
              <button class="btn ${tone === "danger" ? "btn-danger" : "btn-primary"}" type="button" data-confirm-accept>${escapeHtml(confirmLabel)}</button>
            </div>
          </div>
        </div>
      </div>
    `;

    const close = (result) => {
      confirmRoot.className = "confirm-root";
      confirmRoot.innerHTML = "";
      resolve(result);
    };

    confirmRoot.querySelector("[data-confirm-cancel]").addEventListener("click", () => close(false), { once: true });
    confirmRoot.querySelector("[data-confirm-accept]").addEventListener("click", () => close(true), { once: true });
    confirmRoot.querySelector(".confirm-overlay").addEventListener("click", () => close(false), { once: true });
  });
}

export function createTimeline(items, emptyCopy = "No activity available.") {
  if (!items.length) {
    return createEmptyState({ title: "No activity found", copy: emptyCopy });
  }
  return `
    <div class="timeline">
      ${items.map((item) => `
        <article class="timeline-item">
          <strong>${escapeHtml(item.title)}</strong>
          <p class="muted" style="margin:8px 0;">${escapeHtml(item.copy)}</p>
          <small class="muted">${escapeHtml(item.meta)}</small>
        </article>
      `).join("")}
    </div>
  `;
}

export function bookingSuccessActions(reservationId, guestId) {
  return `
    <button class="btn btn-primary" type="button" data-booking-view="${reservationId}">View Booking Details</button>
    <a class="btn btn-secondary" href="booking-confirmation.html?id=${reservationId}">Print Booking Confirmation</a>
    ${guestId ? `<a class="btn btn-ghost" href="guest-details.html?id=${guestId}">Back to Guest Profile</a>` : ""}
  `;
}

export function openBookingSuccessModal(reservation) {
  openModal({
    title: "Reservation saved",
    body: `
      <div class="success-panel">
        <p class="eyebrow">Confirmation</p>
        <h3 class="font-display" style="margin:8px 0 10px;">${escapeHtml(reservation.confirmation_number || `Reservation #${reservation.id}`)}</h3>
        <p class="muted">The booking was saved successfully. You can review the reservation, print the confirmation, or save it as PDF using the browser print dialog.</p>
      </div>
    `,
    actions: bookingSuccessActions(reservation.id, reservation.guest_id),
  });

  modalRoot.querySelector(`[data-booking-view="${reservation.id}"]`)?.addEventListener("click", () => {
    window.location.href = `booking-confirmation.html?id=${reservation.id}`;
  });
}

export function renderBookingConfirmation({ reservation, invoice, payments, amenityItems, clubItems }) {
  const settings = getStoredSettings();
  const room = reservation.rooms || {};
  const roomType = room.room_types || {};
  const guest = reservation.guests || {};
  const creator = reservation.created_by_profile || {};
  const specialRequests = String(reservation.special_requests || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const requestedServices = reservation.service_orders || [];

  const invoiceItems = [
    ...(invoice?.invoice_items || []),
    ...amenityItems,
    ...clubItems,
  ];

  return `
    <div class="print-shell">
      <div class="print-actions">
        <button class="btn btn-primary" id="print-confirmation-button" type="button">Print / Save as PDF</button>
        <a class="btn btn-ghost" href="reservations.html">Back to Reservations</a>
        ${guest.id ? `<a class="btn btn-secondary" href="guest-details.html?id=${guest.id}">Back to Guest Profile</a>` : ""}
      </div>
      <article class="print-card">
        <header class="print-header">
          <div>
            <p class="eyebrow">Grand Millado Hotel</p>
            <h1>Booking Confirmation</h1>
            <p class="muted">${escapeHtml(settings.address)}</p>
            <p class="muted">${escapeHtml(settings.contact)}</p>
          </div>
          <div class="text-right">
            <p class="eyebrow">Confirmation Number</p>
            <h2 class="font-display mono">${escapeHtml(reservation.confirmation_number || `GMH-BOOK-${reservation.id}`)}</h2>
            <p class="muted">Booking Date: ${escapeHtml(formatDate(reservation.created_at))}</p>
          </div>
        </header>
        <section class="print-section">
          <h2>Guest Details</h2>
          ${createKeyValueGrid([
            { label: "Guest Name", value: escapeHtml(guest.full_name || "—") },
            { label: "Guest Email", value: escapeHtml(guest.email || "—") },
            { label: "Guest Phone", value: escapeHtml(guest.phone || "—") },
            { label: "Reservation Status", value: createStatusBadge(reservation.status) },
            { label: "Payment Status", value: createStatusBadge(reservation.payment_status) },
            { label: "Handled By", value: escapeHtml(creator.full_name || "Reservations Team") },
          ])}
        </section>
        <section class="print-section">
          <h2>Stay Details</h2>
          ${createKeyValueGrid([
            { label: "Room Number", value: escapeHtml(room.room_number || "—") },
            { label: "Room Type", value: escapeHtml(roomType.name || "—") },
            { label: "Check In", value: escapeHtml(formatDate(reservation.check_in)) },
            { label: "Check Out", value: escapeHtml(formatDate(reservation.check_out)) },
            { label: "Arrival Date", value: escapeHtml(formatDate(reservation.arrival_date)) },
            { label: "Flight Number", value: escapeHtml(reservation.flight_number || "-") },
            { label: "Departure Date", value: escapeHtml(formatDate(reservation.departure_date)) },
            { label: "Nights", value: escapeHtml(String(reservation.nights || "—")) },
            { label: "Adults / Children", value: escapeHtml(`${reservation.adults || 0} / ${reservation.children || 0}`) },
            { label: "Inclusions", value: escapeHtml(roomType.inclusions || "None recorded.") },
          ])}
          <div class="print-special-requests">
            <strong>Special Requests:</strong>
            ${specialRequests.length ? `
              <ul>
                ${specialRequests.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}
              </ul>
            ` : `<span>None recorded.</span>`}
          </div>
          <div class="print-special-requests">
            <strong>Requested Services:</strong>
            ${requestedServices.length ? `
              <ul>
                ${requestedServices.map((order) => `<li>${escapeHtml(order.hotel_services?.name || "Service")} ${order.notes ? `- ${escapeHtml(order.notes)}` : ""}</li>`).join("")}
              </ul>
            ` : `<span>None recorded.</span>`}
          </div>
        </section>
        <section class="print-section">
          <h2>Billing Summary</h2>
          ${createKeyValueGrid([
            { label: "Room Rate", value: escapeHtml(formatCurrency(reservation.room_rate || 0)) },
            { label: "Subtotal", value: escapeHtml(formatCurrency(invoice?.subtotal ?? reservation.total_amount ?? 0)) },
            { label: "Tax", value: escapeHtml(formatCurrency(invoice?.tax ?? 0)) },
            { label: "Discount", value: escapeHtml(formatCurrency(invoice?.discount ?? 0)) },
            { label: "Total Amount", value: escapeHtml(formatCurrency(invoice?.total ?? reservation.total_amount ?? 0)) },
            { label: "Downpayment Required", value: escapeHtml(formatCurrency(reservation.downpayment_amount || 0)) },
            { label: "Downpayment Paid", value: escapeHtml(formatCurrency(reservation.downpayment_paid || 0)) },
            { label: "Payments Received", value: escapeHtml(formatCurrency(payments.reduce((total, payment) => total + Number(payment.amount || 0), 0))) },
          ])}
          ${invoiceItems.length ? `
            <div class="table-wrap" style="margin-top:18px;">
              <table>
                <thead>
                  <tr><th>Description</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr>
                </thead>
                <tbody>
                  ${invoiceItems.map((item) => `
                    <tr>
                      <td>${escapeHtml(item.description)}</td>
                      <td>${escapeHtml(String(item.quantity || 1))}</td>
                      <td>${escapeHtml(formatCurrency(item.unit_price || 0))}</td>
                      <td>${escapeHtml(formatCurrency(item.total || item.total_amount || 0))}</td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
          ` : ""}
        </section>
        <section class="print-section">
          <h2>Terms & Conditions</h2>
          <ol class="muted print-terms-list">
            <li>Check-in time is 2:00 PM and check-out time is 12:00 PM.</li>
            <li>The hotel is not liable for lost, misplaced, or unattended guest items.</li>
            <li>Room damages, missing items, or property losses caused during the stay will be charged to the guest.</li>
            <li>All room, amenity, and VIP club charges are subject to Grand Millado Hotel policies and applicable taxes.</li>
            <li>Cancellations, amendments, and refund processing follow the confirmed booking policy shared at the time of reservation.</li>
          </ol>
          <div class="signature-grid booking-signatures">
            <div class="signature-block">
              <div class="signature-line">
                <strong>${escapeHtml(guest.full_name || "Guest")}</strong><br>
                Guest Signature
              </div>
            </div>
            <div class="signature-block">
              <div class="signature-line">
                <strong>${escapeHtml(creator.full_name || "Front Office")}</strong><br>
                FO Staff
              </div>
            </div>
          </div>
        </section>
      </article>
    </div>
  `;
}

export function createSummaryPill(label, value) {
  return `<span class="pill"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(String(value))}</span>`;
}

export function formatMoney(value) {
  return formatCurrency(value);
}

export function formatWhen(value) {
  return formatDateTime(value);
}
