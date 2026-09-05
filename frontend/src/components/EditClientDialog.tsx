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
import { toastError, toastSuccess } from "@/lib/toast";

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
      toastSuccess(
        "Actualizado",
        "Los datos del cliente fueron guardados."
      );
    } catch (error: any) {
      toastError(
        "No se pudo guardar",
        error?.response?.data?.detail ?? "Error desconocido"
      );
    } finally {
      setSaving(false);
    }
  }

  async function savePortalAccess() {
    if (!portalEmail.trim() || !portalPassword.trim()) {
      toastError(
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
      toastSuccess(
        "Acceso del cliente actualizado",
        "El cliente ya puede iniciar sesión en su vista de usuario."
      );
    } catch (error: any) {
      toastError(
        "No se pudo configurar el acceso",
        error?.response?.data?.detail ?? "Error desconocido"
      );
    } finally {
      setSavingPortal(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-surface-1 text-foreground">
        <DialogHeader>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-label-caps uppercase text-primary-strong">
            <ShieldCheck className="h-3.5 w-3.5" />
            Ficha operativa
          </div>
          <DialogTitle className="pt-3 text-2xl font-semibold text-foreground">
            Editar cliente
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Actualiza la informacion basica del cliente y su estado operativo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="rounded-xl border border-border bg-surface-2/30 p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-primary/15 p-3 text-primary-strong">
                <UserRound className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{client.full_name}</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Ajusta sus datos de contacto y define si sigue disponible para cobros,
                  asistencia y seguimiento diario.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">Nombre completo</label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nombre y apellido"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4 text-muted-foreground" />
                Email
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="cliente@mail.com"
              />
            </div>
            <div className="space-y-1">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-4 w-4 text-muted-foreground" />
                Telefono
              </label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="11 5555 5555"
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border bg-surface-2/20 p-4">
            <div className="text-sm">
              <div className="font-medium text-foreground">Estado del cliente</div>
              <div className="mt-1 text-muted-foreground">
                {isActive
                  ? "Activo para operar en cobros y asistencias."
                  : "Inactivo, util para seguimiento o baja temporal."}
              </div>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>

          <div className="space-y-3 rounded-xl border border-border bg-surface-2/20 p-4">
            <p className="text-sm font-medium text-foreground">Acceso del cliente (vista USER)</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                type="email"
                value={portalEmail}
                onChange={(e) => setPortalEmail(e.target.value)}
                placeholder="cliente@login.com"
              />
              <Input
                type="password"
                value={portalPassword}
                onChange={(e) => setPortalPassword(e.target.value)}
                placeholder="Contraseña (mínimo 6)"
              />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border bg-surface-2/40 p-3">
              <p className="text-xs text-muted-foreground">Habilitar cuenta para login del cliente</p>
              <Switch checked={portalActive} onCheckedChange={setPortalActive} />
            </div>
            <div className="flex justify-end">
              <Button type="button" onClick={savePortalAccess} disabled={savingPortal}>
                {savingPortal ? "Guardando acceso..." : "Guardar acceso USER"}
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving || !fullName.trim()}>
            {saving ? "Guardando..." : "Guardar cambios"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
