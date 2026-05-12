import { CLUB_LEVELS, CLUB_REGISTRATION_STATUSES } from "../config.js";
import { initProtectedPage } from "../router.js";
import { createAuditLog } from "../services/auditService.js";
import { addClubMembershipFeeToInvoice, getReservationInvoice } from "../services/billingService.js";
import { deleteClub, deleteClubRegistration, listBenefitUsage, listClubRegistrations, listClubs, saveClub, saveClubBenefit, saveClubRegistration, saveClubTransaction } from "../services/clubsService.js";
import { listGuestOptions } from "../services/guestsService.js";
import { listHotelServices } from "../services/hotelServicesService.js";
import { listReservations } from "../services/reservationsService.js";
import { buildSelectOptions, friendlyError, formatCurrency, formatDate, initials, qs, render, serializeForm, todayIso, withFormBusy } from "../utils.js";
import { closeModal, confirmDialog, createPageHeader, createStatusBadge, createVipBadge, openModal, showToast } from "../ui.js";

await initProtectedPage("clubs", async ({ root, auth }) => {
  const isAdmin = auth.profile.role === "Admin";
  let filters = { status: "", membershipLevel: "", benefitType: "", search: "" };

  async function load() {
    const [clubs, registrations, guests, reservations, hotelServices, benefitUsage] = await Promise.all([
      listClubs(),
      listClubRegistrations(filters),
      listGuestOptions(),
      listReservations({}),
      listHotelServices(),
      listBenefitUsage({ search: filters.search }),
    ]);

    const searchNeedle = String(filters.search || "").trim().toLowerCase();
    const filteredClubs = clubs.filter((club) => {
      const matchesSearch = !searchNeedle || [club.name, club.description, club.status].join(" ").toLowerCase().includes(searchNeedle);
      const matchesBenefitType = !filters.benefitType || (club.club_benefits || []).some((benefit) => benefit.discount_type === filters.benefitType || benefit.benefit_type === filters.benefitType);
      return matchesSearch && matchesBenefitType;
    });
    const filteredRegistrations = registrations.filter((registration) => {
      return !searchNeedle || [
        registration.guests?.full_name,
        registration.clubs?.name,
        registration.membership_number,
        registration.membership_level,
      ].join(" ").toLowerCase().includes(searchNeedle);
    });
    const flatBenefits = filteredClubs.flatMap((club) => (club.club_benefits || []).map((benefit) => ({ ...benefit, club_name: club.name })))
      .filter((benefit) => !filters.benefitType || benefit.discount_type === filters.benefitType || benefit.benefit_type === filters.benefitType);

    const activeMembers = filteredRegistrations.filter((registration) => registration.status === "Active").length;
    const pendingMembers = filteredRegistrations.filter((registration) => registration.status === "Pending").length;
    const totalRevenue = filteredRegistrations.reduce((sum, registration) => sum + Number(registration.clubs?.membership_fee || 0), 0);

    render(root, `
      ${createPageHeader({
        title: "VIP Clubs",
        subtitle: "Premium membership programmes, benefits, and revenue streams for Grand Millado Hotel guests.",
        actions: `
          <button class="btn btn-secondary" id="register-club-member-button" type="button">Register Guest</button>
          ${isAdmin ? `<button class="btn btn-primary" id="add-club-button" type="button">Add Club</button>` : ""}
        `,
      })}
      <section class="stitch-kpi-grid">
        <article class="stitch-kpi-card">
          <div class="stitch-kpi-iconrow"><span class="stitch-kpi-tag">Members</span></div>
          <h3>Active Members</h3>
          <div class="stitch-kpi-value">${activeMembers}</div>
          <p class="stitch-kpi-note">${pendingMembers} pending memberships</p>
        </article>
        <article class="stitch-kpi-card">
          <div class="stitch-kpi-iconrow"><span class="stitch-kpi-tag">Revenue</span></div>
          <h3>Club Revenue</h3>
          <div class="stitch-kpi-value">${formatCurrency(totalRevenue)}</div>
          <p class="stitch-kpi-note">Membership fees represented in registrations</p>
        </article>
        <article class="stitch-kpi-card">
          <div class="stitch-kpi-iconrow"><span class="stitch-kpi-tag">Portfolio</span></div>
          <h3>Configured Clubs</h3>
          <div class="stitch-kpi-value">${filteredClubs.length}</div>
          <p class="stitch-kpi-note">Standard through Presidential tiers</p>
        </article>
        <article class="stitch-kpi-card">
          <div class="stitch-kpi-iconrow"><span class="stitch-kpi-tag">Levels</span></div>
          <h3>Membership Levels</h3>
          <div class="stitch-kpi-value">${flatBenefits.length}</div>
          <p class="stitch-kpi-note">Benefits currently configured</p>
        </article>
      </section>
      <section class="stitch-main-grid" style="margin-top:24px;">
        <div class="stitch-overview-card">
          <div class="stitch-overview-head">
            <div>
              <h2>Club Portfolio</h2>
              <p>Premium membership programmes adapted to the Stitch executive cards.</p>
            </div>
          </div>
          <div class="stitch-club-grid">
            ${filteredClubs.map((club) => `
              <article class="stitch-club-card">
                <div class="stitch-club-head">
                  <strong>${club.name}</strong>
                  ${createStatusBadge(club.status)}
                </div>
                <p class="stitch-room-meta">${club.description || "Private member access and elevated guest privileges."}</p>
                <div class="stitch-room-rate">${formatCurrency(club.membership_fee)}</div>
                <div class="stitch-mini-meta">
                  <span>${(club.club_benefits || []).length} benefits</span>
                  <span>${(club.club_registrations || []).length} registrations</span>
                </div>
                <div class="stitch-club-benefits">
                  ${(club.club_benefits || []).slice(0, 3).map((benefit) => `<span>${benefit.title}</span>`).join("") || "<span>No benefits configured</span>"}
                </div>
                ${isAdmin ? `
                  <div class="table-actions" style="margin-top:18px;">
                    <button class="btn btn-ghost club-edit-button" data-id="${club.id}" type="button">Edit</button>
                    <button class="btn btn-ghost club-benefit-button" data-id="${club.id}" type="button">Add Benefit</button>
                    <button class="btn btn-danger club-delete-button" data-id="${club.id}" type="button">Delete</button>
                  </div>
                ` : `<div class="muted" style="margin-top:18px;">Staff can view memberships and benefits only.</div>`}
              </article>
            `).join("") || `<div class="empty-state"><h3 class="font-display">No clubs configured</h3><p>Add a VIP club to begin registrations.</p></div>`}
          </div>
        </div>
        <aside class="stitch-arrivals-card">
          <div class="stitch-section-head">
            <div>
              <h2>New Registrations</h2>
              <p>Latest members and current status.</p>
            </div>
          </div>
          ${filteredRegistrations.slice(0, 6).map((registration) => `
            <article class="stitch-arrival-item">
              <div class="stitch-arrival-avatar">${initials(registration.guests?.full_name || "GM")}</div>
              <div class="stitch-arrival-copy">
                <strong>${registration.guests?.full_name || "Guest"}</strong>
                <small>${registration.clubs?.name || "VIP Club"} &bull; ${registration.membership_number}</small>
              </div>
              <div class="stitch-arrival-time">
                <strong>${registration.membership_level}</strong>
                <small>${registration.status}</small>
              </div>
            </article>
          `).join("") || `<div class="empty-state"><h3 class="font-display">No registrations</h3><p>Guest memberships will appear here.</p></div>`}
        </aside>
      </section>
      <section class="stitch-overview-card" style="margin-top:24px; margin-bottom:24px;">
        <div class="stitch-overview-head">
          <div>
            <h2>Registration Filters</h2>
            <p>Filter memberships by status and level.</p>
          </div>
        </div>
        <div class="filter-row">
          <div class="field">
            <label for="club-status-filter">Registration Status</label>
            <select id="club-status-filter">${buildSelectOptions(CLUB_REGISTRATION_STATUSES)}<\/select>
          </div>
          <div class="field">
            <label for="club-level-filter">Membership Level</label>
            <select id="club-level-filter">${buildSelectOptions(CLUB_LEVELS)}<\/select>
          </div>
        </div>
        <div class="filter-row">
          <div class="field">
            <label for="club-benefit-type-filter">Benefit Type</label>
            <select id="club-benefit-type-filter">${buildSelectOptions(["Percentage", "Fixed", "Complimentary", "Access"], "All benefit types")}<\/select>
          </div>
          <div class="field">
            <label for="club-search-filter">Search</label>
            <input id="club-search-filter" type="search" placeholder="Club name, guest name, membership number">
          </div>
        </div>
      </section>
      <section class="stitch-overview-card">
        <div class="stitch-overview-head">
          <div>
            <h2>Club Registrations</h2>
            <p>${filteredRegistrations.length} memberships loaded.</p>
          </div>
        </div>
        <div class="table-wrap">
          <table class="stitch-overview-table">
            <thead>
              <tr>
                <th>Guest</th>
                <th>Club</th>
                <th>Membership</th>
                <th>Period</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${filteredRegistrations.map((registration) => `
                <tr>
                  <td>
                    <strong>${registration.guests?.full_name || "-"}</strong>
                    ${registration.guests?.vip_status ? `<div style="margin-top:6px;">${createVipBadge("VIP Guest")}</div>` : ""}
                  </td>
                  <td>${registration.clubs?.name || "-"}</td>
                  <td>${registration.membership_number}<div class="muted">${createVipBadge(registration.membership_level)}</div></td>
                  <td>${formatDate(registration.start_date)} to ${formatDate(registration.end_date)}</td>
                  <td>${createStatusBadge(registration.status)}</td>
                  <td>
                    ${isAdmin ? `
                      <div class="table-actions">
                        <button class="btn btn-ghost registration-transaction-button" data-id="${registration.id}" type="button">Add Transaction</button>
                        <button class="btn btn-danger registration-delete-button" data-id="${registration.id}" type="button">Delete</button>
                      </div>
                    ` : `<span class="muted">View only</span>`}
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </section>
      <section class="stitch-overview-card" style="margin-top:24px;">
        <div class="stitch-overview-head">
          <div>
            <h2>Benefit Registry</h2>
            <p>Discount rules, applicable areas, and linked services.</p>
          </div>
        </div>
        <div class="table-wrap">
          <table class="stitch-overview-table">
            <thead>
              <tr><th>Club</th><th>Benefit</th><th>Applies To</th><th>Discount</th><th>Linked Service</th><th>Max Uses</th><th>Status</th></tr>
            </thead>
            <tbody>
              ${flatBenefits.map((benefit) => `
                <tr>
                  <td>${benefit.club_name}</td>
                  <td><strong>${benefit.title}</strong><div class="muted">${benefit.description || ""}</div></td>
                  <td>${benefit.applies_to || "-"}</td>
                  <td>${benefit.discount_type || benefit.benefit_type || "-"}${benefit.discount_value ? `<div class="muted">${benefit.discount_value}</div>` : ""}</td>
                  <td>${hotelServices.find((service) => Number(service.id) === Number(benefit.service_id))?.name || "-"}</td>
                  <td>${benefit.max_uses || "Unlimited"}</td>
                  <td>${createStatusBadge(benefit.status || "Active")}</td>
                </tr>
              `).join("") || `<tr><td colspan="7">No benefits configured for the current filters.</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>
      <section class="stitch-overview-card" style="margin-top:24px;">
        <div class="stitch-overview-head">
          <div>
            <h2>Benefit Usage</h2>
            <p>Applied benefits recorded against reservations and service orders.</p>
          </div>
        </div>
        <div class="table-wrap">
          <table class="stitch-overview-table">
            <thead>
              <tr><th>Guest</th><th>Club</th><th>Benefit</th><th>Service</th><th>Discount</th><th>Used At</th></tr>
            </thead>
            <tbody>
              ${benefitUsage.map((usage) => `
                <tr>
                  <td>${usage.guests?.full_name || "-"}</td>
                  <td>${usage.club_registrations?.clubs?.name || "-"}</td>
                  <td>${usage.club_benefits?.title || "-"}</td>
                  <td>${usage.service_orders?.hotel_services?.name || "Stay benefit"}</td>
                  <td>${formatCurrency(usage.amount_discounted)}</td>
                  <td>${formatDate(usage.used_at)}</td>
                </tr>
              `).join("") || `<tr><td colspan="6">No benefit usage recorded for the current filters.</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>
    `);

    function clubFormMarkup(club = {}) {
      return `
        <form id="club-form" class="form-stack">
          <input name="id" type="hidden" value="${club.id || ""}">
          <div class="field">
            <label for="name">Club Name</label>
            <input id="name" name="name" value="${club.name || ""}" required>
          </div>
          <div class="field">
            <label for="description">Description</label>
            <textarea id="description" name="description">${club.description || ""}</textarea>
          </div>
          <div class="filter-row">
            <div class="field">
              <label for="membership_fee">Membership Fee</label>
              <input id="membership_fee" name="membership_fee" type="number" min="0" step="0.01" value="${club.membership_fee || ""}" required>
            </div>
            <div class="field">
              <label for="status">Status</label>
              <select id="status" name="status">
                <option value="Active">Active</option>
                <option value="Paused">Paused</option>
                <option value="Archived">Archived</option>
              </select>
            </div>
          </div>
          <div class="field">
            <label for="benefits">Benefits Summary</label>
            <textarea id="benefits" name="benefits">${club.benefits || ""}</textarea>
          </div>
          <button class="btn btn-primary" type="submit">${club.id ? "Save Changes" : "Add Club"}</button>
        </form>
      `;
    }

    function bindClubForm(club = {}) {
      qs("#status").value = club.status || "Active";
      qs("#club-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        try {
          await withFormBusy(event.currentTarget, club.id ? "Saving..." : "Creating...", async () => {
            const payload = serializeForm(event.currentTarget);
            payload.membership_fee = Number(payload.membership_fee);
            if (!payload.id) {
              delete payload.id;
            } else {
              payload.id = Number(payload.id);
            }
            const saved = await saveClub(payload);
            await createAuditLog({
              userId: auth.user.id,
              action: club.id ? "Updated club" : "Created club",
              entityType: "clubs",
              entityId: saved.id,
              details: saved.name,
            });
            await load();
            closeModal();
            showToast("Club saved.", "success");
          });
        } catch (error) {
          showToast(friendlyError(error), "error");
        }
      });
    }

    qs("#add-club-button")?.addEventListener("click", () => {
      openModal({ title: "Add VIP Club", body: clubFormMarkup() });
      bindClubForm();
    });

    qs("#register-club-member-button")?.addEventListener("click", () => {
      openModal({
        title: "Register VIP Guest",
        body: `
          <form id="registration-form" class="form-stack">
            <div class="filter-row">
              <div class="field">
                <label for="club_id">Club</label>
                <select id="club_id" name="club_id" required>
                  <option value="">Select club</option>
                  ${clubs.map((club) => `<option value="${club.id}">${club.name}</option>`).join("")}
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
                <label for="membership_level">Membership Level</label>
                <select id="membership_level" name="membership_level">${buildSelectOptions(CLUB_LEVELS, "Select level")}<\/select>
              </div>
              <div class="field">
                <label for="status">Status</label>
                <select id="status" name="status">${buildSelectOptions(CLUB_REGISTRATION_STATUSES, "Select status")}<\/select>
              </div>
            </div>
            <div class="filter-row">
              <div class="field">
                <label for="start_date">Start Date</label>
                <input id="start_date" name="start_date" type="date" value="${todayIso()}" required>
              </div>
              <div class="field">
                <label for="end_date">End Date</label>
                <input id="end_date" name="end_date" type="date" value="${todayIso()}" required>
              </div>
            </div>
            <div class="field">
              <label for="notes">Notes</label>
              <textarea id="notes" name="notes"></textarea>
            </div>
            <div class="field">
              <label for="reservation_id">Reservation for Invoice Fee (optional)</label>
              <select id="reservation_id" name="reservation_id">
                <option value="">No invoice link</option>
                ${reservations.map((reservation) => `<option value="${reservation.id}">${reservation.confirmation_number || reservation.id} &bull; ${reservation.guests?.full_name || "Guest"}</option>`).join("")}
              </select>
            </div>
            <button class="btn btn-primary" type="submit">Save Registration</button>
          </form>
        `,
      });

      qs("#registration-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        try {
          await withFormBusy(event.currentTarget, "Saving...", async () => {
            const payload = serializeForm(event.currentTarget);
            const reservationId = payload.reservation_id ? Number(payload.reservation_id) : null;
            delete payload.reservation_id;
            payload.club_id = Number(payload.club_id);
            payload.guest_id = Number(payload.guest_id);
            const saved = await saveClubRegistration(payload);

            if (reservationId) {
              const invoice = await getReservationInvoice(reservationId);
              if (invoice) {
                await addClubMembershipFeeToInvoice({
                  invoiceId: invoice.id,
                  clubName: saved.clubs?.name || "VIP Club",
                  membershipNumber: saved.membership_number,
                  amount: Number(saved.clubs?.membership_fee || 0),
                });
              }
            }

            await createAuditLog({
              userId: auth.user.id,
              action: "Registered VIP club member",
              entityType: "club_registrations",
              entityId: saved.id,
              details: `${saved.guests?.full_name || "Guest"} - ${saved.clubs?.name || "Club"}`,
            });
            await load();
            closeModal();
            showToast("VIP club registration saved.", "success");
          });
        } catch (error) {
          showToast(friendlyError(error), "error");
        }
      });
    });

    qs("#club-status-filter").value = filters.status;
    qs("#club-level-filter").value = filters.membershipLevel;
    qs("#club-benefit-type-filter").value = filters.benefitType;
    qs("#club-search-filter").value = filters.search;
    qs("#club-status-filter").addEventListener("change", async (event) => {
      filters.status = event.target.value;
      await load();
    });
    qs("#club-level-filter").addEventListener("change", async (event) => {
      filters.membershipLevel = event.target.value;
      await load();
    });
    qs("#club-benefit-type-filter").addEventListener("change", async (event) => {
      filters.benefitType = event.target.value;
      await load();
    });
    qs("#club-search-filter").addEventListener("input", async (event) => {
      filters.search = event.target.value.trim();
      await load();
    });

    root.querySelectorAll(".club-edit-button").forEach((button) => button.addEventListener("click", () => {
      const club = clubs.find((item) => item.id === Number(button.dataset.id));
      openModal({ title: `Edit ${club.name}`, body: clubFormMarkup(club) });
      bindClubForm(club);
    }));

    root.querySelectorAll(".club-benefit-button").forEach((button) => button.addEventListener("click", () => {
      openModal({
        title: "Add Club Benefit",
        body: `
          <form id="benefit-form" class="form-stack">
            <input name="club_id" type="hidden" value="${button.dataset.id}">
            <div class="field">
              <label for="title">Benefit Title</label>
              <input id="title" name="title" required>
            </div>
            <div class="field">
              <label for="description">Description</label>
              <textarea id="description" name="description"></textarea>
            </div>
            <div class="filter-row">
              <div class="field">
                <label for="benefit_type">Benefit Type</label>
                <input id="benefit_type" name="benefit_type" placeholder="Priority check-in">
              </div>
              <div class="field">
                <label for="applies_to">Applies To</label>
                <select id="applies_to" name="applies_to">${buildSelectOptions(["Reservation", "Amenity", "Service", "Billing", "Stay"], "Select target")}<\/select>
              </div>
            </div>
            <div class="filter-row">
              <div class="field">
                <label for="discount_type">Discount Type</label>
                <select id="discount_type" name="discount_type">${buildSelectOptions(["Percentage", "Fixed", "Complimentary", "Access"], "Select discount type")}<\/select>
              </div>
              <div class="field">
                <label for="discount_value">Discount Value</label>
                <input id="discount_value" name="discount_value" type="number" min="0" step="0.01">
              </div>
            </div>
            <div class="filter-row">
              <div class="field">
                <label for="service_id">Linked Service</label>
                <select id="service_id" name="service_id">
                  <option value="">No linked service</option>
                  ${hotelServices.map((service) => `<option value="${service.id}">${service.name}</option>`).join("")}
                </select>
              </div>
              <div class="field">
                <label for="max_uses">Max Uses</label>
                <input id="max_uses" name="max_uses" type="number" min="0" step="1">
              </div>
            </div>
            <div class="filter-row">
              <div class="field">
                <label for="status">Status</label>
                <select id="status" name="status">${buildSelectOptions(["Active", "Inactive"], "Select status")}<\/select>
              </div>
              <div class="field">
                <label for="value">Legacy Value</label>
                <input id="value" name="value" type="number" min="0" step="0.01">
              </div>
            </div>
            <button class="btn btn-primary" type="submit">Save Benefit</button>
          </form>
        `,
      });

      qs("#benefit-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        try {
          await withFormBusy(event.currentTarget, "Saving...", async () => {
            const payload = serializeForm(event.currentTarget);
            payload.club_id = Number(payload.club_id);
            payload.service_id = payload.service_id ? Number(payload.service_id) : null;
            payload.max_uses = payload.max_uses ? Number(payload.max_uses) : null;
            payload.discount_value = payload.discount_value ? Number(payload.discount_value) : null;
            payload.value = payload.value ? Number(payload.value) : null;
            if (payload.discount_type === "Percentage" && (Number(payload.discount_value || 0) < 0 || Number(payload.discount_value || 0) > 100)) {
              throw new Error("Discount percentage must be between 0 and 100.");
            }
            await saveClubBenefit(payload);
            await load();
            closeModal();
            showToast("Club benefit saved.", "success");
          });
        } catch (error) {
          showToast(friendlyError(error), "error");
        }
      });
    }));

    root.querySelectorAll(".club-delete-button").forEach((button) => button.addEventListener("click", async () => {
      if (!await confirmDialog({ title: "Delete club", message: "This removes the VIP club definition.", confirmLabel: "Delete", tone: "danger" })) {
        return;
      }
      try {
        await deleteClub(Number(button.dataset.id));
        await createAuditLog({
          userId: auth.user.id,
          action: "Deleted club",
          entityType: "clubs",
          entityId: Number(button.dataset.id),
          details: "VIP club removed",
        });
        showToast("Club deleted.", "success");
        await load();
      } catch (error) {
        showToast(friendlyError(error), "error");
      }
    }));

    root.querySelectorAll(".registration-transaction-button").forEach((button) => button.addEventListener("click", () => {
      const registration = registrations.find((item) => item.id === Number(button.dataset.id));
      openModal({
        title: "Add Club Transaction",
        body: `
          <form id="club-transaction-form" class="form-stack">
            <input name="club_registration_id" type="hidden" value="${registration.id}">
            <input name="guest_id" type="hidden" value="${registration.guest_id}">
            <div class="field">
              <label for="transaction_type">Transaction Type</label>
              <input id="transaction_type" name="transaction_type" value="Membership Fee" required>
            </div>
            <div class="field">
              <label for="amount">Amount</label>
              <input id="amount" name="amount" type="number" min="0" step="0.01" value="${registration.clubs?.membership_fee || 0}" required>
            </div>
            <div class="field">
              <label for="description">Description</label>
              <textarea id="description" name="description">${registration.clubs?.name || "Club"} transaction</textarea>
            </div>
            <button class="btn btn-primary" type="submit">Save Transaction</button>
          </form>
        `,
      });

      qs("#club-transaction-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        try {
          await withFormBusy(event.currentTarget, "Saving...", async () => {
            const payload = serializeForm(event.currentTarget);
            payload.club_registration_id = Number(payload.club_registration_id);
            payload.guest_id = Number(payload.guest_id);
            payload.amount = Number(payload.amount);
            await saveClubTransaction(payload);
            await createAuditLog({
              userId: auth.user.id,
              action: "Added club transaction",
              entityType: "club_transactions",
              entityId: payload.club_registration_id,
              details: `${payload.transaction_type} - ${formatCurrency(payload.amount)}`,
            });
            await load();
            closeModal();
            showToast("Club transaction saved.", "success");
          });
        } catch (error) {
          showToast(friendlyError(error), "error");
        }
      });
    }));

    root.querySelectorAll(".registration-delete-button").forEach((button) => button.addEventListener("click", async () => {
      if (!await confirmDialog({ title: "Delete registration", message: "This removes the club registration record.", confirmLabel: "Delete", tone: "danger" })) {
        return;
      }
      try {
        await deleteClubRegistration(Number(button.dataset.id));
        await createAuditLog({
          userId: auth.user.id,
          action: "Deleted club registration",
          entityType: "club_registrations",
          entityId: Number(button.dataset.id),
          details: "VIP club registration removed",
        });
        showToast("Registration deleted.", "success");
        await load();
      } catch (error) {
        showToast(friendlyError(error), "error");
      }
    }));
  }

  await load();
});
