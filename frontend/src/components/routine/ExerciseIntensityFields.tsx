import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  INTENSITY_SCALE_LABEL,
  intensityValue,
  parseIntensityInput,
  parseRestInput,
  type IntensityScale,
} from "@/lib/intensity";
import { cn } from "@/lib/utils";

// Los dos campos de prescripción de un ejercicio del borrador
// (`routine-exercise-intensity`): intensidad (RIR o RPE) y pausa entre
// series. Los dos son opcionales — vacío significa "sin prescribir", que es
// lo que guarda `null`.
//
// La etiqueta de la intensidad **es** el botón que alterna la escala: RIR y
// RPE son el mismo número invertido (`lib/intensity.ts`), así que cambiar de
// escala no toca el dato, solo cómo se lee y se tipea. La preferencia es
// global del editor — alternarla en una fila las cambia todas.

type Props = {
  rir: number | null;
  restSeconds: number | null;
  scale: IntensityScale;
  onScaleChange: (scale: IntensityScale) => void;
  onRirChange: (rir: number | null) => void;
  onRestChange: (restSeconds: number | null) => void;
};

export default function ExerciseIntensityFields({
  rir,
  restSeconds,
  scale,
  onScaleChange,
  onRirChange,
  onRestChange,
}: Props) {
  // Estado local para no pelear con lo que se está tipeando (un "1." a medio
  // escribir no parsea, y no por eso hay que revertir el input). El borrador
  // se actualiza solo cuando el texto parsea a un valor válido.
  const [intensityText, setIntensityText] = useState("");
  const [restText, setRestText] = useState("");

  // Se resincroniza con el borrador cuando cambia el dato o la escala — este
  // último es el que convierte 2 (RIR) en 8 (RPE) en pantalla.
  useEffect(() => {
    setIntensityText(rir === null ? "" : String(intensityValue(rir, scale)));
  }, [rir, scale]);

  useEffect(() => {
    setRestText(restSeconds === null ? "" : String(restSeconds));
  }, [restSeconds]);

  const scaleLabel = INTENSITY_SCALE_LABEL[scale];
  const otherScale: IntensityScale = scale === "rir" ? "rpe" : "rir";

  function handleIntensity(raw: string) {
    setIntensityText(raw);
    const parsed = parseIntensityInput(raw, scale);
    if (parsed !== undefined) onRirChange(parsed);
  }

  function handleRest(raw: string) {
    setRestText(raw);
    const parsed = parseRestInput(raw);
    if (parsed !== undefined) onRestChange(parsed);
  }

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onScaleChange(otherScale)}
          title={`Anotar en ${INTENSITY_SCALE_LABEL[otherScale]} en vez de ${scaleLabel}`}
          aria-label={`Escala de intensidad: ${scaleLabel}. Cambiar a ${INTENSITY_SCALE_LABEL[otherScale]}`}
          className={cn(
            "rounded-full border border-border bg-surface-2/40 px-2.5 py-1",
            "text-label-caps uppercase text-muted-foreground transition-colors",
            "hover:border-primary/30 hover:text-foreground",
          )}
        >
          {scaleLabel}
        </button>
        <Input
          type="number"
          inputMode="decimal"
          min={0}
          max={10}
          step={0.5}
          value={intensityText}
          onChange={(event) => handleIntensity(event.target.value)}
          aria-label={`${scaleLabel} del ejercicio`}
          placeholder="—"
          className="h-8 w-20 text-sm"
        />
      </div>

      <div className="flex items-center gap-2">
        <span className="text-label-caps uppercase text-muted-foreground">Pausa</span>
        <Input
          type="number"
          inputMode="numeric"
          min={0}
          max={3600}
          step={15}
          value={restText}
          onChange={(event) => handleRest(event.target.value)}
          aria-label="Pausa entre series, en segundos"
          placeholder="—"
          className="h-8 w-24 text-sm"
        />
        <span className="text-xs text-muted-foreground">seg</span>
      </div>
    </div>
  );
}
