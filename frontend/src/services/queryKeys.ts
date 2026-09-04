import type { ClientsParams } from "./clients";
import type { PaymentsParams, PeriodRange as PaymentsPeriodRange } from "./payments";
import type { AttendanceParams, PeriodRange as AttendancePeriodRange } from "./attendance";

// Único lugar del repo donde se escribe un string de key (dec. 3). Jerarquía
// [dominio, vista, params] para poder invalidar por prefijo de dominio
// (`queryKeys.<dominio>.all`) sin importar la combinación de params de cada
// query concreta.
export const queryKeys = {
  clients: {
    all: ["clients"] as const,
    list: (params: ClientsParams) => ["clients", "list", params] as const,
    search: (q: string) => ["clients", "search", q] as const,
  },
  payments: {
    all: ["payments"] as const,
    list: (params: PaymentsParams) => ["payments", "list", params] as const,
    kpis: (period: PaymentsPeriodRange) => ["payments", "kpis", period] as const,
  },
  attendance: {
    all: ["attendance"] as const,
    list: (params: AttendanceParams) => ["attendance", "list", params] as const,
    count: (period: AttendancePeriodRange) => ["attendance", "count", period] as const,
  },
  settings: {
    all: ["settings"] as const,
  },
  me: {
    all: ["me"] as const,
  },
};
