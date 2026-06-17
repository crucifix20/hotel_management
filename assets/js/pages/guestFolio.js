import { requireAuth } from "../auth.js";
import { ROLES } from "../config.js";
import { createAuditLog } from "../services/auditService.js";
import { getGuestFolioData, renderGuestFolioPage, settleGuestFolio } from "../services/guestFolioService.js";
import { createEmptyState, showToast } from "../ui.js";
import { friendlyError, getQueryParam, qs, render, serializeForm, withFormBusy } from "../utils.js";

const root = document.getElementById("guest-folio-page");
const reservationId = Number(getQueryParam("id"));
const auth = await requireAuth();

if (auth) {
  await load();
}

async function load() {
  if (!reservationId) {
    render(root, createEmptyState({ title: "Missing reservation", copy: "A reservation ID is required to load the guest folio." }));
    return;
  }

  try {
    const data = await getGuestFolioData(reservationId);
    render(root, renderGuestFolioPage({ ...data, isAdmin: auth.profile.role === ROLES.ADMIN }));

    qs("#print-folio-button")?.addEventListener("click", () => window.print());
    qs("#confirm-checkout-button")?.addEventListener("click", () => {
      const panel = qs("#guest-folio-settlement");
      panel.style.display = panel.style.display === "none" ? "block" : "none";
      panel.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    qs("#guest-folio-settlement-form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        await withFormBusy(event.currentTarget, "Completing...", async () => {
          const payload = serializeForm(event.currentTarget);
          const result = await settleGuestFolio({
            reservationId,
            userId: auth.user.id,
            isAdmin: auth.profile.role === ROLES.ADMIN,
            paymentAmount: Number(payload.payment_amount || 0),
            paymentMethod: payload.payment_method,
            paymentReference: payload.payment_reference,
            paymentNotes: payload.payment_notes,
            chargeDescription: payload.charge_description,
            chargeQuantity: Number(payload.charge_quantity || 0),
            chargeUnitPrice: Number(payload.charge_unit_price || 0),
            checkoutNotes: payload.checkout_notes,
            allowOverride: payload.allow_override === "on",
            checkoutOverrideReason: payload.checkout_override_reason,
          });

          await createAuditLog({
            userId: auth.user.id,
            action: "Checked out reservation",
            entityType: "reservations",
            entityId: result.reservation.id,
            details: payload.checkout_override_reason?.trim()
              ? `${result.reservation.confirmation_number || result.reservation.id} checked out with override: ${payload.checkout_override_reason.trim()}`
              : `${result.reservation.confirmation_number || result.reservation.id} checked out from guest folio`,
          });

          showToast("Checkout completed successfully.", "success");
          window.location.href = `checkout-receipt.html?id=${result.reservation.id}`;
        });
      } catch (error) {
        showToast(friendlyError(error), "error");
      }
    });
  } catch (error) {
    render(root, createEmptyState({ title: "Unable to load guest folio", copy: friendlyError(error, "The guest folio could not be generated for this reservation.") }));
    showToast("Unable to load guest folio.", "error");
  }
}
