import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch"; // si no lo tenés: npx shadcn@latest add switch
import type { Client } from "@/types";
import api from "@/lib/http";
import { alertError, alertSuccess, alertSuccessAutoClose } from "@/lib/alerts";
import { useNavigate } from "react-router-dom";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  client: Client;
  onSuccess?: () => void;
};

export default function EditClientDialog({ open, onOpenChange, client, onSuccess }: Props) {
  const [fullName, setFullName] = useState(client.full_name);
  const [email, setEmail] = useState(client.email ?? "");
  const [phone, setPhone] = useState(client.phone ?? "");
  const [isActive, setIsActive] = useState(client.is_active ?? true);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

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
      
      await alertSuccessAutoClose("Actualizado", "Los datos del cliente fueron guardados.", 1000);

      navigate("/dashboard", { replace: true });

      setTimeout(() => {
        window.location.reload();
      }, 150);
    } catch (e: any) {
      alertError("No se pudo guardar", e?.response?.data?.detail ?? "Error desconocido");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/10 bg-zinc-950 text-zinc-100">
        <DialogHeader>
          <DialogTitle>Editar cliente</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Actualizá la información básica del cliente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <label className="text-sm text-zinc-400">Nombre completo</label>
            <Input className="bg-zinc-900/70 border-white/10" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-zinc-400">Email</label>
            <Input className="bg-zinc-900/70 border-white/10" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-zinc-400">Teléfono</label>
            <Input className="bg-zinc-900/70 border-white/10" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-white/10 p-3">
            <div className="text-sm">
              <div className="font-medium text-zinc-200">Estado</div>
              <div className="text-zinc-400">¿Cliente activo?</div>
              <div className="text-zinc-400">{isActive ? "Sí" : "No"}</div>
              <Button variant="link" className="p-0 text-xs mt-1" onClick={() => setIsActive(!isActive)}>Cambiar estado</Button>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />

          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" className="border-white/10" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button className="bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/30" onClick={save} disabled={saving}>
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
