import { ROOM_STATUSES } from "../config.js";
import { initProtectedPage } from "../router.js";
import { createAuditLog } from "../services/auditService.js";
import { listRooms, updateRoomStatus } from "../services/roomsService.js";
import { friendlyError, qs, render } from "../utils.js";
import { createPageHeader, showToast } from "../ui.js";

const HOUSEKEEPING_STATUS_OPTIONS = [
  { label: "Clean", value: "Available" },
  { label: "Dirty", value: "Cleaning" },
  { label: "Occupied", value: "Occupied" },
  { label: "Blocked", value: "Maintenance" },
  { label: "Reserved", value: "Reserved" },
  { label: "Out of Service", value: "Out of Service" },
];

function housekeepingLabel(status) {
  if (status === "Available") return "Clean";
  if (status === "Cleaning") return "Dirty";
  if (["Maintenance", "Out of Service"].includes(status)) return "Blocked";
  return status || "Unknown";
}

function housekeepingStatusClass(status) {
  if (status === "Available") return "housekeeping-kpi-clean";
  if (status === "Cleaning") return "housekeeping-kpi-dirty";
  if (status === "Occupied") return "housekeeping-kpi-occupied";
  if (["Maintenance", "Out of Service"].includes(status)) return "housekeeping-kpi-blocked";
  return "";
}

function roomStatusBadge(status) {
  const normalized = String(status || "Unknown").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `<span class="status-badge status-${normalized}">${housekeepingLabel(status)}</span>`;
}

function statusOptions(selectedStatus = "") {
  const knownOptions = HOUSEKEEPING_STATUS_OPTIONS
    .filter((option) => ROOM_STATUSES.includes(option.value))
    .map((option) => `<option value="${option.value}" ${option.value === selectedStatus ? "selected" : ""}>${option.label}</option>`)
    .join("");

  if (!selectedStatus || HOUSEKEEPING_STATUS_OPTIONS.some((option) => option.value === selectedStatus)) {
    return knownOptions;
  }

  return `<option value="${selectedStatus}" selected>${housekeepingLabel(selectedStatus)}</option>${knownOptions}`;
}

await initProtectedPage("housekeeping", async ({ root, auth }) => {
  let rooms = [];
  let filters = { status: "", search: "" };

  async function load() {
    rooms = await listRooms({});

    const dirtyRooms = rooms.filter((room) => room.status === "Cleaning").length;
    const cleanRooms = rooms.filter((room) => room.status === "Available").length;
    const occupiedRooms = rooms.filter((room) => room.status === "Occupied").length;
    const blockedRooms = rooms.filter((room) => ["Maintenance", "Out of Service"].includes(room.status)).length;
    const searchNeedle = filters.search.trim().toLowerCase();
    const visibleRooms = rooms.filter((room) => {
      const matchesStatus = !filters.status || room.status === filters.status || (filters.status === "Maintenance" && room.status === "Out of Service");
      const matchesSearch = !searchNeedle || [room.room_number, room.room_types?.name, housekeepingLabel(room.status)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(searchNeedle);
      return matchesStatus && matchesSearch;
    });

    render(root, `
      ${createPageHeader({
        title: "Housekeeping Operations",
        subtitle: "Update room cleanliness and availability from one simple board.",
      })}
      <section class="stitch-main-grid">
        <div>
          <div class="stitch-section-head">
            <div>
              <h2>Room Status Board</h2>
              <p>Choose a room, set the current status, then save.</p>
            </div>
          </div>
          <div class="housekeeping-room-grid">
            ${visibleRooms.map((room) => `
              <article class="stitch-room-card housekeeping-room-card">
                <div class="housekeeping-room-card-head ${housekeepingStatusClass(room.status)}">
                  <div>
                    <p class="eyebrow">Room</p>
                    <h3>${room.room_number || "-"}</h3>
                  </div>
                  <span>${housekeepingLabel(room.status)}</span>
                </div>
                <div class="stitch-room-body">
                  <div class="stitch-mini-meta">
                    <span>${room.room_types?.name || "Room"}</span>
                    <span>${roomStatusBadge(room.status)}</span>
                  </div>
                  <div class="housekeeping-status-control">
                    <label for="room-status-${room.id}">Update Status</label>
                    <select id="room-status-${room.id}" class="hk-room-status-select" data-id="${room.id}">
                      ${statusOptions(room.status)}
                    </select>
                    <button class="btn btn-primary hk-room-status-button" data-id="${room.id}" type="button">Save Status</button>
                  </div>
                </div>
              </article>
            `).join("") || `
              <article class="panel">
                <p class="muted">No rooms match the selected filters.</p>
              </article>
            `}
          </div>
        </div>

        <div class="list-grid" style="grid-template-columns:1fr;">
          <article class="panel">
            <div class="stitch-section-head">
              <div>
                <h2 style="font-size:1.5rem;">Room Status Count</h2>
                <p>Current room condition totals.</p>
              </div>
            </div>
            <div class="housekeeping-kpi-grid">
              <article class="stitch-kpi-card compact housekeeping-kpi-dirty">
                <h3>Dirty</h3>
                <div class="stitch-kpi-value">${dirtyRooms}</div>
                <p class="stitch-kpi-note">Needs cleaning</p>
              </article>
              <article class="stitch-kpi-card compact housekeeping-kpi-clean">
                <h3>Clean</h3>
                <div class="stitch-kpi-value">${cleanRooms}</div>
                <p class="stitch-kpi-note">Ready for guests</p>
              </article>
              <article class="stitch-kpi-card compact housekeeping-kpi-occupied">
                <h3>Occupied</h3>
                <div class="stitch-kpi-value">${occupiedRooms}</div>
                <p class="stitch-kpi-note">In-house guests</p>
              </article>
              <article class="stitch-kpi-card compact housekeeping-kpi-blocked">
                <h3>Blocked</h3>
                <div class="stitch-kpi-value">${blockedRooms}</div>
                <p class="stitch-kpi-note">Unavailable rooms</p>
              </article>
            </div>
          </article>
          <article class="panel">
            <div class="stitch-section-head">
              <div>
                <h2 style="font-size:1.5rem;">Find Rooms</h2>
                <p>Filter the board by room or status.</p>
              </div>
            </div>
            <div class="form-stack">
              <div class="field">
                <label for="hk-room-search">Search</label>
                <input id="hk-room-search" value="${filters.search}" placeholder="Room number or type">
              </div>
              <div class="field">
                <label for="hk-status-filter">Status</label>
                <select id="hk-status-filter">
                  <option value="">All statuses</option>
                  ${HOUSEKEEPING_STATUS_OPTIONS
                    .filter((option) => ROOM_STATUSES.includes(option.value))
                    .map((option) => `<option value="${option.value}" ${option.value === filters.status ? "selected" : ""}>${option.label}</option>`)
                    .join("")}
                </select>
              </div>
            </div>
          </article>
        </div>
      </section>
    `);

    bindEvents();
  }

  function bindEvents() {
    qs("#hk-room-search").addEventListener("input", async (event) => {
      filters.search = event.target.value;
      await load();
    });

    qs("#hk-status-filter").addEventListener("change", async (event) => {
      filters.status = event.target.value;
      await load();
    });

    root.querySelectorAll(".hk-room-status-button").forEach((button) => button.addEventListener("click", async () => {
      const room = rooms.find((item) => item.id === Number(button.dataset.id));
      const select = qs(`#room-status-${button.dataset.id}`);
      const nextStatus = select.value;

      if (!room || room.status === nextStatus) {
        showToast("Room status is already up to date.", "info");
        return;
      }

      try {
        const updated = await updateRoomStatus(room.id, nextStatus);
        await createAuditLog({
          userId: auth.user.id,
          action: "Updated room housekeeping status",
          entityType: "rooms",
          entityId: updated.id,
          details: `Room ${updated.room_number}: ${housekeepingLabel(room.status)} -> ${housekeepingLabel(updated.status)}`,
        });
        showToast(`Room ${updated.room_number} set to ${housekeepingLabel(updated.status)}.`, "success");
        await load();
      } catch (error) {
        showToast(friendlyError(error), "error");
      }
    }));
  }

  await load();
});
