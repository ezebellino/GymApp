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

const DEFAULT_SETTINGS: AppSettings = {
  gym_name: "Mini Espacio",
  admin_name: "Fabian Aguirre (Manga)",
  // Legacy/deprecado (ver types.ts): el tema es ahora una preferencia del
  // usuario, no del negocio; este valor no se lee ni se envia.
  theme_preference: null,
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

const outlineButtonClass =
  "border-border bg-surface-2/40 text-foreground hover:border-primary/30 hover:bg-surface-2/70";

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
      className={`flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-border bg-surface-2/20 p-4 ${disabled ? "opacity-70" : "hover:bg-surface-2/40"}`}
    >
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 accent-primary"
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
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const canEdit = role === "owner";

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get<AppSettings>("/settings");
        const next = normalizeSettings({ ...DEFAULT_SETTINGS, ...data });
        setSettings(next);
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

  async function save() {
    setSaving(true);
    try {
      // `theme_preference` quedó legacy (ver types.ts): no viaja en el PUT.
      const { theme_preference: _themePreference, ...payload } = settings;
      const { data } = await api.put<AppSettings>("/settings", payload);
      const next = normalizeSettings({ ...DEFAULT_SETTINGS, ...data });
      setSettings(next);
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
      <div className="grid min-h-screen place-items-center text-muted-foreground">
        Cargando configuracion...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="hero-aura rounded-xl border border-border p-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-label-caps uppercase text-primary">
          Ajustes del negocio
        </div>
        <h1 className="warm-accent-text font-display mt-4 text-3xl font-extrabold md:text-headline-hero">
          Convertí la configuración en una herramienta de operación real.
        </h1>
        <p className="mt-3 max-w-2xl text-body-md text-muted-foreground md:text-body-lg">
          Acá definís la información que el equipo necesita para cobrar, atender
          consultas y sostener una rutina diaria más ordenada.
        </p>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <Card className="border-border bg-surface-1">
            <CardHeader className="border-b border-border pb-5">
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Building2 className="h-5 w-5" />
                Identidad y contacto del gimnasio
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-6 pt-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">Nombre del gimnasio</label>
                  <Input
                    value={settings.gym_name}
                    disabled={!canEdit}
                    onChange={(e) => updateField("gym_name", e.target.value)}
                    className="border-border bg-surface-1/70 text-foreground focus-visible:ring-ring"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">Administrador</label>
                  <Input
                    value={settings.admin_name ?? ""}
                    disabled={!canEdit}
                    onChange={(e) => updateField("admin_name", e.target.value)}
                    className="border-border bg-surface-1/70 text-foreground focus-visible:ring-ring"
                    placeholder="Fabian Aguirre (Manga)"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">Moneda</label>
                  <Input
                    value={settings.currency}
                    disabled={!canEdit}
                    onChange={(e) => updateField("currency", e.target.value.toUpperCase())}
                    className="border-border bg-surface-1/70 text-foreground focus-visible:ring-ring"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Direccion del negocio</label>
                <Input
                  value={settings.address ?? ""}
                  disabled={!canEdit}
                  onChange={(e) => updateField("address", e.target.value)}
                  className="border-border bg-surface-1/70 text-foreground focus-visible:ring-ring"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">Email de contacto</label>
                  <Input
                    type="email"
                    value={settings.contact_email ?? ""}
                    disabled={!canEdit}
                    onChange={(e) => updateField("contact_email", e.target.value)}
                    className="border-border bg-surface-1/70 text-foreground focus-visible:ring-ring"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">Telefono</label>
                  <Input
                    value={settings.contact_phone ?? ""}
                    disabled={!canEdit}
                    onChange={(e) => updateField("contact_phone", e.target.value)}
                    className="border-border bg-surface-1/70 text-foreground focus-visible:ring-ring"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">WhatsApp</label>
                  <Input
                    id="whatsapp_phone"
                    value={settings.whatsapp_phone ?? ""}
                    disabled={!canEdit}
                    onChange={(e) => updateField("whatsapp_phone", e.target.value)}
                    className="border-border bg-surface-1/70 text-foreground focus-visible:ring-ring"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Horario visible</label>
                <Input
                  value={settings.business_hours ?? ""}
                  disabled={!canEdit}
                  onChange={(e) => updateField("business_hours", e.target.value)}
                  className="border-border bg-surface-1/70 text-foreground focus-visible:ring-ring"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-surface-1">
            <CardHeader className="border-b border-border pb-5">
              <CardTitle className="flex items-center gap-2 text-foreground">
                <CreditCard className="h-5 w-5" />
                Cobranza y medios de pago
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-6 pt-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">Cuota mensual base</label>
                  <Input
                    type="number"
                    value={settings.default_fee}
                    disabled={!canEdit}
                    onChange={(e) =>
                      updateField("default_fee", Number(e.target.value) || 0)
                    }
                    className="border-border bg-surface-1/70 text-foreground focus-visible:ring-ring"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">Dias de tolerancia</label>
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
                    className="border-border bg-surface-1/70 text-foreground focus-visible:ring-ring"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Alias o referencia bancaria</label>
                <Input
                  value={settings.payment_alias ?? ""}
                  disabled={!canEdit}
                  onChange={(e) => updateField("payment_alias", e.target.value)}
                  className="border-border bg-surface-1/70 text-foreground focus-visible:ring-ring"
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
                <label className="text-sm text-muted-foreground">Aclaraciones de pago</label>
                <textarea
                  value={settings.payment_notes ?? ""}
                  disabled={!canEdit}
                  onChange={(e) => updateField("payment_notes", e.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-border bg-surface-2/40 px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-70"
                  placeholder="Ej: enviar comprobante por WhatsApp, horarios de caja, promociones vigentes..."
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-surface-1">
            <CardHeader className="border-b border-border pb-5">
              <CardTitle className="flex items-center gap-2 text-foreground">
                <MessageSquareText className="h-5 w-5" />
                Mensaje de recordatorio de pago
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-4 pt-6">
              <p className="text-sm leading-6 text-muted-foreground">
                Este texto se usa para los recordatorios mensuales por WhatsApp.
                Puedes incluir placeholders: <span className="text-foreground">{`{client_name}`}</span>,{" "}
                <span className="text-foreground">{`{gym_name}`}</span>,{" "}
                <span className="text-foreground">{`{amount}`}</span>,{" "}
                <span className="text-foreground">{`{grace_days}`}</span> y{" "}
                <span className="text-foreground">{`{payment_alias}`}</span>.
              </p>
              <textarea
                value={settings.payment_reminder_message ?? ""}
                disabled={!canEdit}
                onChange={(e) => updateField("payment_reminder_message", e.target.value)}
                rows={7}
                className="w-full rounded-xl border border-border bg-surface-2/40 px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-70"
                placeholder="Escribe el mensaje base para los recordatorios de pago."
              />
              <div className="rounded-xl border border-border bg-surface-2/20 p-4 text-sm text-muted-foreground">
                Último envío registrado:{" "}
                <span className="font-medium text-foreground">
                  {settings.payment_reminder_last_sent_at
                    ? new Date(settings.payment_reminder_last_sent_at).toLocaleString("es-AR")
                    : "Todavía no se registró"}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-border bg-surface-1/60">
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="text-foreground">Vista previa del negocio</CardTitle>
            </CardHeader>

            <CardContent className="space-y-4 pt-6">
              <div className="warm-accent-bg rounded-xl border border-primary/20 p-4">
                <p className="text-lg font-semibold text-foreground">{settings.gym_name}</p>
                <p className="mt-1 text-sm text-primary/85">
                  Administra: {settings.admin_name || "Sin responsable definido"}
                </p>
                <div className="mt-4 space-y-3 text-sm text-muted-foreground">
                  <div className="flex items-start gap-3">
                    <MapPin className="mt-0.5 h-4 w-4 text-primary" />
                    <span>{settings.address || "Sin direccion cargada"}</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Mail className="mt-0.5 h-4 w-4 text-primary" />
                    <span>{settings.contact_email || "Sin email de contacto"}</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Phone className="mt-0.5 h-4 w-4 text-primary" />
                    <span>{settings.contact_phone || "Sin teléfono principal"}</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Clock3 className="mt-0.5 h-4 w-4 text-primary" />
                    <span>{settings.business_hours || "Sin horario visible"}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-surface-2/20 p-4">
                <div className="mb-3 flex items-center gap-2 text-foreground">
                  <Landmark className="h-4 w-4" />
                  Cobranza
                </div>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    Cuota base:{" "}
                    <span className="font-medium text-foreground">
                      {settings.currency} {settings.default_fee.toLocaleString("es-AR")}
                    </span>
                  </p>
                  <p>
                    Medios activos:{" "}
                    <span className="font-medium text-foreground">
                      {paymentMethodsSummary}
                    </span>
                  </p>
                  <p>
                    Alias:{" "}
                    <span className="font-medium text-foreground">
                      {settings.payment_alias || "No definido"}
                    </span>
                  </p>
                  <p>
                    Tolerancia:{" "}
                    <span className="font-medium text-foreground">
                      {settings.late_fee_grace_days} días
                    </span>
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-surface-2/20 p-4 text-sm leading-6 text-muted-foreground">
                <div className="mb-2 flex items-center gap-2 text-foreground">
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
                className={`w-full ${outlineButtonClass} disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <MessageSquareText className="mr-2 h-4 w-4" />
                Ver recordatorio en WhatsApp
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border bg-surface-1/60">
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="text-foreground">Resumen rápido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-6 text-sm text-muted-foreground">
              <p>
                Responsable:{" "}
                <span className="font-medium text-foreground">
                  {settings.admin_name || "No cargado"}
                </span>
              </p>
              <p>
                WhatsApp principal:{" "}
                {settings.whatsapp_phone ? (
                  <span className="font-medium text-foreground">
                    {settings.whatsapp_phone}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={focusWhatsappField}
                    className="font-medium text-primary underline-offset-2 hover:underline"
                  >
                    Completar WhatsApp
                  </button>
                )}
              </p>
              <p>
                Recordatorio mensual:{" "}
                <span className="font-medium text-foreground">
                  {settings.payment_reminder_message
                    ? "Configurado"
                    : "Pendiente de definir"}
                </span>
              </p>
              <p>
                Estado de edicion:{" "}
                <span className="font-medium text-foreground">
                  {canEdit ? "Editable por Dueño" : "Solo lectura para Coach"}
                </span>
              </p>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button
              onClick={save}
              disabled={saving || !canEdit}
              className="px-6 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
