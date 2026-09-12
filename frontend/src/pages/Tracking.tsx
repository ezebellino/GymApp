import { LineChart } from "lucide-react";
import ComingSoon from "@/components/ComingSoon";

// Sección propia desde que "Inicio" se quedó con `/dashboard`: antes el item
// "Seguimiento" del Sidebar apuntaba al dashboard. Todavía sin contenido, se
// resuelve en una iteración futura.
export default function Tracking() {
  return (
    <ComingSoon
      title="Seguimiento"
      description="El seguimiento de progreso de los alumnos."
      icon={LineChart}
    />
  );
}
