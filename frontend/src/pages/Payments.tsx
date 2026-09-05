import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// TODO: reimplementar la seccion de Pagos desde cero.
// Se elimino la implementacion anterior (stats, filtros, tabla, alta/baja de
// pagos) a pedido de producto - va a rehacerse con un diseno nuevo. Antes de
// tocar esto, arrancar con /opsx:propose para la spec nueva en vez de seguir
// el patron viejo de este archivo.
export default function PaymentsPage() {
  return (
    <Card className="border-dashed border-border/60 bg-surface-1/40">
      <CardHeader>
        <CardTitle>Pagos</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Esta seccion esta en reconstruccion.
      </CardContent>
    </Card>
  );
}
