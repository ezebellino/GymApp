import { useEffect, useMemo, useState } from "react";
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
import api from "@/lib/http";
import { toastError, toastSuccess } from "@/lib/toast";
import type { AppSettings } from "@/types";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientId: string;
  clientName: string;
  defaultFee?: number;
  onSuccess?: () => void;
};

export default function NewPaymentDialog({
  open,
  onOpenChange,
  clientId,
  clientName,
  defaultFee = 24000,
  onSuccess,
}: Props) {
  const now = useMemo(() => new Date(), []);
  const [amount, setAmount] = useState<number>(defaultFee);
  const [method, setMethod] = useState<"cash" | "transfer">("cash");
  const [methodChannel, setMethodChannel] = useState<string>("");
  const [periodMonth, setPeriodMonth] = useState<number>(now.getMonth() + 1);
  const [periodYear, setPeriodYear] = useState<number>(now.getFullYear());
  const [note, setNote] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMethod("cash");
    setMethodChannel("");
    setPeriodMonth(now.getMonth() + 1);
    setPeriodYear(now.getFullYear());
    setNote("");

    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get<AppSettings>("/settings");
        if (!cancelled) {
          setAmount(Number(data?.default_fee) || defaultFee);
        }
      } catch {
        if (!cancelled) {
          const raw = localStorage.getItem("app_settings");
          if (raw) {
            try {
              const parsed = JSON.parse(raw);
              setAmount(Number(parsed?.default_fee) || defaultFee);
              return;
            } catch {
              // ignore parse error and use prop fallback
            }
          }
          setAmount(defaultFee);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [defaultFee, now, open]);

  async function handleCreate() {
    setLoading(true);
    try {
      await api.post("/payments", {
        user_id: clientId,
        amount,
        method,
        method_channel: method === "transfer" ? methodChannel.trim() || null : null,
        note: note.trim() || null,
        period_month: periodMonth,
        period_year: periodYear,
      });

      onSuccess?.();
      onOpenChange(false);

      try {
        window.dispatchEvent(
          new CustomEvent("payments:created", { detail: { client_id: clientId } })
        );
      } catch {
        // no-op
      }

      toastSuccess(
        "Pago creado",
        `Se registro correctamente el pago de ${clientName}.`
      );
    } catch (error: any) {
      toastError(
        "No se pudo crear el pago",
        error?.response?.data?.detail ?? "Revisa los datos e intenta nuevamente."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-surface-1">
        <DialogHeader>
          <DialogTitle className="text-foreground">Crear pago</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Registrar pago para <span className="text-foreground">{clientName}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs text-muted-foreground">Monto (ARS)</label>
            <Input
              type="number"
              min={0}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Metodo</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as "cash" | "transfer")}
              className="w-full rounded-md border border-border bg-surface-2/40 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="cash">Efectivo</option>
              <option value="transfer">Transferencia</option>
            </select>
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

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleCreate}
            disabled={
              loading ||
              amount <= 0 ||
              periodMonth < 1 ||
              periodMonth > 12 ||
              periodYear < 2020 ||
              periodYear > 2100
            }
          >
            {loading ? "Guardando..." : "Crear pago"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
