import { DEFAULT_DOWNPAYMENT_RATE, DOWNPAYMENT_STATUSES, PAYMENT_METHODS, PAYMENT_STATUSES, RESERVATION_STATUSES, ROLES } from "../config.js";
import { initProtectedPage } from "../router.js";
import { createAuditLog } from "../services/auditService.js";
import { createInvoiceFromReservation, getCheckoutFolio, getReservationInvoice, saveInvoiceItem, savePayment } from "../services/billingService.js";
import { listActiveMembershipsForGuest } from "../services/clubsService.js";
import { findPotentialDuplicateGuests, listGuestOptions, saveGuest } from "../services/guestsService.js";
import { saveHousekeepingTask } from "../services/housekeepingService.js";
import { listReservations, getAvailableRooms, getReservation, saveReservation, updateReservationStatus, validateReservationCheckIn, validateReservationCheckOut } from "../services/reservationsService.js";
import { listRooms, listRoomTypes } from "../services/roomsService.js";
import { buildSelectOptions, createOptionList, debounce, escapeHtml, friendlyError, formatCurrency, formatDate, qs, render, serializeForm, todayIso, withFormBusy } from "../utils.js";
import { closeModal, confirmDialog, createEmptyState, createLoadingState, createPageHeader, createStatusBadge, openBookingSuccessModal, openModal, showToast } from "../ui.js";

await initProtectedPage("reservations", async ({ root, auth }) => {
  const isAdmin = auth.profile.role === ROLES.ADMIN;
  let guestOptions = [];
  let roomOptions = [];
  let roomTypes = [];
  let filters = { status: "", search: "" };

  function roundCurrency(value) {
    return Number(Number(value || 0).toFixed(2));
  }

  const TRANSACTION_TYPE_DOWNPAYMENT = "Reservation Downpayment";
  const TRANSACTION_TYPE_CHECKIN = "Check-In Payment";
  const TRANSACTION_TYPE_CHECKOUT = "Checkout Payment";
  const TRANSACTION_TYPE_INCIDENTAL = "Incidental Deposit";

  function computeRequiredDownpayment(totalAmount) {
    return roundCurrency(Number(totalAmount || 0) * DEFAULT_DOWNPAYMENT_RATE);
  }

  function isValidEmail(value) {
    if (!value) {
      return true;
    }
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
  }

  function buildGuestLabel(guest) {
    const parts = [guest.full_name];
    if (guest.email) {
      parts.push(guest.email);
    }
    return parts.filter(Boolean).join(" · ");
  }

  function getReservationActionMarkup(reservation) {
    const status = reservation.status;
    const canCheckIn = ["Pending", "Confirmed"].includes(status);
    const canCheckOut = status === "Checked In";
    const canCancel = !["Checked Out", "Cancelled", "No Show"].includes(status);
    const canEdit = !["Checked Out", "Cancelled", "No Show"].includes(status) || isAdmin;
    const canAddPayment = ["Pending", "Confirmed", "Checked In"].includes(status);

    return `
      <div class="reservation-actions">
        <div class="reservation-links">
          <a class="link-action" href="booking-confirmation.html?id=${reservation.id}">Confirmation</a>
          ${status === "Checked In" || status === "Checked Out" ? `<a class="link-action" href="guest-folio.html?id=${reservation.id}">Guest Folio</a>` : ""}
          ${status === "Checked Out" ? `<a class="link-action" href="checkout-receipt.html?id=${reservation.id}">Receipt</a>` : ""}
        </div>
        <div class="reservation-action-grid">
          ${canEdit ? `<button class="btn btn-ghost reservation-edit-button" data-id="${reservation.id}" type="button">Edit</button>` : ""}
          ${canCheckIn ? `<button class="btn btn-ghost reservation-checkin-button" data-id="${reservation.id}" type="button">Check In</button>` : ""}
          ${canAddPayment ? `<button class="btn btn-ghost reservation-payment-button" data-id="${reservation.id}" type="button">Add Payment</button>` : ""}
          ${canCheckOut ? `<button class="btn btn-ghost reservation-checkout-button" data-id="${reservation.id}" type="button">Check Out</button>` : ""}
          ${canCancel ? `<button class="btn btn-danger reservation-cancel-button" data-id="${reservation.id}" type="button">Cancel</button>` : ""}
        </div>
        <div class="reservation-action-note muted">
          ${status === "Checked In" ? "Guest is already checked in." : ""}
          ${status === "Checked Out" ? "Stay completed. Receipt is available." : ""}
          ${status === "Cancelled" ? "Reservation already cancelled." : ""}
          ${status === "No Show" ? "Reservation marked as no-show." : ""}
        </div>
      </div>
    `;
  }

  function getReservationStatusMarkup(reservation) {
    const financialBadges = [createStatusBadge(reservation.payment_status)];
    const downpaymentStatus = reservation.downpayment_status || DOWNPAYMENT_STATUSES[0];

    if (
      reservation.downpayment_required
      && ["Required", "Partially Paid", "Paid"].includes(downpaymentStatus)
    ) {
      financialBadges.push(createStatusBadge(downpaymentStatus));
    }

    return `
      <div class="reservation-status-stack">
        <div class="reservation-status-primary">
          ${createStatusBadge(reservation.status)}
        </div>
        <div class="reservation-status-financial">
          ${financialBadges.join("")}
        </div>
      </div>
    `;
  }

  async function load() {
    [guestOptions, roomOptions, roomTypes] = await Promise.all([
      listGuestOptions(),
      listRooms({}),
      listRoomTypes(),
    ]);

    const reservations = await listReservations(filters);
    const inHouseCount = reservations.filter((reservation) => reservation.status === "Checked In").length;
    const pendingCheckIns = reservations.filter((reservation) => reservation.status === "Confirmed" || reservation.status === "Pending").length;
    const pendingCheckOuts = reservations.filter((reservation) => reservation.status === "Checked In").length;
    const unpaidBalances = reservations.filter((reservation) => Number(reservation.balance_due || 0) > 0).length;

    render(root, `
      ${createPageHeader({
        title: "Reservation Ledger",
        subtitle: "Availability-aware bookings, downpayments, check-in, folio settlement, and operational reservation control.",
        actions: `
          <a class="btn btn-secondary" href="reservation-calendar.html">Calendar View</a>
          <button class="btn btn-primary" id="add-reservation-button" type="button">Create Reservation</button>
        `,
      })}
      <section class="stitch-kpi-grid">
        <article class="stitch-kpi-card"><h3>Reservations</h3><div class="stitch-kpi-value">${reservations.length}</div><p class="stitch-kpi-note">Loaded in the current ledger view</p></article>
        <article class="stitch-kpi-card"><h3>Pending Check-Ins</h3><div class="stitch-kpi-value">${pendingCheckIns}</div><p class="stitch-kpi-note">Pending or confirmed arrivals</p></article>
        <article class="stitch-kpi-card"><h3>In-House Guests</h3><div class="stitch-kpi-value">${inHouseCount}</div><p class="stitch-kpi-note">Currently checked in</p></article>
        <article class="stitch-kpi-card"><h3>Pending Check-Outs</h3><div class="stitch-kpi-value">${pendingCheckOuts}</div><p class="stitch-kpi-note">${unpaidBalances} with unpaid balances</p></article>
      </section>
      <section class="table-card">
        <div class="table-toolbar">
          <div>
            <h2 class="font-display" style="margin:0 0 8px;">Reservation Search</h2>
            <p class="table-meta">Search by guest name, email, phone, room number, confirmation, reservation status, or payment status.</p>
          </div>
          <div class="filter-row" style="min-width:min(640px,100%);">
            <div class="field">
              <label for="reservation-filter-status">Reservation Status</label>
              <select id="reservation-filter-status">${buildSelectOptions(RESERVATION_STATUSES, "All statuses")}</select>
            </div>
            <div class="field">
              <label for="reservation-search">Search</label>
              <input id="reservation-search" type="search" placeholder="Sophie, 301, GMH-BOOK, Partial, Paid">
            </div>
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Guest</th>
                <th>Room / Type</th>
                <th>Stay</th>
                <th>Financials</th>
                <th>Status</th>
                <th class="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${reservations.map((reservation) => `
                <tr>
                  <td>
                    <strong style="font-family:'Noto Serif',serif; font-size:1.05rem;">${escapeHtml(reservation.guests?.full_name || "-")}</strong>
                    <div class="muted" style="margin-top:4px;">${escapeHtml(reservation.confirmation_number || `Reservation #${reservation.id}`)}</div>
                    <div class="muted">${escapeHtml(reservation.guests?.email || reservation.guests?.phone || "")}</div>
                  </td>
                  <td>
                    <strong>${escapeHtml(reservation.rooms?.room_number || "Unassigned")}</strong>
                    <div class="muted">${escapeHtml(reservation.rooms?.room_types?.name || "")}</div>
                  </td>
                  <td>
                    <div>${formatDate(reservation.check_in)} to ${formatDate(reservation.check_out)}</div>
                    <div class="muted">${reservation.nights} night(s)</div>
                  </td>
                  <td>
                    <div>${formatCurrency(reservation.total_amount)}</div>
                    <div class="muted">Downpayment: ${formatCurrency(reservation.downpayment_paid)} / ${formatCurrency(reservation.downpayment_amount)}</div>
                    <div class="muted">Balance: ${formatCurrency(reservation.balance_due)}</div>
                  </td>
                  <td>
                    ${getReservationStatusMarkup(reservation)}
                  </td>
                  <td>
                    ${getReservationActionMarkup(reservation)}
                  </td>
                </tr>
              `).join("") || `<tr><td colspan="6">${createEmptyState({ title: "No reservations found", copy: "Adjust your filters or create a new reservation." })}</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>
    `);

    qs("#reservation-filter-status").value = filters.status;
    qs("#reservation-search").value = filters.search;
    bindEvents(reservations);
  }

  function createRoomOptionMarkup(rooms, currentRoom = null) {
    const options = [`<option value="">Select available room</option>`];
    rooms.forEach((room) => {
      options.push(`<option value="${room.id}">${escapeHtml(room.room_number)} · Floor ${room.floor} · ${escapeHtml(room.room_type_name || room.room_types?.name || "")}</option>`);
    });

    if (currentRoom && !rooms.some((room) => Number(room.id) === Number(currentRoom.id))) {
      options.push(`<option value="${currentRoom.id}">${escapeHtml(currentRoom.room_number)} · Current assignment</option>`);
    }

    return options.join("");
  }

  function reservationFormMarkup(reservation = {}) {
    const roomTypeId = reservation.rooms?.room_types?.id || reservation.room_type_id || "";
    const totalAmount = Number(reservation.total_amount || 0);
    const downpaymentAmount = Number(reservation.downpayment_amount || computeRequiredDownpayment(totalAmount));
    const paymentDate = reservation.created_at ? new Date(reservation.created_at).toISOString().slice(0, 10) : todayIso();

    return `
      <form id="reservation-form" class="form-stack">
        <input name="id" type="hidden" value="${reservation.id || ""}">
        <section class="panel" style="padding:18px;">
          <div class="panel-header"><div><h3 style="margin:0;">Guest</h3><p class="muted">Select an existing guest or create one inline without leaving this form.</p></div></div>
          <div class="filter-row">
            <div class="field">
              <label for="guest_id">Existing Guest</label>
              <select id="guest_id" name="guest_id" required>${createOptionList(guestOptions.map((guest) => ({ ...guest, label: buildGuestLabel(guest) })), "id", "label", "Select guest")}</select>
            </div>
            <div class="field">
              <label>&nbsp;</label>
              <button class="btn btn-ghost" id="toggle-new-guest-button" type="button">+ New Guest</button>
            </div>
          </div>
          <section id="new-guest-panel" class="panel" style="display:none; padding:18px; margin-top:12px; background:rgba(255,255,255,.72);">
            <div class="panel-header"><div><h3 style="margin:0;">Create Guest</h3><p class="muted">The reservation form stays open while you add the guest profile.</p></div></div>
            <div class="filter-row">
              <div class="field">
                <label for="new_guest_full_name">Full Name</label>
                <input id="new_guest_full_name" name="new_guest_full_name" placeholder="Guest full name">
              </div>
              <div class="field">
                <label for="new_guest_email">Email</label>
                <input id="new_guest_email" name="new_guest_email" type="email" placeholder="guest@email.com">
              </div>
            </div>
            <div class="filter-row">
              <div class="field">
                <label for="new_guest_phone">Phone</label>
                <input id="new_guest_phone" name="new_guest_phone" placeholder="+63 9xx xxx xxxx">
              </div>
              <div class="field">
                <label for="new_guest_address">Address</label>
                <input id="new_guest_address" name="new_guest_address" placeholder="Mailing address">
              </div>
            </div>
            <div class="filter-row">
              <div class="field">
                <label for="new_guest_preferences">Preferences</label>
                <input id="new_guest_preferences" name="new_guest_preferences" placeholder="High floor, extra pillows">
              </div>
              <div class="field">
                <label class="checkbox-label" style="margin-top:32px;"><input id="new_guest_vip_status" name="new_guest_vip_status" type="checkbox"> Mark as VIP guest</label>
              </div>
            </div>
            <div class="field">
              <label for="new_guest_notes">Notes</label>
              <textarea id="new_guest_notes" name="new_guest_notes" placeholder="Guest notes"></textarea>
            </div>
            <div class="button-row">
              <button class="btn btn-secondary" id="save-new-guest-button" type="button">Save Guest</button>
              <button class="btn btn-ghost" id="cancel-new-guest-button" type="button">Cancel</button>
            </div>
          </section>
        </section>
        <div id="reservation-membership-panel" class="success-panel" style="display:none;"></div>
        <section class="panel" style="padding:18px;">
          <div class="panel-header"><div><h3 style="margin:0;">Stay Details</h3><p class="muted">Reservation status is driven automatically by required downpayment completion.</p></div></div>
          <div class="filter-row">
            <div class="field">
              <label for="check_in">Check-In Date</label>
              <input id="check_in" name="check_in" type="date" value="${reservation.check_in?.slice(0, 10) || ""}" required>
            </div>
            <div class="field">
              <label for="check_out">Check-Out Date</label>
              <input id="check_out" name="check_out" type="date" value="${reservation.check_out?.slice(0, 10) || ""}" required>
            </div>
          </div>
          <div class="filter-row">
            <div class="field">
              <label for="adults">Adults</label>
              <input id="adults" name="adults" type="number" min="1" value="${reservation.adults || 1}" required>
            </div>
            <div class="field">
              <label for="children">Children</label>
              <input id="children" name="children" type="number" min="0" value="${reservation.children || 0}">
            </div>
          </div>
          <div class="success-panel" style="margin-top:8px;">
            <strong>Expected reservation status:</strong>
            <span id="reservation-status-preview">${reservation.status || "Pending"}</span>
          </div>
        </section>
        <section class="panel" style="padding:18px;">
          <div class="panel-header"><div><h3 style="margin:0;">Room Selection</h3><p class="muted">Only rooms available for the selected stay period and room type will appear.</p></div></div>
          <div class="filter-row">
            <div class="field">
              <label for="room_type_id">Room Type</label>
              <select id="room_type_id" name="room_type_id" required>${createOptionList(roomTypes, "id", "name", "Select room type")}</select>
            </div>
            <div class="field">
              <label for="room_id">Available Room Number</label>
              <select id="room_id" name="room_id" required>
                <option value="">Select dates and room type first</option>
              </select>
              <p class="field-help" id="availability-help">Only available rooms for the selected stay period will appear here.</p>
            </div>
          </div>
          <div class="filter-row">
            <div class="field">
              <label for="reservation-total-preview">Reservation Total</label>
              <input id="reservation-total-preview" type="text" value="${formatCurrency(totalAmount)}" readonly>
            </div>
            <div class="field">
              <label>&nbsp;</label>
              <button class="btn btn-ghost" id="clear-room-filters-button" type="button">Clear Filters</button>
            </div>
          </div>
        </section>
        <section class="panel" style="padding:18px;">
          <div class="panel-header"><div><h3 style="margin:0;">Required Downpayment</h3><p class="muted">Every booking requires a ${Math.round(DEFAULT_DOWNPAYMENT_RATE * 100)}% deposit before confirmation.</p></div></div>
          <input id="downpayment_required" name="downpayment_required" type="hidden" value="true">
          <div class="filter-row">
            <div class="field">
              <label for="downpayment_amount">Required Downpayment</label>
              <input id="downpayment_amount" name="downpayment_amount" type="number" min="0" step="0.01" value="${downpaymentAmount}" ${isAdmin ? "" : "readonly"}>
            </div>
            <div class="field">
              <label for="downpayment_paid">Downpayment Paid</label>
              <input id="downpayment_paid" name="downpayment_paid" type="number" min="0.01" step="0.01" value="${reservation.downpayment_paid || downpaymentAmount}" required>
            </div>
          </div>
          <div class="filter-row">
            <div class="field">
              <label for="payment_method">Initial Payment Method</label>
              <select id="payment_method" name="payment_method" required>${buildSelectOptions(PAYMENT_METHODS, "Select payment method")}</select>
            </div>
            <div class="field">
              <label for="payment_date">Payment Date</label>
              <input id="payment_date" name="payment_date" type="date" value="${paymentDate}" required>
            </div>
          </div>
          <div class="filter-row">
            <div class="field">
              <label for="payment_reference">Payment Reference</label>
              <input id="payment_reference" name="payment_reference" value="" placeholder="Card auth, bank ref, wallet ref">
            </div>
            <div class="field">
              <label for="downpayment_status_preview">Downpayment Status</label>
              <input id="downpayment_status_preview" type="text" value="${reservation.downpayment_status || "Required"}" readonly>
            </div>
          </div>
          ${isAdmin ? `
            <div class="field">
              <label for="downpayment_override_reason">Admin Override Reason</label>
              <textarea id="downpayment_override_reason" name="downpayment_override_reason" placeholder="Required only when changing the computed downpayment amount."></textarea>
            </div>
          ` : ""}
        </section>
        <section class="panel" style="padding:18px;">
          <div class="panel-header"><div><h3 style="margin:0;">Requests and Notes</h3><p class="muted">Capture guest requests and internal front desk notes for the stay.</p></div></div>
          <div class="field">
            <label for="special_requests">Guest Requests</label>
            <textarea id="special_requests" name="special_requests">${reservation.special_requests || ""}</textarea>
          </div>
          <div class="field">
            <label for="internal_notes">Internal Staff Notes</label>
            <textarea id="internal_notes" name="internal_notes">${reservation.internal_notes || ""}</textarea>
          </div>
        </section>
        ${isAdmin ? `
          <div class="field">
            <label for="admin_notes">Admin Notes</label>
            <textarea id="admin_notes" name="admin_notes">${reservation.admin_notes || ""}</textarea>
          </div>
        ` : ""}
        <button class="btn btn-primary" type="submit">${reservation.id ? "Save Reservation" : "Create Reservation"}</button>
      </form>
    `;
  }

  async function bindReservationForm(reservation = {}) {
    const originalDates = {
      check_in: reservation.check_in?.slice(0, 10) || "",
      check_out: reservation.check_out?.slice(0, 10) || "",
      room_type_id: String(reservation.rooms?.room_types?.id || reservation.room_type_id || ""),
    };
    const currentRoom = reservation.rooms ? { id: reservation.rooms.id || reservation.room_id, room_number: reservation.rooms.room_number } : null;
    const initialTotal = Number(reservation.total_amount || 0);
    const defaultDownpayment = computeRequiredDownpayment(initialTotal);
    let selectedAvailableRooms = [];

    qs("#guest_id").value = reservation.guest_id || "";
    qs("#room_type_id").value = originalDates.room_type_id;
    qs("#payment_method").value = PAYMENT_METHODS.includes(reservation.payment_method) ? reservation.payment_method : "";
    qs("#downpayment_amount").value = reservation.downpayment_amount || defaultDownpayment || 0;
    qs("#downpayment_paid").value = reservation.downpayment_paid || defaultDownpayment || 0;

    function setNewGuestPanelVisible(visible) {
      qs("#new-guest-panel").style.display = visible ? "block" : "none";
      qs("#toggle-new-guest-button").textContent = visible ? "Hide New Guest" : "+ New Guest";
    }

    function clearNewGuestFields() {
      ["new_guest_full_name", "new_guest_email", "new_guest_phone", "new_guest_address", "new_guest_preferences", "new_guest_notes"].forEach((id) => {
        qs(`#${id}`).value = "";
      });
      qs("#new_guest_vip_status").checked = false;
    }

    function updateStatusPreview() {
      const required = Number(qs("#downpayment_amount").value || 0);
      const paid = Number(qs("#downpayment_paid").value || 0);
      const isPaid = required > 0 && paid >= required;
      qs("#reservation-status-preview").textContent = isPaid ? "Confirmed" : "Pending";
      qs("#downpayment_status_preview").value = isPaid ? "Paid" : paid > 0 ? "Partially Paid" : "Required";
    }

    async function updateMembershipPanel() {
      const guestId = qs("#guest_id").value;
      const panel = qs("#reservation-membership-panel");

      if (!guestId) {
        panel.style.display = "none";
        panel.innerHTML = "";
        return;
      }

      try {
        const memberships = await listActiveMembershipsForGuest(Number(guestId));
        if (!memberships.length) {
          panel.style.display = "none";
          panel.innerHTML = "";
          return;
        }

        panel.style.display = "block";
        panel.innerHTML = `
          <p class="eyebrow">VIP Membership</p>
          <strong>Active club benefits available for this guest</strong>
          <div class="stack-sm" style="margin-top:10px;">
            ${memberships.map((membership) => `
              <div>${escapeHtml(membership.clubs?.name || "VIP Club")} · ${escapeHtml(membership.membership_level || "Member")} · ${(membership.clubs?.club_benefits || []).slice(0, 2).map((benefit) => escapeHtml(benefit.title)).join(", ") || "Benefits available"}</div>
            `).join("")}
          </div>
        `;
      } catch {
        panel.style.display = "none";
      }
    }

    async function refreshAvailableRooms() {
      const checkIn = qs("#check_in").value;
      const checkOut = qs("#check_out").value;
      const roomTypeId = qs("#room_type_id").value;
      const roomSelect = qs("#room_id");
      const help = qs("#availability-help");

      if (!checkIn || !checkOut || !roomTypeId) {
        roomSelect.innerHTML = `<option value="">Select dates and room type first</option>`;
        help.textContent = "Only available rooms for the selected stay period will appear here.";
        return;
      }

      roomSelect.disabled = true;
      roomSelect.innerHTML = `<option value="">Checking room availability...</option>`;
      help.textContent = "Loading available rooms...";

      try {
        selectedAvailableRooms = await getAvailableRooms({
          checkIn,
          checkOut,
          roomTypeId,
          excludeReservationId: reservation.id || null,
        });

        const unchangedFilters = originalDates.check_in === checkIn
          && originalDates.check_out === checkOut
          && originalDates.room_type_id === roomTypeId;

        roomSelect.innerHTML = createRoomOptionMarkup(
          selectedAvailableRooms,
          unchangedFilters ? currentRoom : null,
        );

        if (selectedAvailableRooms.length) {
          help.textContent = `${selectedAvailableRooms.length} available room(s) found.`;
        } else if (unchangedFilters && currentRoom) {
          help.textContent = "Current assigned room remains selectable for this reservation.";
        } else {
          help.textContent = "No available rooms for the selected dates and room type.";
        }

        roomSelect.value = unchangedFilters ? String(reservation.room_id || "") : "";
      } catch (error) {
        roomSelect.innerHTML = `<option value="">Unable to check availability</option>`;
        help.textContent = friendlyError(error);
      } finally {
        roomSelect.disabled = false;
      }
    }

    async function updateTotalPreview() {
      const roomId = qs("#room_id").value;
      const room = selectedAvailableRooms.find((item) => Number(item.id) === Number(roomId))
        || roomOptions.find((item) => Number(item.id) === Number(roomId));
      const checkIn = qs("#check_in").value;
      const checkOut = qs("#check_out").value;

      if (!roomId || !room || !checkIn || !checkOut || checkOut <= checkIn) {
        qs("#reservation-total-preview").value = formatCurrency(0);
        qs("#downpayment_amount").value = 0;
        updateStatusPreview();
        return;
      }

      const nights = Math.max(1, Math.ceil((new Date(checkOut) - new Date(checkIn)) / 86400000));
      const total = roundCurrency(Number(room.rate || 0) * nights);
      const computedDownpayment = computeRequiredDownpayment(total);
      qs("#reservation-total-preview").value = formatCurrency(total);
      if (!reservation.id || !Number(reservation.downpayment_amount || 0) || Number(qs("#downpayment_amount").value || 0) === defaultDownpayment) {
        qs("#downpayment_amount").value = computedDownpayment;
      }
      if (!reservation.id && !Number(qs("#downpayment_paid").value || 0)) {
        qs("#downpayment_paid").value = computedDownpayment;
      }
      updateStatusPreview();
    }

    qs("#guest_id").addEventListener("change", updateMembershipPanel);
    qs("#check_in").addEventListener("change", async () => { await refreshAvailableRooms(); await updateTotalPreview(); });
    qs("#check_out").addEventListener("change", async () => { await refreshAvailableRooms(); await updateTotalPreview(); });
    qs("#room_type_id").addEventListener("change", async () => { await refreshAvailableRooms(); await updateTotalPreview(); });
    qs("#room_id").addEventListener("change", updateTotalPreview);
    qs("#downpayment_paid").addEventListener("input", updateStatusPreview);
    qs("#downpayment_amount").addEventListener("input", updateStatusPreview);

    qs("#toggle-new-guest-button").addEventListener("click", () => {
      setNewGuestPanelVisible(qs("#new-guest-panel").style.display !== "block");
    });
    qs("#cancel-new-guest-button").addEventListener("click", () => {
      clearNewGuestFields();
      setNewGuestPanelVisible(false);
    });

    qs("#save-new-guest-button").addEventListener("click", async () => {
      const newGuest = {
        full_name: qs("#new_guest_full_name").value.trim(),
        email: qs("#new_guest_email").value.trim() || null,
        phone: qs("#new_guest_phone").value.trim() || null,
        address: qs("#new_guest_address").value.trim() || null,
        vip_status: qs("#new_guest_vip_status").checked,
        preferences: qs("#new_guest_preferences").value.trim() || null,
        notes: qs("#new_guest_notes").value.trim() || null,
      };

      try {
        if (!newGuest.full_name) {
          throw new Error("Guest full name is required.");
        }
        if (!isValidEmail(newGuest.email)) {
          throw new Error("Enter a valid guest email address.");
        }

        const duplicates = await findPotentialDuplicateGuests({
          email: newGuest.email,
          phone: newGuest.phone,
        });

        if (duplicates.length) {
          const proceed = await confirmDialog({
            title: "Potential duplicate guest",
            message: `A guest with the same email or phone already exists: ${duplicates.map((guest) => guest.full_name).join(", ")}. Continue creating this guest anyway?`,
            confirmLabel: "Create Guest",
          });
          if (!proceed) {
            return;
          }
        }

        const savedGuest = await saveGuest(newGuest);
        guestOptions = await listGuestOptions();
        qs("#guest_id").innerHTML = createOptionList(guestOptions.map((guest) => ({ ...guest, label: buildGuestLabel(guest) })), "id", "label", "Select guest");
        qs("#guest_id").value = String(savedGuest.id);
        clearNewGuestFields();
        setNewGuestPanelVisible(false);
        await updateMembershipPanel();
        showToast("Guest created and selected for this reservation.", "success");
      } catch (error) {
        showToast(friendlyError(error), "error");
      }
    });

    qs("#clear-room-filters-button").addEventListener("click", () => {
      qs("#check_in").value = "";
      qs("#check_out").value = "";
      qs("#room_type_id").value = "";
      qs("#room_id").innerHTML = `<option value="">Select dates and room type first</option>`;
      qs("#availability-help").textContent = "Only available rooms for the selected stay period will appear here.";
      qs("#reservation-total-preview").value = formatCurrency(0);
      qs("#downpayment_amount").value = 0;
      qs("#downpayment_paid").value = 0;
      updateStatusPreview();
    });

    qs("#reservation-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        await withFormBusy(event.currentTarget, reservation.id ? "Saving..." : "Creating...", async () => {
          const payload = serializeForm(event.currentTarget);
          payload.created_by = auth.user.id;
          payload.downpayment_required = true;
          if (!payload.id) {
            delete payload.id;
          }

          if (!payload.room_id) {
            throw new Error("Select an available room before saving the reservation.");
          }

          const reservationTotal = Number(String(qs("#reservation-total-preview").value).replace(/[^\d.-]/g, "")) || 0;
          const requiredDownpayment = roundCurrency(Number(payload.downpayment_amount || 0));
          const downpaymentPaid = roundCurrency(Number(payload.downpayment_paid || 0));

          if (requiredDownpayment <= 0) {
            throw new Error("Required downpayment must be greater than zero.");
          }
          if (downpaymentPaid <= 0) {
            throw new Error("Downpayment paid is required to save the reservation.");
          }
          if (downpaymentPaid > reservationTotal) {
            throw new Error("Downpayment paid cannot exceed the reservation total.");
          }
          if (!payload.payment_method) {
            throw new Error("Payment method is required when collecting downpayment.");
          }

          const computedDownpayment = computeRequiredDownpayment(reservationTotal);
          if (isAdmin && requiredDownpayment !== computedDownpayment && !payload.downpayment_override_reason?.trim()) {
            throw new Error("Admin override reason is required when changing the computed downpayment.");
          }

          payload.status = downpaymentPaid >= requiredDownpayment ? "Confirmed" : "Pending";
          payload.payment_status = downpaymentPaid >= reservationTotal ? "Paid" : "Partial";

          const saved = await saveReservation(payload);
          const invoice = await createInvoiceFromReservation(saved);
          const desiredDeposit = Number(payload.downpayment_paid || 0);
          const existingInvoice = await getReservationInvoice(saved.id);
          const existingPaid = (existingInvoice?.payments || []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

          if (desiredDeposit > existingPaid) {
            await savePayment({
              invoice_id: invoice.id,
              reservation_id: saved.id,
              amount: desiredDeposit - existingPaid,
              payment_method: payload.payment_method,
              payment_reference: payload.payment_reference || null,
              payment_status: desiredDeposit >= Number(payload.downpayment_amount || 0) ? "Paid" : "Partial",
              paid_at: payload.payment_date ? new Date(`${payload.payment_date}T12:00:00`).toISOString() : new Date().toISOString(),
              notes: payload.downpayment_override_reason?.trim()
                ? `Reservation downpayment override: ${payload.downpayment_override_reason.trim()}`
                : "Reservation downpayment",
              received_by: auth.user.id,
              transaction_type: TRANSACTION_TYPE_DOWNPAYMENT,
            });
          }

          await createAuditLog({
            userId: auth.user.id,
            action: reservation.id ? "Updated reservation" : "Created reservation",
            entityType: "reservations",
            entityId: saved.id,
            details: payload.downpayment_override_reason?.trim()
              ? `${saved.confirmation_number || saved.id} for ${saved.guests?.full_name || "guest"} · downpayment override: ${payload.downpayment_override_reason.trim()}`
              : `${saved.confirmation_number || saved.id} for ${saved.guests?.full_name || "guest"}`,
          });

          await load();
          closeModal();
          showToast("Reservation saved successfully.", "success");
          openBookingSuccessModal(saved);
        });
      } catch (error) {
        showToast(friendlyError(error), "error");
      }
    });

    await updateMembershipPanel();
    await refreshAvailableRooms();
    await updateTotalPreview();
    updateStatusPreview();
  }

  function openReservationEditor(reservation = null) {
    openModal({
      title: reservation ? `Edit ${reservation.confirmation_number || `Reservation #${reservation.id}`}` : "Create Reservation",
      body: reservationFormMarkup(reservation || {}),
    });
    bindReservationForm(reservation || {});
  }

  async function openCheckInModal(id) {
    const reservation = await getReservation(id);
    await validateReservationCheckIn(reservation);

    const remainingRequired = Math.max(Number(reservation.downpayment_amount || 0) - Number(reservation.downpayment_paid || 0), 0);

    openModal({
      title: `Check In · ${reservation.confirmation_number || `Reservation #${reservation.id}`}`,
      body: `
        <form id="checkin-form" class="form-stack">
          <section class="panel" style="padding:18px;">
            <h3 style="margin-top:0;">Reservation Summary</h3>
            <div class="detail-grid">
              <dl class="detail-kv"><dt>Guest</dt><dd>${escapeHtml(reservation.guests?.full_name || "-")}</dd></dl>
              <dl class="detail-kv"><dt>Room</dt><dd>${escapeHtml(reservation.rooms?.room_number || "-")} · ${escapeHtml(reservation.rooms?.room_types?.name || "")}</dd></dl>
              <dl class="detail-kv"><dt>Stay</dt><dd>${formatDate(reservation.check_in)} to ${formatDate(reservation.check_out)}</dd></dl>
              <dl class="detail-kv"><dt>Nights</dt><dd>${reservation.nights}</dd></dl>
              <dl class="detail-kv"><dt>Total</dt><dd>${formatCurrency(reservation.total_amount)}</dd></dl>
              <dl class="detail-kv"><dt>Current Balance</dt><dd>${formatCurrency(reservation.balance_due)}</dd></dl>
            </div>
          </section>
          <section class="panel" style="padding:18px;">
            <h3 style="margin-top:0;">Guest Verification</h3>
            <div class="checkbox-field">
              <label class="checkbox-label"><input name="guest_verified" type="checkbox" ${reservation.guest_verified ? "checked" : ""}> Confirm guest identity</label>
            </div>
            <div class="filter-row">
              <div class="field"><label for="guest_id_type">ID Type</label><input id="guest_id_type" name="guest_id_type" value="${reservation.guest_id_type || ""}"></div>
              <div class="field"><label for="guest_id_number">ID Number</label><input id="guest_id_number" name="guest_id_number" value="${reservation.guest_id_number || ""}"></div>
            </div>
            <div class="field"><label for="check_in_notes">Check-In Notes</label><textarea id="check_in_notes" name="check_in_notes">${reservation.check_in_notes || ""}</textarea></div>
          </section>
          <section class="panel" style="padding:18px;">
            <h3 style="margin-top:0;">Payment Verification</h3>
            <div class="detail-grid">
              <dl class="detail-kv"><dt>Required Downpayment</dt><dd>${formatCurrency(reservation.downpayment_amount)}</dd></dl>
              <dl class="detail-kv"><dt>Paid</dt><dd>${formatCurrency(reservation.downpayment_paid)}</dd></dl>
              <dl class="detail-kv"><dt>Remaining Required</dt><dd>${formatCurrency(remainingRequired)}</dd></dl>
            </div>
            <div class="filter-row">
              <div class="field"><label for="payment_amount">Collect Payment</label><input id="payment_amount" name="payment_amount" type="number" min="0" step="0.01" value="0"></div>
              <div class="field"><label for="payment_method">Payment Method</label><select id="payment_method" name="payment_method">${buildSelectOptions(PAYMENT_METHODS, "Select payment method")}</select></div>
            </div>
            <div class="field"><label for="payment_reference">Payment Reference</label><input id="payment_reference" name="payment_reference"></div>
          </section>
          <section class="panel" style="padding:18px;">
            <h3 style="margin-top:0;">Incidental Deposit</h3>
            <div class="filter-row">
              <div class="field"><label for="incidental_deposit_amount">Deposit Amount</label><input id="incidental_deposit_amount" name="incidental_deposit_amount" type="number" min="0" step="0.01" value="${reservation.incidental_deposit_amount || 0}"></div>
              <div class="field"><label for="incidental_payment_method">Deposit Method</label><select id="incidental_payment_method" name="incidental_payment_method">${buildSelectOptions(PAYMENT_METHODS, "Select payment method")}</select></div>
            </div>
          </section>
          <button class="btn btn-primary" type="submit">Confirm Check In</button>
        </form>
      `,
    });

    qs("#checkin-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        await withFormBusy(event.currentTarget, "Checking in...", async () => {
          const payload = serializeForm(event.currentTarget);
          const paymentAmount = Number(payload.payment_amount || 0);
          const incidentalDepositAmount = Number(payload.incidental_deposit_amount || 0);
          const invoice = await createInvoiceFromReservation(reservation);

          if (paymentAmount > 0) {
            if (!payload.payment_method) {
              throw new Error("Payment method is required when collecting payment.");
            }
            await savePayment({
              invoice_id: invoice.id,
              reservation_id: reservation.id,
              amount: paymentAmount,
              payment_method: payload.payment_method,
              payment_reference: payload.payment_reference || null,
              payment_status: "Paid",
              paid_at: new Date().toISOString(),
              notes: "Payment collected during check-in",
              received_by: auth.user.id,
              transaction_type: TRANSACTION_TYPE_CHECKIN,
            });
          }

          if (incidentalDepositAmount > 0) {
            if (!payload.incidental_payment_method) {
              throw new Error("Deposit method is required when collecting incidental deposit.");
            }
            await savePayment({
              invoice_id: invoice.id,
              reservation_id: reservation.id,
              amount: incidentalDepositAmount,
              payment_method: payload.incidental_payment_method,
              payment_status: "Paid",
              paid_at: new Date().toISOString(),
              notes: "Incidental deposit collected at check-in",
              received_by: auth.user.id,
              transaction_type: TRANSACTION_TYPE_INCIDENTAL,
            });
          }

          if (!payload.guest_verified) {
            throw new Error("Guest identity must be confirmed before check-in.");
          }

          const updated = await updateReservationStatus(reservation.id, "Checked In", {
            guest_verified: true,
            guest_id_type: payload.guest_id_type || null,
            guest_id_number: payload.guest_id_number || null,
            check_in_notes: payload.check_in_notes || null,
            checked_in_at: new Date().toISOString(),
            checked_in_by: auth.user.id,
            incidental_deposit_amount: incidentalDepositAmount,
            incidental_deposit_paid: incidentalDepositAmount,
          });

          await createAuditLog({
            userId: auth.user.id,
            action: "Checked in reservation",
            entityType: "reservations",
            entityId: updated.id,
            details: `${updated.confirmation_number || updated.id} checked in`,
          });
          await load();
          closeModal();
          showToast("Guest checked in successfully.", "success");
        });
      } catch (error) {
        showToast(friendlyError(error), "error");
      }
    });
  }

  async function openCheckOutModal(id) {
    const reservation = await getReservation(id);
    await validateReservationCheckOut(reservation);
    window.location.href = `guest-folio.html?id=${reservation.id}`;
    return;
    const folio = await getCheckoutFolio(reservation.id) || await createInvoiceFromReservation(reservation).then(() => getCheckoutFolio(reservation.id));
    const isStaff = auth.profile.role === ROLES.STAFF;

    openModal({
      title: `Check Out · ${reservation.confirmation_number || `Reservation #${reservation.id}`}`,
      body: `
        <form id="checkout-form" class="form-stack">
          <section class="panel" style="padding:18px;">
            <h3 style="margin-top:0;">Stay Summary</h3>
            <div class="detail-grid">
              <dl class="detail-kv"><dt>Guest</dt><dd>${escapeHtml(reservation.guests?.full_name || "-")}</dd></dl>
              <dl class="detail-kv"><dt>Room</dt><dd>${escapeHtml(reservation.rooms?.room_number || "-")}</dd></dl>
              <dl class="detail-kv"><dt>Stay</dt><dd>${formatDate(reservation.check_in)} to ${formatDate(reservation.check_out)}</dd></dl>
              <dl class="detail-kv"><dt>Nights</dt><dd>${reservation.nights}</dd></dl>
            </div>
          </section>
          <section class="panel" style="padding:18px;">
            <h3 style="margin-top:0;">Folio</h3>
            <div class="detail-grid">
              <dl class="detail-kv"><dt>Invoice Total</dt><dd>${formatCurrency(folio.invoice.total)}</dd></dl>
              <dl class="detail-kv"><dt>Payments</dt><dd>${formatCurrency(folio.totalPayments)}</dd></dl>
              <dl class="detail-kv"><dt>Incidental Deposit</dt><dd>${formatCurrency(reservation.incidental_deposit_paid)}</dd></dl>
              <dl class="detail-kv"><dt>Outstanding</dt><dd>${formatCurrency(folio.outstandingBalance)}</dd></dl>
            </div>
            <div class="table-wrap" style="margin-top:18px;">
              <table>
                <thead><tr><th>Description</th><th>Qty</th><th>Total</th></tr></thead>
                <tbody>
                  ${(folio.lineItems || []).map((item) => `<tr><td>${escapeHtml(item.description)}</td><td>${item.quantity || 1}</td><td>${formatCurrency(item.total || 0)}</td></tr>`).join("")}
                </tbody>
              </table>
            </div>
          </section>
          <section class="panel" style="padding:18px;">
            <h3 style="margin-top:0;">Add Last-Minute Charge</h3>
            <div class="filter-row">
              <div class="field"><label for="charge_description">Description</label><input id="charge_description" name="charge_description" placeholder="Late checkout fee"></div>
              <div class="field"><label for="charge_quantity">Quantity</label><input id="charge_quantity" name="charge_quantity" type="number" min="1" value="1"></div>
            </div>
            <div class="filter-row">
              <div class="field"><label for="charge_unit_price">Unit Price</label><input id="charge_unit_price" name="charge_unit_price" type="number" min="0" step="0.01" value="0"></div>
              <div class="field"><label for="payment_amount">Settle Balance</label><input id="payment_amount" name="payment_amount" type="number" min="0" step="0.01" value="0"></div>
            </div>
            <div class="filter-row">
              <div class="field"><label for="payment_method">Payment Method</label><select id="payment_method" name="payment_method">${buildSelectOptions(PAYMENT_METHODS, "Select payment method")}</select></div>
              <div class="field"><label for="payment_reference">Payment Reference</label><input id="payment_reference" name="payment_reference"></div>
            </div>
          </section>
          ${isAdmin ? `
            <section class="panel" style="padding:18px;">
              <h3 style="margin-top:0;">Admin Override</h3>
              <div class="checkbox-field">
                <label class="checkbox-label"><input id="allow_override" name="allow_override" type="checkbox"> Allow checkout with unpaid balance</label>
              </div>
              <div class="field"><label for="checkout_override_reason">Override Reason</label><textarea id="checkout_override_reason" name="checkout_override_reason"></textarea></div>
            </section>
          ` : ""}
          <div class="field"><label for="checkout_notes">Checkout Notes</label><textarea id="checkout_notes" name="checkout_notes">${reservation.checkout_notes || ""}</textarea></div>
          <button class="btn btn-primary" type="submit">Confirm Check Out</button>
        </form>
      `,
    });

    qs("#checkout-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        await withFormBusy(event.currentTarget, "Checking out...", async () => {
          const payload = serializeForm(event.currentTarget);
          const extraQuantity = Number(payload.charge_quantity || 0);
          const extraUnitPrice = Number(payload.charge_unit_price || 0);
          const paymentAmount = Number(payload.payment_amount || 0);

          if (payload.charge_description && extraQuantity > 0 && extraUnitPrice >= 0) {
            await saveInvoiceItem({
              invoice_id: folio.invoice.id,
              description: payload.charge_description,
              quantity: extraQuantity,
              unit_price: extraUnitPrice,
              total: Number((extraQuantity * extraUnitPrice).toFixed(2)),
            });
          }

          if (paymentAmount > 0) {
            if (!payload.payment_method) {
              throw new Error("Payment method is required when settling balance.");
            }
            await savePayment({
              invoice_id: folio.invoice.id,
              reservation_id: reservation.id,
              amount: paymentAmount,
              payment_method: payload.payment_method,
              payment_reference: payload.payment_reference || null,
              payment_status: "Paid",
              paid_at: new Date().toISOString(),
              notes: "Checkout settlement",
            });
          }

          const refreshedFolio = await getCheckoutFolio(reservation.id);
          if (Number(refreshedFolio.outstandingBalance || 0) > 0) {
            if (isStaff) {
              throw new Error("Staff cannot complete checkout while a balance remains unpaid.");
            }
            if (!payload.allow_override || !payload.checkout_override_reason?.trim()) {
              throw new Error("Admin override requires a reason.");
            }
          }

          const updated = await updateReservationStatus(reservation.id, "Checked Out", {
            checked_out_at: new Date().toISOString(),
            checked_out_by: auth.user.id,
            checkout_notes: payload.checkout_notes || null,
            checkout_override_reason: payload.checkout_override_reason || null,
          });

          await saveHousekeepingTask({
            room_id: reservation.room_id,
            task_type: "Checkout Turnover",
            priority: "High",
            status: "Pending",
            due_date: todayIso(),
            notes: `Auto-created after checkout for ${updated.confirmation_number || updated.id}`,
          });

          await createAuditLog({
            userId: auth.user.id,
            action: "Checked out reservation",
            entityType: "reservations",
            entityId: updated.id,
            details: payload.checkout_override_reason?.trim()
              ? `${updated.confirmation_number || updated.id} checked out with override: ${payload.checkout_override_reason}`
              : `${updated.confirmation_number || updated.id} checked out`,
          });
          await load();
          closeModal();
          showToast("Guest checked out successfully.", "success");
          window.location.href = `checkout-receipt.html?id=${updated.id}`;
        });
      } catch (error) {
        showToast(friendlyError(error), "error");
      }
    });
  }

  async function openAddPaymentModal(id) {
    const reservation = await getReservation(id);
    const invoice = await createInvoiceFromReservation(reservation);
    const folio = await getCheckoutFolio(reservation.id);

    openModal({
      title: `Add Payment · ${reservation.confirmation_number || `Reservation #${reservation.id}`}`,
      body: `
        <form id="reservation-payment-form" class="form-stack">
          <section class="panel" style="padding:18px;">
            <div class="detail-grid">
              <dl class="detail-kv"><dt>Guest</dt><dd>${escapeHtml(reservation.guests?.full_name || "-")}</dd></dl>
              <dl class="detail-kv"><dt>Confirmation</dt><dd>${escapeHtml(reservation.confirmation_number || `Reservation #${reservation.id}`)}</dd></dl>
              <dl class="detail-kv"><dt>Room</dt><dd>${escapeHtml(reservation.rooms?.room_number || "-")}</dd></dl>
              <dl class="detail-kv"><dt>Outstanding</dt><dd>${formatCurrency(folio?.outstandingBalance || 0)}</dd></dl>
            </div>
          </section>
          <div class="filter-row">
            <div class="field"><label for="payment_amount">Amount</label><input id="payment_amount" name="payment_amount" type="number" min="0.01" step="0.01" value="${folio?.outstandingBalance || 0}" required></div>
            <div class="field"><label for="payment_method">Payment Method</label><select id="payment_method" name="payment_method" required>${buildSelectOptions(PAYMENT_METHODS, "Select payment method")}</select></div>
          </div>
          <div class="filter-row">
            <div class="field"><label for="payment_reference">Payment Reference</label><input id="payment_reference" name="payment_reference"></div>
            <div class="field"><label for="payment_date">Payment Date</label><input id="payment_date" name="payment_date" type="date" value="${todayIso()}" required></div>
          </div>
          <div class="field"><label for="payment_notes">Notes</label><textarea id="payment_notes" name="payment_notes" placeholder="Optional transaction note"></textarea></div>
          <button class="btn btn-primary" type="submit">Post Payment</button>
        </form>
      `,
    });

    qs("#reservation-payment-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        await withFormBusy(event.currentTarget, "Posting...", async () => {
          const payload = serializeForm(event.currentTarget);
          await savePayment({
            invoice_id: invoice.id,
            reservation_id: reservation.id,
            amount: Number(payload.payment_amount || 0),
            payment_method: payload.payment_method,
            payment_reference: payload.payment_reference || null,
            payment_status: "Paid",
            paid_at: new Date(`${payload.payment_date}T12:00:00`).toISOString(),
            notes: payload.payment_notes || "Reservation payment",
            received_by: auth.user.id,
            transaction_type: reservation.status === "Checked In" ? TRANSACTION_TYPE_CHECKOUT : TRANSACTION_TYPE_DOWNPAYMENT,
          });
          await createAuditLog({
            userId: auth.user.id,
            action: "Recorded reservation payment",
            entityType: "payments",
            entityId: reservation.id,
            details: `${reservation.confirmation_number || reservation.id} payment recorded`,
          });
          closeModal();
          await load();
          showToast("Payment recorded successfully.", "success");
        });
      } catch (error) {
        showToast(friendlyError(error), "error");
      }
    });
  }

  function bindEvents(reservations) {
    qs("#add-reservation-button").addEventListener("click", () => openReservationEditor());
    qs("#reservation-filter-status").addEventListener("change", async (event) => {
      filters.status = event.target.value;
      await load();
    });
    qs("#reservation-search").addEventListener("input", debounce(async (event) => {
      filters.search = event.target.value.trim();
      await load();
    }, 300));

    root.querySelectorAll(".reservation-edit-button").forEach((button) => button.addEventListener("click", async () => {
      const reservation = await getReservation(Number(button.dataset.id));
      openReservationEditor(reservation);
    }));

    root.querySelectorAll(".reservation-checkin-button").forEach((button) => button.addEventListener("click", async () => {
      try {
        await openCheckInModal(Number(button.dataset.id));
      } catch (error) {
        showToast(friendlyError(error), "error");
      }
    }));

    root.querySelectorAll(".reservation-checkout-button").forEach((button) => button.addEventListener("click", async () => {
      try {
        await openCheckOutModal(Number(button.dataset.id));
      } catch (error) {
        showToast(friendlyError(error), "error");
      }
    }));

    root.querySelectorAll(".reservation-payment-button").forEach((button) => button.addEventListener("click", async () => {
      try {
        await openAddPaymentModal(Number(button.dataset.id));
      } catch (error) {
        showToast(friendlyError(error), "error");
      }
    }));

    root.querySelectorAll(".reservation-cancel-button").forEach((button) => button.addEventListener("click", async () => {
      if (!await confirmDialog({
        title: "Cancel reservation",
        message: "This will cancel the reservation and release the room.",
        confirmLabel: "Cancel Reservation",
        tone: "danger",
      })) {
        return;
      }

      const reservation = reservations.find((item) => item.id === Number(button.dataset.id));
      openModal({
        title: "Cancellation Reason",
        body: `
          <form id="reservation-cancel-form" class="form-stack">
            <div class="field">
              <label for="cancellation_reason">Reason</label>
              <textarea id="cancellation_reason" name="cancellation_reason" required></textarea>
            </div>
            <button class="btn btn-danger" type="submit">Confirm Cancellation</button>
          </form>
        `,
      });

      qs("#reservation-cancel-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        try {
          await withFormBusy(event.currentTarget, "Cancelling...", async () => {
            const payload = serializeForm(event.currentTarget);
            const updated = await updateReservationStatus(reservation.id, "Cancelled", {
              cancellation_reason: payload.cancellation_reason,
              cancelled_at: new Date().toISOString(),
              cancelled_by: auth.user.id,
            });
            await createAuditLog({
              userId: auth.user.id,
              action: "Cancelled reservation",
              entityType: "reservations",
              entityId: updated.id,
              details: payload.cancellation_reason,
            });
            closeModal();
            await load();
            showToast("Reservation cancelled.", "success");
          });
        } catch (error) {
          showToast(friendlyError(error), "error");
        }
      });
    }));
  }

  await load();
});
