import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { signIn as requestSignIn, type Credentials } from "@/services/auth";
import { useSessionStore } from "@/stores/session";
import { useThemeStore } from "@/stores/theme";
import { normalizeThemeMode } from "@/lib/theme";

export type SignInOptions = {
  // Cierra la sesión anterior (store + caché de react-query) antes de abrir la
  // nueva. Lo usa el widget de desarrollo; el login manual no lo necesita.
  resetPreviousSession?: boolean;
};

// Único camino de login del frontend (dec. 3 de `add-dev-role-switcher`): red
// (`services/auth.ts`) seguida de los efectos, en este orden fijo (dec. 4):
//
//   1. `POST /auth/token` + `GET /auth/me` — nada de estado local todavía.
//   2. Recién con éxito: `logout()` opcional → `setSession` → tema → `navigate`.
//
// Primero la red, después el switch de sesión: un login fallido deja la sesión
// anterior intacta (el llamador ve el error y decide el mensaje). El aterrizaje
// por rol lo resuelve la ruta `/` de `App.jsx`, que lee `role` del store recién
// escrito y manda a `/dashboard` o `/my-routine`.
export function useSignIn() {
  const navigate = useNavigate();
  const setSession = useSessionStore((s) => s.setSession);
  const logout = useSessionStore((s) => s.logout);
  const setThemeMode = useThemeStore((s) => s.setMode);

  return useCallback(
    async (credentials: Credentials, { resetPreviousSession = false }: SignInOptions = {}) => {
      const { accessToken, me } = await requestSignIn(credentials);

      if (resetPreviousSession) logout();

      if (me) {
        setSession(accessToken, {
          name: me.full_name ?? me.email ?? "Usuario",
          role: me.role,
          email: me.email ?? undefined,
        });
      } else {
        // Sin /auth/me, setSession decodifica el JWT y deriva nombre/rol/exp.
        setSession(accessToken);
      }
      setThemeMode(normalizeThemeMode(me?.theme_preference));

      navigate("/", { replace: true });
    },
    [navigate, setSession, logout, setThemeMode],
  );
}
