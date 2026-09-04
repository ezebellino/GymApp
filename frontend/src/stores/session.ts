import { create } from "zustand";
import { persist, type PersistStorage, type StorageValue } from "zustand/middleware";
import { jwtDecode } from "jwt-decode";
import { queryClient } from "@/lib/queryClient";
import type { Role } from "@/types";

type TokenPayload = {
  exp: number;
  role?: Role;
  name?: string;
  email?: string;
};

export type SessionState = {
  token: string | null;
  userName: string | null;
  role: Role | null;
  // Derivados del token, NUNCA persistidos: se recalculan del token al
  // rehidratar (ver `sessionPersistStorage.getItem`), igual que `exp`.
  email: string | null;
  exp: number | null;
  setSession: (token: string, over?: { name?: string; role?: Role; email?: string }) => void;
  logout: () => void;
};

// setTimeout satura arriba de ~24.8 dias (2^31 - 1 ms) y dispara de inmediato
// si se le pasa un delay mas grande. Los tokens de esta app duran mucho menos,
// pero el bug seria un logout instantaneo e inexplicable.
const MAX_TIMEOUT_MS = 2_147_483_647;

let logoutTimer: ReturnType<typeof setTimeout> | null = null;

function clearAutoLogout() {
  if (logoutTimer !== null) {
    clearTimeout(logoutTimer);
    logoutTimer = null;
  }
}

// `set`/`get` del store, capturados desde el creator (ver mas abajo). Se usan
// en vez de referenciar `useSessionStore` para no toparse con la temporal dead
// zone: el callback de rehidratacion de `persist` puede correr de forma
// sincronica, todavia dentro de la llamada a `create()`, es decir antes de que
// `useSessionStore` quede asignado.
let getState: () => SessionState;

function performLogout() {
  clearAutoLogout();
  getState().logout();
}

// Agenda (o re-agenda) el auto-logout por expiracion del token. Se invoca
// desde `setSession` y desde el callback de rehidratacion de `persist`, para
// que el timer sobreviva a cada F5 (sin esto el auto-logout solo existiria
// hasta el primer refresh de pagina).
function scheduleAutoLogout(exp: number | null) {
  clearAutoLogout();

  // Un exp no numerico se trata como "sin expiracion conocida": no agenda timer.
  if (typeof exp !== "number" || Number.isNaN(exp)) return;

  const delay = exp * 1000 - Date.now();
  if (delay <= 0) {
    performLogout();
    return;
  }

  const cappedDelay = Math.min(delay, MAX_TIMEOUT_MS);
  logoutTimer = setTimeout(() => {
    if (cappedDelay < delay) {
      // El delay real era mayor que el maximo de setTimeout: todavia no
      // llegamos al exp real, hay que recalcular en vez de desloguear ya.
      scheduleAutoLogout(exp);
    } else {
      performLogout();
    }
  }, cappedDelay);
}

// PersistStorage a medida: mapea el estado a las tres claves planas que ya usa
// el resto del repo (`access_token`, `user_name`, `user_role`) en vez de la
// clave nueva con el envoltorio `{state, version}` que usaria el
// `createJSONStorage` default. Shim de compatibilidad con fecha de
// vencimiento (ver frontend/AGENTS.md): cero migracion de sesiones existentes
// y los lectores fuera de alcance de `localStorage` siguen andando.
const sessionPersistStorage: PersistStorage<SessionState> = {
  getItem: (): StorageValue<SessionState> | null => {
    const token = localStorage.getItem("access_token");
    if (!token) return null;

    const userName = localStorage.getItem("user_name");
    const role = localStorage.getItem("user_role") as Role | null;

    // `exp` y `email` no se persisten: se recalculan del token en cada
    // rehidratacion.
    let exp: number | null = null;
    let email: string | null = null;
    try {
      const payload = jwtDecode<TokenPayload>(token);
      exp = payload.exp ?? null;
      email = payload.email ?? null;
    } catch {
      exp = null;
      email = null;
    }

    return { state: { token, userName, role, email, exp }, version: 0 };
  },
  setItem: (_name, value) => {
    const { token, userName, role } = value.state;
    if (token) localStorage.setItem("access_token", token);
    else localStorage.removeItem("access_token");

    if (userName) localStorage.setItem("user_name", userName);
    else localStorage.removeItem("user_name");

    if (role) localStorage.setItem("user_role", role);
    else localStorage.removeItem("user_role");
  },
  removeItem: () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_name");
    localStorage.removeItem("user_role");
  },
};

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => {
      getState = get;

      return {
        token: null,
        userName: null,
        role: null,
        email: null,
        exp: null,
        setSession: (token, over) => {
          // Igual que el adaptador de persistencia (`getItem` arriba): un
          // token no decodificable no debe tirar la sesión entera para atrás
          // con un error genérico, sino degradar a "sin datos derivados del
          // token" y dejar que `over` (lo que ya trajo `/auth/me`) mande.
          let payload: Partial<TokenPayload> = {};
          try {
            payload = jwtDecode<TokenPayload>(token);
          } catch {
            payload = {};
          }
          const role = over?.role ?? payload.role ?? null;
          const userName = over?.name ?? payload.name ?? payload.email ?? null;
          const email = over?.email ?? payload.email ?? null;
          const exp = payload.exp ?? null;

          set({ token, userName, role, email, exp });
          scheduleAutoLogout(exp);
        },
        logout: () => {
          clearAutoLogout();
          set({ token: null, userName: null, role: null, email: null, exp: null });
          // Sin esto los datos del usuario anterior quedarian en la cache de
          // react-query y se pintarian al loguearse otro usuario en la misma
          // pestaña.
          queryClient.clear();
        },
      };
    },
    {
      name: "session",
      storage: sessionPersistStorage,
      // Sin `skipHydration`: la rehidratacion tiene que ser sincronica, antes
      // del primer render (el storage de arriba es sincronico, asi que
      // `persist` tambien hidrata de forma sincronica, todavia dentro de la
      // llamada a `create()`).
      onRehydrateStorage: () => (state) => {
        if (!state) return;

        if (typeof state.exp === "number" && Date.now() >= state.exp * 1000) {
          // Ya vencio: descartar la sesion en el mismo callback, antes del
          // primer render, para que `ProtectedRoute` vea `token === null`
          // desde el arranque sin llegar a pintar un frame de contenido
          // protegido.
          getState().logout();
          return;
        }

        scheduleAutoLogout(state.exp);
      },
    },
  ),
);
