// RIR/RPE y pausa entre series (`routine-exercise-intensity`).
//
// El modelo guarda **un solo número, el RIR** (repeticiones en reserva, 0 =
// al fallo). El RPE (esfuerzo percibido, 1-10) es la misma escala invertida,
// así que no se persiste: se deriva acá. Una sola fuente de verdad de la
// conversión y del formato — el editor, "Mi rutina" y el PDF la comparten.

export type IntensityScale = "rir" | "rpe";

export const INTENSITY_SCALE_LABEL: Record<IntensityScale, string> = {
  rir: "RIR",
  rpe: "RPE",
};

// RPE = 10 - RIR. Exacta en las dos direcciones, medios incluidos
// (RIR 1.5 ⇔ RPE 8.5).
export function rirToRpe(rir: number): number {
  return 10 - rir;
}

export function rpeToRir(rpe: number): number {
  return 10 - rpe;
}

// El valor a mostrar en la escala elegida, sin la etiqueta.
export function intensityValue(rir: number, scale: IntensityScale): number {
  return scale === "rpe" ? rirToRpe(rir) : rir;
}

// "RIR 2" / "RPE 8.5"; cadena vacía si no hay nada prescripto.
export function formatIntensity(rir: number | null | undefined, scale: IntensityScale): string {
  if (rir === null || rir === undefined) return "";
  return `${INTENSITY_SCALE_LABEL[scale]} ${intensityValue(rir, scale)}`;
}

// "45 s" hasta el minuto; de ahí en más "2 min" o "1 min 30 s". Sin valor,
// cadena vacía — nunca un "0 s" inventado.
export function formatRest(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return "";
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest === 0 ? `${minutes} min` : `${minutes} min ${rest} s`;
}

// Variante compacta para la columna PAUSA del PDF, que tiene ~40pt de ancho:
// ahí "1 min 30 s" wrapea a dos líneas y deforma la fila. Mismo dato, notación
// mm:ss a partir del minuto.
export function formatRestCompact(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return "";
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

// Lee lo que el usuario tipeó en un input de intensidad y lo devuelve como
// RIR listo para guardar. Vacío ⇒ `null` ("sin prescribir"); fuera de la
// escala 0-10 ⇒ `undefined`, que el llamador trata como "no lo apliques".
export function parseIntensityInput(
  raw: string,
  scale: IntensityScale,
): number | null | undefined {
  const trimmed = raw.trim().replace(",", ".");
  if (trimmed === "") return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0 || value > 10) return undefined;
  return scale === "rpe" ? rpeToRir(value) : value;
}

// Ídem para la pausa, en segundos enteros. Vacío ⇒ `null`; negativo, no
// numérico o mayor a una hora ⇒ `undefined`.
export function parseRestInput(raw: string): number | null | undefined {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const value = Number(trimmed);
  if (!Number.isInteger(value) || value < 0 || value > 3600) return undefined;
  return value;
}

// Preferencia de escala del editor: es una conveniencia de quien mira, no un
// dato de la rutina, así que vive en `localStorage` y no en el modelo ni en
// un store (los tres stores persistidos del repo siguen siendo tres). Storage
// bloqueado ⇒ RIR, nunca romper el render.
const SCALE_STORAGE_KEY = "routine_intensity_scale";

export function readIntensityScale(): IntensityScale {
  try {
    return localStorage.getItem(SCALE_STORAGE_KEY) === "rpe" ? "rpe" : "rir";
  } catch {
    return "rir";
  }
}

export function writeIntensityScale(scale: IntensityScale): void {
  try {
    localStorage.setItem(SCALE_STORAGE_KEY, scale);
  } catch {
    // Sin persistencia la preferencia dura lo que dure la pantalla: aceptable.
  }
}
