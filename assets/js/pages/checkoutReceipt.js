import { requireAuth } from "../auth.js";
import { getCheckoutReceiptData, renderCheckoutReceiptPage } from "../services/receiptPrintService.js";
import { createEmptyState, showToast } from "../ui.js";
import { friendlyError, getQueryParam, qs, render } from "../utils.js";

const root = document.getElementById("checkout-receipt-page");
const reservationId = Number(getQueryParam("id"));
const auth = await requireAuth();

if (auth) {
  await load();
}

async function load() {
  if (!reservationId) {
    render(root, createEmptyState({ title: "Missing reservation", copy: "A reservation ID is required to load the checkout receipt." }));
    return;
  }

  try {
    const receipt = await getCheckoutReceiptData(reservationId);
    render(root, renderCheckoutReceiptPage(receipt));
    qs("#print-receipt-button")?.addEventListener("click", () => window.print());
  } catch (error) {
    render(root, createEmptyState({ title: "Unable to load receipt", copy: friendlyError(error, "The checkout receipt could not be generated for this reservation.") }));
    showToast("Unable to load checkout receipt.", "error");
  }
}
