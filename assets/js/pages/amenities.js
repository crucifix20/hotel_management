import { ROLES } from "../config.js";
import { initProtectedPage } from "../router.js";
import { createAuditLog } from "../services/auditService.js";
import { addAmenityChargeToInvoice, createInvoiceFromReservation, getReservationInvoice, saveInvoiceItem } from "../services/billingService.js";
import { deleteAmenity, listAmenityBookings, listAmenities, saveAmenity, saveAmenityBooking } from "../services/amenitiesService.js";
import { applyBenefitToServiceOrder, listApplicableBenefits } from "../services/clubsService.js";
import { listGuestOptions } from "../services/guestsService.js";
import { deleteHotelService, listHotelServices, listServiceOrders, saveHotelService, saveServiceOrder } from "../services/hotelServicesService.js";
import { listReservations } from "../services/reservationsService.js";
import { buildSelectOptions, friendlyError, formatCurrency, formatDate, qs, render, serializeForm, todayIso, withFormBusy } from "../utils.js";
import { closeModal, confirmDialog, createPageHeader, createStatusBadge, openModal, showToast } from "../ui.js";

await initProtectedPage("amenities", async ({ root, auth }) => {
  const isAdmin = auth.profile.role === ROLES.ADMIN;

  async function load() {
    const [amenities, bookings, guests, reservations, hotelServices, serviceOrders] = await Promise.all([
      listAmenities(),
      listAmenityBookings(),
      listGuestOptions(),
      listReservations({}),
      listHotelServices(),
      listServiceOrders(),
    ]);
    const revenue = bookings.reduce((sum, booking) => sum + Number(booking.total_amount || 0), 0);
    const serviceRevenue = serviceOrders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0);
    const activeAmenities = amenities.filter((amenity) => amenity.status === "Available").length;
    const activeServices = hotelServices.filter((service) => service.status === "Available").length;
    const complimentaryCount = bookings.filter((booking) => Number(booking.total_amount || 0) === 0).length;

    render(root, `
      ${createPageHeader({
        title: "Amenities & Services",
        subtitle: "Premium experiences, guest service bookings, and ancillary revenue streams.",
        actions: `
          <button class="btn btn-secondary" id="book-amenity-button" type="button">Book Amenity</button>
          <button class="btn btn-secondary" id="add-service-order-button" type="button">Add Service Order</button>
          ${isAdmin ? `<button class="btn btn-primary" id="add-amenity-button" type="button">Add Amenity</button>` : ""}
        `,
      })}
      <section class="stitch-kpi-grid">
        <article class="stitch-kpi-card">
          <div class="stitch-kpi-iconrow"><span class="stitch-kpi-tag">Catalogue</span></div>
          <h3>Active Services</h3>
          <div class="stitch-kpi-value">${activeAmenities}</div>
          <p class="stitch-kpi-note">${amenities.length} amenities configured</p>
        </article>
        <article class="stitch-kpi-card">
          <div class="stitch-kpi-iconrow"><span class="stitch-kpi-tag">Bookings</span></div>
          <h3>Service Bookings</h3>
          <div class="stitch-kpi-value">${bookings.length}</div>
          <p class="stitch-kpi-note">Amenity reservations captured</p>
        </article>
        <article class="stitch-kpi-card">
          <div class="stitch-kpi-iconrow"><span class="stitch-kpi-tag">Revenue</span></div>
          <h3>Amenity Revenue</h3>
          <div class="stitch-kpi-value">${formatCurrency(revenue)}</div>
          <p class="stitch-kpi-note">${complimentaryCount} complimentary benefit bookings</p>
        </article>
        <article class="stitch-kpi-card">
          <div class="stitch-kpi-iconrow"><span class="stitch-kpi-tag">Services</span></div>
          <h3>In-Stay Services</h3>
          <div class="stitch-kpi-value">${activeServices}</div>
          <p class="stitch-kpi-note">${formatCurrency(serviceRevenue)} posted in service orders</p>
        </article>
      </section>
      <section class="stitch-main-grid" style="margin-top:24px;">
        <div class="stitch-overview-card">
          <div class="stitch-overview-head">
            <div>
              <h2>Service Catalogue</h2>
              <p>Premium service cards adapted to the Stitch executive presentation.</p>
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
                    <span>${(amenity.amenity_bookings || []).length} bookings</span>
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
            `).join("") || `<div class="empty-state"><h3 class="font-display">No amenities configured</h3><p>Add a service to start booking ancillary revenue.</p></div>`}
          </div>
        </div>
        <aside class="stitch-arrivals-card">
          <div class="stitch-section-head">
            <div>
              <h2>Recent Bookings</h2>
              <p>Latest amenity bookings and status.</p>
            </div>
          </div>
          ${bookings.slice(0, 6).map((booking) => `
            <article class="stitch-arrival-item">
              <div class="stitch-arrival-copy">
                <strong>${booking.amenities?.name || "Amenity"}</strong>
                <small>${booking.guests?.full_name || "Guest"} &bull; ${formatDate(booking.booking_date)}</small>
              </div>
              <div class="stitch-arrival-time">
                <strong>${formatCurrency(booking.total_amount)}</strong>
                <small>${booking.status}</small>
              </div>
            </article>
          `).join("") || `<div class="empty-state"><h3 class="font-display">No bookings yet</h3><p>Bookings will appear here once services are reserved.</p></div>`}
        </aside>
      </section>
      <section class="stitch-overview-card" style="margin-top:24px;">
        <div class="stitch-overview-head">
          <div>
            <h2>Amenity Booking Ledger</h2>
            <p>${bookings.length} amenity bookings loaded.</p>
          </div>
        </div>
        <div class="table-wrap">
          <table class="stitch-overview-table">
            <thead>
              <tr>
                <th>Amenity</th>
                <th>Guest</th>
                <th>Reservation</th>
                <th>Date</th>
                <th>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${bookings.map((booking) => `
                <tr>
                  <td>${booking.amenities?.name || "-"}</td>
                  <td>${booking.guests?.full_name || "-"}</td>
                  <td>${booking.reservations?.confirmation_number || "-"}</td>
                  <td>${formatDate(booking.booking_date)}</td>
                  <td>${formatCurrency(booking.total_amount)}</td>
                  <td>${createStatusBadge(booking.status)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </section>
      <section class="stitch-overview-card" style="margin-top:24px;">
        <div class="stitch-overview-head">
          <div>
            <h2>Hotel Service Catalogue</h2>
            <p>Operational in-stay services that can be charged to active folios.</p>
          </div>
          ${isAdmin ? `<button class="btn btn-primary" id="add-service-button" type="button">Add Service</button>` : ""}
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
      <section class="stitch-overview-card" style="margin-top:24px;">
        <div class="stitch-overview-head">
          <div>
            <h2>Service Order Ledger</h2>
            <p>Active and completed in-stay service requests.</p>
          </div>
        </div>
        <div class="table-wrap">
          <table class="stitch-overview-table">
            <thead>
              <tr><th>Service</th><th>Guest</th><th>Reservation</th><th>Status</th><th>Total</th><th>Requested</th></tr>
            </thead>
            <tbody>
              ${serviceOrders.map((order) => `
                <tr>
                  <td>${order.hotel_services?.name || "-"}</td>
                  <td>${order.guests?.full_name || "-"}</td>
                  <td>${order.reservations?.confirmation_number || "-"}</td>
                  <td>${createStatusBadge(order.status)}</td>
                  <td>${formatCurrency(order.total_amount)}</td>
                  <td>${formatDate(order.requested_at || order.created_at)}</td>
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
          <div class="field"><label for="service_name">Service Name</label><input id="service_name" name="name" value="${service.name || ""}" required></div>
          <div class="field"><label for="service_description">Description</label><textarea id="service_description" name="description">${service.description || ""}</textarea></div>
          <div class="filter-row">
            <div class="field"><label for="service_category">Category</label><select id="service_category" name="category">${buildSelectOptions(["Room Service", "Housekeeping", "Food & Beverage", "Spa", "Transport", "Laundry", "Other"], "Select category")}</select></div>
            <div class="field"><label for="service_price">Price</label><input id="service_price" name="price" type="number" min="0" step="0.01" value="${service.price || 0}" required></div>
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
      openModal({ title: "Add Hotel Service", body: serviceFormMarkup() });
      bindServiceForm();
    });

    qs("#book-amenity-button").addEventListener("click", () => {
      openModal({
        title: "Book Amenity",
        body: `
          <form id="amenity-booking-form" class="form-stack">
            <div class="filter-row">
              <div class="field">
                <label for="amenity_id">Amenity</label>
                <select id="amenity_id" name="amenity_id" required>
                  <option value="">Select amenity</option>
                  ${amenities.map((amenity) => `<option value="${amenity.id}">${amenity.name}</option>`).join("")}
                </select>
              </div>
              <div class="field">
                <label for="guest_id">Guest</label>
                <select id="guest_id" name="guest_id" required>
                  <option value="">Select guest</option>
                  ${guests.map((guest) => `<option value="${guest.id}">${guest.full_name}</option>`).join("")}
                </select>
              </div>
            </div>
            <div class="filter-row">
              <div class="field">
                <label for="reservation_id">Reservation</label>
                <select id="reservation_id" name="reservation_id">
                  <option value="">Select reservation</option>
                  ${reservations.map((reservation) => `<option value="${reservation.id}">${reservation.confirmation_number || reservation.id} &bull; ${reservation.guests?.full_name || "Guest"}</option>`).join("")}
                </select>
              </div>
              <div class="field">
                <label for="booking_date">Booking Date</label>
                <input id="booking_date" name="booking_date" type="date" value="${todayIso()}" required>
              </div>
            </div>
            <div class="filter-row">
              <div class="field">
                <label for="quantity">Quantity</label>
                <input id="quantity" name="quantity" type="number" min="1" value="1" required>
              </div>
              <div class="field">
                <label for="status">Status</label>
                <select id="status" name="status">
                  <option value="Booked">Booked</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>
            </div>
            <button class="btn btn-primary" type="submit">Save Booking</button>
          </form>
        `,
      });

      qs("#amenity-booking-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        try {
          await withFormBusy(event.currentTarget, "Saving...", async () => {
            const payload = serializeForm(event.currentTarget);
            payload.amenity_id = Number(payload.amenity_id);
            payload.guest_id = Number(payload.guest_id);
            payload.reservation_id = payload.reservation_id ? Number(payload.reservation_id) : null;
            payload.quantity = Number(payload.quantity);
            const result = await saveAmenityBooking(payload);

            if (payload.reservation_id) {
              const invoice = await getReservationInvoice(payload.reservation_id);
              if (invoice) {
                await addAmenityChargeToInvoice({
                  invoiceId: invoice.id,
                  amenityName: result.amenity.name,
                  quantity: payload.quantity,
                  amount: result.booking.total_amount,
                });
              }
            }

            await createAuditLog({
              userId: auth.user.id,
              action: "Booked amenity",
              entityType: "amenity_bookings",
              entityId: result.booking.id,
              details: `${result.amenity.name} for ${result.booking.guests?.full_name || "guest"}`,
            });
            await load();
            closeModal();
            showToast("Amenity booking saved.", "success");
          });
        } catch (error) {
          showToast(friendlyError(error), "error");
        }
      });
    });

    qs("#add-service-order-button").addEventListener("click", () => {
      const activeReservations = reservations.filter((reservation) => reservation.status === "Checked In");
      let applicableBenefits = [];
      openModal({
        title: "Add Service Order",
        body: `
          <form id="service-order-form" class="form-stack">
            <div class="field">
              <label for="reservation_id">Active Reservation</label>
              <select id="reservation_id" name="reservation_id" required>
                <option value="">Select checked-in reservation</option>
                ${activeReservations.map((reservation) => `<option value="${reservation.id}" data-room-id="${reservation.room_id}" data-guest-id="${reservation.guest_id}">${reservation.confirmation_number || reservation.id} · ${reservation.guests?.full_name || "Guest"} · Room ${reservation.rooms?.room_number || "-"}</option>`).join("")}
              </select>
            </div>
            <div class="filter-row">
              <div class="field">
                <label for="service_id">Service</label>
                <select id="service_id" name="service_id" required>
                  <option value="">Select available service</option>
                  ${hotelServices.filter((service) => service.status === "Available").map((service) => `<option value="${service.id}" data-price="${service.price}">${service.name}</option>`).join("")}
                </select>
              </div>
              <div class="field">
                <label for="quantity">Quantity</label>
                <input id="quantity" name="quantity" type="number" min="1" value="1" required>
              </div>
            </div>
            <div class="filter-row">
              <div class="field"><label for="unit_price">Unit Price</label><input id="unit_price" name="unit_price" type="number" min="0" step="0.01" value="0" required></div>
              <div class="field"><label for="status">Status</label><select id="status" name="status">${buildSelectOptions(["Requested", "In Progress", "Completed", "Cancelled", "Charged"], "Select status")}</select></div>
            </div>
            <div class="field">
              <label for="benefit_selection">VIP Club Benefit</label>
              <select id="benefit_selection" name="benefit_selection">
                <option value="">No VIP benefit applied</option>
              </select>
              <p class="field-help" id="benefit-help">Select an active reservation and service to load eligible VIP benefits.</p>
            </div>
            <div class="field"><label for="notes">Notes</label><textarea id="notes" name="notes"></textarea></div>
            <button class="btn btn-primary" type="submit">Save Service Order</button>
          </form>
        `,
      });

      async function refreshApplicableBenefits() {
        const reservationId = Number(qs("#reservation_id").value);
        const serviceId = Number(qs("#service_id").value);
        const benefitSelect = qs("#benefit_selection");
        const help = qs("#benefit-help");

        if (!reservationId || !serviceId) {
          applicableBenefits = [];
          benefitSelect.innerHTML = `<option value="">No VIP benefit applied</option>`;
          help.textContent = "Select an active reservation and service to load eligible VIP benefits.";
          return;
        }

        const reservation = activeReservations.find((item) => item.id === reservationId);
        applicableBenefits = await listApplicableBenefits({
          guestId: reservation.guest_id,
          serviceId,
        });

        benefitSelect.innerHTML = `
          <option value="">No VIP benefit applied</option>
          ${applicableBenefits.map((benefit) => `
            <option value="${benefit.club_registration_id}:${benefit.benefit_id}">
              ${benefit.club_name} · ${benefit.title} · ${benefit.discount_type || benefit.applies_to}
            </option>
          `).join("")}
        `;
        help.textContent = applicableBenefits.length
          ? `${applicableBenefits.length} VIP benefit(s) available.`
          : "No active VIP benefits are available for this service.";
      }

      qs("#service_id").addEventListener("change", async (event) => {
        const price = event.target.selectedOptions[0]?.dataset.price || "0";
        qs("#unit_price").value = price;
        await refreshApplicableBenefits();
      });
      qs("#reservation_id").addEventListener("change", refreshApplicableBenefits);

      qs("#status").value = "Requested";
      qs("#service-order-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        try {
          await withFormBusy(event.currentTarget, "Saving...", async () => {
            const payload = serializeForm(event.currentTarget);
            const reservation = activeReservations.find((item) => item.id === Number(payload.reservation_id));
            payload.reservation_id = Number(payload.reservation_id);
            payload.guest_id = reservation.guest_id;
            payload.room_id = reservation.room_id;
            payload.service_id = Number(payload.service_id);
            payload.quantity = Number(payload.quantity);
            payload.unit_price = Number(payload.unit_price);
            payload.created_by = auth.user.id;
            const order = await saveServiceOrder(payload);

            if (payload.benefit_selection) {
              if (!["Completed", "Charged"].includes(payload.status)) {
                throw new Error("VIP benefits can only be applied when the service order is completed or charged.");
              }

              const [clubRegistrationId, benefitId] = String(payload.benefit_selection).split(":").map(Number);
              const invoice = await getReservationInvoice(order.reservation_id) || await createInvoiceFromReservation(reservation);
              const service = hotelServices.find((item) => item.id === payload.service_id);
              const benefitResult = await applyBenefitToServiceOrder({
                clubRegistrationId,
                benefitId,
                reservationId: order.reservation_id,
                guestId: reservation.guest_id,
                serviceOrderId: order.id,
                serviceId: payload.service_id,
                serviceName: service?.name || "Service",
                quantity: payload.quantity,
                unitPrice: payload.unit_price,
              });

              if (benefitResult.discountAmount > 0 && service?.is_chargeable !== false) {
                await saveInvoiceItem({
                  invoice_id: invoice.id,
                  description: benefitResult.invoiceDescription,
                  quantity: 1,
                  unit_price: -Number(benefitResult.discountAmount),
                  total: -Number(benefitResult.discountAmount),
                });
              }
            }

            await createAuditLog({
              userId: auth.user.id,
              action: "Created service order",
              entityType: "service_orders",
              entityId: order.id,
              details: `${order.hotel_services?.name || "Service"} for ${reservation.guests?.full_name || "guest"}`,
            });
            await load();
            closeModal();
            showToast("Service order saved.", "success");
          });
        } catch (error) {
          showToast(friendlyError(error), "error");
        }
      });
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
