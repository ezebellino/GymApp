import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// TODO: reimplementar la seccion de Pagos desde cero.
// Se elimino la implementacion anterior (stats, filtros, tabla, alta/baja de
// pagos) a pedido de producto - va a rehacerse con un diseno nuevo. Antes de
// tocar esto, arrancar con /opsx:propose para la spec nueva en vez de seguir
// el patron viejo de este archivo.
// Única modificación permitida por `add-membership-plans` (design D4): el
// botón "Planes" del header, hacia la pantalla de planes de membresía.
export default function PaymentsPage() {
  return (
    <Card className="border-dashed border-border/60 bg-surface-1/40">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Pagos</CardTitle>
        <Button variant="outline" asChild>
          <Link to="/plans">Planes</Link>
        </Button>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Esta seccion esta en reconstruccion.
      </CardContent>
    </Card>
  );
}
