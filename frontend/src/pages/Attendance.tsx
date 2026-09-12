import { CalendarCheck2 } from "lucide-react";
import ComingSoon from "@/components/ComingSoon";

// Sección vaciada a pedido del dueño (ver comentario de `Dashboard.tsx`): el
// listado de check-ins, sus KPIs, filtros y paginación se retiraron para
// rehacerse en una iteración futura. El calendario de asistencias de la ficha
// de un miembro (`components/AttendanceCalendar.tsx`) NO se tocó: vive en
// `UserCard`, fuera de esta sección.
export default function AttendancePage() {
  return (
    <ComingSoon
      title="Asistencias"
      description="El registro de check-ins del gimnasio."
      icon={CalendarCheck2}
    />
  );
}
