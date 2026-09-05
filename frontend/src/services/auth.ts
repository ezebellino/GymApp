import api from "@/lib/http";
import type { MeUser } from "@/services/me";

// Fetchers puros del login: red y nada más (sin stores ni navegación, eso vive
// en `hooks/useSignIn.ts`). Es el único camino de autenticación del frontend:
// lo usan `pages/Login.tsx` y el widget de desarrollo (`DevRoleSwitcher`).
// Default export de `@/lib/http` (regla dura de `frontend/AGENTS.md`, de la
// que depende `vi.mock("@/lib/http")` en la suite).

export type Credentials = { username: string; password: string };

export type TokenResp = { access_token: string; token_type: string };

export type SignInResult = {
  accessToken: string;
  // `null` si `/auth/me` falló: el llamador degrada a derivar nombre/rol del JWT.
  me: MeUser | null;
};

const TOKEN_REQUEST_CONFIG = {
  timeout: 8000,
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
};

// `POST /auth/token` con un único reintento a los 2 s ante timeout: el backend
// en Railway puede estar despertándose en el primer request del día.
export async function requestToken({ username, password }: Credentials) {
  const body = new URLSearchParams();
  body.append("username", username);
  body.append("password", password);

  try {
    return await api.post<TokenResp>("/auth/token", body, TOKEN_REQUEST_CONFIG);
  } catch (err: unknown) {
    const { code, message = "" } = (err ?? {}) as { code?: string; message?: string };
    if (code === "ECONNABORTED" || message.includes("timeout")) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return api.post<TokenResp>("/auth/token", body, TOKEN_REQUEST_CONFIG);
    }
    throw err;
  }
}

// El store todavía no tiene el token cuando se llama (setSession corre una
// única vez, al final del flujo): se pasa explícito para que esta llamada
// puntual quede autenticada sin depender del interceptor de `lib/http.ts`.
export async function fetchMeWithToken(token: string): Promise<MeUser> {
  const { data } = await api.get<MeUser>("/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}

export async function signIn(credentials: Credentials): Promise<SignInResult> {
  const { data } = await requestToken(credentials);

  let me: MeUser | null = null;
  try {
    me = await fetchMeWithToken(data.access_token);
  } catch {
    // Sin /auth/me, `setSession` decodifica el JWT y deriva nombre/rol/exp.
    me = null;
  }

  return { accessToken: data.access_token, me };
}
