import ConfirmActionDialog from "@/components/ConfirmActionDialog";
import { useVerifyContactMutation } from "@/services/users.queries";
import { toastError, toastSuccess } from "@/lib/toast";
import type { User } from "@/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User;
};

// Mismo criterio que el backend (`routers/users.py::verify_contact`, design D1):
// un dato entra si está cargado y todavía no está verificado.
function pendingChannels(user: User): ("email" | "phone")[] {
  const pending: ("email" | "phone")[] = [];
  if (user.email && !user.email_verified) pending.push("email");
  if (user.phone && !user.phone_verified) pending.push("phone");
  return pending;
}

// Enumeración del copy (design D8): "el email", "el celular" o "el email y el celular".
function describePending(pending: ("email" | "phone")[]): string {
  const label: Record<"email" | "phone", string> = { email: "el email", phone: "el celular" };
  return pending.map((channel) => label[channel]).join(" y ");
}

export default function VerifyContactDialog({ open, onOpenChange, user }: Props) {
  const verifyMutation = useVerifyContactMutation();
  const pending = pendingChannels(user);
  const frase = describePending(pending);

  const restituteAccessWarning =
    pending.includes("email") && user.invitation_status === "access_active"
      ? " Esta persona ya tiene contraseña definida: al verificar su email vas a restituirle el acceso al sistema."
      : "";

  async function handleConfirm() {
    // Se calcula antes de disparar la mutación: después del refetch la lista
    // de pendientes queda vacía y el toast no podría describir nada (design D8).
    const successFrase = frase;

    const summary =
      pending.length > 1
        ? "quedaron marcados como verificados"
        : "quedó marcado como verificado";

    try {
      await verifyMutation.mutateAsync(user.id);
      onOpenChange(false);
      toastSuccess(
        "Contacto verificado",
        `${successFrase.charAt(0).toUpperCase()}${successFrase.slice(1)} de ${user.full_name} ${summary}.`
      );
    } catch (error: any) {
      toastError(
        "No se pudo verificar el contacto",
        error?.response?.data?.detail ?? "Error desconocido"
      );
    }
  }

  return (
    <ConfirmActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Verificar contacto"
      description={`Vas a marcar como verificados ${frase} de ${user.full_name}. Es una afirmación tuya, no una prueba de que el usuario abrió un link: no le define ninguna contraseña.${restituteAccessWarning}`}
      confirmLabel="Verificar contacto"
      pendingLabel="Verificando..."
      isPending={verifyMutation.isPending}
      onConfirm={handleConfirm}
    />
  );
}
