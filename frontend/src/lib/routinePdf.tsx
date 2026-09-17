import { pdf } from "@react-pdf/renderer";
import { RoutineSheet, type RoutineSheetProps } from "@/components/routine/RoutineSheet";

// Generación y descarga de la planilla imprimible de una copia de rutina.
// El documento en sí vive en `components/routine/RoutineSheet.tsx`.
//
// `@react-pdf/renderer` es pesado y no tiene por qué entrar al bundle
// inicial: quien difiere la carga es el **caller** — `MemberRoutineEditor`
// hace `await import("@/lib/routinePdf")` recién al tocar "Exportar PDF".

export type RoutinePdfInput = RoutineSheetProps;

// Devuelve el PDF como blob sin descargarlo: `exportRoutinePdf` le pega la
// descarga encima. Separados para que un test pueda inspeccionar el
// documento sin depender del navegador.
export function buildRoutinePdfBlob(input: RoutinePdfInput): Promise<Blob> {
  return pdf(<RoutineSheet {...input} />).toBlob();
}

export async function exportRoutinePdf(input: RoutinePdfInput): Promise<void> {
  const blob = await buildRoutinePdfBlob(input);
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = routinePdfFilename(input.memberName, input.templateName);
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

// `Plan_Juan-Perez_Fuerza-4-dias_2026-09-16.pdf`: sin acentos ni espacios,
// para que sobreviva a cualquier sistema de archivos.
export function routinePdfFilename(memberName: string, templateName: string): string {
  const slug = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "rutina";
  const today = new Date().toISOString().slice(0, 10);
  return `Plan_${slug(memberName)}_${slug(templateName)}_${today}.pdf`;
}
