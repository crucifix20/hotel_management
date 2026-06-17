import { initProtectedPage } from "../router.js";
import { getRoom } from "../services/roomsService.js";
import { createEmptyState, createPageHeader, createStatusBadge } from "../ui.js";
import { escapeHtml, formatCurrency, formatDate, getQueryParam, render } from "../utils.js";

await initProtectedPage("rooms", async ({ root }) => {
  const roomId = Number(getQueryParam("id"));
  if (!roomId) {
    render(root, createEmptyState({ title: "Room not found", copy: "A valid room ID is required to view the detail page." }));
    return;
  }

  const room = await getRoom(roomId);
  const reservations = room.reservations || [];
  const tasks = room.housekeeping_tasks || [];

  render(root, `
    ${createPageHeader({
      title: `Room ${room.room_number}`,
      subtitle: `${room.room_types?.name || "Room"} - ${room.floor}th floor`,
      actions: `<a class="btn btn-ghost" href="rooms.html">Back to Rooms</a>`,
    })}
    <section class="stitch-room-detail-image${room.image_base64 ? " has-image" : ""}"${room.image_base64 ? ` style="--room-image:url('${escapeHtml(room.image_base64)}')"` : ""}>
      <div class="stitch-room-status status-${room.status.toLowerCase().replaceAll(" ", "-")}">${room.status}</div>
    </section>
    <section class="stitch-kpi-grid">
      <article class="stitch-kpi-card">
        <div class="stitch-kpi-iconrow"><span class="stitch-kpi-tag">Status</span></div>
        <h3>Room Status</h3>
        <div class="stitch-kpi-value" style="font-size:1.9rem;">${room.status}</div>
        <p class="stitch-kpi-note">Current operational state</p>
      </article>
      <article class="stitch-kpi-card">
        <div class="stitch-kpi-iconrow"><span class="stitch-kpi-tag">Rate</span></div>
        <h3>Nightly Rate</h3>
        <div class="stitch-kpi-value">${formatCurrency(room.rate)}</div>
        <p class="stitch-kpi-note">${room.room_types?.capacity || "-"} guest capacity</p>
      </article>
      <article class="stitch-kpi-card">
        <div class="stitch-kpi-iconrow"><span class="stitch-kpi-tag">Stays</span></div>
        <h3>Reservations</h3>
        <div class="stitch-kpi-value">${reservations.length}</div>
        <p class="stitch-kpi-note">Current and historical bookings</p>
      </article>
      <article class="stitch-kpi-card">
        <div class="stitch-kpi-iconrow"><span class="stitch-kpi-tag">Tasks</span></div>
        <h3>Housekeeping</h3>
        <div class="stitch-kpi-value">${tasks.length}</div>
        <p class="stitch-kpi-note">Operational task history</p>
      </article>
    </section>
    <section class="stitch-detail-hero" style="margin-top:24px;">
      <div>
        <p class="eyebrow">Suite Profile</p>
        <h2>${room.room_types?.name || "Room"} ${createStatusBadge(room.status)}</h2>
        <p class="detail-copy">${room.notes || "No operational notes are currently recorded for this room."}</p>
      </div>
      <div class="stitch-detail-meta">
        <div><span>Floor</span><strong>${room.floor}</strong></div>
        <div><span>Capacity</span><strong>${room.room_types?.capacity || "-"}</strong></div>
        <div><span>Amenities</span><strong>${room.amenities || "-"}</strong></div>
        <div><span>Inclusions</span><strong>${room.room_types?.inclusions || "-"}</strong></div>
        <div><span>Created</span><strong>${formatDate(room.created_at)}</strong></div>
      </div>
    </section>
    <section class="split-grid" style="margin-top:24px;">
      <div class="stitch-overview-card">
        <div class="stitch-overview-head">
          <div>
            <h2>Reservation Activity</h2>
            <p>Current and recent bookings tied to this room.</p>
          </div>
        </div>
        ${reservations.length ? `
          <div class="timeline">
            ${reservations.map((reservation) => `
              <article class="timeline-item">
                <strong>${reservation.confirmation_number || `Reservation #${reservation.id}`}</strong>
                <p class="muted" style="margin:8px 0;">${reservation.guests?.full_name || "Guest"} &bull; ${formatDate(reservation.check_in)} to ${formatDate(reservation.check_out)}</p>
                <div class="button-row">
                  ${createStatusBadge(reservation.status)}
                  ${createStatusBadge(reservation.payment_status)}
                </div>
              </article>
            `).join("")}
          </div>
        ` : createEmptyState({ title: "No reservations", copy: "No reservations were found for this room." })}
      </div>
      <div class="stitch-overview-card">
        <div class="stitch-overview-head">
          <div>
            <h2>Housekeeping Activity</h2>
            <p>Recent task status and room readiness.</p>
          </div>
        </div>
        ${tasks.length ? `
          <div class="timeline">
            ${tasks.map((task) => `
              <article class="timeline-item">
                <strong>${task.task_type}</strong>
                <p class="muted" style="margin:8px 0;">${task.staff?.full_name || "Unassigned"} &bull; Due ${formatDate(task.due_date)}</p>
                <div class="button-row">
                  ${createStatusBadge(task.priority)}
                  ${createStatusBadge(task.status)}
                </div>
              </article>
            `).join("")}
          </div>
        ` : createEmptyState({ title: "No housekeeping tasks", copy: "No housekeeping tasks are recorded for this room." })}
      </div>
    </section>
  `);
});
