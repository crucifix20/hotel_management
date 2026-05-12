import { requireAuth } from "../auth.js";
import { getBookingConfirmationData, renderBookingConfirmationPage } from "../services/bookingPrintService.js";
import { createEmptyState, showToast } from "../ui.js";
import { friendlyError, getQueryParam, qs, render } from "../utils.js";

const root = document.getElementById("booking-confirmation-page");
const reservationId = Number(getQueryParam("id"));
const auth = await requireAuth();

if (auth) {
  await load();
}

async function load() {
  if (!reservationId) {
    render(root, createEmptyState({ title: "Missing reservation", copy: "A reservation ID is required to load the booking confirmation." }));
    return;
  }

  try {
    const confirmation = await getBookingConfirmationData(reservationId);
    render(root, renderBookingConfirmationPage(confirmation));
    qs("#print-confirmation-button")?.addEventListener("click", () => window.print());
  } catch (error) {
    render(root, createEmptyState({ title: "Unable to load confirmation", copy: friendlyError(error, "The reservation ID may be invalid or inaccessible.") }));
    showToast("Unable to load booking confirmation.", "error");
  }
}
