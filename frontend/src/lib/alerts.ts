// src/lib/alerts.ts
import Swal from "sweetalert2";

export const alertSuccess = async (title: string, text?: string) => {
  return Swal.fire({
    icon: "success",
    title,
    text,
    confirmButtonText: "OK",
    background: "#0b0b0f",
    color: "#e5e7eb",
    confirmButtonColor: "#22c55e",
  });
};

export const alertError = async (title: string, text?: string) => {
  return Swal.fire({
    icon: "error",
    title,
    text,
    confirmButtonText: "Entendido",
    background: "#0b0b0f",
    color: "#e5e7eb",
    confirmButtonColor: "#ef4444",
  });
};

export const alertInfo = async (title: string, text?: string) => {
  return Swal.fire({
    icon: "info",
    title,
    text,
    confirmButtonText: "OK",
    background: "#0b0b0f",
    color: "#e5e7eb",
    confirmButtonColor: "#3b82f6",
  });
};

export const confirmAction = async (title: string, text?: string) => {
  return Swal.fire({
    icon: "question",
    title,
    text,
    showCancelButton: true,
    confirmButtonText: "Confirmar",
    cancelButtonText: "Cancelar",
    background: "#0b0b0f",
    color: "#e5e7eb",
    confirmButtonColor: "#22c55e",
    cancelButtonColor: "#6b7280",
  });
};

// Toast rápido (arriba a la derecha)
export const toast = Swal.mixin({
  toast: true,
  position: "top-end",
  showConfirmButton: false,
  timer: 2500,
  timerProgressBar: true,
  background: "#0b0b0f",
  color: "#e5e7eb",
});
