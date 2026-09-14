import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUnsavedChangesStore } from "@/stores/unsavedChanges";

// Aviso al salir con un borrador sin guardar (`template-owned-routine-days`,
// design D11): `main.jsx` usa `<BrowserRouter>` (react-router 7 sin data
// router), así que `useBlocker` no está disponible. Este hook es la
// alternativa: consulta el flag global de `stores/unsavedChanges.ts` y, si
// está sucio, retiene la navegación pedida en vez de ejecutarla, para que el
// caller pueda mostrar un `ConfirmActionDialog` ("Descartar y salir" /
// "Seguir editando"). Lo usan el botón "Volver a Rutinas" del detalle de
// plantilla y los links de `components/Sidebar.tsx`.
export function useGuardedNavigate() {
  const navigate = useNavigate();
  const dirty = useUnsavedChangesStore((s) => s.dirty);
  const setDirty = useUnsavedChangesStore((s) => s.setDirty);
  const [pendingTo, setPendingTo] = useState<string | null>(null);

  const guardedNavigate = useCallback(
    (to: string) => {
      if (dirty) {
        setPendingTo(to);
        return;
      }
      navigate(to);
    },
    [dirty, navigate],
  );

  const confirmDiscardAndLeave = useCallback(() => {
    if (pendingTo) {
      setDirty(false);
      navigate(pendingTo);
    }
    setPendingTo(null);
  }, [pendingTo, navigate, setDirty]);

  const cancelLeave = useCallback(() => setPendingTo(null), []);

  return {
    guardedNavigate,
    isConfirmOpen: pendingTo !== null,
    confirmDiscardAndLeave,
    cancelLeave,
  };
}
