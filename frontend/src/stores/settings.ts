import { create } from "zustand";
import { persist, subscribeWithSelector, type PersistStorage, type StorageValue } from "zustand/middleware";
import { applyTheme, getStoredTheme, isAppThemeId, type AppThemeId } from "@/lib/theme";
import type { AppSettings } from "@/types";

export type SettingsState = {
  settings: AppSettings;
  setSettings: (next: Partial<AppSettings>) => void;
};

const SETTINGS_STORAGE_KEY = "app_settings";

// Valores por defecto del negocio: unico lugar del repo donde vive esta
// constante (antes de este change estaba copiada, con drift, en Settings.tsx,
// Footer.tsx y Payments.tsx). Es la version completa (coincide con el seed del
// backend); Settings.tsx conserva su propia copia porque no se migra a este
// store (dec. 12 / dec. 15 del design: solo cambia su persistencia).
export const DEFAULT_SETTINGS: AppSettings = {
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

// PersistStorage a medida sobre la clave plana `app_settings` que ya existe
// (mismo shim de compatibilidad que `stores/session.ts`, ver dec. 8): el
// objeto `AppSettings` se guarda tal cual, sin el envoltorio `{state,version}`
// del `createJSONStorage` default, para que los lectores fuera de alcance
// (`NewPaymentDialog`, `UserCard`) lo sigan parseando sin tocarlos.
const settingsStorage: PersistStorage<SettingsState> = {
  getItem: (): StorageValue<SettingsState> | null => {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as Partial<AppSettings>;
      return { state: { settings: { ...DEFAULT_SETTINGS, ...parsed } }, version: 0 };
    } catch {
      return null;
    }
  },
  setItem: (_name, value) => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(value.state.settings));
  },
  removeItem: () => {
    localStorage.removeItem(SETTINGS_STORAGE_KEY);
  },
};

export const useSettingsStore = create<SettingsState>()(
  subscribeWithSelector(
    persist(
      (set) => ({
        settings: DEFAULT_SETTINGS,
        setSettings: (next) =>
          set((state) => ({
            settings: { ...DEFAULT_SETTINGS, ...state.settings, ...next },
          })),
      }),
      {
        name: "settings",
        storage: settingsStorage,
        // Sin `skipHydration`: igual que en `stores/session.ts`, la
        // rehidratacion tiene que ser sincronica y ocurrir antes del primer
        // render (el tema se aplica inmediatamente debajo, leyendo el estado
        // ya rehidratado).
      },
    ),
  ),
);

function themeFromSettings(preference: AppSettings["theme_preference"]): AppThemeId {
  return isAppThemeId(preference) ? preference : getStoredTheme();
}

// Aplicacion sincronica del tema en el primer render (antes de que React monte
// nada) + suscripcion a los cambios posteriores. Reemplaza al viejo
// `syncThemeFromSettings()` y al evento global de ajustes que emitian
// Settings/Payments (dec. 12): las dos lineas importan, no solo la
// suscripcion, porque de otro modo el primer paint quedaria sin tema aplicado
// hasta el primer cambio.
applyTheme(themeFromSettings(useSettingsStore.getState().settings.theme_preference));
useSettingsStore.subscribe(
  (state) => state.settings.theme_preference,
  (preference) => applyTheme(themeFromSettings(preference)),
);
