import { Card } from "@/components/ui/card";

export default function Dashboard() {
  // Luego conectamos a /reports/* para KPIs reales
  const kpis = [
    { label: "Clientes activos", value: 128 },
    { label: "Pagos (mes)", value: 92 },
    { label: "Asistencias (hoy)", value: 64 },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Resumen</h1>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {kpis.map((k) => (
          <Card key={k.label} className="p-4">
            <div className="text-sm text-muted-foreground">{k.label}</div>
            <div className="text-2xl font-bold">{k.value}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}
