import { create } from "zustand";

// Flag global de "hay un borrador sin guardar en la pantalla actual"
// (`template-owned-routine-days`, design D11). Mismo patrón que
// `stores/session.ts`/`settings.ts`/`theme.ts`, pero sin persistencia: es
// efímero por diseño — vive solo mientras la pestaña sigue abierta en la
// pantalla que lo prendió.
//
// Quien edita un borrador (hoy, `pages/RoutineTemplateDetail.tsx`) es el
// único escritor de `dirty` (lo sincroniza con un `useEffect`, y lo apaga al
// desmontarse). Quien navega (el botón "Volver a Rutinas" de esa misma
// página, los links de `components/Sidebar.tsx`) lo consulta a través de
// `hooks/useGuardedNavigate.ts`, sin acoplarse a qué pantalla lo prendió.
type UnsavedChangesState = {
  dirty: boolean;
  setDirty: (dirty: boolean) => void;
};

export const useUnsavedChangesStore = create<UnsavedChangesState>((set) => ({
  dirty: false,
  setDirty: (dirty) => set({ dirty }),
}));
