import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  Clock3,
  CreditCard,
  Landmark,
  Mail,
  MapPin,
  MessageSquareText,
  Phone,
  Settings2,
  Wallet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import api from "@/lib/http";
import type { AppSettings, Role } from "@/types";
import { alertError, alertSuccess } from "@/lib/alerts";

const LS_KEY = "app_settings";

const DEFAULT_SETTINGS: AppSettings = {
  gym_name: "Mini Espacio",
  currency: "ARS",
  default_fee: 24000,
  address: "Av. San Martin 325 - Dolores",
  contact_email: "owner@miniespacio.com",
  contact_phone: "11 5555 5555",
  whatsapp_phone: "11 5555 5555",
  business_hours: "Lunes a viernes de 7 a 22 hs. Sabados de 9 a 13 hs.",
  payment_alias: "MINI.ESPACIO.GYM",
  payment_notes:
    "Aceptamos efectivo y transferencia. Confirmar pagos con comprobante.",
  late_fee_grace_days: 5,
  allow_cash: true,
  allow_transfer: true,
  onboarding_message:
    "Bienvenido a Mini Espacio. Ante dudas sobre pagos, asistencias o rutinas, consulta en recepción.",
};

function roleLabel(role: Role) {
  return role === "owner" ? "Dueño" : "Coach";
}

function normalizeSettings(settings: AppSettings): AppSettings {
  return {
    ...settings,
    gym_name:
      settings.gym_name === "Libre Funcional" ? "Mini Espacio" : settings.gym_name,
    contact_email:
      settings.contact_email === "owner@librefuncional.com"
        ? "owner@miniespacio.com"
        : settings.contact_email,
    payment_alias:
      settings.payment_alias === "LIBRE.FUNCIONAL.GYM"
        ? "MINI.ESPACIO.GYM"
        : settings.payment_alias,
    onboarding_message:
      settings.onboarding_message ===
      "Bienvenido a Libre Funcional. Ante dudas sobre pagos o asistencias, consulta en recepcion."
        ? "Bienvenido a Mini Espacio. Ante dudas sobre pagos, asistencias o rutinas, consulta en recepción."
        : settings.onboarding_message,
  };
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

function ToggleCard({
  title,
  description,
  checked,
  disabled,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start justify-between gap-4 rounded-2xl border border-amber-200/10 bg-white/[0.03] p-4 ${disabled ? "opacity-70" : "hover:bg-white/[0.05]"}`}
    >
      <div>
        <p className="text-sm font-medium text-zinc-100">{title}</p>
        <p className="mt-1 text-sm leading-6 text-zinc-400">{description}</p>
      </div>
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 accent-amber-400"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

export default function SettingsPage() {
  const [role, setRole] = useState<Role>("coach");
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const canEdit = role === "owner";

  useEffect(() => {
    const storedRole = (localStorage.getItem("user_role") as Role) || "coach";
    setRole(storedRole);

    (async () => {
      try {
        const { data } = await api.get<AppSettings>("/settings");
        const next = normalizeSettings({ ...DEFAULT_SETTINGS, ...data });
        setSettings(next);
        localStorage.setItem(LS_KEY, JSON.stringify(next));
      } catch {
        const raw = localStorage.getItem(LS_KEY);
        if (raw) {
          try {
            setSettings(normalizeSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) }));
          } catch {
            setSettings(DEFAULT_SETTINGS);
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function updateField<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setSettings((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function save() {
    setSaving(true);
    try {
      const payload = { ...settings };
      const { data } = await api.put<AppSettings>("/settings", payload);
      const next = normalizeSettings({ ...DEFAULT_SETTINGS, ...data });
      setSettings(next);
      localStorage.setItem(LS_KEY, JSON.stringify(next));
      window.dispatchEvent(new Event("app-settings:updated"));
      await alertSuccess("Listo", "Configuración guardada.");
    } catch {
      localStorage.setItem(LS_KEY, JSON.stringify(settings));
      window.dispatchEvent(new Event("app-settings:updated"));
      await alertError(
        "Guardado local",
        "No se pudo conectar al servidor. Los cambios quedaron guardados localmente."
      );
    } finally {
      setSaving(false);
    }
  }

  const paymentMethodsSummary = useMemo(() => {
    const methods: string[] = [];
    if (settings.allow_cash) methods.push("efectivo");
    if (settings.allow_transfer) methods.push("transferencia");
    return methods.length ? methods.join(" y ") : "sin medios configurados";
  }, [settings.allow_cash, settings.allow_transfer]);

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
            Convertí la configuración en una herramienta de operación real.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400 md:text-base">
            Acá definís la información que el equipo necesita para cobrar, atender
            consultas y sostener una rutina diaria más ordenada.
          </p>
        </div>

        <div className="rounded-[28px] border border-amber-200/10 bg-white/[0.035] p-6 backdrop-blur-xl">
          <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">
            Contexto operativo
          </p>
          <div className="mt-4 space-y-4">
            <div>
              <p className="text-sm text-zinc-400">Perfil activo</p>
              <p className="text-lg font-semibold text-zinc-100">
                {roleLabel(role)}
              </p>
            </div>
            <div>
              <p className="text-sm text-zinc-400">Cuota base actual</p>
              <p className="text-lg font-semibold text-zinc-100">
                {settings.currency} {settings.default_fee.toLocaleString("es-AR")}
              </p>
            </div>
            <div className="rounded-2xl border border-amber-300/20 bg-[linear-gradient(90deg,rgba(250,204,21,0.12),rgba(255,247,237,0.05),rgba(249,115,22,0.12))] p-4 text-sm text-amber-50">
              {canEdit
                ? `Hoy tenés configurado ${paymentMethodsSummary} y ${settings.late_fee_grace_days} días de tolerancia para cobranzas.`
                : "Podés consultar la configuración vigente del gimnasio, sus medios de cobro y el mensaje operativo actual."}
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <InfoCard
          title="Identidad y contacto"
          description="Centraliza nombre comercial, direccion y canales para que recepcion y coaches manejen la misma informacion."
          icon={Building2}
        />
        <InfoCard
          title="Cobranza operativa"
          description="Define cuota base, tolerancia y metodos de pago para que el criterio comercial sea consistente."
          icon={Wallet}
        />
        <InfoCard
          title="Mensaje interno"
          description="Dejá un texto base para recepción o seguimiento diario, útil al recibir nuevos clientes o responder consultas."
          icon={MessageSquareText}
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <Card className="rounded-[28px] border-amber-200/10 bg-zinc-900/60 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_10px_30px_-10px_rgba(0,0,0,0.6)] backdrop-blur-xl">
            <CardHeader className="border-b border-amber-200/10 pb-5">
              <CardTitle className="flex items-center gap-2 text-zinc-100">
                <Building2 className="h-5 w-5" />
                Identidad y contacto del gimnasio
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-6 pt-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm text-zinc-400">Nombre del gimnasio</label>
                  <Input
                    value={settings.gym_name}
                    disabled={!canEdit}
                    onChange={(e) => updateField("gym_name", e.target.value)}
                    className="border-amber-200/10 bg-zinc-900/70 text-zinc-200 focus-visible:ring-amber-400/35"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-zinc-400">Moneda</label>
                  <Input
                    value={settings.currency}
                    disabled={!canEdit}
                    onChange={(e) => updateField("currency", e.target.value.toUpperCase())}
                    className="border-amber-200/10 bg-zinc-900/70 text-zinc-200 focus-visible:ring-amber-400/35"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-zinc-400">Direccion del negocio</label>
                <Input
                  value={settings.address ?? ""}
                  disabled={!canEdit}
                  onChange={(e) => updateField("address", e.target.value)}
                  className="border-amber-200/10 bg-zinc-900/70 text-zinc-200 focus-visible:ring-amber-400/35"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-sm text-zinc-400">Email de contacto</label>
                  <Input
                    type="email"
                    value={settings.contact_email ?? ""}
                    disabled={!canEdit}
                    onChange={(e) => updateField("contact_email", e.target.value)}
                    className="border-amber-200/10 bg-zinc-900/70 text-zinc-200 focus-visible:ring-amber-400/35"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-zinc-400">Telefono</label>
                  <Input
                    value={settings.contact_phone ?? ""}
                    disabled={!canEdit}
                    onChange={(e) => updateField("contact_phone", e.target.value)}
                    className="border-amber-200/10 bg-zinc-900/70 text-zinc-200 focus-visible:ring-amber-400/35"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-zinc-400">WhatsApp</label>
                  <Input
                    value={settings.whatsapp_phone ?? ""}
                    disabled={!canEdit}
                    onChange={(e) => updateField("whatsapp_phone", e.target.value)}
                    className="border-amber-200/10 bg-zinc-900/70 text-zinc-200 focus-visible:ring-amber-400/35"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-zinc-400">Horario visible</label>
                <Input
                  value={settings.business_hours ?? ""}
                  disabled={!canEdit}
                  onChange={(e) => updateField("business_hours", e.target.value)}
                  className="border-amber-200/10 bg-zinc-900/70 text-zinc-200 focus-visible:ring-amber-400/35"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[28px] border-amber-200/10 bg-zinc-900/60 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_10px_30px_-10px_rgba(0,0,0,0.6)] backdrop-blur-xl">
            <CardHeader className="border-b border-amber-200/10 pb-5">
              <CardTitle className="flex items-center gap-2 text-zinc-100">
                <CreditCard className="h-5 w-5" />
                Cobranza y medios de pago
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-6 pt-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm text-zinc-400">Cuota mensual base</label>
                  <Input
                    type="number"
                    value={settings.default_fee}
                    disabled={!canEdit}
                    onChange={(e) =>
                      updateField("default_fee", Number(e.target.value) || 0)
                    }
                    className="border-amber-200/10 bg-zinc-900/70 text-zinc-200 focus-visible:ring-amber-400/35"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-zinc-400">Dias de tolerancia</label>
                  <Input
                    type="number"
                    value={settings.late_fee_grace_days}
                    disabled={!canEdit}
                    onChange={(e) =>
                      updateField(
                        "late_fee_grace_days",
                        Math.max(0, Number(e.target.value) || 0)
                      )
                    }
                    className="border-amber-200/10 bg-zinc-900/70 text-zinc-200 focus-visible:ring-amber-400/35"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-zinc-400">Alias o referencia bancaria</label>
                <Input
                  value={settings.payment_alias ?? ""}
                  disabled={!canEdit}
                  onChange={(e) => updateField("payment_alias", e.target.value)}
                  className="border-amber-200/10 bg-zinc-900/70 text-zinc-200 focus-visible:ring-amber-400/35"
                  placeholder="Ej: MINI.ESPACIO.GYM"
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <ToggleCard
                  title="Aceptar efectivo"
                  description="Ideal para recepcion y cobros presenciales en el gimnasio."
                  checked={settings.allow_cash}
                  disabled={!canEdit}
                  onChange={(next) => updateField("allow_cash", next)}
                />
                <ToggleCard
                  title="Aceptar transferencia"
                  description="Habilita cobro por alias o cuenta bancaria como opcion habitual."
                  checked={settings.allow_transfer}
                  disabled={!canEdit}
                  onChange={(next) => updateField("allow_transfer", next)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-zinc-400">Aclaraciones de pago</label>
                <textarea
                  value={settings.payment_notes ?? ""}
                  disabled={!canEdit}
                  onChange={(e) => updateField("payment_notes", e.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-amber-200/10 bg-zinc-900/70 px-3 py-2 text-sm text-zinc-200 outline-none transition focus:border-amber-300/25 focus:ring-2 focus:ring-amber-400/25 disabled:cursor-not-allowed disabled:opacity-70"
                  placeholder="Ej: enviar comprobante por WhatsApp, horarios de caja, promociones vigentes..."
                />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[28px] border-amber-200/10 bg-zinc-900/60 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_10px_30px_-10px_rgba(0,0,0,0.6)] backdrop-blur-xl">
            <CardHeader className="border-b border-amber-200/10 pb-5">
              <CardTitle className="flex items-center gap-2 text-zinc-100">
                <MessageSquareText className="h-5 w-5" />
                Mensaje operativo y de recepcion
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-4 pt-6">
              <p className="text-sm leading-6 text-zinc-400">
                Este mensaje puede servir como base para recepcion, coaches o
                comunicacion con clientes nuevos.
              </p>
              <textarea
                value={settings.onboarding_message ?? ""}
                disabled={!canEdit}
                onChange={(e) => updateField("onboarding_message", e.target.value)}
                rows={5}
                className="w-full rounded-xl border border-amber-200/10 bg-zinc-900/70 px-3 py-2 text-sm text-zinc-200 outline-none transition focus:border-amber-300/25 focus:ring-2 focus:ring-amber-400/25 disabled:cursor-not-allowed disabled:opacity-70"
                placeholder="Escribe un mensaje base para nuevos clientes o recordatorios operativos."
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="rounded-[28px] border-amber-200/10 bg-white/[0.035] backdrop-blur-xl">
            <CardHeader className="border-b border-amber-200/10 pb-4">
              <CardTitle className="text-zinc-100">Vista previa del negocio</CardTitle>
            </CardHeader>

            <CardContent className="space-y-4 pt-6">
              <div className="rounded-2xl border border-amber-300/20 bg-[linear-gradient(180deg,rgba(250,204,21,0.08),rgba(255,247,237,0.02),rgba(249,115,22,0.12))] p-4">
                <p className="text-lg font-semibold text-zinc-50">{settings.gym_name}</p>
                <div className="mt-4 space-y-3 text-sm text-zinc-300">
                  <div className="flex items-start gap-3">
                    <MapPin className="mt-0.5 h-4 w-4 text-amber-200" />
                    <span>{settings.address || "Sin direccion cargada"}</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Mail className="mt-0.5 h-4 w-4 text-amber-200" />
                    <span>{settings.contact_email || "Sin email de contacto"}</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Phone className="mt-0.5 h-4 w-4 text-amber-200" />
                    <span>{settings.contact_phone || "Sin teléfono principal"}</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Clock3 className="mt-0.5 h-4 w-4 text-amber-200" />
                    <span>{settings.business_hours || "Sin horario visible"}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="mb-3 flex items-center gap-2 text-zinc-100">
                  <Landmark className="h-4 w-4" />
                  Cobranza
                </div>
                <div className="space-y-2 text-sm text-zinc-400">
                  <p>
                    Cuota base:{" "}
                    <span className="font-medium text-zinc-100">
                      {settings.currency} {settings.default_fee.toLocaleString("es-AR")}
                    </span>
                  </p>
                  <p>
                    Medios activos:{" "}
                    <span className="font-medium text-zinc-100">
                      {paymentMethodsSummary}
                    </span>
                  </p>
                  <p>
                    Alias:{" "}
                    <span className="font-medium text-zinc-100">
                      {settings.payment_alias || "No definido"}
                    </span>
                  </p>
                  <p>
                    Tolerancia:{" "}
                    <span className="font-medium text-zinc-100">
                      {settings.late_fee_grace_days} días
                    </span>
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm leading-6 text-zinc-400">
                <div className="mb-2 flex items-center gap-2 text-zinc-200">
                  <Settings2 className="h-4 w-4" />
                  Impacto operativo
                </div>
                <p>
                  Esta configuracion afecta lo que el equipo consulta para cobrar,
                  responder dudas y sostener la experiencia diaria del gimnasio.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[28px] border-amber-200/10 bg-white/[0.035] backdrop-blur-xl">
            <CardHeader className="border-b border-amber-200/10 pb-4">
              <CardTitle className="text-zinc-100">Resumen rápido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-6 text-sm text-zinc-400">
              <p>
                WhatsApp principal:{" "}
                <span className="font-medium text-zinc-100">
                  {settings.whatsapp_phone || "No cargado"}
                </span>
              </p>
              <p>
                Mensaje de recepcion:{" "}
                <span className="font-medium text-zinc-100">
                  {settings.onboarding_message
                    ? "Configurado"
                    : "Pendiente de definir"}
                </span>
              </p>
              <p>
                Estado de edicion:{" "}
                <span className="font-medium text-zinc-100">
                  {canEdit ? "Editable por Dueño" : "Solo lectura para Coach"}
                </span>
              </p>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button
              onClick={save}
              disabled={saving || !canEdit}
              className="border border-amber-300/25 bg-[linear-gradient(90deg,#facc15_0%,#fff7ed_48%,#f97316_100%)] px-6 font-medium text-black hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
