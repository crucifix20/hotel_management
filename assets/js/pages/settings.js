import { initProtectedPage } from "../router.js";
import { createAuditLog } from "../services/auditService.js";
import { deleteRoomType, listRoomTypes, saveRoomType } from "../services/roomsService.js";
import { deleteAllStaffTransactions } from "../services/staffAccountingService.js";
import { closeModal, confirmDialog, createPageHeader, openModal, showToast } from "../ui.js";
import { escapeHtml, friendlyError, formatCurrency, getStoredSettings, qs, render, saveStoredSettings, serializeForm, withFormBusy } from "../utils.js";

await initProtectedPage("settings", async ({ root, auth }) => {
  async function load() {
    const settings = getStoredSettings();
    const roomTypes = await listRoomTypes();

    render(root, `
      ${createPageHeader({
        title: "Settings",
        subtitle: "Hotel profile defaults, tax configuration, room types, and role visibility controls.",
      })}
      <section class="stitch-kpi-grid">
        <article class="stitch-kpi-card">
          <div class="stitch-kpi-iconrow"><span class="stitch-kpi-tag">Brand</span></div>
          <h3>Hotel Name</h3>
          <div class="stitch-kpi-value" style="font-size:1.8rem;">Grand Millado Hotel</div>
          <p class="stitch-kpi-note">Applied across dashboard, login, and print output</p>
        </article>
        <article class="stitch-kpi-card">
          <div class="stitch-kpi-iconrow"><span class="stitch-kpi-tag">Tax</span></div>
          <h3>Tax Rate</h3>
          <div class="stitch-kpi-value">${Number(settings.taxRate || 0).toFixed(2)}%</div>
          <p class="stitch-kpi-note">Used when generating invoices</p>
        </article>
        <article class="stitch-kpi-card">
          <div class="stitch-kpi-iconrow"><span class="stitch-kpi-tag">Rooms</span></div>
          <h3>Room Types</h3>
          <div class="stitch-kpi-value">${roomTypes.length}</div>
          <p class="stitch-kpi-note">Inventory classes configured</p>
        </article>
      </section>
      <section class="stitch-main-grid" style="margin-top:24px;">
        <div class="stitch-overview-card">
          <div class="stitch-overview-head">
            <div>
              <h2>Hotel Profile</h2>
              <p>Used for branding and booking confirmation output.</p>
            </div>
          </div>
          <form id="settings-form" class="form-stack">
            <div class="field">
              <label for="hotelName">Hotel Name</label>
              <input id="hotelName" name="hotelName" value="${settings.hotelName}">
            </div>
            <div class="field">
              <label for="address">Address</label>
              <input id="address" name="address" value="${settings.address}">
            </div>
            <div class="field">
              <label for="contact">Contact</label>
              <input id="contact" name="contact" value="${settings.contact}">
            </div>
            <div class="field">
              <label for="taxRate">Tax Rate (%)</label>
              <input id="taxRate" name="taxRate" type="number" min="0" step="0.01" value="${settings.taxRate}">
            </div>
            <button class="btn btn-primary" type="submit">Save Settings</button>
          </form>
        </div>
        <aside class="stitch-arrivals-card">
          <div class="stitch-section-head">
            <div>
              <h2>Role Visibility</h2>
              <p>Frontend access rules active in this build.</p>
            </div>
          </div>
          <article class="timeline-item">
            <strong>Admin</strong>
            <p class="muted">Full access to all modules and all record-management workflows.</p>
          </article>
          <article class="timeline-item">
            <strong>Staff</strong>
            <p class="muted">Dashboard, rooms, reservations, reservation calendar, guests, and booking confirmations through reservation records.</p>
          </article>
        </aside>
      </section>
      <section class="stitch-main-grid" style="margin-top:24px;">
        <div class="stitch-overview-card">
          <div class="stitch-overview-head">
            <div>
              <h2>Current User</h2>
              <p>Signed-in account details for this session.</p>
            </div>
          </div>
          <div class="detail-grid">
            <dl class="detail-kv">
              <dt>Name</dt>
              <dd>${escapeHtml(auth.profile?.full_name || "Grand Millado User")}</dd>
            </dl>
            <dl class="detail-kv">
              <dt>Email</dt>
              <dd>${escapeHtml(auth.user?.email || "-")}</dd>
            </dl>
            <dl class="detail-kv">
              <dt>Role</dt>
              <dd>${escapeHtml(auth.profile?.role || "Staff")}</dd>
            </dl>
            <dl class="detail-kv">
              <dt>Password</dt>
              <dd>Password is protected by Supabase Auth and cannot be displayed after it is created.</dd>
            </dl>
          </div>
        </div>
        <aside class="stitch-arrivals-card">
          <div class="stitch-section-head">
            <div>
              <h2>Staff Transactions</h2>
              <p>Remove every cashier closing payment record created by staff users.</p>
            </div>
          </div>
          <article class="timeline-item">
            <strong>Delete All Staff Transactions</strong>
            <p class="muted">Deletes payment records received by linked staff login accounts. This cannot be undone.</p>
          </article>
          <button class="btn btn-danger" id="delete-staff-transactions-button" type="button">Delete All Staff Transactions</button>
        </aside>
      </section>
      <section class="stitch-overview-card" style="margin-top:24px;">
        <div class="stitch-overview-head">
          <div>
            <h2>Room Type Register</h2>
            <p>${roomTypes.length} room types configured.</p>
          </div>
          <button class="btn btn-secondary" id="add-room-type-button" type="button">Add Room Type</button>
        </div>
        <div class="room-type-register">
          ${roomTypes.map((roomType) => `
            <article class="room-type-card">
              <div class="room-type-card-main">
                <div class="room-type-title-row">
                  <h3>${roomType.name}</h3>
                  <div class="room-type-metrics">
                    <span><strong>${formatCurrency(roomType.base_rate)}</strong> Base Rate</span>
                    <span><strong>${roomType.capacity}</strong> Capacity</span>
                  </div>
                </div>
                <div class="room-type-copy-grid">
                  <div>
                    <span class="room-type-label">Description</span>
                    <p>${roomType.description || "No description recorded."}</p>
                  </div>
                  <div>
                    <span class="room-type-label">Inclusions</span>
                    <p>${roomType.inclusions || "No inclusions recorded."}</p>
                  </div>
                </div>
              </div>
              <div class="room-type-actions">
                <button class="btn btn-ghost room-type-edit-button" data-id="${roomType.id}" type="button">Edit</button>
                <button class="btn btn-danger room-type-delete-button" data-id="${roomType.id}" type="button">Delete</button>
              </div>
            </article>
          `).join("") || `<div class="empty-state"><h3 class="font-display">No room types configured</h3><p>Add a room type to define rates, capacity, and inclusions.</p></div>`}
        </div>
      </section>
    `);

    qs("#settings-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        await withFormBusy(event.currentTarget, "Saving...", async () => {
          const payload = serializeForm(event.currentTarget);
          payload.taxRate = Number(payload.taxRate);
          saveStoredSettings(payload);
          await createAuditLog({
            userId: auth.user.id,
            action: "Updated settings",
            entityType: "settings",
            details: "Updated local hotel settings",
          });
          showToast("Settings saved.", "success");
        });
      } catch (error) {
        showToast(friendlyError(error), "error");
      }
    });

    qs("#delete-staff-transactions-button")?.addEventListener("click", async () => {
      if (!await confirmDialog({
        title: "Delete all staff transactions",
        message: "This permanently deletes every payment transaction received by linked staff login accounts from the cashier closing ledger.",
        confirmLabel: "Delete All",
        tone: "danger",
      })) {
        return;
      }

      const button = qs("#delete-staff-transactions-button");
      const originalLabel = button.textContent;
      button.disabled = true;
      button.textContent = "Deleting...";

      try {
        const deletedCount = await deleteAllStaffTransactions();
        await createAuditLog({
          userId: auth.user.id,
          action: "Deleted all staff transactions",
          entityType: "payments",
          details: `Deleted ${deletedCount} staff transaction records`,
        });
        showToast(`${deletedCount} staff transaction record${deletedCount === 1 ? "" : "s"} deleted.`, "success");
      } catch (error) {
        showToast(friendlyError(error), "error");
      } finally {
        if (document.body.contains(button)) {
          button.disabled = false;
          button.textContent = originalLabel;
        }
      }
    });

    function roomTypeFormMarkup(roomType = {}) {
      return `
        <form id="room-type-form" class="form-stack">
          <input name="id" type="hidden" value="${roomType.id || ""}">
          <div class="field">
            <label for="name">Room Type Name</label>
            <input id="name" name="name" value="${roomType.name || ""}" required>
          </div>
          <div class="field">
            <label for="description">Description</label>
            <textarea id="description" name="description">${roomType.description || ""}</textarea>
          </div>
          <div class="field">
            <label for="inclusions">Inclusions</label>
            <textarea id="inclusions" name="inclusions" placeholder="Complimentary breakfast, Wi-Fi, lounge access">${roomType.inclusions || ""}</textarea>
          </div>
          <div class="filter-row">
            <div class="field">
              <label for="base_rate">Base Rate</label>
              <input id="base_rate" name="base_rate" type="number" min="0" step="0.01" value="${roomType.base_rate || ""}" required>
            </div>
            <div class="field">
              <label for="capacity">Capacity</label>
              <input id="capacity" name="capacity" type="number" min="1" value="${roomType.capacity || 2}" required>
            </div>
          </div>
          <button class="btn btn-primary" type="submit">${roomType.id ? "Save Changes" : "Add Room Type"}</button>
        </form>
      `;
    }

    function bindRoomTypeForm(roomType = {}) {
      qs("#room-type-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        try {
          await withFormBusy(event.currentTarget, roomType.id ? "Saving..." : "Creating...", async () => {
            const payload = serializeForm(event.currentTarget);
            payload.base_rate = Number(payload.base_rate);
            payload.capacity = Number(payload.capacity);
            if (!payload.id) {
              delete payload.id;
            } else {
              payload.id = Number(payload.id);
            }
            const saved = await saveRoomType(payload);
            await createAuditLog({
              userId: auth.user.id,
              action: roomType.id ? "Updated room type" : "Created room type",
              entityType: "room_types",
              entityId: saved.id,
              details: saved.name,
            });
            await load();
            closeModal();
            showToast("Room type saved.", "success");
          });
        } catch (error) {
          showToast(friendlyError(error), "error");
        }
      });
    }

    qs("#add-room-type-button").addEventListener("click", () => {
      openModal({ title: "Add Room Type", body: roomTypeFormMarkup() });
      bindRoomTypeForm();
    });

    root.querySelectorAll(".room-type-edit-button").forEach((button) => button.addEventListener("click", () => {
      const roomType = roomTypes.find((item) => item.id === Number(button.dataset.id));
      openModal({ title: `Edit ${roomType.name}`, body: roomTypeFormMarkup(roomType) });
      bindRoomTypeForm(roomType);
    }));

    root.querySelectorAll(".room-type-delete-button").forEach((button) => button.addEventListener("click", async () => {
      if (!await confirmDialog({ title: "Delete room type", message: "This removes the room type record.", confirmLabel: "Delete", tone: "danger" })) {
        return;
      }
      try {
        await deleteRoomType(Number(button.dataset.id));
        await createAuditLog({
          userId: auth.user.id,
          action: "Deleted room type",
          entityType: "room_types",
          entityId: Number(button.dataset.id),
          details: "Room type removed",
        });
        showToast("Room type deleted.", "success");
        await load();
      } catch (error) {
        showToast(friendlyError(error), "error");
      }
    }));
  }

  await load();
});
