import { getReservationInvoice } from "./billingService.js";
import { getReservation } from "./reservationsService.js";
import { renderBookingConfirmation } from "../ui.js";

export function formatConfirmationNumber(reservation) {
  return reservation.confirmation_number || `GMH-BOOK-${new Date(reservation.created_at || Date.now()).getFullYear()}-${String(reservation.id).padStart(6, "0")}`;
}

export async function getBookingConfirmationData(id) {
  const reservation = await getReservation(id);
  const invoice = await getReservationInvoice(id);

  const amenityItems = (reservation.guests?.amenity_bookings || []).map((booking) => ({
    description: booking.amenities?.name || "Amenity",
    quantity: booking.quantity,
    unit_price: booking.total_amount / Math.max(booking.quantity || 1, 1),
    total_amount: booking.total_amount,
  }));

  const clubItems = (reservation.guests?.club_registrations || [])
    .flatMap((registration) => registration.club_transactions || [])
    .map((transaction) => ({
      description: transaction.description || transaction.transaction_type,
      quantity: 1,
      unit_price: transaction.amount,
      total_amount: transaction.amount,
    }));

  return {
    reservation: {
      ...reservation,
      confirmation_number: formatConfirmationNumber(reservation),
    },
    invoice,
    payments: invoice?.payments || [],
    amenityItems,
    clubItems,
  };
}

export function renderBookingConfirmationPage(data) {
  return renderBookingConfirmation(data);
}
