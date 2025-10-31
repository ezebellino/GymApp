import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Role } from "@/types";

export default function SettingsPage() {
  const [gymName] = useState("Libre Funcional");
  const [currency] = useState("ARS");
  const [defaultFee, setDefaultFee] = useState(24000);
  const [address, setAddress] = useState("Av. San Martín 325 - Dolores");
  const [role, setRole] = useState<Role>("coach");

  useEffect(() => {
    const storedRole = (localStorage.getItem("user_role") as Role) || "coach";
    setRole(storedRole);
  }, []);

  function save() {
    console.log({ defaultFee });
    alert("Guardado (stub). Luego conectamos al backend.");
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-zinc-100 bg-zinc-950">
      <Card className="w-full max-w-lg border border-white/10 bg-zinc-900/60 backdrop-blur-md shadow-lg">
        <CardHeader className="pb-2">
          <CardTitle className="text-center text-xl font-semibold text-amber-400">
            Configuración del sistema
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6 px-6 pb-6">
          {/* Nombre */}
          <div className="space-y-1">
            <label className="text-sm text-zinc-400">Nombre del Gimnasio</label>
            <Input
              value={gymName}
              readOnly
              className="bg-zinc-900/70 border-white/10 text-zinc-400 cursor-not-allowed"
            />
          </div>

          {/* Moneda */}
          <div className="space-y-1">
            <label className="text-sm text-zinc-400">Moneda</label>
            <Input
              value={currency}
              readOnly
              className="bg-zinc-900/70 border-white/10 text-zinc-400 cursor-not-allowed"
            />
          </div>

          {/* Dirección solo visible para Owner */}
          {role === "owner" && (
            <div className="space-y-1">
              <label className="text-sm text-zinc-400">Dirección</label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="bg-zinc-900/70 border-white/10 text-zinc-200"
              />
            </div>
          )}

          {/* Cuota editable */}
          <div className="space-y-1">
            <label className="text-sm text-zinc-400">Cuota mensual</label>
            <Input
              type="number"
              value={defaultFee}
              onChange={(e) => setDefaultFee(Number(e.target.value))}
              className="bg-zinc-900/70 border-white/10 focus:ring-amber-400/50"
            />
          </div>

          <div className="pt-2 flex justify-center">
            <Button
              onClick={save}
              className="px-6 bg-amber-400/90 text-black font-medium hover:bg-amber-300"
            >
              Guardar cambios
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
