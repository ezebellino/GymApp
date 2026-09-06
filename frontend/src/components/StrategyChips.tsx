import type { ProgressionStrategy } from "@/types";
import { cn } from "@/lib/utils";

const STRATEGY_LABEL: Record<ProgressionStrategy, string> = {
  constant: "Constante",
  pyramid: "Pirámide",
  inverted: "Invertida",
  drop_set: "Drop set",
  rest_pause: "Rest-pause",
};

const STRATEGIES: ProgressionStrategy[] = [
  "constant",
  "pyramid",
  "inverted",
  "drop_set",
  "rest_pause",
];

type Props = {
  value: ProgressionStrategy;
  disabled?: boolean;
  onChange: (strategy: ProgressionStrategy) => void;
};

// Los cinco chips de estrategia de progresión, con el elegido marcado.
// `disabled` mientras la mutación de autosave está en vuelo (design D5/D11
// de add-routine-templates): el coach nunca ve un botón "Guardar", clickear
// otro chip dispara el PUT y listo.
export default function StrategyChips({ value, disabled, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Estrategia de progresión">
      {STRATEGIES.map((strategy) => {
        const selected = strategy === value;
        return (
          <button
            key={strategy}
            type="button"
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => !selected && onChange(strategy)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
              selected
                ? "border-primary/40 bg-primary/15 text-primary-strong"
                : "border-border bg-surface-2/30 text-muted-foreground hover:bg-surface-2/60"
            )}
          >
            {STRATEGY_LABEL[strategy]}
          </button>
        );
      })}
    </div>
  );
}
