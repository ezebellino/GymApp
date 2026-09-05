import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// TODO: reimplementar la seccion de Rutinas desde cero.
// Se elimino la implementacion anterior (catalogo de ejercicios, editor de
// rutina por dia, registro de series/progreso) a pedido de producto - va a
// rehacerse con un diseno nuevo. Antes de tocar esto, arrancar con
// /opsx:propose para la spec nueva en vez de seguir el patron viejo de este
// archivo. No confundir con "Mi rutina" (pages/UserRoutine.tsx, portal
// cliente), que sigue como esta.
export default function RoutinesPage() {
  return (
    <Card className="border-dashed border-border/60 bg-surface-1/40">
      <CardHeader>
        <CardTitle>Rutinas</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Esta seccion esta en reconstruccion.
      </CardContent>
    </Card>
  );
}
