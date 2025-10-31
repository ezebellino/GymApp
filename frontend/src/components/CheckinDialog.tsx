// src/components/CheckinDialog.tsx
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import api from "@/lib/http";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientId: string;
  clientName: string;
  onSuccess?: () => void; // refrescar listados luego
};

export default function CheckinDialog({ open, onOpenChange, clientId, clientName, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    try {
      await api.post("/attendance/checkin", { client_id: clientId });
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
          <DialogTitle className="text-zinc-100">Registrar asistencia</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Se registrará la asistencia de <span className="text-zinc-200">{clientName}</span> para hoy.
          </DialogDescription>
        </DialogHeader>

        <div className="text-sm text-zinc-300">
          Fecha: {new Date().toLocaleString()}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" className="border-white/10 hover:bg-white/10" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            className="bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/30"
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? "Registrando…" : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
