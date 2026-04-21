import axios from "axios";
import { alertError } from "./alerts";

const apiBaseURL =
  import.meta.env.VITE_API_URL ??
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://127.0.0.1:8000"
    : "https://backend-production-7264e.up.railway.app");

const api = axios.create({
  baseURL: apiBaseURL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    if (error?.response?.status === 401) {
      await alertError("Sesión expirada", "Volvé a iniciar sesión.");
      localStorage.removeItem("access_token");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;
