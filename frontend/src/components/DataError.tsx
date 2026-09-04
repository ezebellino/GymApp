import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

type DataErrorProps = {
  title?: string;
  description?: string;
  onRetry?: () => void;
};

// Bloque de error compartido por las cuatro vistas de la spec
// `server-data-cache` (dec. 5): un solo componente de presentacion, pero cada
// vista pasa sus propios textos (los que ya mostraba antes de este change).
// El default reusa el texto que ya usaba `Attendance.tsx` en su modal de
// SweetAlert, que este componente reemplaza en la carga.
export default function DataError({
  title = "No se pudieron cargar los datos",
  description = "Intenta nuevamente en unos segundos.",
  onRetry,
}: DataErrorProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-amber-200/10 bg-zinc-900/40 px-6 py-10 text-center">
      <AlertTriangle className="h-6 w-6 text-amber-300" aria-hidden="true" />
      <div>
        <p className="text-sm font-medium text-zinc-100">{title}</p>
        <p className="mt-1 text-sm text-zinc-400">{description}</p>
      </div>
      {onRetry ? (
        <Button
          type="button"
          variant="outline"
          onClick={onRetry}
          className="border-amber-300/20 bg-white/[0.04] text-amber-50 hover:bg-white/[0.08]"
        >
          Reintentar
        </Button>
      ) : null}
    </div>
  );
}
