import { useEffect, useState } from "react";
import type { AppSettings, Role } from "@/types";

const SETTINGS_KEY = "app_settings";

const DEFAULT_SETTINGS: AppSettings = {
  gym_name: "Libre Funcional",
  currency: "ARS",
  default_fee: 24000,
  address: "",
  contact_email: "",
  contact_phone: "",
  whatsapp_phone: "",
  business_hours: "",
  payment_alias: "",
  payment_notes: "",
  late_fee_grace_days: 5,
  allow_cash: true,
  allow_transfer: true,
  onboarding_message: "",
};

function roleLabel(role: Role | "guest") {
  if (role === "owner") return "Dueño";
  if (role === "coach") return "Coach";
  return "Invitado";
}

export default function Footer() {
  const [role, setRole] = useState<Role | "guest">("guest");
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const syncSettings = () => {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) {
        setSettings(DEFAULT_SETTINGS);
        return;
      }

      try {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) });
      } catch {
        setSettings(DEFAULT_SETTINGS);
      }
    };

    setRole((localStorage.getItem("user_role") as Role) || "guest");
    setOnline(window.navigator.onLine);
    syncSettings();

    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("app-settings:updated", syncSettings);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("app-settings:updated", syncSettings);
    };
  }, []);

  return (
    <footer className="mt-8 border-t border-amber-200/10 bg-[#0e0c0b]/70 px-6 py-4 text-xs text-zinc-400 backdrop-blur-xl">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-medium text-zinc-200">{settings.gym_name}</span>
          <span>{roleLabel(role)}</span>
          <span>{online ? "Sistema online" : "Sin conexion"}</span>
          {settings.address ? <span>{settings.address}</span> : null}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {settings.contact_phone ? <span>{settings.contact_phone}</span> : null}
          {settings.business_hours ? <span>{settings.business_hours}</span> : null}
        </div>
      </div>
    </footer>
  );
}
