import { useEffect, useState } from "react";
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
import { Switch } from "@/components/ui/switch";
import type { Client } from "@/types";
import api from "@/lib/http";
import { alertError, alertSuccessAutoClose } from "@/lib/alerts";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  client: Client;
  onSuccess?: () => void;
};

export default function EditClientDialog({
  open,
  onOpenChange,
  client,
  onSuccess,
}: Props) {
  const [fullName, setFullName] = useState(client.full_name);
  const [email, setEmail] = useState(client.email ?? "");
  const [phone, setPhone] = useState(client.phone ?? "");
  const [isActive, setIsActive] = useState(client.is_active ?? true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setFullName(client.full_name);
      setEmail(client.email ?? "");
      setPhone(client.phone ?? "");
      setIsActive(!!client.is_active);
    }
  }, [open, client]);

  async function save() {
    setSaving(true);
    try {
      await api.patch(`/clients/${client.id}`, {
        full_name: fullName.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        is_active: isActive,
      });

      onOpenChange(false);
      onSuccess?.();
      await alertSuccessAutoClose(
        "Actualizado",
        "Los datos del cliente fueron guardados."
      );
    } catch (error: any) {
      await alertError(
        "No se pudo guardar",
        error?.response?.data?.detail ?? "Error desconocido"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-amber-200/10 bg-zinc-950 text-zinc-100">
        <DialogHeader>
          <DialogTitle>Editar cliente</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Actualiza la informacion basica del cliente y su estado operativo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <label className="text-sm text-zinc-400">Nombre completo</label>
            <Input
              className="border-white/10 bg-zinc-900/70"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-zinc-400">Email</label>
            <Input
              className="border-white/10 bg-zinc-900/70"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-zinc-400">Telefono</label>
            <Input
              className="border-white/10 bg-zinc-900/70"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-white/10 p-4">
            <div className="text-sm">
              <div className="font-medium text-zinc-200">Estado del cliente</div>
              <div className="mt-1 text-zinc-400">
                {isActive
                  ? "Activo para operar en cobros y asistencias."
                  : "Inactivo, util para seguimiento o baja temporal."}
              </div>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            className="border-white/10"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            className="border border-amber-300/20 bg-[linear-gradient(90deg,rgba(250,204,21,0.14),rgba(255,247,237,0.06),rgba(249,115,22,0.16))] text-amber-50 hover:opacity-95"
            onClick={save}
            disabled={saving || !fullName.trim()}
          >
            {saving ? "Guardando..." : "Guardar cambios"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
