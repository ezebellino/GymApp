import { useState } from "react";
import { Copy, MessageCircle } from "lucide-react";
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
import { useInviteUserMutation } from "@/services/users.queries";
import { toastError, toastSuccess } from "@/lib/toast";
import type { User } from "@/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User;
};

type InviteResult = { email_link: string; phone_link: string };

export default function InviteUserDialog({ open, onOpenChange, user }: Props) {
  const [inviteResult, setInviteResult] = useState<InviteResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inviteMutation = useInviteUserMutation();

  const isReinvite = user.invitation_status !== "none";

  async function handleInvite() {
    setError(null);
    try {
      const result = await inviteMutation.mutateAsync(user.id);
      setInviteResult(result);
      toastSuccess(
        "Invitación generada",
        "Se envió el link por email y ya podés compartirlo por WhatsApp."
      );
    } catch (err: any) {
      // Error de precondición (400, falta email/celular): se muestra inline
      // dentro del modal, no como toast — un solo canal por error (design D9).
      setError(err?.response?.data?.detail ?? "Error desconocido");
    }
  }

  async function copyLink(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      toastSuccess("Copiado", "El link se copió al portapapeles.");
    } catch {
      toastError("No se pudo copiar", "Copiá el link manualmente.");
    }
  }

  function openWhatsApp(link: string) {
    if (!user.phone) return;
    const digits = user.phone.replace(/\D/g, "");
    const normalizedPhone = digits.startsWith("54") ? digits : `54${digits}`;
    const message = encodeURIComponent(
      `Hola ${user.first_name}, te invitamos a crear tu acceso al portal de Mini Espacio: ${link}`
    );
    window.open(
      `https://wa.me/${normalizedPhone}?text=${message}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-surface-1 text-foreground">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {isReinvite ? "Reenviar invitación" : "Invitar al portal"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Genera un link para que {user.full_name} defina su contraseña y acceda al portal.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="flex gap-2">
            <Input
              readOnly
              value={inviteResult?.email_link ?? ""}
              placeholder="El link va a aparecer acá al confirmar"
              className="font-mono text-xs"
            />
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={() => inviteResult && copyLink(inviteResult.email_link)}
              disabled={!inviteResult}
              aria-label="Copiar link de invitación"
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <Button
            type="button"
            variant="outline"
            className="border-emerald-500/20 bg-emerald-500/8 text-emerald-800 hover:bg-emerald-500/15 dark:text-emerald-100"
            onClick={() => inviteResult && openWhatsApp(inviteResult.phone_link)}
            disabled={!inviteResult || !user.phone}
          >
            <MessageCircle className="mr-2 h-4 w-4" />
            Enviar por WhatsApp
          </Button>
        </div>

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
          <Button type="button" onClick={handleInvite} disabled={inviteMutation.isPending}>
            {inviteMutation.isPending
              ? "Generando..."
              : isReinvite
                ? "Reenviar invitación"
                : "Invitar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
