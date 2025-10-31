// src/pages/Home.tsx
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { Dumbbell, Sparkles } from "lucide-react";

export default function Home() {
  const [name, setName] = useState<string>("");
  const [role, setRole] = useState<string>("");

  useEffect(() => {
    const storedName = localStorage.getItem("user_name") || "Usuario";
    const storedRole = localStorage.getItem("user_role") || "guest";
    setName(storedName);
    setRole(storedRole);
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "¡Buenos días!";
    if (hour < 19) return "¡Buenas tardes!";
    return "¡Buenas noches!";
  };

  const roleLabel =
    role === "owner"
      ? "Dueño"
      : role === "coach"
      ? "Coach"
      : "Usuario";

  return (
    <div className="relative flex flex-col items-center justify-center h-[calc(100vh-6rem)] px-4 overflow-hidden">
      {/* Fondo animado con gradientes suaves */}
      <div className="absolute inset-0 -z-10 bg-linear-to-b from-zinc-950 via-zinc-900 to-zinc-950">
        <div className="absolute -top-40 -left-40 h-96 w-96 bg-violet-600/20 blur-3xl rounded-full animate-pulse" />
        <div className="absolute -bottom-40 -right-40 h-96 w-96 bg-cyan-500/20 blur-3xl rounded-full animate-pulse" />
      </div>

      {/* Card principal */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <Card className="border border-white/10 bg-zinc-900/70 backdrop-blur-lg shadow-2xl p-6 text-center max-w-md">
          <CardContent>
            <motion.div
              initial={{ rotate: -15, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="flex justify-center mb-4"
            >
              <Dumbbell className="h-12 w-12 text-cyan-400 drop-shadow-[0_0_12px_rgba(6,182,212,0.5)]" />
            </motion.div>

            <h1 className="text-3xl font-semibold mb-2 bg-linear-to-r from-violet-500 to-cyan-400 bg-clip-text text-transparent">
              {getGreeting()}, {roleLabel} {name}!
            </h1>
            <p className="text-zinc-400">
              Bienvenido al sistema de gestión de{" "}
              <span className="text-amber-300 font-medium">Libre Funcional</span>.
            </p>

            <p className="text-zinc-500 text-sm mt-3">
              Usá el menú lateral para acceder a clientes, asistencias, pagos y reportes.
            </p>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2, duration: 0.8 }}
              className="flex justify-center mt-4"
            >
              <Sparkles className="h-6 w-6 text-amber-300 animate-pulse" />
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
