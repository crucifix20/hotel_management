import { addDays, formatDate, toIsoDate } from "../utils.js";

export function normalizeCalendarDate(value) {
  const date = new Date(value);
  date.setHours(12, 0, 0, 0);
  return date;
}

export function startOfWeek(value) {
  const date = normalizeCalendarDate(value);
  date.setDate(date.getDate() - date.getDay());
  return date;
}

export function endOfWeek(value) {
  return addDays(startOfWeek(value), 6);
}

export function startOfMonth(value) {
  const date = normalizeCalendarDate(value);
  return new Date(date.getFullYear(), date.getMonth(), 1, 12);
}

export function endOfMonth(value) {
  const date = normalizeCalendarDate(value);
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 12);
}

export function daysBetween(start, end) {
  const startDate = normalizeCalendarDate(start);
  const endDate = normalizeCalendarDate(end);
  return Math.round((endDate - startDate) / 86400000);
}

export function isSameMonth(left, right) {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth();
}

export function buildCalendarWeeks(visibleStart, visibleEnd) {
  const days = [];
  for (let cursor = normalizeCalendarDate(visibleStart); cursor <= visibleEnd; cursor = addDays(cursor, 1)) {
    days.push(normalizeCalendarDate(cursor));
  }

  const weeks = [];
  for (let index = 0; index < days.length; index += 7) {
    weeks.push(days.slice(index, index + 7));
  }
  return weeks;
}

function reservationSort(left, right) {
  return left.checkIn.localeCompare(right.checkIn)
    || left.checkOut.localeCompare(right.checkOut)
    || left.guestName.localeCompare(right.guestName)
    || String(left.id).localeCompare(String(right.id));
}

function getSegmentStatusClass(status) {
  const normalized = String(status || "").toLowerCase().replace(/\s+/g, "-");
  return `status-${normalized || "pending"}`;
}

function createReservationLabel(reservation) {
  return `${reservation.guestName} · Room ${reservation.roomNumber} · ${reservation.nights} night${reservation.nights === 1 ? "" : "s"}`;
}

export function buildWeekReservationSegments(reservations, weekStart, weekEndExclusive) {
  const sortedReservations = [...reservations]
    .filter((reservation) => {
      const bookingStart = normalizeCalendarDate(reservation.checkIn);
      const bookingEnd = normalizeCalendarDate(reservation.checkOut);
      return bookingStart < weekEndExclusive && bookingEnd > weekStart;
    })
    .sort(reservationSort);

  const segments = sortedReservations.map((reservation) => {
    const bookingStart = normalizeCalendarDate(reservation.checkIn);
    const bookingEnd = normalizeCalendarDate(reservation.checkOut);
    const visibleStart = bookingStart < weekStart ? weekStart : bookingStart;
    const visibleEnd = bookingEnd > weekEndExclusive ? weekEndExclusive : bookingEnd;
    const startColumn = daysBetween(weekStart, visibleStart) + 1;
    const endColumn = daysBetween(weekStart, visibleEnd) + 1;

    return {
      ...reservation,
      startColumn,
      endColumn,
      span: Math.max(1, endColumn - startColumn),
      isSegmentStart: bookingStart.getTime() === visibleStart.getTime(),
      isSegmentEnd: bookingEnd.getTime() === visibleEnd.getTime(),
    };
  }).sort((left, right) => left.startColumn - right.startColumn || right.endColumn - left.endColumn || reservationSort(left, right));

  const laneEnds = [];
  return segments.map((segment) => {
    let laneIndex = 0;
    while ((laneEnds[laneIndex] || 0) > segment.startColumn) {
      laneIndex += 1;
    }
    laneEnds[laneIndex] = segment.endColumn;

    return {
      ...segment,
      laneIndex,
      lane: laneIndex + 1,
    };
  });
}

export function buildMonthReservationWeeks(range, reservations) {
  return buildCalendarWeeks(range.visibleStart, range.visibleEnd).map((days) => {
    const weekStart = normalizeCalendarDate(days[0]);
    const weekEndExclusive = addDays(weekStart, 7);
    const segments = buildWeekReservationSegments(reservations, weekStart, weekEndExclusive);
    const laneCount = Math.max(segments.reduce((max, segment) => Math.max(max, segment.lane), 0), 1);

    return {
      key: toIsoDate(weekStart),
      weekStart,
      weekEndExclusive,
      days,
      segments,
      laneCount,
    };
  });
}

function renderWeekSegment(segment, selectedReservationId) {
  const selected = String(segment.id) === String(selectedReservationId);
  const statusClass = getSegmentStatusClass(segment.status);

  return `
    <button
      class="reservation-calendar-bar calendar-reservation-button ${statusClass}${segment.isSegmentStart ? " segment-start" : ""}${segment.isSegmentEnd ? " segment-end" : ""}${selected ? " is-selected" : ""}"
      data-id="${segment.id}"
      data-status="${segment.status || ""}"
      type="button"
      style="grid-column:${segment.startColumn} / ${segment.endColumn}; grid-row:${segment.lane};"
      aria-label="${createReservationLabel(segment)} from ${formatDate(segment.checkIn)} to ${formatDate(segment.checkOut)}"
    >
      <span class="reservation-calendar-status-dot" aria-hidden="true"></span>
      <span class="reservation-calendar-bar-copy">
        <strong>${segment.guestName}</strong>
        <small>Room ${segment.roomNumber} · ${segment.nights} night${segment.nights === 1 ? "" : "s"}</small>
      </span>
    </button>
  `;
}

export function renderReservationCalendar({ range, reservations, selectedReservationId = null }) {
  const weeks = buildMonthReservationWeeks(range, reservations);
  const weekdayLabels = weeks[0]?.days.map((day) => day.toLocaleDateString("en-US", { weekday: "short" })) || [];

  return `
    <section class="stitch-overview-card stitch-calendar-shell" style="margin-top:24px;">
      <div class="stitch-overview-head">
        <div>
          <h2>Reservation Calendar</h2>
          <p>${range.label}</p>
        </div>
        <div class="stitch-legend">
          <span><i></i> Multi-night stays displayed as continuous booking bars</span>
        </div>
      </div>
      <div class="reservation-calendar" aria-label="Monthly reservation calendar">
        <div class="reservation-calendar-head" aria-hidden="true">
          ${weekdayLabels.map((label) => `<div class="calendar-head">${label}</div>`).join("")}
        </div>
        ${weeks.map((week) => `
          <section class="reservation-calendar-week" style="--reservation-week-lanes:${week.laneCount};" aria-label="Week of ${formatDate(week.weekStart)}">
            <div class="reservation-calendar-week-grid">
              ${week.days.map((day) => `
                <div class="reservation-calendar-day${isSameMonth(day, range.monthStart) ? "" : " outside-month"}">
                  <strong>${day.getDate()}</strong>
                  <small>${day.toLocaleDateString("en-US", { month: "short" })}</small>
                </div>
              `).join("")}
            </div>
            <div class="reservation-calendar-week-events" role="list" aria-label="Reservations for the week starting ${formatDate(week.weekStart)}">
              ${week.segments.map((segment) => renderWeekSegment(segment, selectedReservationId)).join("")}
            </div>
          </section>
        `).join("")}
      </div>
    </section>
  `;
}
