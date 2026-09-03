import { sileo } from "sileo";
import type { ReactNode } from "react";

// Helper unico de disparo de toasts sobre sileo. Las paginas no deben
// importar `sileo` directo: todo pasa por estas funciones para mantener
// un unico punto de estilo/posicion/copy (ver openspec toast-notifications).

export function toastError(title: string, description?: ReactNode) {
  return sileo.error({ title, description });
}

export function toastSuccess(title: string, description?: ReactNode) {
  return sileo.success({ title, description });
}

export function toastInfo(title: string, description?: ReactNode) {
  return sileo.info({ title, description });
}
