import api from "@/lib/http";
import type { Payment } from "@/types";
import { readTotalCount, type PaginatedResult } from "./pagination";

export type PaymentsParams = {
  q?: string;
  client_id?: string;
  limit?: number;
  offset?: number;
};

export async function fetchPayments(
  params: PaymentsParams = {},
): Promise<PaginatedResult<Payment>> {
  const { limit = 20, offset = 0, ...rest } = params;
  const { data, headers } = await api.get<Payment[]>("/payments", {
    params: { limit, offset, ...rest },
  });

  return { items: data, total: readTotalCount(headers, data.length) };
}

export type PeriodRange = { start: string; end: string };

export type PaymentsKpis = { amount_sum?: number };

export async function fetchPaymentsKpis(period: PeriodRange): Promise<PaymentsKpis> {
  const { data } = await api.get<PaymentsKpis>("/payments/reports/kpis", {
    params: period,
  });
  return data;
}

export type CreatePaymentInput = {
  client_id: string;
  amount: number;
  method: "cash" | "transfer" | null;
  method_channel?: string | null;
  note?: string | null;
  period_month: number;
  period_year: number;
};

export async function createPayment(input: CreatePaymentInput): Promise<Payment> {
  const { data } = await api.post<Payment>("/payments", input);
  return data;
}

export async function deletePayment(id: string): Promise<void> {
  await api.delete(`/payments/${id}`);
}

// Selectores puros compartidos por Pagos y Dashboard (dec. 3/6): hoy
// duplicados como `loadReminderTargets` (Payments.tsx) y la derivación
// homónima dentro de `loadDashboard` (Dashboard.tsx).
export function getPaidClientIds(
  payments: Payment[],
  period: { month: number; year: number },
): Set<string> {
  return new Set(
    payments
      .filter(
        (payment) =>
          payment.period_month === period.month && payment.period_year === period.year,
      )
      .map((payment) => payment.client_id),
  );
}

export function getPendingClients<C extends { id: string; is_active?: boolean }>(
  clients: C[],
  payments: Payment[],
  period: { month: number; year: number },
): C[] {
  const paidClientIds = getPaidClientIds(payments, period);
  return clients.filter(
    (client) => client.is_active !== false && !paidClientIds.has(client.id),
  );
}
