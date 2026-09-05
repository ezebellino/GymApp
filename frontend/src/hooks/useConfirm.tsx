import { useCallback, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ConfirmState = {
  title: string;
  description?: string;
};

// Reemplaza el confirmAction de SweetAlert2 (sileo es solo toasts, no tiene
// modal de confirmacion). `confirm(title, description)` devuelve una promesa
// que resuelve a `true`/`false` segun el boton que use la persona; el
// elemento `ConfirmDialog` devuelto se renderiza una vez en el JSX del
// componente que llama a `confirm`.
export function useConfirm() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<ConfirmState>({ title: "" });
  const resolveRef = useRef<(value: boolean) => void>();

  const confirm = useCallback((title: string, description?: string) => {
    setState({ title, description });
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const settle = useCallback((value: boolean) => {
    resolveRef.current?.(value);
    resolveRef.current = undefined;
    setOpen(false);
  }, []);

  const ConfirmDialog = (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) settle(false);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{state.title}</AlertDialogTitle>
          {state.description ? (
            <AlertDialogDescription>{state.description}</AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => settle(false)}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction onClick={() => settle(true)}>
            Confirmar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { confirm, ConfirmDialog };
}
