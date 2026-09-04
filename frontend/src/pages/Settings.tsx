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
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import api from "@/lib/http";
import { useSessionStore } from "@/stores/session";
import { useSettingsStore } from "@/stores/settings";
import type { AppSettings } from "@/types";
import { alertError, alertSuccess } from "@/lib/alerts";
import {
  APP_THEMES,
  applyTheme,
  DEFAULT_THEME_ID,
  getStoredTheme,
  type AppThemeId,
} from "@/lib/theme";

const DEFAULT_SETTINGS: AppSettings = {
  gym_name: "Mini Espacio",
  admin_name: "Fabian Aguirre (Manga)",
  theme_preference: "dark-gold",
  currency: "ARS",
  default_fee: 30000,
  address: "Av. San Martin 325 - Dolores",
  contact_email: "owner@miniespacio.com",
  contact_phone: "11 5555 5555",
  whatsapp_phone: "11 5555 5555",
  business_hours: "Lunes a viernes de 7 a 22 hs. Sabados de 9 a 13 hs.",
  payment_alias: "MINI.ESPACIO.GYM",
  payment_notes:
    "Aceptamos efectivo y transferencia. Confirmar pagos con comprobante.",
  payment_reminder_message:
    "Hola {client_name}, te recordamos con cariño la cuota mensual de {gym_name}. El valor actual es {amount} y contamos con {grace_days} días de tolerancia para abonarla. Podés transferir al alias {payment_alias}. Si ya pagaste, podés ignorar este mensaje. ¡Gracias!",
  payment_reminder_last_sent_at: null,
  late_fee_grace_days: 5,
  allow_cash: true,
  allow_transfer: true,
  onboarding_message:
    "Bienvenido a Mini Espacio. Ante dudas sobre pagos, asistencias o rutinas, consulta en recepción.",
};

function normalizeSettings(settings: AppSettings): AppSettings {
  return {
    ...settings,
    gym_name:
      settings.gym_name === "Libre Funcional" ? "Mini Espacio" : settings.gym_name,
    admin_name: settings.admin_name || "Fabian Aguirre (Manga)",
    contact_email:
      settings.contact_email === "owner@librefuncional.com"
        ? "owner@miniespacio.com"
        : settings.contact_email,
    payment_alias:
      settings.payment_alias === "LIBRE.FUNCIONAL.GYM"
        ? "MINI.ESPACIO.GYM"
        : settings.payment_alias,
    theme_preference: settings.theme_preference || "dark-gold",
    payment_reminder_message:
      settings.payment_reminder_message ||
      DEFAULT_SETTINGS.payment_reminder_message,
    onboarding_message:
      settings.onboarding_message ===
      "Bienvenido a Libre Funcional. Ante dudas sobre pagos o asistencias, consulta en recepcion."
        ? "Bienvenido a Mini Espacio. Ante dudas sobre pagos, asistencias o rutinas, consulta en recepción."
        : settings.onboarding_message,
  };
}

function buildReminderPreviewMessage(settings: AppSettings) {
  const template =
    settings.payment_reminder_message || DEFAULT_SETTINGS.payment_reminder_message;

  return template
    .replaceAll("{client_name}", "Cliente de ejemplo")
    .replaceAll("{gym_name}", settings.gym_name || "el gimnasio")
    .replaceAll(
      "{amount}",
      `${settings.currency} ${settings.default_fee.toLocaleString("es-AR")}`
    )
    .replaceAll("{grace_days}", String(settings.late_fee_grace_days))
    .replaceAll("{payment_alias}", settings.payment_alias || "sin alias definido");
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
  const role = useSessionStore((s) => s.role) ?? "coach";
  const setSharedSettings = useSettingsStore((s) => s.setSettings);
  const sharedSettings = useSettingsStore((s) => s.settings);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [themeId, setThemeId] = useState<AppThemeId>(DEFAULT_THEME_ID);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const canEdit = role === "owner";

  useEffect(() => {
    setThemeId(getStoredTheme());

    (async () => {
      try {
        const { data } = await api.get<AppSettings>("/settings");
        // El tema es "solo este dispositivo" (copy de la UI, más abajo): el
        // GET no debe pisar la elección ya persistida localmente vía el
        // swatch (`handleThemeChange`) con lo que el servidor tenga guardado,
        // o un simple reload de esta página revertiría un tema recién
        // elegido sin pasar por "Guardar cambios".
        const deviceTheme = sharedSettings.theme_preference || getStoredTheme();
        const next = normalizeSettings({
          ...DEFAULT_SETTINGS,
          ...data,
          theme_preference: deviceTheme,
        });
        setSettings(next);
        setThemeId(deviceTheme as AppThemeId);
        applyTheme(deviceTheme as AppThemeId);
        setSharedSettings(next);
      } catch {
        // Sin servidor: el único escritor de `app_settings` es el store
        // (`useSettingsStore`), así que la caché local se lee ahí en vez de
        // parsear `localStorage` a mano.
        setSettings(normalizeSettings({ ...DEFAULT_SETTINGS, ...sharedSettings }));
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

  function handleThemeChange(nextTheme: AppThemeId) {
    setThemeId(nextTheme);
    updateField("theme_preference", nextTheme);
    applyTheme(nextTheme);
    // El tema es "solo este dispositivo" (copy de la UI, más abajo): a
    // diferencia del resto de los campos, se persiste al toque a través del
    // store en vez de esperar a "Guardar cambios" completo. `setSettings` es
    // el único escritor de `app_settings` (frontend/AGENTS.md); la
    // suscripción de `stores/settings.ts` vuelve a aplicar el tema desde ahí,
    // así que sobrevive a un reload sin pasar por el PUT /settings.
    setSharedSettings({ theme_preference: nextTheme });
  }

  async function save() {
    setSaving(true);
    try {
      const payload = { ...settings };
      const { data } = await api.put<AppSettings>("/settings", payload);
      const next = normalizeSettings({ ...DEFAULT_SETTINGS, ...data });
      setSettings(next);
      setThemeId((next.theme_preference || "dark-gold") as AppThemeId);
      setSharedSettings(next);
      await alertSuccess("Listo", "Configuración guardada.");
    } catch {
      setSharedSettings(settings);
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

  function openReminderPreview() {
    const digits = (settings.whatsapp_phone ?? "").replace(/\D/g, "");
    if (!digits) return;

    const normalizedPhone = digits.startsWith("54") ? digits : `54${digits}`;
    const message = encodeURIComponent(buildReminderPreviewMessage(settings));
    window.open(
      `https://wa.me/${normalizedPhone}?text=${message}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  function focusWhatsappField() {
    document.getElementById("whatsapp_phone")?.focus();
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
      <section className="rounded-[28px] border border-amber-200/10 bg-[linear-gradient(135deg,rgba(250,204,21,0.1),rgba(255,247,237,0.03)_45%,rgba(249,115,22,0.11))] p-6 shadow-[0_20px_80px_-40px_rgba(249,115,22,0.42)]">
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
                  <label className="text-sm text-zinc-400">Administrador</label>
                  <Input
                    value={settings.admin_name ?? ""}
                    disabled={!canEdit}
                    onChange={(e) => updateField("admin_name", e.target.value)}
                    className="border-amber-200/10 bg-zinc-900/70 text-zinc-200 focus-visible:ring-amber-400/35"
                    placeholder="Fabian Aguirre (Manga)"
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
                    id="whatsapp_phone"
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
                Mensaje de recordatorio de pago
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-4 pt-6">
              <p className="text-sm leading-6 text-zinc-400">
                Este texto se usa para los recordatorios mensuales por WhatsApp.
                Puedes incluir placeholders: <span className="text-zinc-200">{`{client_name}`}</span>,{" "}
                <span className="text-zinc-200">{`{gym_name}`}</span>,{" "}
                <span className="text-zinc-200">{`{amount}`}</span>,{" "}
                <span className="text-zinc-200">{`{grace_days}`}</span> y{" "}
                <span className="text-zinc-200">{`{payment_alias}`}</span>.
              </p>
              <textarea
                value={settings.payment_reminder_message ?? ""}
                disabled={!canEdit}
                onChange={(e) => updateField("payment_reminder_message", e.target.value)}
                rows={7}
                className="w-full rounded-xl border border-amber-200/10 bg-zinc-900/70 px-3 py-2 text-sm text-zinc-200 outline-none transition focus:border-amber-300/25 focus:ring-2 focus:ring-amber-400/25 disabled:cursor-not-allowed disabled:opacity-70"
                placeholder="Escribe el mensaje base para los recordatorios de pago."
              />
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-zinc-400">
                Último envío registrado:{" "}
                <span className="font-medium text-zinc-100">
                  {settings.payment_reminder_last_sent_at
                    ? new Date(settings.payment_reminder_last_sent_at).toLocaleString("es-AR")
                    : "Todavía no se registró"}
                </span>
              </div>
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
                <p className="mt-1 text-sm text-amber-100/85">
                  Administra: {settings.admin_name || "Sin responsable definido"}
                </p>
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

              <Button
                type="button"
                variant="outline"
                onClick={openReminderPreview}
                disabled={!settings.whatsapp_phone}
                className="w-full border-amber-200/10 bg-white/[0.04] hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <MessageSquareText className="mr-2 h-4 w-4" />
                Ver recordatorio en WhatsApp
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-[28px] border-amber-200/10 bg-white/[0.035] backdrop-blur-xl">
            <CardHeader className="border-b border-amber-200/10 pb-4">
              <CardTitle className="text-zinc-100">Tema visual</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <p className="text-sm leading-6 text-zinc-400">
                Elegi una paleta cerrada para mantener la app consistente. Por ahora
                este cambio se guarda solo en este dispositivo.
              </p>

              <div className="space-y-3">
                {APP_THEMES.map((theme) => {
                  const isActive = theme.id === themeId;

                  return (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => handleThemeChange(theme.id)}
                      className={`w-full rounded-[24px] border px-4 py-4 text-left transition ${
                        isActive
                          ? "border-amber-300/25 bg-[linear-gradient(135deg,rgba(250,204,21,0.12),rgba(255,247,237,0.04),rgba(249,115,22,0.14))]"
                          : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-zinc-100">{theme.name}</p>
                          <p className="mt-1 text-sm leading-6 text-zinc-400">
                            {theme.description}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className="h-3 w-8 rounded-full"
                            style={{
                              backgroundImage: `linear-gradient(90deg, ${theme.preview.start} 0%, ${theme.preview.mid} 48%, ${theme.preview.end} 100%)`,
                            }}
                          />
                          <span
                            className={`rounded-full border px-2 py-1 text-[11px] uppercase tracking-[0.18em] ${
                              isActive
                                ? "border-amber-300/20 bg-amber-300/10 text-amber-100"
                                : "border-white/10 bg-black/10 text-zinc-400"
                            }`}
                          >
                            {isActive ? "Activo" : theme.shortName}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[28px] border-amber-200/10 bg-white/[0.035] backdrop-blur-xl">
            <CardHeader className="border-b border-amber-200/10 pb-4">
              <CardTitle className="text-zinc-100">Resumen rápido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-6 text-sm text-zinc-400">
              <p>
                Responsable:{" "}
                <span className="font-medium text-zinc-100">
                  {settings.admin_name || "No cargado"}
                </span>
              </p>
              <p>
                WhatsApp principal:{" "}
                {settings.whatsapp_phone ? (
                  <span className="font-medium text-zinc-100">
                    {settings.whatsapp_phone}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={focusWhatsappField}
                    className="font-medium text-amber-200 underline-offset-2 hover:underline"
                  >
                    Completar WhatsApp
                  </button>
                )}
              </p>
              <p>
                Recordatorio mensual:{" "}
                <span className="font-medium text-zinc-100">
                  {settings.payment_reminder_message
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
