import { getStoredSettings, parseNumber } from "../utils.js";
import { supabase } from "../supabaseClient.js";

function invoiceQuery() {
  return supabase
    .from("invoices")
    .select(`
      *,
      guests(id, full_name, email, phone),
      reservations(id, confirmation_number, status, payment_status, total_amount, downpayment_amount, downpayment_paid, incidental_deposit_amount, incidental_deposit_paid, check_in, check_out, rooms(room_number, room_types(name))),
      invoice_items(*),
      payments(*, received_by_profile:users_profile!payments_received_by_fkey(full_name, role))
    `);
}

export async function listInvoices() {
  const { data, error } = await invoiceQuery().order("created_at", { ascending: false });
  if (error) {
    throw error;
  }
  return data || [];
}

export async function getReservationInvoice(reservationId) {
  const { data, error } = await invoiceQuery()
    .eq("reservation_id", reservationId)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data;
}

export async function createInvoiceFromReservation(reservation, options = {}) {
  const settings = getStoredSettings();
  const taxRate = parseNumber(options.taxRate ?? settings.taxRate, 12);
  const subtotal = parseNumber(options.subtotal ?? reservation.total_amount, 0);
  const discount = parseNumber(options.discount, 0);
  const tax = Number(((subtotal - discount) * (taxRate / 100)).toFixed(2));
  const total = Number((subtotal - discount + tax).toFixed(2));

  const existing = await getReservationInvoice(reservation.id);
  if (existing) {
    return existing;
  }

  const { data, error } = await supabase
    .from("invoices")
    .insert({
      reservation_id: reservation.id,
      guest_id: reservation.guest_id,
      invoice_number: `GMH-INV-${new Date().getFullYear()}-${String(reservation.id).padStart(6, "0")}`,
      subtotal,
      tax,
      discount,
      total,
      status: reservation.downpayment_paid > 0 ? "Partial" : "Pending",
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  await saveInvoiceItem({
    invoice_id: data.id,
    description: `Room charge for reservation ${reservation.confirmation_number || reservation.id}`,
    quantity: 1,
    unit_price: subtotal,
    total: subtotal,
  });

  return getReservationInvoice(reservation.id);
}

export async function saveInvoiceItem(payload) {
  const amount = Number(payload.total || 0);
  if (amount < 0 && !String(payload.description || "").toLowerCase().includes("discount")) {
    throw new Error("Negative invoice amounts are only allowed for discount line items.");
  }

  const { data, error } = await supabase.from("invoice_items").insert(payload).select("*").single();
  if (error) {
    throw error;
  }
  return data;
}

export async function savePayment(payload) {
  const amount = Number(payload.amount || 0);
  if (amount <= 0) {
    throw new Error("Payment amount must be greater than zero.");
  }
  if (!payload.payment_method) {
    throw new Error("Payment method is required.");
  }

  const { data, error } = await supabase.from("payments").insert(payload).select("*").single();
  if (error) {
    throw error;
  }
  return data;
}

export async function addClubMembershipFeeToInvoice({ invoiceId, clubName, membershipNumber, amount }) {
  return saveInvoiceItem({
    invoice_id: invoiceId,
    description: `${clubName} membership fee (${membershipNumber})`,
    quantity: 1,
    unit_price: amount,
    total: amount,
  });
}

export async function addAmenityChargeToInvoice({ invoiceId, amenityName, quantity, amount }) {
  return saveInvoiceItem({
    invoice_id: invoiceId,
    description: `${amenityName} service charge`,
    quantity,
    unit_price: Number(amount || 0) / Number(quantity || 1),
    total: amount,
  });
}

export async function addServiceChargeToInvoice({ invoiceId, description, quantity, amount }) {
  return saveInvoiceItem({
    invoice_id: invoiceId,
    description,
    quantity,
    unit_price: Number(amount || 0) / Number(quantity || 1),
    total: amount,
  });
}

export async function getCheckoutFolio(reservationId) {
  const invoice = await getReservationInvoice(reservationId);
  if (!invoice) {
    return null;
  }

  const totalPayments = (invoice.payments || []).reduce((sum, payment) => {
    return sum + (payment.payment_status === "Refunded" ? -Number(payment.amount || 0) : Number(payment.amount || 0));
  }, 0);

  const refundableAmount = Math.max(Number(invoice.reservations?.incidental_deposit_paid || 0) - Math.max(Number(invoice.total || 0) - totalPayments, 0), 0);
  const outstandingBalance = Math.max(Number(invoice.total || 0) - totalPayments, 0);

  return {
    invoice,
    lineItems: invoice.invoice_items || [],
    payments: invoice.payments || [],
    totalPayments,
    refundableAmount,
    outstandingBalance,
  };
}

export async function getBillingSummary() {
  const invoices = await listInvoices();
  const totalRevenue = invoices.reduce((total, invoice) => total + Number(invoice.total || 0), 0);
  const outstanding = invoices.reduce((total, invoice) => {
    const paid = (invoice.payments || []).reduce((sum, payment) => {
      return sum + (payment.payment_status === "Refunded" ? -Number(payment.amount || 0) : Number(payment.amount || 0));
    }, 0);
    return total + Math.max(Number(invoice.total || 0) - paid, 0);
  }, 0);
  const clubRevenue = invoices.reduce((total, invoice) => {
    const feeTotal = (invoice.invoice_items || [])
      .filter((item) => item.description.toLowerCase().includes("membership fee"))
      .reduce((sum, item) => sum + Number(item.total || 0), 0);
    return total + feeTotal;
  }, 0);
  const serviceRevenue = invoices.reduce((total, invoice) => {
    const feeTotal = (invoice.invoice_items || [])
      .filter((item) => item.description.toLowerCase().includes("service charge"))
      .reduce((sum, item) => sum + Number(item.total || 0), 0);
    return total + feeTotal;
  }, 0);

  return {
    totalRevenue,
    outstanding,
    clubRevenue,
    serviceRevenue,
    invoices,
  };
}
