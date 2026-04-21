import { useEffect, useState } from "react";
import { Mail, Phone, ShieldCheck, UserRound } from "lucide-react";
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
  const [portalEmail, setPortalEmail] = useState("");
  const [portalPassword, setPortalPassword] = useState("");
  const [portalActive, setPortalActive] = useState(true);
  const [savingPortal, setSavingPortal] = useState(false);

  useEffect(() => {
    if (open) {
      setFullName(client.full_name);
      setEmail(client.email ?? "");
      setPhone(client.phone ?? "");
      setIsActive(!!client.is_active);
      setPortalEmail("");
      setPortalPassword("");
      setPortalActive(true);
      void loadPortalAccess();
    }
  }, [open, client]);

  async function loadPortalAccess() {
    try {
      const { data } = await api.get<{
        user_id: string;
        client_id: string;
        full_name: string;
        email: string;
        is_active: boolean;
      } | null>(`/clients/${client.id}/portal-access`);

      if (data) {
        setPortalEmail(data.email ?? "");
        setPortalActive(!!data.is_active);
      }
    } catch {
      // no-op: no bloquea la edición del cliente
    }
  }

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

  async function savePortalAccess() {
    if (!portalEmail.trim() || !portalPassword.trim()) {
      await alertError(
        "Faltan datos de acceso",
        "Completá email y contraseña para habilitar el acceso del cliente."
      );
      return;
    }

    setSavingPortal(true);
    try {
      await api.post(`/clients/${client.id}/portal-access`, {
        email: portalEmail.trim(),
        password: portalPassword,
        full_name: fullName.trim(),
        is_active: portalActive,
      });

      setPortalPassword("");
      await alertSuccessAutoClose(
        "Acceso del cliente actualizado",
        "El cliente ya puede iniciar sesión en su vista de usuario."
      );
    } catch (error: any) {
      await alertError(
        "No se pudo configurar el acceso",
        error?.response?.data?.detail ?? "Error desconocido"
      );
    } finally {
      setSavingPortal(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-amber-200/10 bg-[#0d0b0a]/95 text-zinc-100 shadow-[0_30px_80px_-40px_rgba(249,115,22,0.55)]">
        <DialogHeader>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-amber-100">
            <ShieldCheck className="h-3.5 w-3.5" />
            Ficha operativa
          </div>
          <DialogTitle className="pt-3 text-2xl font-semibold text-zinc-50">
            Editar cliente
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            Actualiza la informacion basica del cliente y su estado operativo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="rounded-[24px] border border-amber-200/10 bg-[linear-gradient(135deg,rgba(250,204,21,0.08),rgba(255,247,237,0.03)_48%,rgba(249,115,22,0.1))] p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-white/6 p-3 text-amber-100">
                <UserRound className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-100">{client.full_name}</p>
                <p className="mt-1 text-sm leading-6 text-zinc-400">
                  Ajusta sus datos de contacto y define si sigue disponible para cobros,
                  asistencia y seguimiento diario.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm text-zinc-400">Nombre completo</label>
            <Input
              className="border-white/10 bg-zinc-900/70"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nombre y apellido"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="flex items-center gap-2 text-sm text-zinc-400">
                <Mail className="h-4 w-4 text-zinc-500" />
                Email
              </label>
              <Input
                className="border-white/10 bg-zinc-900/70"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="cliente@mail.com"
              />
            </div>
            <div className="space-y-1">
              <label className="flex items-center gap-2 text-sm text-zinc-400">
                <Phone className="h-4 w-4 text-zinc-500" />
                Telefono
              </label>
              <Input
                className="border-white/10 bg-zinc-900/70"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="11 5555 5555"
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
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

          <div className="space-y-3 rounded-[24px] border border-amber-200/10 bg-white/[0.03] p-4">
            <p className="text-sm font-medium text-zinc-200">Acceso del cliente (vista USER)</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                className="border-white/10 bg-zinc-900/70"
                type="email"
                value={portalEmail}
                onChange={(e) => setPortalEmail(e.target.value)}
                placeholder="cliente@login.com"
              />
              <Input
                className="border-white/10 bg-zinc-900/70"
                type="password"
                value={portalPassword}
                onChange={(e) => setPortalPassword(e.target.value)}
                placeholder="Contraseña (mínimo 6)"
              />
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-zinc-900/40 p-3">
              <p className="text-xs text-zinc-400">Habilitar cuenta para login del cliente</p>
              <Switch checked={portalActive} onCheckedChange={setPortalActive} />
            </div>
            <div className="flex justify-end">
              <Button
                type="button"
                onClick={savePortalAccess}
                disabled={savingPortal}
                className="border border-amber-300/20 bg-[linear-gradient(90deg,rgba(250,204,21,0.14),rgba(255,247,237,0.06),rgba(249,115,22,0.16))] text-amber-50 hover:opacity-95"
              >
                {savingPortal ? "Guardando acceso..." : "Guardar acceso USER"}
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            className="border-white/10 bg-transparent"
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
