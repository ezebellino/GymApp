import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchSettings } from "./settings";
import { queryKeys } from "./queryKeys";
import { useSettingsStore } from "@/stores/settings";
import { useSessionStore } from "@/stores/session";

export function useSettingsQuery() {
  const token = useSessionStore((s) => s.token);

  return useQuery({
    queryKey: queryKeys.settings.all,
    queryFn: fetchSettings,
    // Solo si hay sesion: sin token la llamada seria un 401 seguro (analogo
    // exacto de `useMeQuery`, `secure-staff-endpoints` dec. D4).
    enabled: !!token,
  });
}

// Unico sincronizador servidor -> store de ajustes: se monta una sola vez en
// App.jsx. v5 no tiene `onSuccess` en `useQuery`, asi que el efecto sobre
// `data` es el reemplazo (dec. 12). El resto de la app solo lee del store o
// escribe con `setSettings`; nadie mas debe escuchar `data` de esta query.
export function useSyncSettings() {
  const { data } = useSettingsQuery();
  const setSettings = useSettingsStore((s) => s.setSettings);

  useEffect(() => {
    if (data) {
      setSettings(data);
    }
  }, [data, setSettings]);
}
