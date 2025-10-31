// src/components/NewPaymentDialog.tsx
import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import api from "@/lib/http";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientId: string;
  clientName: string;
  defaultFee?: number; // monto por defecto
  onSuccess?: () => void; // refrescar listados/lado derecho
};

export default function NewPaymentDialog({ open, onOpenChange, clientId, clientName, defaultFee = 24000, onSuccess }: Props) {
  const now = useMemo(() => new Date(), []);
  const [amount, setAmount] = useState<number>(defaultFee);
  const [method, setMethod] = useState<"cash" | "transfer">("cash");
  const [methodChannel, setMethodChannel] = useState<string>("");
  const [periodMonth, setPeriodMonth] = useState<number>(now.getMonth() + 1);
  const [periodYear, setPeriodYear] = useState<number>(now.getFullYear());
  const [note, setNote] = useState<string>("");
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    setLoading(true);
    try {
      await api.post("/payments", {
        client_id: clientId,
        amount,
        method,
        method_channel: method === "transfer" ? (methodChannel || null) : null,
        note: note || null,
        period_month: periodMonth,
        period_year: periodYear,
      });
      onSuccess?.();
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/10 bg-zinc-900/80 backdrop-blur-md">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">Crear pago</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Registrar pago para <span className="text-zinc-200">{clientName}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-zinc-400">Monto (ARS)</label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="text-gray-100 bg-zinc-900/70 border-white/10"
            />
          </div>

          <div>
            <label className="text-xs text-zinc-400">Método</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as "cash" | "transfer")}
              className="w-full rounded-md border text-gray-100 border-white/10 bg-zinc-900/70 px-3 py-2 text-sm"
            >
              <option value="cash">Efectivo</option>
              <option value="transfer">Transferencia</option>
            </select>
          </div>

          {method === "transfer" && (
            <div className="sm:col-span-2">
              <label className="text-xs text-zinc-400">Canal (opcional)</label>
              <Input
                placeholder="mercadopago, cuentadni, etc."
                value={methodChannel}
                onChange={(e) => setMethodChannel(e.target.value)}
                className="bg-zinc-900/70 border-white/10 text-gray-100"
              />
            </div>
          )}

          <div>
            <label className="text-xs text-zinc-400">Mes</label>
            <Input
              type="number"
              min={1}
              max={12}
              value={periodMonth}
              onChange={(e) => setPeriodMonth(Number(e.target.value))}
              className="bg-zinc-900/70 border-white/10 text-gray-100"
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
              className="bg-zinc-900/70 border-white/10 text-gray-100"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="text-xs text-zinc-400">Nota (opcional)</label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="bg-zinc-900/70 border-white/10 text-gray-100"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" className="text-gray-100 border-white/10 hover:bg-white/10" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleCreate}
            disabled={loading}
            className="text-gray-100 bg-violet-600/40 hover:bg-violet-600/60 border border-violet-400/30"
          >
            {loading ? "Guardando…" : "Crear pago"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
