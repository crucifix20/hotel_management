import { supabase } from "../supabaseClient.js";

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

export async function listStaffTransactions({ userId, isAdmin = false, filters = {} }) {
  let query = supabase
    .from("payments")
    .select(`
      *,
      invoices(invoice_number),
      reservations(
        id,
        confirmation_number,
        rooms(room_number),
        guests(full_name)
      ),
      received_by_profile:users_profile!payments_received_by_fkey(full_name, role)
    `)
    .order("paid_at", { ascending: false });

  if (!isAdmin) {
    query = query.eq("received_by", userId);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  let transactions = data || [];

  if (filters.dateFrom) {
    transactions = transactions.filter((transaction) => String(transaction.paid_at || transaction.created_at || "").slice(0, 10) >= filters.dateFrom);
  }
  if (filters.dateTo) {
    transactions = transactions.filter((transaction) => String(transaction.paid_at || transaction.created_at || "").slice(0, 10) <= filters.dateTo);
  }
  if (filters.transactionType) {
    transactions = transactions.filter((transaction) => transaction.transaction_type === filters.transactionType);
  }
  if (filters.paymentMethod) {
    transactions = transactions.filter((transaction) => transaction.payment_method === filters.paymentMethod);
  }
  if (filters.search) {
    const needle = normalize(filters.search);
    transactions = transactions.filter((transaction) => {
      const guestName = normalize(transaction.reservations?.guests?.full_name);
      const roomNumber = normalize(transaction.reservations?.rooms?.room_number);
      const confirmation = normalize(transaction.reservations?.confirmation_number);
      const reference = normalize(transaction.payment_reference);
      return [guestName, roomNumber, confirmation, reference].some((value) => value.includes(needle));
    });
  }

  return transactions;
}

export function summarizeTransactions(transactions = []) {
  const totalsByMethod = transactions.reduce((summary, transaction) => {
    const method = transaction.payment_method || "Unspecified";
    summary[method] = (summary[method] || 0) + Number(transaction.amount || 0);
    return summary;
  }, {});

  return {
    totalCollected: transactions.reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0),
    totalsByMethod,
  };
}
