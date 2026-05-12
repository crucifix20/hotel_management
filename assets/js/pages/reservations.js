import { DOWNPAYMENT_STATUSES, PAYMENT_METHODS, PAYMENT_STATUSES, RESERVATION_STATUSES, ROLES } from "../config.js";
import { initProtectedPage } from "../router.js";
import { createAuditLog } from "../services/auditService.js";
import { createInvoiceFromReservation, getCheckoutFolio, getReservationInvoice, saveInvoiceItem, savePayment } from "../services/billingService.js";
import { listActiveMembershipsForGuest } from "../services/clubsService.js";
import { listGuestOptions } from "../services/guestsService.js";
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

  function getReservationActionMarkup(reservation) {
    const status = reservation.status;
    const canCheckIn = ["Pending", "Confirmed"].includes(status);
    const canCheckOut = status === "Checked In";
    const canCancel = !["Checked Out", "Cancelled", "No Show"].includes(status);
    const canEdit = !["Checked Out", "Cancelled", "No Show"].includes(status) || isAdmin;

    return `
      <div class="reservation-actions">
        <div class="reservation-links">
          <a class="link-action" href="booking-confirmation.html?id=${reservation.id}">Confirmation</a>
          ${status === "Checked Out" ? `<a class="link-action" href="checkout-receipt.html?id=${reservation.id}">Receipt</a>` : ""}
        </div>
        <div class="reservation-action-grid">
          ${canEdit ? `<button class="btn btn-ghost reservation-edit-button" data-id="${reservation.id}" type="button">Edit</button>` : ""}
          ${canCheckIn ? `<button class="btn btn-ghost reservation-checkin-button" data-id="${reservation.id}" type="button">Check In</button>` : ""}
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

    return `
      <form id="reservation-form" class="form-stack">
        <input name="id" type="hidden" value="${reservation.id || ""}">
        <div class="filter-row">
          <div class="field">
            <label for="guest_id">Guest</label>
            <select id="guest_id" name="guest_id" required>${createOptionList(guestOptions, "id", "full_name", "Select guest")}</select>
          </div>
          <div class="field">
            <label for="room_type_id">Room Type</label>
            <select id="room_type_id" name="room_type_id" required>${createOptionList(roomTypes, "id", "name", "Select room type")}</select>
          </div>
        </div>
        <div id="reservation-membership-panel" class="success-panel" style="display:none;"></div>
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
            <label for="room_id">Available Room Number</label>
            <select id="room_id" name="room_id" required>
              <option value="">Select dates and room type first</option>
            </select>
            <p class="field-help" id="availability-help">Only available rooms for the selected stay period will appear here.</p>
          </div>
          <div class="field">
            <label for="reservation-total-preview">Reservation Total</label>
            <input id="reservation-total-preview" type="text" value="${reservation.total_amount ? formatCurrency(reservation.total_amount) : formatCurrency(0)}" readonly>
          </div>
        </div>
        <div class="button-row" style="margin-top:-6px;">
          <button class="btn btn-ghost" id="clear-room-filters-button" type="button">Clear Filters</button>
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
        <div class="filter-row">
          <div class="field">
            <label for="status">Reservation Status</label>
            <select id="status" name="status">${buildSelectOptions(RESERVATION_STATUSES, "Select status")}</select>
          </div>
          <div class="field">
            <label for="payment_status">Payment Status</label>
            <select id="payment_status" name="payment_status">${buildSelectOptions(PAYMENT_STATUSES, "Select payment status")}</select>
          </div>
        </div>
        <section class="panel" style="padding:18px;">
          <div class="panel-header"><div><h3 style="margin:0;">Downpayment</h3><p class="muted">Capture reservation deposits before arrival.</p></div></div>
          <div class="checkbox-field">
            <label class="checkbox-label"><input id="downpayment_required" name="downpayment_required" type="checkbox" ${reservation.downpayment_required ? "checked" : ""}> Require downpayment</label>
          </div>
          <div class="filter-row">
            <div class="field">
              <label for="downpayment_amount">Required Downpayment</label>
              <input id="downpayment_amount" name="downpayment_amount" type="number" min="0" step="0.01" value="${reservation.downpayment_amount || 0}">
            </div>
            <div class="field">
              <label for="downpayment_paid">Downpayment Paid</label>
              <input id="downpayment_paid" name="downpayment_paid" type="number" min="0" step="0.01" value="${reservation.downpayment_paid || 0}">
            </div>
          </div>
          <div class="filter-row">
            <div class="field">
              <label for="downpayment_status">Downpayment Status</label>
              <select id="downpayment_status" name="downpayment_status">${buildSelectOptions(DOWNPAYMENT_STATUSES, "Select status")}</select>
            </div>
            <div class="field">
              <label for="payment_method">Initial Payment Method</label>
              <select id="payment_method" name="payment_method">${buildSelectOptions(PAYMENT_METHODS, "Select payment method")}</select>
            </div>
          </div>
          <div class="field">
            <label for="payment_reference">Payment Reference</label>
            <input id="payment_reference" name="payment_reference" value="${reservation.payment_reference || ""}" placeholder="Card auth, bank ref, wallet ref">
          </div>
        </section>
        <div class="field">
          <label for="special_requests">Guest Requests</label>
          <textarea id="special_requests" name="special_requests">${reservation.special_requests || ""}</textarea>
        </div>
        <div class="field">
          <label for="internal_notes">Internal Staff Notes</label>
          <textarea id="internal_notes" name="internal_notes">${reservation.internal_notes || ""}</textarea>
        </div>
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
    let selectedAvailableRooms = [];

    qs("#guest_id").value = reservation.guest_id || "";
    qs("#room_type_id").value = originalDates.room_type_id;
    qs("#status").value = reservation.status || "Pending";
    qs("#payment_status").value = reservation.payment_status || "Unpaid";
    qs("#downpayment_status").value = reservation.downpayment_status || (reservation.downpayment_required ? "Required" : "Not Required");
    qs("#payment_method").value = reservation.payment_method || "";

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
        return;
      }

      const nights = Math.max(1, Math.ceil((new Date(checkOut) - new Date(checkIn)) / 86400000));
      qs("#reservation-total-preview").value = formatCurrency(Number(room.rate || 0) * nights);
    }

    qs("#guest_id").addEventListener("change", updateMembershipPanel);
    qs("#check_in").addEventListener("change", async () => { await refreshAvailableRooms(); await updateTotalPreview(); });
    qs("#check_out").addEventListener("change", async () => { await refreshAvailableRooms(); await updateTotalPreview(); });
    qs("#room_type_id").addEventListener("change", async () => { await refreshAvailableRooms(); await updateTotalPreview(); });
    qs("#room_id").addEventListener("change", updateTotalPreview);

    qs("#clear-room-filters-button").addEventListener("click", () => {
      qs("#check_in").value = "";
      qs("#check_out").value = "";
      qs("#room_type_id").value = "";
      qs("#room_id").innerHTML = `<option value="">Select dates and room type first</option>`;
      qs("#availability-help").textContent = "Only available rooms for the selected stay period will appear here.";
      qs("#reservation-total-preview").value = formatCurrency(0);
    });

    qs("#reservation-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        await withFormBusy(event.currentTarget, reservation.id ? "Saving..." : "Creating...", async () => {
          const payload = serializeForm(event.currentTarget);
          payload.created_by = auth.user.id;
          if (!payload.id) {
            delete payload.id;
          }

          if (!payload.room_id) {
            throw new Error("Select an available room before saving the reservation.");
          }

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
              paid_at: new Date().toISOString(),
              notes: "Reservation downpayment",
            });
          }

          await createAuditLog({
            userId: auth.user.id,
            action: reservation.id ? "Updated reservation" : "Created reservation",
            entityType: "reservations",
            entityId: saved.id,
            details: `${saved.confirmation_number || saved.id} for ${saved.guests?.full_name || "guest"}`,
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
