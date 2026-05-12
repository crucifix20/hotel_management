import { addDays, formatDate, getQueryParam, qs, render, toIsoDate } from "../utils.js";
import { initProtectedPage } from "../router.js";
import { listCalendarReservations } from "../services/reservationsService.js";
import { listRooms } from "../services/roomsService.js";
import { createPageHeader, openModal } from "../ui.js";
import {
  endOfMonth,
  endOfWeek,
  normalizeCalendarDate,
  renderReservationCalendar,
  startOfMonth,
  startOfWeek,
} from "../components/reservationCalendar.js";

function daysBetween(start, end) {
  const startDate = normalizeCalendarDate(start);
  const endDate = normalizeCalendarDate(end);
  return Math.round((endDate - startDate) / 86400000);
}

function buildWeekDays(start) {
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

function getViewRange(viewMode, anchorDate) {
  const anchor = normalizeCalendarDate(anchorDate);

  if (viewMode === "month") {
    const monthStart = startOfMonth(anchor);
    const monthEnd = endOfMonth(anchor);
    const visibleStart = startOfWeek(monthStart);
    const visibleEnd = endOfWeek(monthEnd);
    return {
      anchor,
      label: monthStart.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
      queryStart: visibleStart,
      queryEnd: visibleEnd,
      visibleStart,
      visibleEnd,
      monthStart,
      monthEnd,
    };
  }

  const weekStart = normalizeCalendarDate(anchor);
  const weekEnd = addDays(weekStart, 6);
  return {
    anchor,
    label: `${formatDate(weekStart)} to ${formatDate(weekEnd)}`,
    queryStart: weekStart,
    queryEnd: weekEnd,
    visibleStart: weekStart,
    visibleEnd: weekEnd,
  };
}

function openReservationDetails(reservation) {
  openModal({
    title: reservation.confirmation_number || `Reservation #${reservation.id}`,
    body: `
      <div class="stack-sm">
        <p><strong>Guest:</strong> ${reservation.guests?.full_name || "-"}</p>
        <p><strong>Room:</strong> ${reservation.rooms?.room_number || "-"} &bull; ${reservation.rooms?.room_types?.name || ""}</p>
        <p><strong>Stay:</strong> ${formatDate(reservation.check_in)} to ${formatDate(reservation.check_out)}</p>
        <p><strong>Duration:</strong> ${reservation.nights} night(s)</p>
        <p><strong>Status:</strong> ${reservation.status}</p>
        <a class="btn btn-primary" href="booking-confirmation.html?id=${reservation.id}">Open Booking Confirmation</a>
      </div>
    `,
  });
}

function createWeeklyBar(reservation, weekStart) {
  const bookingStart = normalizeCalendarDate(reservation.check_in);
  const bookingEnd = normalizeCalendarDate(reservation.check_out);
  const visibleStart = bookingStart < weekStart ? weekStart : bookingStart;
  const visibleEnd = bookingEnd > addDays(weekStart, 7) ? addDays(weekStart, 7) : bookingEnd;
  const startColumn = daysBetween(weekStart, visibleStart) + 1;
  const span = Math.max(1, daysBetween(visibleStart, visibleEnd));
  const longStay = reservation.nights > 2;

  return `
    <button
      class="calendar-stay-bar${longStay ? " long-stay" : ""} calendar-reservation-button"
      data-id="${reservation.id}"
      type="button"
      aria-label="${reservation.guests?.full_name || "Guest"} in room ${reservation.rooms?.room_number || "-"} for ${reservation.nights} night(s)"
      style="grid-column:${startColumn} / span ${span};"
    >
      <span>${reservation.guests?.full_name || "Guest"}</span>
      <small>${reservation.rooms?.room_number || "-"} &bull; ${reservation.nights} night(s)</small>
    </button>
  `;
}

function renderWeeklyBoard(rooms, reservations, range) {
  const days = buildWeekDays(range.visibleStart);

  return `
    <section class="stitch-overview-card stitch-calendar-shell" style="margin-top:24px;">
      <div class="stitch-overview-head">
        <div>
          <h2>Weekly Board</h2>
          <p>${range.label}</p>
        </div>
        <div class="stitch-legend">
          <span><i></i> Reservation stay duration</span>
        </div>
      </div>
      <div class="calendar-week-head-row">
        <div class="calendar-head">Room</div>
        <div class="calendar-week-head-days">
          ${days.map((day) => `<div class="calendar-head">${formatDate(day)}</div>`).join("")}
        </div>
      </div>
      <div class="calendar-week-board">
        ${rooms.map((room) => {
          const roomReservations = reservations
            .filter((reservation) => reservation.room_id === room.id)
            .sort((left, right) => left.check_in.localeCompare(right.check_in));

          return `
            <div class="calendar-room-name">${room.room_number}<div class="muted">${room.room_types?.name || ""}</div></div>
            <div class="calendar-week-track">
              <div class="calendar-week-cells">
                ${days.map(() => `<div class="calendar-cell calendar-cell-compact"></div>`).join("")}
              </div>
              <div class="calendar-week-events">
                ${roomReservations.map((reservation) => createWeeklyBar(reservation, range.visibleStart)).join("")}
              </div>
            </div>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function mapReservationToCalendarItem(reservation) {
  return {
    id: String(reservation.id),
    guestName: reservation.guests?.full_name || "Guest",
    roomNumber: reservation.rooms?.room_number || "-",
    checkIn: reservation.check_in,
    checkOut: reservation.check_out,
    nights: reservation.nights,
    status: reservation.status,
  };
}

await initProtectedPage("reservation-calendar", async ({ root }) => {
  let anchorDate = getQueryParam("date") || toIsoDate(new Date());
  let viewMode = getQueryParam("view") === "month" ? "month" : "week";
  let selectedReservationId = null;

  async function load() {
    const range = getViewRange(viewMode, anchorDate);
    const [rooms, reservations] = await Promise.all([
      listRooms({}),
      listCalendarReservations(toIsoDate(range.queryStart), toIsoDate(range.queryEnd)),
    ]);

    const visibleDays = [];
    for (let cursor = normalizeCalendarDate(range.queryStart); cursor <= range.queryEnd; cursor = addDays(cursor, 1)) {
      visibleDays.push(normalizeCalendarDate(cursor));
    }

    const occupiedSlots = rooms.reduce((sum, room) => {
      return sum + visibleDays.filter((day) => {
        const dayIso = toIsoDate(day);
        return reservations.some((reservation) => reservation.room_id === room.id && reservation.check_in <= dayIso && reservation.check_out > dayIso);
      }).length;
    }, 0);

    const calendarReservations = reservations.map(mapReservationToCalendarItem);

    render(root, `
      ${createPageHeader({
        title: "Reservation Calendar",
        subtitle: viewMode === "month"
          ? "Monthly occupancy planning with connected multi-night booking bars across the calendar."
          : "Weekly room planning board with stay-duration bars across the booking span.",
        actions: `
          <button class="btn ${viewMode === "week" ? "btn-primary" : "btn-ghost"}" id="calendar-week-view" type="button">Weekly</button>
          <button class="btn ${viewMode === "month" ? "btn-primary" : "btn-ghost"}" id="calendar-month-view" type="button">Monthly</button>
          <button class="btn btn-ghost" id="calendar-prev" type="button">${viewMode === "month" ? "Previous Month" : "Previous Week"}</button>
          <button class="btn btn-secondary" id="calendar-today" type="button">Today</button>
          <button class="btn btn-primary" id="calendar-next" type="button">${viewMode === "month" ? "Next Month" : "Next Week"}</button>
        `,
      })}
      <section class="stitch-kpi-grid">
        <article class="stitch-kpi-card">
          <div class="stitch-kpi-iconrow"><span class="stitch-kpi-tag">Board</span></div>
          <h3>Rooms</h3>
          <div class="stitch-kpi-value">${rooms.length}</div>
          <p class="stitch-kpi-note">${viewMode === "month" ? "Inventory summarized across the month view" : "Inventory shown in the weekly room board"}</p>
        </article>
        <article class="stitch-kpi-card">
          <div class="stitch-kpi-iconrow"><span class="stitch-kpi-tag">Bookings</span></div>
          <h3>Reservations</h3>
          <div class="stitch-kpi-value">${reservations.length}</div>
          <p class="stitch-kpi-note">Bookings overlapping the visible calendar range</p>
        </article>
        <article class="stitch-kpi-card">
          <div class="stitch-kpi-iconrow"><span class="stitch-kpi-tag">Occupancy</span></div>
          <h3>Occupied Slots</h3>
          <div class="stitch-kpi-value">${occupiedSlots}</div>
          <p class="stitch-kpi-note">Room-days occupied or reserved in this view</p>
        </article>
      </section>
      ${viewMode === "month"
        ? renderReservationCalendar({ range, reservations: calendarReservations, selectedReservationId })
        : renderWeeklyBoard(rooms, reservations, range)}
    `);

    qs("#calendar-week-view").addEventListener("click", async () => {
      viewMode = "week";
      anchorDate = toIsoDate(range.anchor);
      await load();
    });

    qs("#calendar-month-view").addEventListener("click", async () => {
      viewMode = "month";
      anchorDate = toIsoDate(range.anchor);
      await load();
    });

    qs("#calendar-prev").addEventListener("click", async () => {
      anchorDate = toIsoDate(viewMode === "month"
        ? new Date(range.anchor.getFullYear(), range.anchor.getMonth() - 1, 1, 12)
        : addDays(range.anchor, -7));
      await load();
    });

    qs("#calendar-today").addEventListener("click", async () => {
      anchorDate = toIsoDate(new Date());
      await load();
    });

    qs("#calendar-next").addEventListener("click", async () => {
      anchorDate = toIsoDate(viewMode === "month"
        ? new Date(range.anchor.getFullYear(), range.anchor.getMonth() + 1, 1, 12)
        : addDays(range.anchor, 7));
      await load();
    });

    root.querySelectorAll(".calendar-reservation-button").forEach((button) => {
      button.addEventListener("click", () => {
        selectedReservationId = String(button.dataset.id);
        root.querySelectorAll(".calendar-reservation-button").forEach((item) => {
          item.classList.toggle("is-selected", item.dataset.id === selectedReservationId);
        });
        const reservation = reservations.find((item) => item.id === Number(button.dataset.id));
        if (reservation) {
          openReservationDetails(reservation);
        }
      });
    });
  }

  await load();
});
