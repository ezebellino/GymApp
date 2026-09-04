import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchMe, updateMyTheme } from "./me";
import { queryKeys } from "./queryKeys";
import { useSessionStore } from "@/stores/session";
import { useThemeStore } from "@/stores/theme";
import { normalizeThemeMode, type ThemeMode } from "@/lib/theme";

export function useMeQuery() {
  const token = useSessionStore((s) => s.token);

  return useQuery({
    queryKey: queryKeys.me.all,
    queryFn: fetchMe,
    // Solo si hay sesion: sin token la llamada seria un 401 seguro (analogo
    // exacto de `useSyncSettings`/`useSettingsQuery`).
    enabled: !!token,
  });
}

export function useUpdateMyThemeMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (mode: ThemeMode) => updateMyTheme(mode),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.me.all, data);
    },
  });
}

// Unico sincronizador servidor -> store de tema (dec. 5.2): se monta una sola
// vez en App.jsx, al lado de `useSyncSettings()`. Empuja el
// `theme_preference` de `/auth/me` al store de tema normalizado; `null`
// (usuario que nunca eligio) resuelve a "dark", nunca a la cache local de
// `app_theme` (dec. 5.3: el servidor manda cuando responde).
export function useSyncUserTheme() {
  const { data } = useMeQuery();
  const setMode = useThemeStore((s) => s.setMode);

  useEffect(() => {
    if (data) {
      setMode(normalizeThemeMode(data.theme_preference));
    }
  }, [data, setMode]);
}
