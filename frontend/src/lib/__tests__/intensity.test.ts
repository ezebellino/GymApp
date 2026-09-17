import { describe, expect, it } from "vitest";
import {
  formatIntensity,
  formatRest,
  formatRestCompact,
  intensityValue,
  parseIntensityInput,
  parseRestInput,
  readIntensityScale,
  rirToRpe,
  rpeToRir,
  writeIntensityScale,
} from "@/lib/intensity";

// `routine-exercise-intensity`: el modelo guarda un solo número (RIR) y el
// RPE se deriva. Todo lo que dependa de esa equivalencia vive acá.

describe("conversión RIR ↔ RPE", () => {
  it("son la misma escala invertida", () => {
    expect(rirToRpe(2)).toBe(8);
    expect(rpeToRir(8)).toBe(2);
    expect(rirToRpe(0)).toBe(10); // al fallo
  });

  it("conserva los medios", () => {
    expect(rirToRpe(1.5)).toBe(8.5);
    expect(rpeToRir(8.5)).toBe(1.5);
  });

  it("ida y vuelta no pierde el valor", () => {
    for (const rir of [0, 1, 1.5, 2, 3.5, 10]) {
      expect(rpeToRir(rirToRpe(rir))).toBe(rir);
    }
  });

  it("muestra el número según la escala pedida", () => {
    expect(intensityValue(2, "rir")).toBe(2);
    expect(intensityValue(2, "rpe")).toBe(8);
  });
});

describe("formato", () => {
  it("etiqueta la intensidad con su escala", () => {
    expect(formatIntensity(2, "rir")).toBe("RIR 2");
    expect(formatIntensity(2, "rpe")).toBe("RPE 8");
  });

  it("sin prescripción no inventa un valor", () => {
    expect(formatIntensity(null, "rir")).toBe("");
    expect(formatIntensity(undefined, "rir")).toBe("");
    expect(formatRest(null)).toBe("");
    expect(formatRestCompact(null)).toBe("");
  });

  it("RIR 0 no se confunde con 'sin prescribir'", () => {
    // 0 es un valor legítimo (al fallo): un `if (!rir)` lo borraría.
    expect(formatIntensity(0, "rir")).toBe("RIR 0");
    expect(formatRest(0)).toBe("0 s");
  });

  it("la pausa legible usa minutos a partir del minuto", () => {
    expect(formatRest(45)).toBe("45 s");
    expect(formatRest(120)).toBe("2 min");
    expect(formatRest(90)).toBe("1 min 30 s");
  });

  it("la pausa compacta del PDF usa mm:ss, que entra en la columna", () => {
    expect(formatRestCompact(45)).toBe("45 s");
    expect(formatRestCompact(90)).toBe("1:30");
    expect(formatRestCompact(120)).toBe("2:00");
  });
});

describe("parseo de lo que se tipea", () => {
  it("vacío es 'sin prescribir', no un error", () => {
    expect(parseIntensityInput("", "rir")).toBeNull();
    expect(parseIntensityInput("   ", "rir")).toBeNull();
    expect(parseRestInput("")).toBeNull();
  });

  it("convierte a RIR lo tipeado en RPE", () => {
    expect(parseIntensityInput("8", "rpe")).toBe(2);
    expect(parseIntensityInput("2", "rir")).toBe(2);
  });

  it("acepta la coma como separador decimal", () => {
    expect(parseIntensityInput("1,5", "rir")).toBe(1.5);
  });

  it("rechaza fuera de la escala 0-10 y lo no numérico", () => {
    expect(parseIntensityInput("11", "rir")).toBeUndefined();
    expect(parseIntensityInput("-1", "rir")).toBeUndefined();
    expect(parseIntensityInput("hola", "rir")).toBeUndefined();
  });

  it("la pausa solo admite segundos enteros de 0 a una hora", () => {
    expect(parseRestInput("90")).toBe(90);
    expect(parseRestInput("0")).toBe(0);
    expect(parseRestInput("-1")).toBeUndefined();
    expect(parseRestInput("90.5")).toBeUndefined();
    expect(parseRestInput("3601")).toBeUndefined();
  });
});

describe("preferencia de escala", () => {
  it("por defecto es RIR, que es lo que se guarda", () => {
    expect(readIntensityScale()).toBe("rir");
  });

  it("recuerda la elección", () => {
    writeIntensityScale("rpe");
    expect(readIntensityScale()).toBe("rpe");
    writeIntensityScale("rir");
    expect(readIntensityScale()).toBe("rir");
  });

  it("un valor basura en storage cae a RIR en vez de romper", () => {
    localStorage.setItem("routine_intensity_scale", "vo2max");
    expect(readIntensityScale()).toBe("rir");
  });
});
