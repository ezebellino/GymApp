import { LayoutDashboard } from "lucide-react";
import ComingSoon from "@/components/ComingSoon";

// Sección vaciada a pedido del dueño: todos sus componentes, KPIs, buscador,
// check-in rápido, cobro rápido y modales se retiraron para rehacerse en una
// iteración futura. La ruta y la entrada del Sidebar se conservan mostrando el
// estado "To Do".
export default function Dashboard() {
  return (
    <ComingSoon
      title="Seguimiento"
      description="El seguimiento diario del gimnasio."
      icon={LayoutDashboard}
    />
  );
}
