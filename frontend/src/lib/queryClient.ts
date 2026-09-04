import { QueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";

// El retry no reintenta 4xx: con el default de react-query (3 reintentos) un 401
// dispararia el interceptor de respuesta de `lib/http.ts` -y su alertError +
// redirect a /login- hasta cuatro veces por query fallida. Un 4xx no mejora
// reintentando (es un error del cliente, no algo transitorio); un 5xx o una
// caida de red si pueden resolverse solos.
function shouldRetry(failureCount: number, error: unknown) {
  const status = (error as AxiosError)?.response?.status;
  if (status !== undefined && status >= 400 && status < 500) return false;
  return failureCount < 2;
}

// Singleton exportado (no se crea dentro de main.jsx): tiene que ser accesible
// fuera de React -logout() lo limpia, el puente de eventos legacy lo invalida-.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: shouldRetry,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
    mutations: {
      // Reintentar un POST/PATCH puede duplicar una escritura (un cobro, un
      // check-in): nunca automatico.
      retry: false,
    },
  },
});
