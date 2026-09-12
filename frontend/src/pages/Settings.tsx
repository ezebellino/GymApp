import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import api from "@/lib/http";
import { useSessionStore } from "@/stores/session";
import { useSettingsStore, DEFAULT_SETTINGS } from "@/stores/settings";
import type { AppSettings } from "@/types";
import { toastError, toastSuccess } from "@/lib/toast";
import { APP_NAME } from "@/lib/branding";

function normalizeSettings(settings: AppSettings): AppSettings {
  return {
    ...settings,
    gym_name:
      settings.gym_name === "Libre Funcional" ? APP_NAME : settings.gym_name,
    admin_name: settings.admin_name || "Fabian Aguirre (Manga)",
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
        ? `Bienvenido a ${APP_NAME}. Ante dudas sobre pagos, asistencias o rutinas, consulta en recepción.`
        : settings.onboarding_message,
  };
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

function Field({
  id,
  label,
  disabled,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  id: string;
  label: string;
  disabled: boolean;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm text-muted-foreground">
        {label}
      </label>
      <Input
        id={id}
        type={type}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="border-border bg-surface-1/70 text-foreground focus-visible:ring-ring"
      />
    </div>
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
      const { data } = await api.put<AppSettings>("/settings", settings);
      const next = normalizeSettings({ ...DEFAULT_SETTINGS, ...data });
      setSettings(next);
      setSharedSettings(next);
      toastSuccess("Listo", "Configuración guardada.");
    } catch {
      setSharedSettings(settings);
      toastError(
        "Guardado local",
        "No se pudo conectar al servidor. Los cambios quedaron guardados localmente."
      );
    } finally {
      setSaving(false);
    }
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
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-label-caps uppercase text-primary-strong">
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

      <div className="space-y-6">
        <div className="grid gap-6 xl:grid-cols-2">
          <div className="space-y-6">
            <Card className="border-border bg-surface-1">
              <CardHeader className="border-b border-border pb-5">
                <CardTitle className="text-foreground">Negocio</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field
                    id="gym_name"
                    label="Nombre del gimnasio"
                    disabled={!canEdit}
                    value={settings.gym_name}
                    onChange={(value) => updateField("gym_name", value)}
                  />
                  <Field
                    id="currency"
                    label="Moneda"
                    disabled={!canEdit}
                    value={settings.currency}
                    onChange={(value) => updateField("currency", value.toUpperCase())}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-surface-1">
              <CardHeader className="border-b border-border pb-5">
                <CardTitle className="text-foreground">Cobro</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
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

                <Field
                  id="payment_alias"
                  label="Alias o referencia bancaria"
                  disabled={!canEdit}
                  value={settings.payment_alias ?? ""}
                  onChange={(value) => updateField("payment_alias", value)}
                  placeholder="Ej: MINI.ESPACIO.GYM"
                />

                <div className="space-y-2">
                  <label htmlFor="payment_notes" className="text-sm text-muted-foreground">
                    Aclaraciones de pago
                  </label>
                  <textarea
                    id="payment_notes"
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
          </div>

          <Card className="border-border bg-surface-1">
            <CardHeader className="border-b border-border pb-5">
              <CardTitle className="text-foreground">Contacto</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid gap-4 md:grid-cols-2">
                <Field
                  id="admin_name"
                  label="Responsable"
                  disabled={!canEdit}
                  value={settings.admin_name ?? ""}
                  onChange={(value) => updateField("admin_name", value)}
                  placeholder="Fabian Aguirre (Manga)"
                />
                <Field
                  id="address"
                  label="Dirección del negocio"
                  disabled={!canEdit}
                  value={settings.address ?? ""}
                  onChange={(value) => updateField("address", value)}
                />
                <Field
                  id="contact_email"
                  label="Email de contacto"
                  disabled={!canEdit}
                  value={settings.contact_email ?? ""}
                  onChange={(value) => updateField("contact_email", value)}
                  type="email"
                />
                <Field
                  id="contact_phone"
                  label="Teléfono"
                  disabled={!canEdit}
                  value={settings.contact_phone ?? ""}
                  onChange={(value) => updateField("contact_phone", value)}
                />
                <Field
                  id="whatsapp_phone"
                  label="WhatsApp"
                  disabled={!canEdit}
                  value={settings.whatsapp_phone ?? ""}
                  onChange={(value) => updateField("whatsapp_phone", value)}
                />
                <Field
                  id="business_hours"
                  label="Horario visible"
                  disabled={!canEdit}
                  value={settings.business_hours ?? ""}
                  onChange={(value) => updateField("business_hours", value)}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border bg-surface-1">
          <CardHeader className="border-b border-border pb-5">
            <CardTitle className="text-foreground">Operación</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <label htmlFor="onboarding_message" className="text-sm text-muted-foreground">
                Mensaje operativo
              </label>
              <textarea
                id="onboarding_message"
                value={settings.onboarding_message ?? ""}
                disabled={!canEdit}
                onChange={(e) => updateField("onboarding_message", e.target.value)}
                rows={4}
                className="w-full rounded-xl border border-border bg-surface-2/40 px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-70"
                placeholder="Mensaje de bienvenida u orientación para un miembro nuevo."
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end border-t border-border pt-6">
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
  );
}
