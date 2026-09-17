import { describe, expect, it } from "vitest";
import { buildRoutinePdfBlob, routinePdfFilename, type RoutinePdfInput } from "@/lib/routinePdf";
import type { RoutineTemplateDay } from "@/types";

// Planilla imprimible de una copia de rutina ("PLAN DE ENTRENAMIENTO
// SEMANAL"), armada con `@react-pdf/renderer`. Lo que se verifica acá es la
// **paginación**: el bloque de un día no se parte entre hojas (`wrap={false}`)
// y entran tres por página, que es lo que hace que la planilla salga igual al
// modelo impreso. El resto del layout se verifica mirando el PDF.

function makeDay(name: string, exerciseCount: number): RoutineTemplateDay {
  return {
    day_id: name,
    name,
    muscle_groups: ["Pecho"],
    position: 1,
    exercises: Array.from({ length: exerciseCount }, (_, i) => ({
      exercise_id: `${name}-${i}`,
      name: `Ejercicio ${i + 1}`,
      muscle_group: "Pecho",
      base: { sets: 4, reps: 10, weight_kg: 40 },
      strategy: "constant" as never,
      rir: null,
      rest_seconds: null,
      planned_sets: [{ index: 1, weight_kg: 40, reps: 10, note: null }],
    })),
  };
}

function makeInput(days: RoutineTemplateDay[]): RoutinePdfInput {
  return {
    memberName: "Juan Pérez",
    templateName: "Fuerza 4 días",
    templateTag: "FUERZA",
    startsOn: "2026-01-01",
    days,
    gymName: "Gym App",
    trainerName: "Fabian Aguirre",
  };
}

// El blob no expone el conteo de páginas: se lee del propio PDF, contando los
// objetos `/Type /Page` (el catálogo usa `/Pages`, que no matchea).
async function pageCount(blob: Blob): Promise<number> {
  const source = new TextDecoder("latin1").decode(await blob.arrayBuffer());
  return (source.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
}

describe("planilla de rutina en PDF", () => {
  it("una rutina corta entra en una sola hoja, con la evaluación al pie", async () => {
    const blob = await buildRoutinePdfBlob(makeInput([makeDay("Lunes", 4), makeDay("Martes", 5)]));

    expect(await pageCount(blob)).toBe(1);
  });

  it("una semana de cinco días sale en dos hojas, como el modelo impreso", async () => {
    const days = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"].map((name) => makeDay(name, 4));
    const blob = await buildRoutinePdfBlob(makeInput(days));

    expect(await pageCount(blob)).toBe(2);
  });

  it("los días largos ocupan más hojas: el bloque crece con los ejercicios", async () => {
    // Un día no se parte entre hojas — crece en renglones y empuja al
    // siguiente. Con 12 ejercicios entran menos días por hoja que con 4.
    const names = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom", "Extra"];
    const cortos = await buildRoutinePdfBlob(makeInput(names.map((n) => makeDay(n, 4))));
    const largos = await buildRoutinePdfBlob(makeInput(names.map((n) => makeDay(n, 12))));

    expect(await pageCount(largos)).toBeGreaterThan(await pageCount(cortos));
  });

  it("produce un PDF válido", async () => {
    const blob = await buildRoutinePdfBlob(makeInput([makeDay("Lunes", 4)]));
    const bytes = new Uint8Array(await blob.arrayBuffer());

    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    expect(bytes.byteLength).toBeGreaterThan(1000);
  });

  it("arma un nombre de archivo sin acentos ni espacios", () => {
    expect(routinePdfFilename("Juan Pérez", "Fuerza 4 días")).toMatch(
      /^Plan_Juan-Perez_Fuerza-4-dias_\d{4}-\d{2}-\d{2}\.pdf$/,
    );
  });

  it("no deja el nombre de archivo vacío si no hay nada que convertir en slug", () => {
    expect(routinePdfFilename("", "···")).toMatch(/^Plan_rutina_rutina_\d{4}-\d{2}-\d{2}\.pdf$/);
  });
});
