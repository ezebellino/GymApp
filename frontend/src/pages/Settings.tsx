import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SettingsPage() {
  // Stubs simples de preferencia. Luego los conectamos al backend.
  const [gymName, setGymName] = useState("Libre Funcional");
  const [currency, setCurrency] = useState("ARS");
  const [defaultFee, setDefaultFee] = useState(10000);

  function save() {
    // TODO: POST /settings
    console.log({ gymName, currency, defaultFee });
    alert("Guardado (stub). Luego conectamos al backend.");
  }

  return (
    <div className="p-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Configuración</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 max-w-xl">
          <div className="space-y-2">
            <label className="text-sm">Nombre del Gimnasio</label>
            <Input value={gymName} onChange={(e) => setGymName(e.target.value)} />
          </div>

          <div className="space-y-2">
            <label className="text-sm">Moneda</label>
            <Input value={currency} onChange={(e) => setCurrency(e.target.value)} />
          </div>

          <div className="space-y-2">
            <label className="text-sm">Cuota por defecto</label>
            <Input
              type="number"
              value={defaultFee}
              onChange={(e) => setDefaultFee(Number(e.target.value))}
            />
          </div>

          <Button onClick={save}>Guardar cambios</Button>
        </CardContent>
      </Card>
    </div>
  );
}
