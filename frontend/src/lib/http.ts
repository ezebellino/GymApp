import axios from "axios";
import { toastError } from "./toast";
import { useSessionStore } from "@/stores/session";

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

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    if (error?.response?.status === 401) {
      toastError("Sesión expirada", "Volvé a iniciar sesión.");
      useSessionStore.getState().logout();
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;
