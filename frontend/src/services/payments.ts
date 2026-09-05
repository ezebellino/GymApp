import api from "@/lib/http";
import type { Payment } from "@/types";
import { readTotalCount, type PaginatedResult } from "./pagination";

export type PaymentsParams = {
  q?: string;
  user_id?: string;
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
  user_id: string;
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
