import { createManagedStaffLogin } from "../auth.js";
import { initProtectedPage } from "../router.js";
import { createAuditLog } from "../services/auditService.js";
import { deleteStaff, listStaff, saveStaff } from "../services/staffService.js";
import { escapeHtml, friendlyError, initials, qs, render, serializeForm, withFormBusy } from "../utils.js";
import { closeModal, confirmDialog, createPageHeader, createStatusBadge, openModal, showToast } from "../ui.js";

const STAFF_STATUSES = ["Active", "On Leave", "Inactive"];

await initProtectedPage("staff", async ({ root, auth }) => {
  let filters = { status: "" };

  async function load() {
    const staffMembers = await listStaff(filters);
    const activeStaff = staffMembers.filter((member) => member.status === "Active").length;
    const taskLoad = staffMembers.reduce((sum, member) => sum + (member.housekeeping_tasks || []).length, 0);
    const loginEnabledCount = staffMembers.filter((member) => member.auth_user_id).length;

    render(root, `
      ${createPageHeader({
        title: "Staff & Housekeeping",
        subtitle: "Executive visibility into roster access and task ownership.",
        actions: `<button class="btn btn-primary" id="add-staff-button" type="button">Add Staff Member</button>`,
      })}
      <section class="stitch-kpi-grid">
        <article class="stitch-kpi-card">
          <div class="stitch-kpi-iconrow">
            <span class="stitch-kpi-tag">Directory</span>
          </div>
          <h3>Total Staff</h3>
          <div class="stitch-kpi-value">${staffMembers.length}</div>
          <p class="stitch-kpi-note">${activeStaff} active on the roster</p>
        </article>
        <article class="stitch-kpi-card">
          <div class="stitch-kpi-iconrow">
            <span class="stitch-kpi-tag">Access</span>
          </div>
          <h3>Logins Enabled</h3>
          <div class="stitch-kpi-value">${loginEnabledCount}</div>
          <p class="stitch-kpi-note">Staff accounts linked to Supabase Auth</p>
        </article>
        <article class="stitch-kpi-card">
          <div class="stitch-kpi-iconrow">
            <span class="stitch-kpi-tag">Tasks</span>
          </div>
          <h3>Assigned Tasks</h3>
          <div class="stitch-kpi-value">${taskLoad}</div>
          <p class="stitch-kpi-note">Open housekeeping workload tied to staff</p>
        </article>
      </section>
      <section class="stitch-overview-card" style="margin-top:24px;">
        <div class="stitch-overview-head">
          <div>
            <h2>Roster Filter</h2>
            <p>Refine the staff roster by current status.</p>
          </div>
        </div>
        <div class="filter-row">
          <div class="field">
            <label for="staff-status-filter">Status</label>
            <select id="staff-status-filter"><option value="">All statuses</option>${STAFF_STATUSES.map((status) => `<option value="${status}">${status}</option>`).join("")}<\/select>
          </div>
        </div>
      </section>
      <section class="stitch-main-grid" style="margin-top:24px;">
        <div class="stitch-overview-card">
          <div class="stitch-overview-head">
            <div>
              <h2>Staff Directory</h2>
              <p>${staffMembers.length} team members loaded from Supabase.</p>
            </div>
          </div>
          <div class="stitch-directory-grid">
            ${staffMembers.map((member) => `
              <article class="stitch-person-card">
                <div class="stitch-person-head">
                  <div class="stitch-arrival-avatar">${initials(member.full_name)}</div>
                  <div class="stitch-person-copy">
                    <strong>${member.full_name}</strong>
                    <small>${member.email || member.phone || "No contact information"}</small>
                  </div>
                </div>
                <div class="stitch-person-meta">
                  <div><span>Status</span>${createStatusBadge(member.status)}</div>
                  <div><span>Contact</span><strong>${member.email || member.phone || "No contact"}</strong></div>
                  <div><span>Login</span><strong>${member.auth_user_id ? "Enabled" : "Directory only"}</strong></div>
                  <div><span>Password</span><strong>${member.login_password ? escapeHtml(member.login_password) : "Not saved"}</strong></div>
                  <div><span>Tasks</span><strong>${(member.housekeeping_tasks || []).length} assigned</strong></div>
                </div>
                <div class="table-actions">
                  <button class="btn btn-ghost staff-edit-button" data-id="${member.id}" type="button">Edit</button>
                  <button class="btn btn-danger staff-delete-button" data-id="${member.id}" type="button">Delete</button>
                </div>
              </article>
            `).join("") || `<div class="empty-state"><h3 class="font-display">No staff records</h3><p>Add a team member to populate the roster.</p></div>`}
          </div>
        </div>
        <aside class="stitch-arrivals-card">
          <div class="stitch-section-head">
            <div>
              <h2>Task Assignment</h2>
              <p>Housekeeping load by team member.</p>
            </div>
          </div>
          ${staffMembers
            .slice()
            .sort((left, right) => (right.housekeeping_tasks?.length || 0) - (left.housekeeping_tasks?.length || 0))
            .slice(0, 6)
            .map((member) => `
              <article class="stitch-arrival-item">
                <div class="stitch-arrival-avatar">${initials(member.full_name)}</div>
                <div class="stitch-arrival-copy">
                  <strong>${member.full_name}</strong>
                  <small>${member.email || member.phone || "No contact information"}</small>
                </div>
                <div class="stitch-arrival-time">
                  <strong>${(member.housekeeping_tasks || []).length}</strong>
                  <small>tasks</small>
                </div>
              </article>
            `).join("") || `<div class="empty-state"><h3 class="font-display">No assignments</h3><p>Staff tasks will appear here.</p></div>`}
        </aside>
      </section>
    `);

    qs("#staff-status-filter").value = filters.status;
    bindEvents(staffMembers);
  }

  function staffFormMarkup(member = {}) {
    return `
      <form id="staff-form" class="form-stack">
        <input name="id" type="hidden" value="${member.id || ""}">
        <div class="filter-row">
          <div class="field">
            <label for="full_name">Full Name</label>
            <input id="full_name" name="full_name" value="${member.full_name || ""}" required>
          </div>
          <div class="field">
            <label for="email">Email</label>
            <input id="email" name="email" type="email" value="${member.email || ""}">
          </div>
        </div>
        <div class="filter-row">
          <div class="field">
            <label for="phone">Phone</label>
            <input id="phone" name="phone" value="${member.phone || ""}">
          </div>
          <div class="field">
            <label for="status">Status</label>
            <select id="status" name="status"><option value="">Select status</option>${STAFF_STATUSES.map((status) => `<option value="${status}">${status}</option>`).join("")}<\/select>
          </div>
        </div>
        <div class="field">
          <label for="login_password">Display Password</label>
          <input id="login_password" name="login_password" type="text" minlength="6" value="${escapeHtml(member.login_password || "")}" placeholder="Password shown in staff directory">
          <p class="field-help">Saved on the staff record for display. Supabase Auth passwords cannot be read back after account creation.</p>
        </div>
        ${member.auth_user_id ? `
          <div class="panel">
            <p class="eyebrow">Login Access</p>
            <p class="muted" style="margin:0;">This staff member already has a linked Staff login account.</p>
          </div>
        ` : `
          <div class="panel">
            <div class="stitch-section-head">
              <div>
                <h2 style="font-size:1.2rem;">Staff Login Access</h2>
                <p>Create a Staff login account in Supabase Auth for this directory record.</p>
              </div>
            </div>
            <div class="field checkbox-field">
              <label for="create_login_access" class="checkbox-label">
                <input id="create_login_access" name="create_login_access" type="checkbox">
                <span>Allow this staff member to log in</span>
              </label>
            </div>
            <p class="field-help">Uses the display password above. The created account will receive the Staff role.</p>
          </div>
        `}
        <button class="btn btn-primary" type="submit">${member.id ? "Save Changes" : "Add Staff Member"}</button>
      </form>
    `;
  }

  function bindStaffForm(member = {}) {
    qs("#status").value = member.status || "Active";
    const loginToggle = qs("#create_login_access");
    const loginPasswordField = qs("#login_password");

    if (loginToggle && loginPasswordField) {
      const syncLoginFieldState = () => {
        loginPasswordField.required = loginToggle.checked;
      };

      syncLoginFieldState();
      loginToggle.addEventListener("change", syncLoginFieldState);
    }

    qs("#staff-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        await withFormBusy(event.currentTarget, member.id ? "Saving..." : "Creating...", async () => {
          const payload = serializeForm(event.currentTarget);
          const createLoginAccess = payload.create_login_access === "on";
          const loginPassword = payload.login_password;
          delete payload.create_login_access;
          const loginRequested = createLoginAccess && !member.auth_user_id;
          if (member.auth_user_id) {
            payload.auth_user_id = member.auth_user_id;
          }

          if (!payload.id) {
            delete payload.id;
          } else {
            payload.id = Number(payload.id);
          }

          let saved = await saveStaff(payload);

          if (loginRequested) {
            if (!payload.email) {
              throw new Error("Staff email is required before creating a login account.");
            }

            const authUser = await createManagedStaffLogin({
              email: payload.email,
              password: loginPassword,
              fullName: payload.full_name,
            });

            saved = await saveStaff({
              ...saved,
              auth_user_id: authUser.id,
            });
          }

          await createAuditLog({
            userId: auth.user.id,
            action: member.id ? "Updated staff member" : "Created staff member",
            entityType: "staff",
            entityId: saved.id,
            details: `${saved.full_name}${saved.auth_user_id ? " with Staff login access" : ""}`,
          });
          await load();
          closeModal();
          showToast(saved.auth_user_id && !member.auth_user_id ? "Staff record and login account created." : "Staff record saved.", "success");
        });
      } catch (error) {
        showToast(friendlyError(error), "error");
      }
    });
  }

  function bindEvents(staffMembers) {
    qs("#add-staff-button").addEventListener("click", () => {
      openModal({ title: "Add Staff Member", body: staffFormMarkup() });
      bindStaffForm();
    });

    qs("#staff-status-filter").addEventListener("change", async (event) => {
      filters.status = event.target.value;
      await load();
    });

    root.querySelectorAll(".staff-edit-button").forEach((button) => button.addEventListener("click", () => {
      const member = staffMembers.find((item) => item.id === Number(button.dataset.id));
      openModal({ title: `Edit ${member.full_name}`, body: staffFormMarkup(member) });
      bindStaffForm(member);
    }));

    root.querySelectorAll(".staff-delete-button").forEach((button) => button.addEventListener("click", async () => {
      if (!await confirmDialog({ title: "Delete staff member", message: "This removes the staff record from the directory.", confirmLabel: "Delete", tone: "danger" })) {
        return;
      }
      try {
        await deleteStaff(Number(button.dataset.id));
        await createAuditLog({
          userId: auth.user.id,
          action: "Deleted staff member",
          entityType: "staff",
          entityId: Number(button.dataset.id),
          details: "Staff record removed",
        });
        showToast("Staff member deleted.", "success");
        await load();
      } catch (error) {
        showToast(friendlyError(error), "error");
      }
    }));
  }

  await load();
});
