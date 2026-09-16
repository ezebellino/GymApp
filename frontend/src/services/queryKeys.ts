import type { UsersParams } from "./users";
import type {
  PaymentsParams,
  PeriodRange as PaymentsPeriodRange,
  PaymentsPeriod,
} from "./payments";
import type { AttendanceParams, PeriodRange as AttendancePeriodRange } from "./attendance";
import type { MembershipPlansParams } from "./membershipPlans";
import type { ExercisesParams } from "./exercises";
import type { WorkoutLogsParams } from "./routineAssignments";
import type { PlannedSetsPreviewInput } from "./progression";

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
    // `member-routine-copies` (design D6, D8, D10): detalle de la copia para
    // el editor de Dueño/Coach, histórico filtrable (staff y propio) y
    // ejercicios con registros (filtro de la vista de Progreso).
    detail: (userId: string, assignmentId: string) =>
      ["routineAssignments", "detail", userId, assignmentId] as const,
    logs: (userId: string, params: WorkoutLogsParams) =>
      ["routineAssignments", "logs", userId, params] as const,
    loggedExercises: (userId: string) =>
      ["routineAssignments", "loggedExercises", userId] as const,
    my: () => ["routineAssignments", "my"] as const,
    myDetail: (assignmentId: string) => ["routineAssignments", "myDetail", assignmentId] as const,
    myLogs: (params: WorkoutLogsParams) => ["routineAssignments", "myLogs", params] as const,
    // Prefijo sin `params` (hallazgo menor 6 del `verification.md`): la
    // invalidación de `useMarkSetMutation` alcanza cualquier combinación de
    // filtros del panel "Historial" — antes escrito inline en
    // `routineAssignments.queries.ts`.
    myLogsAll: () => ["routineAssignments", "myLogs"] as const,
    // D15: espejo de `loggedExercises` para el propio Miembro — histórico
    // completo, sin ventana, alimenta el filtro del panel "Historial".
    myLoggedExercises: () => ["routineAssignments", "myLoggedExercises"] as const,
  },
  // `member-routine-copies` (design D13, corrección del gate): previsualización
  // sin estado del plan de series — key = la tupla completa, así volver a una
  // estrategia ya vista cuesta cero requests (`staleTime: Infinity`).
  progression: {
    all: ["progression"] as const,
    preview: (input: PlannedSetsPreviewInput) => ["progression", "preview", input] as const,
  },
  // add-membership-plans (design D4): dominio nuevo.
  membershipPlans: {
    all: ["membershipPlans"] as const,
    list: (params: MembershipPlansParams) => ["membershipPlans", "list", params] as const,
    detail: (id: string) => ["membershipPlans", "detail", id] as const,
  },
  // add-exercise-catalog (design D12): dominio nuevo.
  exercises: {
    all: ["exercises"] as const,
    list: (params: ExercisesParams) => ["exercises", "list", params] as const,
    detail: (id: string) => ["exercises", "detail", id] as const,
    meta: () => ["exercises", "meta"] as const,
  },
};
