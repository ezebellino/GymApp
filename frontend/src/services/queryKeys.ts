import type { UsersParams } from "./users";
import type {
  PaymentsParams,
  PeriodRange as PaymentsPeriodRange,
  PaymentsPeriod,
} from "./payments";
import type { AttendanceParams, PeriodRange as AttendancePeriodRange } from "./attendance";
import type { MembershipPlansParams } from "./membershipPlans";

// Único lugar del repo donde se escribe un string de key (dec. 3). Jerarquía
// [dominio, vista, params] para poder invalidar por prefijo de dominio
// (`queryKeys.<dominio>.all`) sin importar la combinación de params de cada
// query concreta.
export const queryKeys = {
  users: {
    all: ["users"] as const,
    list: (params: UsersParams) => ["users", "list", params] as const,
    detail: (id: string) => ["users", "detail", id] as const,
    search: (q: string) => ["users", "search", q] as const,
  },
  payments: {
    all: ["payments"] as const,
    list: (params: PaymentsParams) => ["payments", "list", params] as const,
    kpis: (period: PaymentsPeriodRange) => ["payments", "kpis", period] as const,
    // `rebuild-payments-with-plan-pricing` (D5.5): único lugar que escribe
    // esta key.
    summary: (period: PaymentsPeriod) => ["payments", "summary", period] as const,
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
  // add-routine-templates (design D12): dos dominios nuevos.
  routineTemplates: {
    all: ["routineTemplates"] as const,
    list: () => ["routineTemplates", "list"] as const,
    detail: (id: string) => ["routineTemplates", "detail", id] as const,
  },
  routineAssignments: {
    all: ["routineAssignments"] as const,
    byUser: (userId: string) => ["routineAssignments", "byUser", userId] as const,
    my: () => ["routineAssignments", "my"] as const,
    myDetail: (assignmentId: string) => ["routineAssignments", "myDetail", assignmentId] as const,
  },
  // add-membership-plans (design D4): dominio nuevo.
  membershipPlans: {
    all: ["membershipPlans"] as const,
    list: (params: MembershipPlansParams) => ["membershipPlans", "list", params] as const,
    detail: (id: string) => ["membershipPlans", "detail", id] as const,
  },
};
