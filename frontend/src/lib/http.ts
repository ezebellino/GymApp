import axios from "axios";
import { toastError } from "./toast";
import { useSessionStore } from "@/stores/session";
import { isPublicPath } from "./navigation";

const apiBaseURL =
  import.meta.env.VITE_API_URL ??
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://127.0.0.1:8000"
    : "https://backend-production-7264e.up.railway.app");

const api = axios.create({
  baseURL: apiBaseURL,
});

const slashEndpoints = new Set(["/users", "/attendance", "/payments"]);

api.interceptors.request.use((config) => {
  if (config.url && slashEndpoints.has(config.url)) {
    config.url = `${config.url}/`;
  }
  if (!config.headers.Authorization) {
    const token = useSessionStore.getState().token;
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export async function handleResponseError(error: unknown) {
  if ((error as { response?: { status?: number } })?.response?.status === 401) {
    // En una vista pública (login, invitación) no desloguea ni redirige: el
    // propio flujo de login llama a la API justo después de `setSession`, y un
    // `logout()` disparado por un 401 rezagado de otra petición borraría la
    // sesión recién creada (dec. D6 de `secure-staff-endpoints`). El token
    // inválido que pueda quedar en `localStorage` lo sobrescribe el próximo
    // login; no es este interceptor el que lo limpia.
    if (isPublicPath(window.location.pathname)) {
      return Promise.reject(error);
    }
    toastError("Sesión expirada", "Volvé a iniciar sesión.");
    useSessionStore.getState().logout();
    window.location.href = "/login";
  }
  return Promise.reject(error);
}

api.interceptors.response.use((r) => r, handleResponseError);

export default api;
