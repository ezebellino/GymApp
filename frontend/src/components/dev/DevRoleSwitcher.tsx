import { useRef, useState } from "react";
import { ChevronDown, FlaskConical, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSignIn } from "@/hooks/useSignIn";
import { useSessionStore } from "@/stores/session";
import type { Role } from "@/types";
import { DEV_USERS, type DevUser, type DevUserId } from "./devUsers";

// Widget flotante de cambio de rol, solo en builds de desarrollo. Lo monta
// `App.jsx` detrás de un ternario `import.meta.env.DEV` a nivel de módulo (dec. 1
// de `add-dev-role-switcher`): en `npm run build` este archivo, `devUsers.ts` y
// las credenciales no entran al grafo del bundle. `data-testid="dev-role-switcher"`
// es además el centinela que se busca en `dist/` para verificarlo.
//
// Hace login real con `useSignIn` (mismo camino que `pages/Login.tsx`) con
// `resetPreviousSession: true`: la sesión anterior se cierra recién cuando la
// nueva ya autenticó, así un fallo deja la sesión previa intacta (dec. 4).

const COLLAPSED_STORAGE_KEY = "dev_role_switcher_collapsed";

const ROLE_LABELS: Record<Role, string> = {
  owner: "Dueño",
  coach: "Coach",
  member: "Miembro",
};

const SEED_MISSING_MESSAGE = "Usuario de desarrollo no encontrado.";
const SEED_MISSING_HINT = "Corré";
const SEED_COMMAND = "make seed-dev";
const SEED_MISSING_TAIL = "y volvé a intentar.";
const GENERIC_ERROR_MESSAGE = "No se pudo cambiar de usuario. ¿Está levantado el backend?";

type SwitchError = { kind: "seed-missing" } | { kind: "generic" };

// Lectura/escritura en `localStorage` directo, no en un store nuevo (dec. 7):
// un booleano de una herramienta de desarrollo no justifica un cuarto store, y
// un store viviría fuera de `components/dev/`, rompiendo el invariante de una
// sola importación entrante. Ambas en try/catch: con storage bloqueado el widget
// degrada a "siempre expandido", nunca rompe el render de la app.
function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeCollapsed(collapsed: boolean) {
  try {
    localStorage.setItem(COLLAPSED_STORAGE_KEY, collapsed ? "1" : "0");
  } catch {
    // Storage bloqueado: el estado vive solo en memoria hasta recargar.
  }
}

function mapError(err: unknown): SwitchError {
  const status = (err as { response?: { status?: number } } | undefined)?.response?.status;
  // `POST /auth/token` responde 400 para usuario inexistente, password
  // incorrecta e invitación pendiente: los tres casos en que un usuario de
  // desarrollo no está bien seedeado. Se agrupa el 401 por si el backend cambia
  // el código (dec. 5).
  if (status === 400 || status === 401) return { kind: "seed-missing" };
  return { kind: "generic" };
}

export default function DevRoleSwitcher() {
  const [collapsed, setCollapsed] = useState<boolean>(readCollapsed);
  const [busyUserId, setBusyUserId] = useState<DevUserId | null>(null);
  const [error, setError] = useState<SwitchError | null>(null);
  // Espejo sincrónico de `busyUserId`: dos clicks en el mismo tick ven el mismo
  // estado (todavía `null`) antes de que React re-renderice con `disabled`.
  const busyRef = useRef<DevUserId | null>(null);

  const role = useSessionStore((s) => s.role);
  const signIn = useSignIn();

  const sessionLabel = role ? ROLE_LABELS[role] : "sin sesión";
  const busyUser = DEV_USERS.find((user) => user.id === busyUserId) ?? null;

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    writeCollapsed(next);
  }

  async function handleSelect(user: DevUser) {
    if (busyRef.current) return;
    busyRef.current = user.id;
    setBusyUserId(user.id);
    setError(null);

    try {
      await signIn(
        { username: user.email, password: user.password },
        { resetPreviousSession: true },
      );
    } catch (err) {
      setError(mapError(err));
    } finally {
      busyRef.current = null;
      setBusyUserId(null);
    }
  }

  if (collapsed) {
    return (
      <button
        type="button"
        data-testid="dev-role-switcher"
        onClick={toggleCollapsed}
        aria-expanded={false}
        aria-label="Abrir selector de usuario de desarrollo"
        title={`Dev · sesión: ${sessionLabel}`}
        className="fixed bottom-4 right-4 z-50 grid size-10 place-items-center rounded-full border border-border bg-surface-2/95 text-foreground shadow-lg backdrop-blur-xl transition-colors hover:bg-surface-3 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <FlaskConical className="size-4" aria-hidden="true" />
      </button>
    );
  }

  return (
    <section
      data-testid="dev-role-switcher"
      aria-label="Selector de usuario de desarrollo"
      className="fixed bottom-4 right-4 z-50 w-64 rounded-2xl border border-border bg-surface-2/95 p-3 text-foreground shadow-lg backdrop-blur-xl"
    >
      <header className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <FlaskConical className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <p className="truncate text-xs text-muted-foreground">
            Dev · sesión:{" "}
            <span className="font-medium text-foreground">{sessionLabel}</span>
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={toggleCollapsed}
          aria-expanded={true}
          aria-label="Colapsar selector de usuario de desarrollo"
        >
          <ChevronDown aria-hidden="true" />
        </Button>
      </header>

      <div className="mt-3 grid gap-1.5">
        {DEV_USERS.map((user) => {
          const isBusy = busyUserId === user.id;
          const isCurrent = role === user.role;
          return (
            <Button
              key={user.id}
              type="button"
              variant={isCurrent ? "default" : "outline"}
              size="sm"
              className="w-full justify-between"
              onClick={() => handleSelect(user)}
              disabled={busyUserId !== null}
              aria-busy={isBusy || undefined}
            >
              <span>{user.label}</span>
              {isBusy ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : isCurrent ? (
                <span className="text-xs opacity-80">actual</span>
              ) : null}
            </Button>
          );
        })}
      </div>

      <p aria-live="polite" className="sr-only">
        {busyUser ? `Cambiando a ${busyUser.label}…` : ""}
      </p>

      {error && (
        <p role="alert" className="mt-3 text-xs leading-relaxed text-destructive">
          {error.kind === "seed-missing" ? (
            <>
              <span className="font-medium">{SEED_MISSING_MESSAGE}</span> {SEED_MISSING_HINT}{" "}
              <code className="rounded bg-surface-3 px-1 py-0.5 font-mono text-foreground">
                {SEED_COMMAND}
              </code>{" "}
              {SEED_MISSING_TAIL}
            </>
          ) : (
            GENERIC_ERROR_MESSAGE
          )}
        </p>
      )}
    </section>
  );
}
