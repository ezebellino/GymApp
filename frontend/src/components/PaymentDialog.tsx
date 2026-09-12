import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/hooks/useDebounce";
import { useUsersQuery } from "@/services/users.queries";
import { useCreatePaymentMutation } from "@/services/payments.queries";
import type { PaymentMethod } from "@/services/payments";
import { useSettingsStore } from "@/stores/settings";
import { toastError, toastSuccess } from "@/lib/toast";
import type { User } from "@/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Con `user` -> sin selector (entrada desde la ficha o desde una fila). Sin
  // `user` -> buscador de miembro (entrada desde la sección Pagos), D5.2.
  user?: User;
  onSuccess?: () => void;
};

const METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: "Efectivo",
  transfer: "Transferencia",
};

function currentPeriod() {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}

/**
 * Diálogo de alta de pago reusable (`rebuild-payments-with-plan-pricing`,
 * D5.2/D5.3): reemplaza a `NewPaymentDialog` y al "pago rápido" que tenía su
 * propia lógica en `UserCard`. Un solo componente para los dos puntos de
 * entrada (Pagos y ficha del miembro).
 */
export default function PaymentDialog({ open, onOpenChange, user, onSuccess }: Props) {
  const allowCash = useSettingsStore((s) => s.settings.allow_cash);
  const allowTransfer = useSettingsStore((s) => s.settings.allow_transfer);
  const allowedMethods = useMemo(
    () => [
      ...(allowCash ? (["cash"] as const) : []),
      ...(allowTransfer ? (["transfer"] as const) : []),
    ],
    [allowCash, allowTransfer]
  );

  // Selector de miembro (solo cuando no viene `user` por prop).
  const [selectedUser, setSelectedUser] = useState<User | null>(user ?? null);
  const [memberQuery, setMemberQuery] = useState("");
  const debouncedMemberQuery = useDebounce(memberQuery, 400);
  const { data: memberResults, isFetching: isSearchingMembers } = useUsersQuery(
    {
      q: debouncedMemberQuery || undefined,
      limit: 20,
    },
    // El miembro viene por prop (entrada desde la ficha o desde una fila):
    // el buscador no se renderiza y este resultado se descarta, así que no
    // hace falta pedirlo (verification.md hallazgo 5).
    { enabled: !user }
  );

  const [amount, setAmount] = useState<number | "">("");
  const [method, setMethod] = useState<PaymentMethod | "">("");
  const [methodChannel, setMethodChannel] = useState("");
  const [periodMonth, setPeriodMonth] = useState(currentPeriod().month);
  const [periodYear, setPeriodYear] = useState(currentPeriod().year);
  const [note, setNote] = useState("");

  const createMutation = useCreatePaymentMutation();

  // Reset completo cada vez que se abre el diálogo o cambia el miembro
  // preseleccionado (props.user). `amount` NO se toca acá: vive en el
  // efecto de abajo para que no pueda desincronizarse cuando `user` cambia
  // de identidad (mismo miembro, objeto nuevo) con el diálogo abierto.
  useEffect(() => {
    if (!open) return;
    setSelectedUser(user ?? null);
    setMemberQuery("");
    const period = currentPeriod();
    setPeriodMonth(period.month);
    setPeriodYear(period.year);
    setMethodChannel("");
    setNote("");
    // Dep en `user?.id`, no en `user` (corrección `verification.md`,
    // segunda pasada, hallazgo 3): un refetch que cambie cualquier campo del
    // `user` (ej. `membership_indicator`) no puede resetear período/nota si
    // sigue siendo "el mismo" miembro.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user?.id]);

  // Precarga del monto con el precio vigente del plan del miembro
  // seleccionado (D2, D5.2) y el primer método habilitado.
  useEffect(() => {
    if (!open) return;
    setAmount(selectedUser?.membership_plan?.current_amount ?? "");
    setMethod(allowedMethods[0] ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedUser?.id]);

  // Corrección `verification.md` (segunda pasada, hallazgo 4): si
  // `allow_cash`/`allow_transfer` cambia con el diálogo abierto (ej. otra
  // pestaña desactiva "Efectivo") y el método seleccionado deja de estar
  // habilitado, el `<select>` queda con un `value` sin `<option>`
  // correspondiente. Igual que `UserCard.tsx` (efecto de corrección del
  // cobro rápido).
  useEffect(() => {
    if (method && allowedMethods.includes(method)) return;
    setMethod(allowedMethods[0] ?? "");
  }, [allowedMethods, method]);

  const hasNoPlan = Boolean(selectedUser) && !selectedUser?.membership_plan;
  // Defensivo: hoy la API no deja llegar acá un plan sin precio vigente (el
  // alta responde 400 antes), pero si pasara, el submit tiene que quedar
  // deshabilitado con un aviso — no en silencio (verification.md hallazgo 4).
  const hasNoPrice =
    Boolean(selectedUser) &&
    Boolean(selectedUser?.membership_plan) &&
    selectedUser?.membership_plan?.current_amount == null;
  const canSubmit =
    Boolean(selectedUser) &&
    !hasNoPlan &&
    !hasNoPrice &&
    Boolean(method) &&
    amount !== "" &&
    Number(amount) >= 0 &&
    allowedMethods.length > 0;

  async function handleSubmit() {
    if (!selectedUser || !method || amount === "") return;
    try {
      await createMutation.mutateAsync({
        user_id: selectedUser.id,
        // SIEMPRE se manda, editado o no (corrección `verification.md`,
        // segunda pasada, hallazgo 1): `canSubmit` ya garantiza que el input
        // tiene un valor numérico antes de permitir el submit, así que
        // payload y pantalla no pueden divergir nunca — sin importar qué
        // dispare un recálculo del precio del plan con el diálogo abierto.
        // El backend sigue aceptando `amount` opcional (D3.1) para el caso
        // en que, algún día, otro cliente lo omita.
        amount: Number(amount),
        method,
        method_channel: method === "transfer" ? methodChannel.trim() || null : null,
        note: note.trim() || null,
        period_month: periodMonth,
        period_year: periodYear,
      });

      onOpenChange(false);
      onSuccess?.();

      // Puente legacy (`hooks/useLegacyRefetchBridge.ts`): lo siguen
      // consumiendo `UserCard`/`SpotlightSearch` hasta que migren del todo.
      try {
        window.dispatchEvent(
          new CustomEvent("payments:created", { detail: { client_id: selectedUser.id } })
        );
      } catch {
        // no-op
      }

      toastSuccess("Pago creado", `Se registró correctamente el pago de ${selectedUser.full_name}.`);
    } catch (error: any) {
      toastError(
        "No se pudo crear el pago",
        error?.response?.data?.detail ?? "Revisá los datos e intentá nuevamente."
      );
    }
  }

  const memberOptions = user ? [] : (memberResults?.items ?? []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-surface-1">
        <DialogHeader>
          <DialogTitle className="text-foreground">Registrar pago</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {selectedUser ? (
              <>
                Registrar pago para <span className="text-foreground">{selectedUser.full_name}</span>.
              </>
            ) : (
              "Elegí un miembro para registrarle un pago."
            )}
          </DialogDescription>
        </DialogHeader>

        {!user ? (
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Miembro</label>
            {selectedUser ? (
              <div className="flex items-center justify-between rounded-md border border-border bg-surface-2/40 px-3 py-2 text-sm text-foreground">
                <span>{selectedUser.full_name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedUser(null)}
                >
                  Cambiar
                </Button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nombre, email o teléfono"
                    aria-label="Buscar miembro"
                    value={memberQuery}
                    onChange={(e) => setMemberQuery(e.target.value)}
                    className="border-border bg-surface-2/40 pl-10 focus-visible:ring-ring"
                  />
                </div>
                <div className="max-h-40 space-y-1 overflow-y-auto">
                  {isSearchingMembers ? (
                    <p className="px-1 py-2 text-xs text-muted-foreground">Buscando...</p>
                  ) : memberOptions.length === 0 ? (
                    <p className="px-1 py-2 text-xs text-muted-foreground">
                      {debouncedMemberQuery ? "Sin resultados." : "Escribí para buscar un miembro."}
                    </p>
                  ) : (
                    memberOptions.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setSelectedUser(option)}
                        className="flex w-full flex-col rounded-md border border-transparent px-2 py-1.5 text-left text-sm text-foreground hover:border-border hover:bg-surface-2/40"
                      >
                        <span>{option.full_name}</span>
                        <span className="text-xs text-muted-foreground">
                          {option.email ?? option.phone ?? "-"}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        ) : null}

        {hasNoPlan ? (
          <div className="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
            <p role="alert" className="text-sm text-amber-700 dark:text-amber-200">
              Este miembro no tiene un plan asignado.
            </p>
            <Button type="button" variant="outline" size="sm" asChild>
              <Link to={`/users/${selectedUser!.id}`} onClick={() => onOpenChange(false)}>
                Asignar plan
              </Link>
            </Button>
          </div>
        ) : null}

        {hasNoPrice ? (
          <div className="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
            <p role="alert" className="text-sm text-amber-700 dark:text-amber-200">
              El plan de este miembro no tiene un precio vigente.
            </p>
            <Button type="button" variant="outline" size="sm" asChild>
              <Link to={`/users/${selectedUser!.id}`} onClick={() => onOpenChange(false)}>
                Revisar plan
              </Link>
            </Button>
          </div>
        ) : null}

        {selectedUser && !hasNoPlan && !hasNoPrice ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs text-muted-foreground">Monto</label>
              <Input
                type="number"
                min={0}
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value === "" ? "" : Number(e.target.value));
                }}
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground">Método</label>
              {allowedMethods.length === 0 ? (
                <p role="alert" className="mt-2 text-sm text-destructive">
                  No hay métodos de pago habilitados en Configuración.
                </p>
              ) : (
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                  aria-label="Método"
                  className="w-full rounded-md border border-border bg-surface-2/40 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {allowedMethods.map((value) => (
                    <option key={value} value={value}>
                      {METHOD_LABEL[value]}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {method === "transfer" ? (
              <div className="sm:col-span-2">
                <label className="text-xs text-muted-foreground">Canal</label>
                <Input
                  placeholder="Mercado Pago, Cuenta DNI, banco, etc."
                  value={methodChannel}
                  onChange={(e) => setMethodChannel(e.target.value)}
                />
              </div>
            ) : null}

            <div>
              <label className="text-xs text-muted-foreground">Mes</label>
              <Input
                type="number"
                min={1}
                max={12}
                value={periodMonth}
                onChange={(e) => setPeriodMonth(Number(e.target.value))}
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground">Año</label>
              <Input
                type="number"
                min={2020}
                max={2100}
                value={periodYear}
                onChange={(e) => setPeriodYear(Number(e.target.value))}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs text-muted-foreground">Nota</label>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Comentario interno opcional"
              />
            </div>
          </div>
        ) : null}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || createMutation.isPending}>
            {createMutation.isPending ? "Guardando..." : "Registrar pago"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
