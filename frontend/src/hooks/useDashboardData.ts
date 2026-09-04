import { useMemo } from "react";
import { useClientsQuery } from "@/services/clients.queries";
import { usePaymentsQuery, usePaymentsKpisQuery } from "@/services/payments.queries";
import { useAttendanceCountQuery } from "@/services/attendance.queries";
import { getPendingClients } from "@/services/payments";
import type { Client, Payment } from "@/types";

// Descomposición del Dashboard (design.md dec. 7): cuatro queries
// independientes en vez del `Promise.allSettled` original, con los
// derivados recalculados con `useMemo` (tasks.md 8.2 y 8.3 se implementan
// juntas: separar "cambiar el fetching" de "recalcular lo que dependía de
// ese fetching" no deja un estado intermedio compilable).

const CLIENTS_SAMPLE_LIMIT = 200;

const pad = (value: number) => String(value).padStart(2, "0");

const d2 = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const monthBounds = (date = new Date()) => {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return {
    start: d2(start),
    end: d2(end),
  };
};

const currentPeriod = () => {
  const today = new Date();
  return {
    month: today.getMonth() + 1,
    year: today.getFullYear(),
  };
};

const isSameMonth = (value: string, month: number, year: number) => {
  const date = new Date(value);
  return date.getMonth() + 1 === month && date.getFullYear() === year;
};

const todayAndTomorrow = () => {
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  return {
    start: d2(today),
    end: d2(tomorrow),
  };
};

// Estado de un bloque del Dashboard (dec. 5): cada sección mira el estado de
// la(s) query(s) que la alimentan, no un estado global — un fallo parcial no
// rompe el resto de la vista (SDC-R3).
type BlockStatus = {
  isPending: boolean;
  isError: boolean;
  refetch: () => void;
};

export function useDashboardData() {
  const period = currentPeriod();
  const monthRange = monthBounds();
  const todayRange = todayAndTomorrow();

  const clientsQuery = useClientsQuery({ limit: CLIENTS_SAMPLE_LIMIT });
  const paymentsQuery = usePaymentsQuery({ limit: 200 });
  const kpisQuery = usePaymentsKpisQuery(monthRange);
  const attendanceCountQuery = useAttendanceCountQuery(todayRange);

  const clients = clientsQuery.data?.items ?? [];
  const allPayments = paymentsQuery.data?.items ?? [];

  const clientsTotal = clientsQuery.data?.total ?? clients.length;
  const activeClients = useMemo(
    () => clients.filter((client) => client.is_active !== false).length,
    [clients]
  );

  const lastPayments = useMemo<Payment[]>(
    () => allPayments.slice(0, 5),
    [allPayments]
  );

  // Mismo fallback que el `loadDashboard` original: si fallan los KPIs del
  // backend, se deriva la facturación del mes a partir de los pagos ya
  // traídos en vez de dejar el dato en blanco.
  const revenueMonth = useMemo(() => {
    const revenueFromPayments = allPayments
      .filter((payment) => isSameMonth(payment.created_at, period.month, period.year))
      .reduce((sum, payment) => sum + (payment.amount || 0), 0);
    return kpisQuery.data?.amount_sum ?? revenueFromPayments;
  }, [allPayments, kpisQuery.data, period.month, period.year]);

  const pendingClientsAll = useMemo<Client[]>(
    () => getPendingClients(clients, allPayments, period),
    [clients, allPayments, period.month, period.year]
  );
  const clientsWithoutPayment = pendingClientsAll.length;
  const pendingClients = useMemo(
    () => pendingClientsAll.slice(0, 6),
    [pendingClientsAll]
  );

  const checkinsToday = attendanceCountQuery.data ?? 0;

  const kpisStatus: BlockStatus = {
    isPending: clientsQuery.isPending || attendanceCountQuery.isPending,
    isError: clientsQuery.isError || attendanceCountQuery.isError,
    refetch: () => {
      clientsQuery.refetch();
      attendanceCountQuery.refetch();
    },
  };

  const lastPaymentsStatus: BlockStatus = {
    isPending: paymentsQuery.isPending,
    isError: paymentsQuery.isError,
    refetch: () => {
      paymentsQuery.refetch();
    },
  };

  const pendingClientsStatus: BlockStatus = {
    isPending: clientsQuery.isPending || paymentsQuery.isPending,
    isError: clientsQuery.isError || paymentsQuery.isError,
    refetch: () => {
      clientsQuery.refetch();
      paymentsQuery.refetch();
    },
  };

  return {
    clientsTotal,
    activeClients,
    clientsWithoutPayment,
    revenueMonth,
    checkinsToday,
    payments: lastPayments,
    pendingClients,
    kpisStatus,
    lastPaymentsStatus,
    pendingClientsStatus,
  };
}
