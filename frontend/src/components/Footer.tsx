import { useEffect, useState } from "react";
import type { Role } from "@/types";
import { useSessionStore } from "@/stores/session";
import { useSettingsStore } from "@/stores/settings";

function roleLabel(role: Role | "guest") {
  if (role === "owner") return "Dueño";
  if (role === "coach") return "Coach";
  return "Invitado";
}

export default function Footer() {
  const role = useSessionStore((s) => s.role) ?? ("guest" as Role | "guest");
  const settings = useSettingsStore((s) => s.settings);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(window.navigator.onLine);

    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <footer className="mt-8 border-t border-amber-200/10 bg-[#0e0c0b]/70 px-6 py-4 text-xs text-zinc-400 backdrop-blur-xl">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-medium text-zinc-200">{settings.gym_name}</span>
          {settings.admin_name ? <span>{settings.admin_name}</span> : null}
          <span>{roleLabel(role)}</span>
          <span>{online ? "Sistema online" : "Sin conexión"}</span>
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
