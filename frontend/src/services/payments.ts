import api from "@/lib/http";
import type { Payment } from "@/types";
import { readTotalCount, type PaginatedResult } from "./pagination";

export type PaymentMethod = "cash" | "transfer";

export type PaymentsParams = {
  q?: string;
  user_id?: string;
  // `rebuild-payments-with-plan-pricing` (D3.3): filtros nuevos, todos
  // opcionales y combinables con los existentes.
  period_month?: number;
  period_year?: number;
  method?: PaymentMethod;
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

// `rebuild-payments-with-plan-pricing` (D3.4): indicadores de un período
// mes/año, distinto de `/reports/kpis` que agrega por `created_at`.
export type PaymentsPeriod = { period_year: number; period_month: number };

export type PaymentsPeriodSummary = {
  period_year: number;
  period_month: number;
  payments_count: number;
  amount_sum: number;
  members_active: number;
  members_paid: number;
  members_pending: number;
};

export async function fetchPaymentsSummary(
  period: PaymentsPeriod,
): Promise<PaymentsPeriodSummary> {
  const { data } = await api.get<PaymentsPeriodSummary>("/payments/summary", {
    params: period,
  });
  return data;
}

export type CreatePaymentInput = {
  user_id: string;
  // Opcional (D3.1): omitido o `undefined` -> el backend usa el precio de
  // referencia vigente del plan del miembro. `JSON.stringify` omite las
  // claves `undefined`, así que no viaja en el payload.
  amount?: number;
  method: PaymentMethod | null;
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
// homónima dentro de `loadDashboard` (Dashboard.tsx). Se mantienen estos
// nombres (no son parte del rename Client->User de la vista/tipo): responden
// "quién no pagó *ese período*", distinto del `membership_indicator` que ya
// calcula el servidor para el listado de Usuarios.
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
      .map((payment) => payment.user_id),
  );
}

export function getPendingClients<U extends { id: string; membership_status?: string }>(
  users: U[],
  payments: Payment[],
  period: { month: number; year: number },
): U[] {
  // `membership_status === "active"` (no `is_active`, que hoy es "cuenta
  // habilitada" para cualquier rol): un Dueño/Coach sin membresía no debe
  // aparecer acá aunque su cuenta esté activa (hallazgo 3 de
  // verification.md de unify-clients-into-users).
  const paidUserIds = getPaidClientIds(payments, period);
  return users.filter(
    (user) => user.membership_status === "active" && !paidUserIds.has(user.id),
  );
}
