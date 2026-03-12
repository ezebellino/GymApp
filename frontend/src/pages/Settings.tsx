import { useState, useEffect } from "react";
import { Building2, MapPin, Settings2, Wallet } from "lucide-react";
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

function roleLabel(role: Role) {
  return role === "owner" ? "Dueño" : "Coach";
}

function InfoCard({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: typeof Building2;
}) {
  return (
    <div className="rounded-[24px] border border-amber-200/10 bg-[linear-gradient(135deg,rgba(250,204,21,0.08),rgba(255,255,255,0.02)_50%,rgba(249,115,22,0.09))] p-5">
      <div className="flex items-start gap-4">
        <div className="rounded-2xl bg-[linear-gradient(135deg,rgba(250,204,21,0.2),rgba(255,247,237,0.08),rgba(249,115,22,0.22))] p-3 text-amber-50">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-zinc-100">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">{description}</p>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [role, setRole] = useState<Role>("coach");
  const [settings, setSettings] = useState<AppSettings>({
    gym_name: "Libre Funcional",
    currency: "ARS",
    default_fee: 24000,
    address: "Av. San Martin 325 - Dolores",
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedRole = (localStorage.getItem("user_role") as Role) || "coach";
    setRole(storedRole);

    (async () => {
      try {
        const { data } = await api.get<AppSettings>("/settings");
        setSettings(data);
        localStorage.setItem(LS_KEY, JSON.stringify(data));
      } catch {
        const raw = localStorage.getItem(LS_KEY);
        if (raw) {
          try {
            setSettings(JSON.parse(raw));
          } catch {
            // no-op
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
      const payload = { ...settings };
      const { data } = await api.put<AppSettings>("/settings", payload);
      setSettings(data);
      localStorage.setItem(LS_KEY, JSON.stringify(data));
      await alertSuccess("Listo", "Configuracion guardada.");
    } catch {
      localStorage.setItem(LS_KEY, JSON.stringify(settings));
      await alertError(
        "Guardado local",
        "No se pudo conectar al servidor. Los cambios quedaron guardados localmente."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center text-zinc-400">
        Cargando configuracion...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-4 lg:grid-cols-[1.45fr_0.95fr]">
        <div className="rounded-[28px] border border-amber-200/10 bg-[linear-gradient(135deg,rgba(250,204,21,0.1),rgba(255,247,237,0.03)_45%,rgba(249,115,22,0.11))] p-6 shadow-[0_20px_80px_-40px_rgba(249,115,22,0.42)]">
          <div className="inline-flex rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-amber-100">
            Ajustes del negocio
          </div>
          <h1 className="warm-accent-text mt-4 text-3xl font-semibold tracking-tight md:text-4xl">
            Configura los datos operativos del gimnasio.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400 md:text-base">
            Define la identidad del negocio, la direccion visible y la cuota base
            usada como referencia comercial.
          </p>
        </div>

        <div className="rounded-[28px] border border-amber-200/10 bg-white/[0.035] p-6 backdrop-blur-xl">
          <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">
            Contexto
          </p>
          <div className="mt-4 space-y-4">
            <div>
              <p className="text-sm text-zinc-400">Perfil activo</p>
              <p className="text-lg font-semibold text-zinc-100">
                {roleLabel(role)}
              </p>
            </div>
            <div className="rounded-2xl border border-amber-300/20 bg-[linear-gradient(90deg,rgba(250,204,21,0.12),rgba(255,247,237,0.05),rgba(249,115,22,0.12))] p-4 text-sm text-amber-50">
              {role === "owner"
                ? "Puedes ajustar los datos principales del negocio y la direccion operativa."
                : "Puedes consultar la configuracion vigente y la cuota base activa."}
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <InfoCard
          title="Identidad comercial"
          description="Define como se presenta el gimnasio en la operacion diaria y en la referencia interna."
          icon={Building2}
        />
        <InfoCard
          title="Direccion operativa"
          description="Util para recepcion, pagos presenciales y comunicacion con clientes."
          icon={MapPin}
        />
        <InfoCard
          title="Cuota base"
          description="Sirve como referencia rapida para orden comercial y seguimiento de cobros."
          icon={Wallet}
        />
      </section>

      <Card className="rounded-[28px] border-amber-200/10 bg-zinc-900/60 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_10px_30px_-10px_rgba(0,0,0,0.6)] backdrop-blur-xl">
        <CardHeader className="border-b border-amber-200/10 pb-5">
          <CardTitle className="text-zinc-100">
            Configuracion principal del gimnasio
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6 pt-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm text-zinc-400">Nombre del gimnasio</label>
              <Input
                value={settings.gym_name}
                readOnly
                className="cursor-not-allowed border-amber-200/10 bg-zinc-900/70 text-zinc-400"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-zinc-400">Moneda</label>
              <Input
                value={settings.currency}
                readOnly
                className="cursor-not-allowed border-amber-200/10 bg-zinc-900/70 text-zinc-400"
              />
            </div>
          </div>

          {role === "owner" && (
            <div className="space-y-2">
              <label className="text-sm text-zinc-400">Direccion del negocio</label>
              <Input
                value={settings.address}
                onChange={(e) =>
                  setSettings((current) => ({
                    ...current,
                    address: e.target.value,
                  }))
                }
                className="border-amber-200/10 bg-zinc-900/70 text-zinc-200 focus-visible:ring-amber-400/35"
              />
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm text-zinc-400">Cuota mensual de referencia</label>
            <Input
              type="number"
              value={settings.default_fee}
              onChange={(e) =>
                setSettings((current) => ({
                  ...current,
                  default_fee: Number(e.target.value) || 0,
                }))
              }
              className="border-amber-200/10 bg-zinc-900/70 text-zinc-200 focus-visible:ring-amber-400/35"
            />
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm leading-6 text-zinc-400">
            <div className="mb-2 flex items-center gap-2 text-zinc-200">
              <Settings2 className="h-4 w-4" />
              Impacto operativo
            </div>
            <p>
              Esta configuracion afecta la referencia comercial del gimnasio y la
              informacion que visualiza el equipo al trabajar con clientes y cobros.
            </p>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              onClick={save}
              disabled={saving}
              className="border border-amber-300/25 bg-[linear-gradient(90deg,#facc15_0%,#fff7ed_48%,#f97316_100%)] px-6 font-medium text-black hover:opacity-95"
            >
              {saving ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
