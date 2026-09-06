import { useEffect, useMemo, useState } from "react";
import { Mail, Phone, Ruler, ShieldCheck, UserRound, Weight } from "lucide-react";
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
import type { Role, User } from "@/types";
import { useSessionStore } from "@/stores/session";
import { useUpdateUserMutation } from "@/services/users.queries";
import { toastError, toastSuccess } from "@/lib/toast";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  user: User;
  onSuccess?: () => void;
};

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "member", label: "Miembro" },
  { value: "coach", label: "Coach" },
  { value: "owner", label: "Dueño" },
];

function calcAge(birthDate: string): number | null {
  if (!birthDate) return null;
  const today = new Date();
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return null;
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
}

export default function EditUserDialog({ open, onOpenChange, user, onSuccess }: Props) {
  const viewerRole = useSessionStore((s) => s.role);
  const isOwner = viewerRole === "owner";

  const [firstName, setFirstName] = useState(user.first_name);
  const [lastName, setLastName] = useState(user.last_name ?? "");
  const [birthDate, setBirthDate] = useState(user.birth_date ?? "");
  const [weightKg, setWeightKg] = useState(user.weight_kg != null ? String(user.weight_kg) : "");
  const [heightCm, setHeightCm] = useState(user.height_cm != null ? String(user.height_cm) : "");
  const [email, setEmail] = useState(user.email ?? "");
  const [phone, setPhone] = useState(user.phone ?? "");
  const [role, setRole] = useState<Role>(user.role);

  const updateMutation = useUpdateUserMutation();

  // Deps `[open, user.id]`, NO `[open, user]`: `user` es un prop derivado de la
  // query (`Users.tsx`/`UserDetail.tsx`), así que cambia de identidad en cada
  // refetch aunque sea el mismo usuario (structural sharing de TanStack
  // Query) — cualquier invalidación de `["users"]` disparada desde otro lado
  // (un modal de membresía/invitación/verificación abierto sobre la misma
  // ficha, el refetch del listado al tipear en el buscador de `Users.tsx`) le
  // cambia la identidad al objeto mientras este diálogo sigue abierto. Además
  // `Users.tsx` deja el diálogo **montado** después de cerrarlo
  // (`selectedUser` no se limpia), así que sin este efecto reabrirlo para
  // otra fila mostraría los valores de la anterior.
  useEffect(() => {
    if (open) {
      setFirstName(user.first_name);
      setLastName(user.last_name ?? "");
      setBirthDate(user.birth_date ?? "");
      setWeightKg(user.weight_kg != null ? String(user.weight_kg) : "");
      setHeightCm(user.height_cm != null ? String(user.height_cm) : "");
      setEmail(user.email ?? "");
      setPhone(user.phone ?? "");
      setRole(user.role);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user.id]);

  const derivedAge = useMemo(() => calcAge(birthDate), [birthDate]);

  async function save() {
    try {
      await updateMutation.mutateAsync({
        id: user.id,
        input: {
          first_name: firstName.trim(),
          last_name: lastName.trim() || null,
          birth_date: birthDate || null,
          weight_kg: weightKg.trim() ? Number(weightKg) : null,
          height_cm: heightCm.trim() ? Number(heightCm) : null,
          email: email.trim() || null,
          phone: phone.trim() || null,
          ...(isOwner ? { role } : {}),
        },
      });

      onOpenChange(false);
      onSuccess?.();
      toastSuccess("Actualizado", "Los datos del usuario fueron guardados.");
    } catch (error: any) {
      toastError(
        "No se pudo guardar",
        error?.response?.data?.detail ?? "Error desconocido"
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto border-border bg-surface-1 text-foreground">
        <DialogHeader>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-label-caps uppercase text-primary-strong">
            <ShieldCheck className="h-3.5 w-3.5" />
            Ficha operativa
          </div>
          <DialogTitle className="pt-3 text-2xl font-semibold text-foreground">
            Editar usuario
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Actualiza el perfil de este usuario.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="rounded-xl border border-border bg-surface-2/30 p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-primary/15 p-3 text-primary-strong">
                <UserRound className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{user.full_name}</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Ajustá sus datos de contacto y su rol.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Nombre</label>
              <Input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Nombre"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Apellido</label>
              <Input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Apellido"
              />
            </div>
          </div>

          {isOwner ? (
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Rol</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="w-full rounded-md border border-border bg-surface-2/40 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

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
                placeholder="usuario@mail.com"
              />
            </div>
            <div className="space-y-1">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-4 w-4 text-muted-foreground" />
                Teléfono
              </label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="11 5555 5555"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">
                Fecha de nacimiento{derivedAge != null ? ` (${derivedAge} años)` : ""}
              </label>
              <Input
                type="date"
                value={birthDate ?? ""}
                onChange={(e) => setBirthDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Weight className="h-4 w-4 text-muted-foreground" />
                Peso (kg)
              </label>
              <Input
                type="number"
                min={0}
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Ruler className="h-4 w-4 text-muted-foreground" />
                Altura (cm)
              </label>
              <Input
                type="number"
                min={0}
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={updateMutation.isPending || !firstName.trim()}>
            {updateMutation.isPending ? "Guardando..." : "Guardar cambios"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
