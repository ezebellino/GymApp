import { useEffect, useState } from "react";
import type { Role } from "@/types";

type AppSettings = {
  gym_name?: string;
  address?: string | null;
};

const SETTINGS_KEY = "app_settings";

function roleLabel(role: Role | "guest") {
  if (role === "owner") return "Dueño";
  if (role === "coach") return "Coach";
  return "Invitado";
}

export default function Footer() {
  const [role, setRole] = useState<Role | "guest">("guest");
  const [gymName, setGymName] = useState("Libre Funcional");
  const [address, setAddress] = useState<string>("");
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setRole((localStorage.getItem("user_role") as Role) || "guest");
    setOnline(window.navigator.onLine);

    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as AppSettings;
        setGymName(parsed.gym_name || "Libre Funcional");
        setAddress(parsed.address || "");
      } catch {
        setGymName("Libre Funcional");
      }
    }

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
          <span className="font-medium text-zinc-200">{gymName}</span>
          <span>{roleLabel(role)}</span>
          <span>{online ? "Sistema online" : "Sin conexion"}</span>
          {address ? <span>{address}</span> : null}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>Operacion diaria</span>
          <span>Clientes, pagos y asistencias unificados</span>
        </div>
      </div>
    </footer>
  );
}
