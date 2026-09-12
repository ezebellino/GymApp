import { Home } from "lucide-react";
import ComingSoon from "@/components/ComingSoon";

// Sección vaciada a pedido del dueño: todos sus componentes, KPIs, buscador,
// check-in rápido, cobro rápido y modales se retiraron para rehacerse en una
// iteración futura. La ruta y la entrada del Sidebar ("Inicio") se conservan
// mostrando el estado "To Do". "Seguimiento" es ahora otra sección aparte
// (`/tracking`), con su propio placeholder.
export default function Dashboard() {
  return (
    <ComingSoon
      title="Inicio"
      description="El panel de inicio del gimnasio."
      icon={Home}
    />
  );
}
