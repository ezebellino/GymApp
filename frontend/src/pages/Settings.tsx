import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import api from "@/lib/http";
import type { Role } from "@/types";
import { alertError, alertSuccess } from "@/lib/alerts";

type AppSettings = {
  gym_name: string;
  currency: string;
  default_fee: number;
  address: string;
};

const LS_KEY = "app_settings";

export default function SettingsPage() {
  const [role, setRole] = useState<Role>("coach");
  const [settings, setSettings] = useState<AppSettings>({
    gym_name: "Libre Funcional",
    currency: "ARS",
    default_fee: 24000,
    address: "Av. San Martín 325 - Dolores",
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Cargar rol y settings
  useEffect(() => {
    const storedRole = (localStorage.getItem("user_role") as Role) || "coach";
    setRole(storedRole);

    (async () => {
      try {
        // 1) Intentar backend
        const { data } = await api.get<AppSettings>("/settings");
        setSettings(data);
        // Actualizar cache local
        localStorage.setItem(LS_KEY, JSON.stringify(data));
      } catch {
        // 2) Fallback: localStorage
        const raw = localStorage.getItem(LS_KEY);
        if (raw) {
          try {
            setSettings(JSON.parse(raw));
          } catch {
            // usar defaults
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function save() {
    setSaving(true);
    try {
      // Primero intentamos persistir en backend
      const payload = { ...settings };
      const { data } = await api.put<AppSettings>("/settings", payload);
      setSettings(data);
      localStorage.setItem(LS_KEY, JSON.stringify(data));
      await alertSuccess("Listo", "Configuración guardada.");
    } catch (e: any) {
      // Si falla backend, guardamos local y avisamos
      localStorage.setItem(LS_KEY, JSON.stringify(settings));
      alertError(
        "Guardado local",
        "No se pudo conectar al servidor. Los cambios se guardaron de forma local y se sincronizarán luego."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center text-zinc-400">
        Cargando configuración…
      </div>
    );
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
          {/* Nombre (solo lectura) */}
          <div className="space-y-1">
            <label className="text-sm text-zinc-400">Nombre del Gimnasio</label>
            <Input
              value={settings.gym_name}
              readOnly
              className="bg-zinc-900/70 border-white/10 text-zinc-400 cursor-not-allowed"
            />
          </div>

          {/* Moneda (solo lectura) */}
          <div className="space-y-1">
            <label className="text-sm text-zinc-400">Moneda</label>
            <Input
              value={settings.currency}
              readOnly
              className="bg-zinc-900/70 border-white/10 text-zinc-400 cursor-not-allowed"
            />
          </div>

          {/* Dirección (solo Owner) */}
          {role === "owner" && (
            <div className="space-y-1">
              <label className="text-sm text-zinc-400">Dirección</label>
              <Input
                value={settings.address}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, address: e.target.value }))
                }
                className="bg-zinc-900/70 border-white/10 text-zinc-200"
              />
            </div>
          )}

          {/* Cuota editable */}
          <div className="space-y-1">
            <label className="text-sm text-zinc-400">Cuota mensual</label>
            <Input
              type="number"
              value={settings.default_fee}
              onChange={(e) =>
                setSettings((s) => ({ ...s, default_fee: Number(e.target.value) || 0 }))
              }
              className="bg-zinc-900/70 border-white/10 focus:ring-amber-400/50"
            />
          </div>

          <div className="pt-2 flex justify-center">
            <Button
              onClick={save}
              disabled={saving}
              className="px-6 bg-amber-400/90 text-black font-medium hover:bg-amber-300"
            >
              {saving ? "Guardando…" : "Guardar cambios"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
