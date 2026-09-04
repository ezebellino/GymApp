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
// `theme_preference` es la unica excepcion a "el servidor manda sobre lo
// persistido": el propio copy de Settings dice que el tema "se guarda solo
// en este dispositivo". Como este hook corre en CADA carga de la app (esta
// montado en App.jsx, no solo en /settings), sincronizar ese campo tambien
// pisaria, en cualquier reload, un tema elegido por el swatch que todavia no
// paso por "Guardar cambios".
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
