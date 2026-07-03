import { ROLES } from "../config.js";
import { initProtectedPage } from "../router.js";
import { createAuditLog } from "../services/auditService.js";
import { deleteAmenity, listAmenities, saveAmenity } from "../services/amenitiesService.js";
import { deleteHotelService, listHotelServices, saveHotelService } from "../services/hotelServicesService.js";
import { buildSelectOptions, friendlyError, formatCurrency, qs, render, serializeForm, withFormBusy } from "../utils.js";
import { closeModal, confirmDialog, createPageHeader, createStatusBadge, openModal, showToast } from "../ui.js";

await initProtectedPage("amenities", async ({ root, auth }) => {
  const isAdmin = auth.profile.role === ROLES.ADMIN;

  async function load() {
    const [amenities, hotelServices] = await Promise.all([
      listAmenities(),
      listHotelServices(),
    ]);
    const activeAmenities = amenities.filter((amenity) => amenity.status === "Available").length;
    const activeServices = hotelServices.filter((service) => service.status === "Available").length;

    render(root, `
      ${createPageHeader({
        title: "Amenities & Services",
        subtitle: "Manage amenity and in-stay service catalogues, pricing, and availability.",
        actions: `
          ${isAdmin ? `<button class="btn btn-secondary" id="add-amenity-button" type="button">Add Amenity</button>` : ""}
          ${isAdmin ? `<button class="btn btn-primary" id="add-service-button" type="button">Add Service / Price</button>` : ""}
        `,
      })}
      <section class="stitch-kpi-grid">
        <article class="stitch-kpi-card">
          <div class="stitch-kpi-iconrow"><span class="stitch-kpi-tag">Catalogue</span></div>
          <h3>Active Amenities</h3>
          <div class="stitch-kpi-value">${activeAmenities}</div>
          <p class="stitch-kpi-note">${amenities.length} amenities configured</p>
        </article>
        <article class="stitch-kpi-card">
          <div class="stitch-kpi-iconrow"><span class="stitch-kpi-tag">Revenue</span></div>
          <h3>Amenity Pricing</h3>
          <div class="stitch-kpi-value">${formatCurrency(amenities.reduce((sum, amenity) => sum + Number(amenity.price || 0), 0))}</div>
          <p class="stitch-kpi-note">Combined configured amenity rates.</p>
        </article>
        <article class="stitch-kpi-card">
          <div class="stitch-kpi-iconrow"><span class="stitch-kpi-tag">Services</span></div>
          <h3>Service Catalogue</h3>
          <div class="stitch-kpi-value">${activeServices}</div>
          <p class="stitch-kpi-note">${hotelServices.length} priced services configured</p>
        </article>
      </section>
      <section class="stitch-overview-card" style="margin-top:24px;">
          <div class="stitch-overview-head">
            <div>
              <h2>Amenity Catalogue</h2>
              <p>Guest amenities and premium experiences that can be booked separately.</p>
            </div>
          </div>
          <div class="stitch-service-grid">
            ${amenities.map((amenity) => `
              <article class="stitch-service-card">
                <div class="stitch-room-image stitch-service-image">
                  <span class="stitch-room-status status-${String(amenity.status || "").toLowerCase().replace(/[^a-z0-9]+/g, "-")}">${amenity.status}</span>
                </div>
                <div class="stitch-room-body">
                  <h3>${amenity.name}</h3>
                  <p class="stitch-room-meta">${amenity.description || "Premium hotel service offering."}</p>
                  <div class="stitch-room-rate">${formatCurrency(amenity.price)}</div>
                  <div class="stitch-mini-meta">
                    <span>Catalogue item</span>
                    <span>${createStatusBadge(amenity.status)}</span>
                  </div>
                  ${isAdmin ? `
                    <div class="table-actions" style="margin-top:18px;">
                      <button class="btn btn-ghost amenity-edit-button" data-id="${amenity.id}" type="button">Edit</button>
                      <button class="btn btn-danger amenity-delete-button" data-id="${amenity.id}" type="button">Delete</button>
                    </div>
                  ` : ""}
                </div>
              </article>
            `).join("") || `<div class="empty-state"><h3 class="font-display">No amenities configured</h3><p>Add an amenity to configure available guest offerings.</p></div>`}
          </div>
      </section>
      <section class="stitch-overview-card" style="margin-top:24px;">
        <div class="stitch-overview-head">
          <div>
            <h2>Priced Service Catalogue</h2>
            <p>Admin-defined in-stay services such as transportation, extra pillow, escort, laundry, or room service.</p>
          </div>
        </div>
        <div class="table-wrap">
          <table class="stitch-overview-table">
            <thead>
              <tr><th>Service</th><th>Category</th><th>Price</th><th>Status</th><th>Chargeable</th><th>Actions</th></tr>
            </thead>
            <tbody>
              ${hotelServices.map((service) => `
                <tr>
                  <td><strong>${service.name}</strong><div class="muted">${service.description || ""}</div></td>
                  <td>${service.category}</td>
                  <td>${formatCurrency(service.price)}</td>
                  <td>${createStatusBadge(service.status)}</td>
                  <td>${service.is_chargeable ? "Yes" : "No"}</td>
                  <td>${isAdmin ? `<div class="table-actions"><button class="btn btn-ghost service-edit-button" data-id="${service.id}" type="button">Edit</button><button class="btn btn-danger service-delete-button" data-id="${service.id}" type="button">Delete</button></div>` : `<span class="muted">Admin only</span>`}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </section>
    `);

    function serviceFormMarkup(service = {}) {
      return `
        <form id="hotel-service-form" class="form-stack">
          <input name="id" type="hidden" value="${service.id || ""}">
          <div class="field">
            <label for="service_name">Service Name</label>
            <input id="service_name" name="name" placeholder="Example: Shuttle" value="${service.name || ""}" required>
            <p class="field-help">This is the service staff can later book for a checked-in guest.</p>
          </div>
          <div class="field"><label for="service_description">Description</label><textarea id="service_description" name="description">${service.description || ""}</textarea></div>
          <div class="filter-row">
            <div class="field"><label for="service_category">Category</label><select id="service_category" name="category">${buildSelectOptions(["Room Service", "Housekeeping", "Food & Beverage", "Spa", "Transport", "Laundry", "Other"], "Select category")}</select></div>
            <div class="field">
              <label for="service_price">Default Price</label>
              <input id="service_price" name="price" type="number" min="0" step="0.01" value="${service.price || 0}" required>
              <p class="field-help">Set the transportation or service price that staff will use for guest requests.</p>
            </div>
          </div>
          <div class="filter-row">
            <div class="field"><label for="service_status">Status</label><select id="service_status" name="status">${buildSelectOptions(["Available", "Unavailable"], "Select status")}</select></div>
            <div class="checkbox-field"><label class="checkbox-label"><input id="is_chargeable" name="is_chargeable" type="checkbox" ${service.is_chargeable !== false ? "checked" : ""}> Chargeable service</label></div>
          </div>
          <button class="btn btn-primary" type="submit">${service.id ? "Save Service" : "Add Service"}</button>
        </form>
      `;
    }

    function bindServiceForm(service = {}) {
      qs("#service_category").value = service.category || "Other";
      qs("#service_status").value = service.status || "Available";
      qs("#hotel-service-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        try {
          await withFormBusy(event.currentTarget, service.id ? "Saving..." : "Creating...", async () => {
            const payload = serializeForm(event.currentTarget);
            payload.price = Number(payload.price);
            payload.is_chargeable = payload.is_chargeable === "on";
            if (!payload.id) {
              delete payload.id;
            } else {
              payload.id = Number(payload.id);
            }
            const saved = await saveHotelService(payload);
            await createAuditLog({
              userId: auth.user.id,
              action: service.id ? "Updated hotel service" : "Created hotel service",
              entityType: "hotel_services",
              entityId: saved.id,
              details: saved.name,
            });
            await load();
            closeModal();
            showToast("Hotel service saved.", "success");
          });
        } catch (error) {
          showToast(friendlyError(error), "error");
        }
      });
    }

    function amenityFormMarkup(amenity = {}) {
      return `
        <form id="amenity-form" class="form-stack">
          <input name="id" type="hidden" value="${amenity.id || ""}">
          <div class="field">
            <label for="name">Amenity / Service Name</label>
            <input id="name" name="name" value="${amenity.name || ""}" required>
          </div>
          <div class="field">
            <label for="description">Description</label>
            <textarea id="description" name="description">${amenity.description || ""}</textarea>
          </div>
          <div class="filter-row">
            <div class="field">
              <label for="price">Price</label>
              <input id="price" name="price" type="number" min="0" step="0.01" value="${amenity.price || ""}" required>
            </div>
            <div class="field">
              <label for="status">Status</label>
              <select id="status" name="status">
                <option value="Available">Available</option>
                <option value="Paused">Paused</option>
                <option value="Archived">Archived</option>
              </select>
            </div>
          </div>
          <button class="btn btn-primary" type="submit">${amenity.id ? "Save Changes" : "Add Amenity"}</button>
        </form>
      `;
    }

    function bindAmenityForm(amenity = {}) {
      qs("#status").value = amenity.status || "Available";
      qs("#amenity-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        try {
          await withFormBusy(event.currentTarget, amenity.id ? "Saving..." : "Creating...", async () => {
            const payload = serializeForm(event.currentTarget);
            payload.price = Number(payload.price);
            if (!payload.id) {
              delete payload.id;
            } else {
              payload.id = Number(payload.id);
            }
            const saved = await saveAmenity(payload);
            await createAuditLog({
              userId: auth.user.id,
              action: amenity.id ? "Updated amenity" : "Created amenity",
              entityType: "amenities",
              entityId: saved.id,
              details: saved.name,
            });
            await load();
            closeModal();
            showToast("Amenity saved.", "success");
          });
        } catch (error) {
          showToast(friendlyError(error), "error");
        }
      });
    }

    qs("#add-amenity-button")?.addEventListener("click", () => {
      openModal({ title: "Add Amenity", body: amenityFormMarkup() });
      bindAmenityForm();
    });

    qs("#add-service-button")?.addEventListener("click", () => {
      openModal({ title: "Add Service / Price", body: serviceFormMarkup() });
      bindServiceForm();
    });

    root.querySelectorAll(".amenity-edit-button").forEach((button) => button.addEventListener("click", () => {
      const amenity = amenities.find((item) => item.id === Number(button.dataset.id));
      openModal({ title: `Edit ${amenity.name}`, body: amenityFormMarkup(amenity) });
      bindAmenityForm(amenity);
    }));

    root.querySelectorAll(".amenity-delete-button").forEach((button) => button.addEventListener("click", async () => {
      if (!await confirmDialog({ title: "Delete amenity", message: "This removes the service from the catalogue.", confirmLabel: "Delete", tone: "danger" })) {
        return;
      }
      try {
        await deleteAmenity(Number(button.dataset.id));
        await createAuditLog({
          userId: auth.user.id,
          action: "Deleted amenity",
          entityType: "amenities",
          entityId: Number(button.dataset.id),
          details: "Amenity removed from catalogue",
        });
        showToast("Amenity deleted.", "success");
        await load();
      } catch (error) {
        showToast(friendlyError(error), "error");
      }
    }));

    root.querySelectorAll(".service-edit-button").forEach((button) => button.addEventListener("click", () => {
      const service = hotelServices.find((item) => item.id === Number(button.dataset.id));
      openModal({ title: `Edit ${service.name}`, body: serviceFormMarkup(service) });
      bindServiceForm(service);
    }));

    root.querySelectorAll(".service-delete-button").forEach((button) => button.addEventListener("click", async () => {
      if (!await confirmDialog({ title: "Delete service", message: "This removes the service from the operational catalogue.", confirmLabel: "Delete", tone: "danger" })) {
        return;
      }
      try {
        await deleteHotelService(Number(button.dataset.id));
        await createAuditLog({
          userId: auth.user.id,
          action: "Deleted hotel service",
          entityType: "hotel_services",
          entityId: Number(button.dataset.id),
          details: "Service removed from catalogue",
        });
        showToast("Hotel service deleted.", "success");
        await load();
      } catch (error) {
        showToast(friendlyError(error), "error");
      }
    }));
  }

  await load();
});
