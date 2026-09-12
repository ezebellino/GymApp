import { BarChart3 } from "lucide-react";
import ComingSoon from "@/components/ComingSoon";

// Sección vaciada a pedido del dueño (ver comentario de `Dashboard.tsx`): los
// gráficos de recharts, el rango de fechas y el modal de detalle de asistencias
// se retiraron para rehacerse en una iteración futura.
export default function ReportsPage() {
  return (
    <ComingSoon
      title="Reportes"
      description="Los reportes de actividad y facturación."
      icon={BarChart3}
    />
  );
}
