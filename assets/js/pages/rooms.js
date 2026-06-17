import { ROOM_STATUSES } from "../config.js";
import { initProtectedPage } from "../router.js";
import { createAuditLog } from "../services/auditService.js";
import { deleteRoom, listRooms, listRoomTypes, saveRoom, updateRoomStatus } from "../services/roomsService.js";
import { buildSelectOptions, createOptionList, escapeHtml, formatCurrency, friendlyError, qs, render, serializeForm, withFormBusy } from "../utils.js";
import { closeModal, confirmDialog, createPageHeader, openModal, showToast } from "../ui.js";

const MAX_ROOM_IMAGE_SIZE = 1024 * 1024 * 1.5;

function buildRoomImageClass(room) {
  return `stitch-room-image${room.image_base64 ? " has-image" : ""}`;
}

function buildRoomImageStyle(room) {
  return room.image_base64 ? ` style="--room-image:url('${escapeHtml(room.image_base64)}')"` : "";
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Unable to read the selected image."));
    reader.readAsDataURL(file);
  });
}

await initProtectedPage("rooms", async ({ root, auth }) => {
  const canManageRooms = auth.profile.role === "Admin";
  let roomTypes = [];
  let filters = { status: "", roomTypeId: "", search: "" };

  async function load() {
    roomTypes = await listRoomTypes();
    const rooms = await listRooms(filters);
    const availableCount = rooms.filter((room) => room.status === "Available").length;
    const occupiedCount = rooms.filter((room) => room.status === "Occupied").length;
    const cleaningCount = rooms.filter((room) => room.status === "Cleaning").length;
    const averageRate = rooms.length ? rooms.reduce((sum, room) => sum + Number(room.rate || 0), 0) / rooms.length : 0;

    render(root, `
      ${createPageHeader({
        title: "Room Management",
        subtitle: "Inventory control, rates, and room readiness across Grand Millado Hotel.",
        actions: canManageRooms ? `
          <button class="btn btn-secondary" id="room-refresh-button" type="button">Refresh</button>
          <button class="btn btn-primary" id="add-room-button" type="button">Add Room</button>
        ` : `<button class="btn btn-secondary" id="room-refresh-button" type="button">Refresh</button>`,
      })}
      <section class="stitch-kpi-grid">
        <article class="stitch-kpi-card" style="border-left:4px solid var(--secondary-bright);">
          <h3>Available Suites</h3>
          <p class="stitch-kpi-value">${availableCount}<span style="font-size:1.1rem; opacity:.4;">/${rooms.length}</span></p>
        </article>
        <article class="stitch-kpi-card">
          <h3>Occupied</h3>
          <p class="stitch-kpi-value">${occupiedCount}</p>
        </article>
        <article class="stitch-kpi-card">
          <h3>Turnover Required</h3>
          <p class="stitch-kpi-value">${cleaningCount}</p>
        </article>
        <article class="stitch-kpi-card">
          <h3>ADR Today</h3>
          <p class="stitch-kpi-value">${formatCurrency(averageRate)}</p>
        </article>
      </section>

      <section class="panel" style="margin-bottom:28px;">
        <div class="filter-row">
          <div class="field">
            <label for="room-filter-status">Room Status</label>
            <select id="room-filter-status">${buildSelectOptions(ROOM_STATUSES)}<\/select>
          </div>
          <div class="field">
            <label for="room-filter-type">Room Type</label>
            <select id="room-filter-type">${createOptionList(roomTypes, "id", "name", "All room types")}<\/select>
          </div>
          <div class="field">
            <label for="room-search">Search Room</label>
            <input id="room-search" type="search" placeholder="Search by room number">
          </div>
        </div>
      </section>

      <section class="stitch-room-grid">
        ${rooms.map((room) => `
          <article class="stitch-room-card">
            <div class="${buildRoomImageClass(room)}"${buildRoomImageStyle(room)}>
              <div class="stitch-room-status status-${room.status.toLowerCase().replaceAll(" ", "-")}">${room.status}</div>
            </div>
            <div class="stitch-room-body">
              <div style="display:flex; justify-content:space-between; gap:16px; align-items:start;">
                <div>
                  <h3>${room.room_types?.name || "Room"}</h3>
                  <div class="stitch-room-meta">Room ${room.room_number} - Floor ${room.floor}</div>
                </div>
                <div class="stitch-room-rate">${formatCurrency(room.rate || 0)}</div>
              </div>
              <div class="stitch-room-divider">
                <div class="stitch-mini-meta">
                  <span>${room.amenities || "No amenities listed"}</span>
                </div>
                <p class="muted" style="margin:10px 0 0;">${room.room_types?.inclusions || "No inclusions listed"}</p>
              </div>
              <div class="table-actions" style="margin-top:18px;">
                <a class="link-action" href="room-details.html?id=${room.id}">View</a>
                ${canManageRooms ? `
                  <button class="btn btn-ghost room-edit-button" data-id="${room.id}" type="button">Edit</button>
                  <button class="btn btn-ghost room-status-button" data-id="${room.id}" data-status="${room.status}" type="button">Update Status</button>
                  <button class="btn btn-danger room-delete-button" data-id="${room.id}" type="button">Delete</button>
                ` : ""}
              </div>
            </div>
          </article>
        `).join("")}
      </section>
    `);

    qs("#room-filter-status").value = filters.status;
    qs("#room-filter-type").value = filters.roomTypeId;
    qs("#room-search").value = filters.search;

    bindEvents(rooms);
  }

  function roomFormMarkup(room = {}) {
    return `
      <form id="room-form" class="form-stack">
        <input name="id" type="hidden" value="${room.id || ""}">
        <div class="filter-row">
          <div class="field">
            <label for="room_number">Room Number</label>
            <input id="room_number" name="room_number" value="${room.room_number || ""}" required>
          </div>
          <div class="field">
            <label for="floor">Floor</label>
            <input id="floor" name="floor" type="number" min="1" value="${room.floor || ""}" required>
          </div>
        </div>
        <div class="filter-row">
          <div class="field">
            <label for="room_type_id">Room Type</label>
            <select id="room_type_id" name="room_type_id" required>${createOptionList(roomTypes, "id", "name", "Select room type")}<\/select>
          </div>
          <div class="field">
            <label for="status">Status</label>
            <select id="status" name="status">${buildSelectOptions(ROOM_STATUSES, "Select status")}<\/select>
          </div>
        </div>
        <div class="filter-row">
          <div class="field">
            <label for="rate">Rate</label>
            <input id="rate" name="rate" type="number" min="0" step="0.01" value="${room.rate || ""}" required>
          </div>
          <div class="field">
            <label for="amenities">Amenities</label>
            <input id="amenities" name="amenities" value="${room.amenities || ""}" placeholder="Butler service, minibar, balcony">
          </div>
        </div>
        <div class="field">
          <label for="notes">Notes</label>
          <textarea id="notes" name="notes">${room.notes || ""}</textarea>
        </div>
        <div class="field">
          <label for="room-image-upload">Room Image</label>
          <input id="room-image-upload" name="room-image-upload" type="file" accept="image/*">
          <input id="image_base64" name="image_base64" type="hidden" value="${room.image_base64 || ""}">
          <p class="field-help">Upload a room image. It will be stored as base64 text in Supabase for this project build.</p>
          <div class="room-upload-preview${room.image_base64 ? " has-image" : ""}" id="room-upload-preview"${room.image_base64 ? ` style="--room-image:url('${escapeHtml(room.image_base64)}')"` : ""}>
            <span>${room.image_base64 ? "Current room image" : "No image selected"}</span>
          </div>
          <div class="button-row">
            <button class="btn btn-ghost" id="clear-room-image-button" type="button">Remove Image</button>
          </div>
        </div>
        <button class="btn btn-primary" type="submit">${room.id ? "Save Changes" : "Add Room"}</button>
      </form>
    `;
  }

  function bindRoomForm(room = {}) {
    qs("#room_type_id").value = room.room_type_id || "";
    qs("#status").value = room.status || ROOM_STATUSES[0];
    const imageInput = qs("#room-image-upload");
    const imageValue = qs("#image_base64");
    const imagePreview = qs("#room-upload-preview");
    const clearImageButton = qs("#clear-room-image-button");

    function syncImagePreview(value) {
      imagePreview.classList.toggle("has-image", Boolean(value));
      if (value) {
        imagePreview.style.setProperty("--room-image", `url('${value.replaceAll("'", "\\'")}')`);
        imagePreview.querySelector("span").textContent = "Current room image";
      } else {
        imagePreview.style.removeProperty("--room-image");
        imagePreview.querySelector("span").textContent = "No image selected";
      }
    }

    imageInput.addEventListener("change", async (event) => {
      const [file] = event.target.files || [];
      if (!file) {
        return;
      }

      if (file.size > MAX_ROOM_IMAGE_SIZE) {
        showToast("Room image is too large. Use an image under 1.5 MB.", "error");
        event.target.value = "";
        return;
      }

      try {
        const base64 = await readFileAsDataUrl(file);
        imageValue.value = base64;
        syncImagePreview(base64);
      } catch (error) {
        showToast(friendlyError(error, "Unable to read the selected image."), "error");
      }
    });

    clearImageButton.addEventListener("click", () => {
      imageInput.value = "";
      imageValue.value = "";
      syncImagePreview("");
    });

    qs("#room-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        await withFormBusy(event.currentTarget, room.id ? "Saving..." : "Creating...", async () => {
          const payload = serializeForm(event.currentTarget);
          payload.floor = Number(payload.floor);
          payload.rate = Number(payload.rate);
          payload.room_type_id = Number(payload.room_type_id);
          delete payload["room-image-upload"];
          if (!payload.id) {
            delete payload.id;
          } else {
            payload.id = Number(payload.id);
          }

          const saved = await saveRoom(payload);
          await createAuditLog({
            userId: auth.user.id,
            action: room.id ? "Updated room" : "Created room",
            entityType: "rooms",
            entityId: saved.id,
            details: `Room ${saved.room_number}`,
          });
          await load();
          closeModal();
          showToast("Room saved successfully.", "success");
        });
      } catch (error) {
        showToast(friendlyError(error), "error");
      }
    });
  }

  function bindEvents(rooms) {
    qs("#add-room-button")?.addEventListener("click", () => {
      openModal({ title: "Add Room", body: roomFormMarkup() });
      bindRoomForm();
    });

    qs("#room-refresh-button").addEventListener("click", load);
    qs("#room-filter-status").addEventListener("change", async (event) => { filters.status = event.target.value; await load(); });
    qs("#room-filter-type").addEventListener("change", async (event) => { filters.roomTypeId = event.target.value; await load(); });
    qs("#room-search").addEventListener("input", async (event) => { filters.search = event.target.value.trim(); await load(); });

    root.querySelectorAll(".room-edit-button").forEach((button) => button.addEventListener("click", () => {
      const room = rooms.find((item) => item.id === Number(button.dataset.id));
      openModal({ title: `Edit Room ${room.room_number}`, body: roomFormMarkup(room) });
      bindRoomForm(room);
    }));

    root.querySelectorAll(".room-status-button").forEach((button) => button.addEventListener("click", async () => {
      const nextStatus = prompt(`Update room status for room ${button.dataset.id}`, button.dataset.status);
      if (!nextStatus || !ROOM_STATUSES.includes(nextStatus)) {
        return;
      }
      try {
        const room = await updateRoomStatus(Number(button.dataset.id), nextStatus);
        await createAuditLog({
          userId: auth.user.id,
          action: "Updated room status",
          entityType: "rooms",
          entityId: room.id,
          details: `${room.room_number} -> ${room.status}`,
        });
        showToast("Room status updated.", "success");
        await load();
      } catch (error) {
        showToast(friendlyError(error), "error");
      }
    }));

    root.querySelectorAll(".room-delete-button").forEach((button) => button.addEventListener("click", async () => {
      if (!await confirmDialog({ title: "Delete room", message: "This will permanently remove the room record.", confirmLabel: "Delete", tone: "danger" })) {
        return;
      }
      try {
        await deleteRoom(Number(button.dataset.id));
        await createAuditLog({
          userId: auth.user.id,
          action: "Deleted room",
          entityType: "rooms",
          entityId: Number(button.dataset.id),
          details: "Room removed from inventory",
        });
        showToast("Room deleted.", "success");
        await load();
      } catch (error) {
        showToast(friendlyError(error), "error");
      }
    }));
  }

  await load();
});
