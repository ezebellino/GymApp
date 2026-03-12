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
import { alertError, alertSuccessAutoClose } from "@/lib/alerts";

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
    setAmount(defaultFee);
    setMethod("cash");
    setMethodChannel("");
    setPeriodMonth(now.getMonth() + 1);
    setPeriodYear(now.getFullYear());
    setNote("");
  }, [defaultFee, now, open]);

  async function handleCreate() {
    setLoading(true);
    try {
      await api.post("/payments", {
        client_id: clientId,
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

      await alertSuccessAutoClose(
        "Pago creado",
        `Se registro correctamente el pago de ${clientName}.`
      );
    } catch (error: any) {
      await alertError(
        "No se pudo crear el pago",
        error?.response?.data?.detail ?? "Revisa los datos e intenta nuevamente."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-amber-200/10 bg-zinc-900/80 backdrop-blur-md">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">Crear pago</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Registrar pago para <span className="text-zinc-200">{clientName}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs text-zinc-400">Monto (ARS)</label>
            <Input
              type="number"
              min={0}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="border-white/10 bg-zinc-900/70 text-gray-100"
            />
          </div>

          <div>
            <label className="text-xs text-zinc-400">Metodo</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as "cash" | "transfer")}
              className="w-full rounded-md border border-white/10 bg-zinc-900/70 px-3 py-2 text-sm text-gray-100"
            >
              <option value="cash">Efectivo</option>
              <option value="transfer">Transferencia</option>
            </select>
          </div>

          {method === "transfer" ? (
            <div className="sm:col-span-2">
              <label className="text-xs text-zinc-400">Canal</label>
              <Input
                placeholder="Mercado Pago, Cuenta DNI, banco, etc."
                value={methodChannel}
                onChange={(e) => setMethodChannel(e.target.value)}
                className="border-white/10 bg-zinc-900/70 text-gray-100"
              />
            </div>
          ) : null}

          <div>
            <label className="text-xs text-zinc-400">Mes</label>
            <Input
              type="number"
              min={1}
              max={12}
              value={periodMonth}
              onChange={(e) => setPeriodMonth(Number(e.target.value))}
              className="border-white/10 bg-zinc-900/70 text-gray-100"
            />
          </div>

          <div>
            <label className="text-xs text-zinc-400">Año</label>
            <Input
              type="number"
              min={2020}
              max={2100}
              value={periodYear}
              onChange={(e) => setPeriodYear(Number(e.target.value))}
              className="border-white/10 bg-zinc-900/70 text-gray-100"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="text-xs text-zinc-400">Nota</label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="border-white/10 bg-zinc-900/70 text-gray-100"
              placeholder="Comentario interno opcional"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            className="border-white/10 text-gray-100 hover:bg-white/10"
            onClick={() => onOpenChange(false)}
          >
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
            className="border border-amber-300/20 bg-[linear-gradient(90deg,rgba(250,204,21,0.14),rgba(255,247,237,0.06),rgba(249,115,22,0.16))] text-amber-50 hover:opacity-95"
          >
            {loading ? "Guardando..." : "Crear pago"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
