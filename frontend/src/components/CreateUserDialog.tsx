import { useEffect, useState } from "react";
import { KeyRound, Mail, Phone, Ruler, UserPlus, Weight } from "lucide-react";
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
import type { Role } from "@/types";
import { useSessionStore } from "@/stores/session";
import { useCreateUserMutation } from "@/services/users.queries";
import { toastError, toastSuccess } from "@/lib/toast";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSuccess?: () => void;
};

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "member", label: "Miembro" },
  { value: "coach", label: "Coach" },
  { value: "owner", label: "Dueño" },
];

export default function CreateUserDialog({ open, onOpenChange, onSuccess }: Props) {
  const viewerRole = useSessionStore((s) => s.role);
  const isOwner = viewerRole === "owner";

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [password, setPassword] = useState("");

  const createMutation = useCreateUserMutation();

  // El owner puede dar de alta cualquier rol; el coach solo Miembro (el
  // backend ya lo exige, esto evita el viaje redondo al servidor).
  useEffect(() => {
    if (open) {
      setFirstName("");
      setLastName("");
      setRole("member");
      setEmail("");
      setPhone("");
      setBirthDate("");
      setWeightKg("");
      setHeightCm("");
      setPassword("");
    }
  }, [open, isOwner]);

  // Password solo tiene sentido para roles no-miembro (dan de alta con acceso
  // ya seteado); un Miembro recibe acceso vía invitación, no acá.
  const showPassword = isOwner && role !== "member";
  // El backend exige password + email para Dueño/Coach (`POST /users/`
  // rechaza con 400 si falta cualquiera de los dos) — no son opcionales
  // como decía el copy viejo (hallazgo N2 de verification.md). El
  // `min_length=6` es el mismo que exige `schemas.UserCreate.password`: sin
  // este chequeo, una contraseña corta cae en un 422 de pydantic cuyo
  // `detail` es una lista de objetos, y `toastError` la pasaría tal cual
  // como `ReactNode` (hallazgo del code review sobre este mismo fix).
  const missingRequiredAccess =
    showPassword && (!password.trim() || password.trim().length < 6 || !email.trim());

  async function save() {
    try {
      const user = await createMutation.mutateAsync({
        first_name: firstName.trim(),
        last_name: lastName.trim() || null,
        role,
        email: email.trim() || null,
        phone: phone.trim() || null,
        birth_date: birthDate || null,
        weight_kg: weightKg.trim() ? Number(weightKg) : null,
        height_cm: heightCm.trim() ? Number(heightCm) : null,
        ...(showPassword && password.trim() ? { password: password.trim() } : {}),
      });

      onOpenChange(false);
      onSuccess?.();
      toastSuccess("Usuario creado", `${user.full_name} ya aparece en el listado.`);
    } catch (error: any) {
      toastError(
        "No se pudo crear el usuario",
        error?.response?.data?.detail ?? "Error desconocido"
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto border-border bg-surface-1 text-foreground">
        <DialogHeader>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-label-caps uppercase text-primary-strong">
            <UserPlus className="h-3.5 w-3.5" />
            Alta de usuario
          </div>
          <DialogTitle className="pt-3 text-2xl font-semibold text-foreground">
            Crear usuario
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Nombre y rol son obligatorios; para Dueño o Coach también necesitás email y
            contraseña. El resto lo completás ahora o después desde su ficha.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Nombre</label>
              <Input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Nombre"
                autoFocus
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
          ) : (
            <p className="rounded-xl border border-border bg-surface-2/20 p-3 text-sm text-muted-foreground">
              Como Coach solo podés dar de alta usuarios con rol Miembro.
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4 text-muted-foreground" />
                Email{showPassword ? " (requerido para dar acceso)" : ""}
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
              <label className="text-sm text-muted-foreground">Fecha de nacimiento</label>
              <Input
                type="date"
                value={birthDate}
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

          {showPassword ? (
            <div className="space-y-1 rounded-xl border border-border bg-surface-2/20 p-4">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <KeyRound className="h-4 w-4 text-muted-foreground" />
                Contraseña inicial
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
              />
              <p className="pt-1 text-xs text-muted-foreground">
                Requerida (junto con el email) para dar de alta a un Dueño o Coach — un
                Miembro recibe su acceso por invitación, no acá.
              </p>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={save}
            disabled={createMutation.isPending || !firstName.trim() || missingRequiredAccess}
          >
            {createMutation.isPending ? "Creando..." : "Crear usuario"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
