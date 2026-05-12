import { HOUSEKEEPING_PRIORITIES, HOUSEKEEPING_STATUSES } from "../config.js";
import { initProtectedPage } from "../router.js";
import { createAuditLog } from "../services/auditService.js";
import { listHousekeepingTasks, saveHousekeepingTask, updateHousekeepingTaskStatus, deleteHousekeepingTask } from "../services/housekeepingService.js";
import { listRooms } from "../services/roomsService.js";
import { listStaffOptions } from "../services/staffService.js";
import { buildSelectOptions, createOptionList, friendlyError, formatDate, qs, render, serializeForm, todayIso, withFormBusy } from "../utils.js";
import { closeModal, confirmDialog, createPageHeader, createStatusBadge, openModal, showToast } from "../ui.js";

await initProtectedPage("housekeeping", async ({ root, auth }) => {
  let roomOptions = [];
  let staffOptions = [];
  let filters = { roomId: "", priority: "", status: "" };

  async function load() {
    [roomOptions, staffOptions] = await Promise.all([listRooms({}), listStaffOptions()]);
    const tasks = await listHousekeepingTasks(filters);
    const urgentTasks = tasks.filter((task) => task.priority === "Urgent" || task.priority === "High");
    const completedTasks = tasks.filter((task) => task.status === "Completed").length;
    const inProgressTasks = tasks.filter((task) => task.status === "In Progress").length;
    const dirtyRooms = roomOptions.filter((room) => room.status === "Cleaning").length;
    const cleanRooms = roomOptions.filter((room) => room.status === "Available").length;
    const occupiedRooms = roomOptions.filter((room) => room.status === "Occupied").length;
    const blockedRooms = roomOptions.filter((room) => ["Maintenance", "Out of Service"].includes(room.status)).length;

    render(root, `
      ${createPageHeader({
        title: "Housekeeping Operations",
        subtitle: "Task visibility, room turnaround, and assignment control.",
        actions: `<button class="btn btn-primary" id="add-task-button" type="button">Add Task</button>`,
      })}
      <section class="stitch-main-grid">
        <div>
          <div class="stitch-section-head">
            <div>
              <h2>Dirty Rooms and Turnovers</h2>
              <p>Priority housekeeping actions and room preparation status.</p>
            </div>
          </div>
          <div class="stitch-room-grid">
            ${urgentTasks.map((task) => `
              <article class="stitch-room-card">
                <div class="stitch-room-image">
                  <div class="stitch-room-status status-${(task.rooms?.status || task.status).toLowerCase().replaceAll(" ", "-")}">${task.status}</div>
                </div>
                <div class="stitch-room-body">
                  <div style="display:flex; justify-content:space-between; gap:16px; align-items:start;">
                    <div>
                      <h3>Room ${task.rooms?.room_number || "-"}</h3>
                      <div class="stitch-room-meta">${task.task_type}</div>
                    </div>
                    <div>${createStatusBadge(task.priority)}</div>
                  </div>
                  <div class="stitch-room-divider">
                    <div class="stitch-mini-meta">
                      <span>${task.staff?.full_name || "Unassigned"}</span>
                      <span>Due ${formatDate(task.due_date)}</span>
                    </div>
                  </div>
                  <div class="table-actions" style="margin-top:18px;">
                    <button class="btn btn-ghost hk-edit-button" data-id="${task.id}" type="button">Edit</button>
                    <button class="btn btn-ghost hk-status-button" data-id="${task.id}" type="button">Advance Status</button>
                    <button class="btn btn-danger hk-delete-button" data-id="${task.id}" type="button">Delete</button>
                  </div>
                </div>
              </article>
            `).join("") || `
              <article class="panel">
                <p class="muted">No urgent turnover tasks are currently queued.</p>
              </article>
            `}
          </div>
        </div>

        <div class="list-grid" style="grid-template-columns:1fr;">
          <article class="panel">
            <div class="stitch-section-head">
              <div>
                <h2 style="font-size:1.5rem;">Room Status Count</h2>
                <p>Live housekeeping-ready room condition totals.</p>
              </div>
            </div>
            <div class="housekeeping-kpi-grid">
              <article class="stitch-kpi-card compact">
                <h3>Dirty</h3>
                <div class="stitch-kpi-value">${dirtyRooms}</div>
                <p class="stitch-kpi-note">Rooms currently in cleaning turnover</p>
              </article>
              <article class="stitch-kpi-card compact">
                <h3>Clean</h3>
                <div class="stitch-kpi-value">${cleanRooms}</div>
                <p class="stitch-kpi-note">Rooms ready for sale or arrival</p>
              </article>
              <article class="stitch-kpi-card compact">
                <h3>Occupied</h3>
                <div class="stitch-kpi-value">${occupiedRooms}</div>
                <p class="stitch-kpi-note">Rooms with in-house guests</p>
              </article>
              <article class="stitch-kpi-card compact">
                <h3>Blocked</h3>
                <div class="stitch-kpi-value">${blockedRooms}</div>
                <p class="stitch-kpi-note">Maintenance or out-of-service rooms</p>
              </article>
            </div>
          </article>
          <article class="panel">
            <div class="stitch-section-head">
              <div>
                <h2 style="font-size:1.5rem;">Efficiency Rate</h2>
                <p>Completed vs active task mix.</p>
              </div>
            </div>
            <div class="stitch-kpi-value">${tasks.length ? Math.round((completedTasks / tasks.length) * 100) : 0}<span style="font-size:1rem; opacity:.4;">%</span></div>
            <p class="stitch-kpi-note">${completedTasks} completed tasks and ${inProgressTasks} in progress.</p>
          </article>
          <article class="panel">
            <div class="stitch-section-head">
              <div>
                <h2 style="font-size:1.5rem;">Task Filters</h2>
                <p>Refine room and staff workflow view.</p>
              </div>
            </div>
            <div class="filter-row">
              <div class="field">
                <label for="hk-room-filter">Room</label>
                <select id="hk-room-filter">${createOptionList(roomOptions, "id", "room_number", "All rooms")}<\/select>
              </div>
              <div class="field">
                <label for="hk-priority-filter">Priority</label>
                <select id="hk-priority-filter">${buildSelectOptions(HOUSEKEEPING_PRIORITIES)}<\/select>
              </div>
              <div class="field">
                <label for="hk-status-filter">Status</label>
                <select id="hk-status-filter">${buildSelectOptions(HOUSEKEEPING_STATUSES)}<\/select>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section class="table-card">
        <div class="table-toolbar">
          <div>
            <h2 class="font-display" style="margin:0 0 8px;">Housekeeping Task Board</h2>
            <p class="table-meta">${tasks.length} tasks loaded</p>
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Room</th>
                <th>Task</th>
                <th>Assigned Staff</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Due</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${tasks.map((task) => `
                <tr>
                  <td><strong>${task.rooms?.room_number || "-"}</strong><div class="muted">${task.rooms?.status || ""}</div></td>
                  <td>${task.task_type}<div class="muted">${task.notes || "No notes"}</div></td>
                  <td>${task.staff?.full_name || "Unassigned"}</td>
                  <td>${createStatusBadge(task.priority)}</td>
                  <td>${createStatusBadge(task.status)}</td>
                  <td>${formatDate(task.due_date)}${task.status !== "Completed" && task.due_date < todayIso() ? '<div class="validation-error">Overdue</div>' : ""}</td>
                  <td>
                    <div class="table-actions">
                      <button class="btn btn-ghost hk-edit-button" data-id="${task.id}" type="button">Edit</button>
                      <button class="btn btn-ghost hk-status-button" data-id="${task.id}" type="button">Advance Status</button>
                      <button class="btn btn-danger hk-delete-button" data-id="${task.id}" type="button">Delete</button>
                    </div>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </section>
    `);

    qs("#hk-room-filter").value = filters.roomId;
    qs("#hk-priority-filter").value = filters.priority;
    qs("#hk-status-filter").value = filters.status;
    bindEvents(tasks);
  }

  function taskFormMarkup(task = {}) {
    return `
      <form id="hk-form" class="form-stack">
        <input name="id" type="hidden" value="${task.id || ""}">
        <div class="filter-row">
          <div class="field">
            <label for="room_id">Room</label>
            <select id="room_id" name="room_id" required>${createOptionList(roomOptions, "id", "room_number", "Select room")}<\/select>
          </div>
          <div class="field">
            <label for="assigned_staff_id">Assign Staff</label>
            <select id="assigned_staff_id" name="assigned_staff_id">${createOptionList(staffOptions, "id", "full_name", "Select staff")}<\/select>
          </div>
        </div>
        <div class="filter-row">
          <div class="field">
            <label for="task_type">Task Type</label>
            <input id="task_type" name="task_type" value="${task.task_type || ""}" placeholder="Deep Clean" required>
          </div>
          <div class="field">
            <label for="due_date">Due Date</label>
            <input id="due_date" name="due_date" type="date" value="${task.due_date?.slice(0, 10) || todayIso()}" required>
          </div>
        </div>
        <div class="filter-row">
          <div class="field">
            <label for="priority">Priority</label>
            <select id="priority" name="priority">${buildSelectOptions(HOUSEKEEPING_PRIORITIES, "Select priority")}<\/select>
          </div>
          <div class="field">
            <label for="status">Status</label>
            <select id="status" name="status">${buildSelectOptions(HOUSEKEEPING_STATUSES, "Select status")}<\/select>
          </div>
        </div>
        <div class="field">
          <label for="notes">Notes</label>
          <textarea id="notes" name="notes">${task.notes || ""}</textarea>
        </div>
        <button class="btn btn-primary" type="submit">${task.id ? "Save Task" : "Create Task"}</button>
      </form>
    `;
  }

  function bindTaskForm(task = {}) {
    qs("#room_id").value = task.room_id || "";
    qs("#assigned_staff_id").value = task.assigned_staff_id || "";
    qs("#priority").value = task.priority || "Medium";
    qs("#status").value = task.status || "Pending";

    qs("#hk-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        await withFormBusy(event.currentTarget, task.id ? "Saving..." : "Creating...", async () => {
          const payload = serializeForm(event.currentTarget);
          payload.room_id = Number(payload.room_id);
          payload.assigned_staff_id = payload.assigned_staff_id ? Number(payload.assigned_staff_id) : null;
          if (!payload.id) {
            delete payload.id;
          } else {
            payload.id = Number(payload.id);
          }
          const saved = await saveHousekeepingTask(payload);
          await createAuditLog({
            userId: auth.user.id,
            action: task.id ? "Updated housekeeping task" : "Created housekeeping task",
            entityType: "housekeeping_tasks",
            entityId: saved.id,
            details: `${saved.task_type} for room ${saved.rooms?.room_number || payload.room_id}`,
          });
          await load();
          closeModal();
          showToast("Housekeeping task saved.", "success");
        });
      } catch (error) {
        showToast(friendlyError(error), "error");
      }
    });
  }

  function nextStatus(currentStatus) {
    const order = ["Pending", "In Progress", "Completed"];
    const index = order.indexOf(currentStatus);
    return order[Math.min(index + 1, order.length - 1)] || "Pending";
  }

  function bindEvents(tasks) {
    qs("#add-task-button").addEventListener("click", () => {
      openModal({ title: "Add Housekeeping Task", body: taskFormMarkup() });
      bindTaskForm();
    });

    qs("#hk-room-filter").addEventListener("change", async (event) => { filters.roomId = event.target.value; await load(); });
    qs("#hk-priority-filter").addEventListener("change", async (event) => { filters.priority = event.target.value; await load(); });
    qs("#hk-status-filter").addEventListener("change", async (event) => { filters.status = event.target.value; await load(); });

    root.querySelectorAll(".hk-edit-button").forEach((button) => button.addEventListener("click", () => {
      const task = tasks.find((item) => item.id === Number(button.dataset.id));
      openModal({ title: "Edit Housekeeping Task", body: taskFormMarkup(task) });
      bindTaskForm(task);
    }));

    root.querySelectorAll(".hk-status-button").forEach((button) => button.addEventListener("click", async () => {
      const task = tasks.find((item) => item.id === Number(button.dataset.id));
      try {
        const status = nextStatus(task.status);
        const updated = await updateHousekeepingTaskStatus(task.id, status);
        await createAuditLog({
          userId: auth.user.id,
          action: "Updated housekeeping status",
          entityType: "housekeeping_tasks",
          entityId: updated.id,
          details: `${task.task_type} → ${status}`,
        });
        showToast(`Task moved to ${status}.`, "success");
        await load();
      } catch (error) {
        showToast(friendlyError(error), "error");
      }
    }));

    root.querySelectorAll(".hk-delete-button").forEach((button) => button.addEventListener("click", async () => {
      if (!await confirmDialog({ title: "Delete task", message: "This will permanently remove the housekeeping task.", confirmLabel: "Delete", tone: "danger" })) {
        return;
      }
      try {
        await deleteHousekeepingTask(Number(button.dataset.id));
        await createAuditLog({
          userId: auth.user.id,
          action: "Deleted housekeeping task",
          entityType: "housekeeping_tasks",
          entityId: Number(button.dataset.id),
          details: "Housekeeping task removed",
        });
        showToast("Task deleted.", "success");
        await load();
      } catch (error) {
        showToast(friendlyError(error), "error");
      }
    }));
  }

  await load();
});
