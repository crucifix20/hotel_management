import { initProtectedPage } from "../router.js";
import { createAuditLog } from "../services/auditService.js";
import { deleteGuest, listGuests, saveGuest } from "../services/guestsService.js";
import { buildSelectOptions, friendlyError, qs, render, serializeForm, withFormBusy } from "../utils.js";
import { closeModal, confirmDialog, createPageHeader, createVipBadge, openModal, showToast } from "../ui.js";

await initProtectedPage("guests", async ({ root, auth }) => {
  const canDeleteGuests = auth.profile.role === "Admin";
  const GUEST_TYPE_OPTIONS = ["FIT", "Airline Crew", "Travel Agency Account", "Corporate Account", "OFW", "Balikbayan", "Others"];
  let filters = { search: "", vipOnly: false, clubStatus: "" };

  async function load() {
    const guests = await listGuests(filters);
    const vipCount = guests.filter((guest) => guest.vip_status).length;
    const clubMembers = guests.filter((guest) => (guest.club_registrations || []).length > 0).length;

    render(root, `
      ${createPageHeader({
        title: "Guest Profiles",
        subtitle: "Profiles, preferences, stay history, and VIP relationship detail.",
        actions: `<button class="btn btn-primary" id="add-guest-button" type="button">Add Guest</button>`,
      })}
      <section class="stitch-kpi-grid">
        <article class="stitch-kpi-card" style="border-left:4px solid var(--secondary-bright);">
          <h3>Total Guests</h3>
          <p class="stitch-kpi-value">${guests.length}</p>
        </article>
        <article class="stitch-kpi-card">
          <h3>VIP Guests</h3>
          <p class="stitch-kpi-value">${vipCount}</p>
        </article>
        <article class="stitch-kpi-card">
          <h3>Club Members</h3>
          <p class="stitch-kpi-value">${clubMembers}</p>
        </article>
        <article class="stitch-kpi-card">
          <h3>Profiles with Preferences</h3>
          <p class="stitch-kpi-value">${guests.filter((guest) => guest.preferences).length}</p>
        </article>
      </section>
      <section class="panel" style="margin-bottom:22px;">
        <div class="filter-row">
          <div class="field">
            <label for="guest-search">Search</label>
            <input id="guest-search" type="search" placeholder="Search guest, email, or phone">
          </div>
          <div class="field">
            <label for="guest-club-status">Club Membership Status</label>
            <select id="guest-club-status">${buildSelectOptions(["Active", "Pending", "Expired", "Cancelled", "Suspended"], "All statuses")}<\/select>
          </div>
          <div class="field">
            <label for="guest-vip-only">VIP Guests</label>
            <select id="guest-vip-only">
              <option value="">All guests</option>
              <option value="true">VIP only</option>
            </select>
          </div>
        </div>
      </section>
      <section class="card-grid">
        ${guests.map((guest) => `
          <article class="panel" style="border-left:${guest.vip_status ? "4px solid var(--secondary-bright)" : "0"};">
            <div class="panel-header">
              <div>
                <h2 class="font-display" style="margin:0 0 6px; font-size:1.5rem;">${guest.full_name}</h2>
                <p class="card-subtitle">${guest.address || "No address recorded"}</p>
              </div>
              <div>${guest.vip_status ? createVipBadge("VIP") : '<span class="status-badge status-standard">Standard</span>'}</div>
            </div>
            <div class="stack-sm">
              <div><strong>Email:</strong> ${guest.email || "-"}</div>
              <div><strong>Phone:</strong> ${guest.phone || "-"}</div>
              <div><strong>Guest Type:</strong> ${guest.guest_type || "-"}</div>
              <div><strong>Preferences:</strong> ${guest.preferences || "None recorded"}</div>
              <div><strong>Club Memberships:</strong> ${(guest.club_registrations || []).map((membership) => `${membership.clubs?.name || "Club"} - ${membership.membership_level || "Member"}`).join(", ") || "None"}</div>
            </div>
            <div class="table-actions" style="margin-top:18px;">
              <a class="link-action" href="guest-details.html?id=${guest.id}">View</a>
              <button class="btn btn-ghost guest-edit-button" data-id="${guest.id}" type="button">Edit</button>
              ${canDeleteGuests ? `<button class="btn btn-danger guest-delete-button" data-id="${guest.id}" type="button">Delete</button>` : ""}
            </div>
          </article>
        `).join("")}
      </section>
    `);

    qs("#guest-search").value = filters.search;
    qs("#guest-club-status").value = filters.clubStatus;
    qs("#guest-vip-only").value = filters.vipOnly ? "true" : "";
    bindEvents(guests);
  }

  function guestFormMarkup(guest = {}) {
    const isCustomGuestType = guest.guest_type && !GUEST_TYPE_OPTIONS.includes(guest.guest_type);
    const guestTypeValue = isCustomGuestType ? "Others" : guest.guest_type || "";
    return `
      <form id="guest-form" class="form-stack">
        <input name="id" type="hidden" value="${guest.id || ""}">
        <div class="filter-row">
          <div class="field">
            <label for="full_name">Full Name</label>
            <input id="full_name" name="full_name" value="${guest.full_name || ""}" required>
          </div>
          <div class="field">
            <label for="email">Email</label>
            <input id="email" name="email" type="email" value="${guest.email || ""}">
          </div>
        </div>
        <div class="filter-row">
          <div class="field">
            <label for="phone">Phone</label>
            <input id="phone" name="phone" value="${guest.phone || ""}">
          </div>
          <div class="field">
            <label for="vip_status">VIP Status</label>
            <select id="vip_status" name="vip_status">
              <option value="false">Standard</option>
              <option value="true">VIP</option>
            </select>
          </div>
        </div>
        <div class="field">
          <label for="address">Address</label>
          <input id="address" name="address" value="${guest.address || ""}">
        </div>
        <div class="filter-row">
          <div class="field">
            <label for="company_name">Company Name</label>
            <input id="company_name" name="company_name" value="${guest.company_name || ""}">
          </div>
          <div class="field">
            <label for="nationality">Nationality</label>
            <input id="nationality" name="nationality" value="${guest.nationality || ""}">
          </div>
        </div>
        <div class="filter-row">
          <div class="field">
            <label for="origin">Origin</label>
            <input id="origin" name="origin" value="${guest.origin || ""}">
          </div>
          <div class="field">
            <label for="booking_person">Booking Person</label>
            <input id="booking_person" name="booking_person" value="${guest.booking_person || ""}">
          </div>
        </div>
        <div class="filter-row">
          <div class="field">
            <label for="guest_type">Guest Type</label>
            <select id="guest_type" name="guest_type">
              <option value="">Select guest type</option>
              ${GUEST_TYPE_OPTIONS.map((type) => `<option value="${type}" ${type === guestTypeValue ? "selected" : ""}>${type}</option>`).join("")}
            </select>
          </div>
          <div class="field" id="guest-type-other-field" style="display:${guestTypeValue === "Others" ? "block" : "none"};">
            <label for="guest_type_other">Other Guest Type</label>
            <input id="guest_type_other" name="guest_type_other" value="${isCustomGuestType ? guest.guest_type : ""}" placeholder="Enter guest type">
          </div>
        </div>
        <div class="field">
          <label for="preferences">Preferences</label>
          <textarea id="preferences" name="preferences">${guest.preferences || ""}</textarea>
        </div>
        <div class="field">
          <label for="notes">Notes</label>
          <textarea id="notes" name="notes">${guest.notes || ""}</textarea>
        </div>
        <button class="btn btn-primary" type="submit">${guest.id ? "Save Changes" : "Add Guest"}</button>
      </form>
    `;
  }

  function bindGuestForm(guest = {}) {
    qs("#vip_status").value = guest.vip_status ? "true" : "false";
    const syncGuestTypeOther = () => {
      qs("#guest-type-other-field").style.display = qs("#guest_type").value === "Others" ? "block" : "none";
    };
    qs("#guest_type").addEventListener("change", syncGuestTypeOther);
    syncGuestTypeOther();
    qs("#guest-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        await withFormBusy(event.currentTarget, guest.id ? "Saving..." : "Creating...", async () => {
          const payload = serializeForm(event.currentTarget);
          payload.vip_status = payload.vip_status === "true";
          payload.guest_type = payload.guest_type === "Others" ? payload.guest_type_other?.trim() || "Others" : payload.guest_type || null;
          delete payload.guest_type_other;
          if (!payload.id) {
            delete payload.id;
          } else {
            payload.id = Number(payload.id);
          }
          const saved = await saveGuest(payload);
          await createAuditLog({
            userId: auth.user.id,
            action: guest.id ? "Updated guest" : "Created guest",
            entityType: "guests",
            entityId: saved.id,
            details: saved.full_name,
          });
          await load();
          closeModal();
          showToast("Guest saved successfully.", "success");
        });
      } catch (error) {
        showToast(friendlyError(error), "error");
      }
    });
  }

  function bindEvents(guests) {
    qs("#add-guest-button").addEventListener("click", () => {
      openModal({ title: "Add Guest", body: guestFormMarkup() });
      bindGuestForm();
    });

    qs("#guest-search").addEventListener("input", async (event) => { filters.search = event.target.value.trim(); await load(); });
    qs("#guest-club-status").addEventListener("change", async (event) => { filters.clubStatus = event.target.value; await load(); });
    qs("#guest-vip-only").addEventListener("change", async (event) => { filters.vipOnly = event.target.value === "true"; await load(); });

    root.querySelectorAll(".guest-edit-button").forEach((button) => button.addEventListener("click", () => {
      const guest = guests.find((item) => item.id === Number(button.dataset.id));
      openModal({ title: `Edit ${guest.full_name}`, body: guestFormMarkup(guest) });
      bindGuestForm(guest);
    }));

    root.querySelectorAll(".guest-delete-button").forEach((button) => button.addEventListener("click", async () => {
      if (!await confirmDialog({ title: "Delete guest", message: "This removes the guest profile from the system.", confirmLabel: "Delete", tone: "danger" })) {
        return;
      }
      try {
        await deleteGuest(Number(button.dataset.id));
        await createAuditLog({
          userId: auth.user.id,
          action: "Deleted guest",
          entityType: "guests",
          entityId: Number(button.dataset.id),
          details: "Guest profile removed",
        });
        showToast("Guest deleted.", "success");
        await load();
      } catch (error) {
        showToast(friendlyError(error), "error");
      }
    }));
  }

  await load();
});
