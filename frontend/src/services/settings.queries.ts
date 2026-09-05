import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchSettings } from "./settings";
import { queryKeys } from "./queryKeys";
import { useSettingsStore } from "@/stores/settings";

export function useSettingsQuery() {
  return useQuery({
    queryKey: queryKeys.settings.all,
    queryFn: fetchSettings,
  });
}

// Unico sincronizador servidor -> store de ajustes: se monta una sola vez en
// App.jsx. v5 no tiene `onSuccess` en `useQuery`, asi que el efecto sobre
// `data` es el reemplazo (dec. 12). El resto de la app solo lee del store o
// escribe con `setSettings`; nadie mas debe escuchar `data` de esta query.
//
// `theme_preference` se descarta siempre: el tema dejo de ser configuracion
// del negocio y paso a ser una preferencia del usuario (`/auth/me` +
// `stores/theme.ts`, ver adopt-kinetic-obsidian-theme). El campo de
// `app_settings` queda legacy, sin ningun lector (dec. 6.5 del design).
export function useSyncSettings() {
  const { data } = useSettingsQuery();
  const setSettings = useSettingsStore((s) => s.setSettings);

  useEffect(() => {
    if (data) {
      const { theme_preference: _serverTheme, ...serverSynced } = data;
      setSettings(serverSynced);
    }
  }, [data, setSettings]);
}
