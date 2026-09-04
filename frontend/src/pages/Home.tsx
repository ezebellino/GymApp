import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { Dumbbell, Sparkles } from "lucide-react";
import { useSessionStore } from "@/stores/session";

export default function Home() {
  const name = useSessionStore((s) => s.userName) ?? "Usuario";
  const role = useSessionStore((s) => s.role) ?? "guest";

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Buenos días";
    if (hour < 19) return "Buenas tardes";
    return "Buenas noches";
  };

  const roleLabel =
    role === "owner" ? "Dueño" : role === "coach" ? "Coach" : "Usuario";

  return (
    <div className="relative flex h-[calc(100vh-6rem)] flex-col items-center justify-center overflow-hidden px-4">
      <div className="absolute inset-0 -z-10 bg-linear-to-b from-[#0b0b0b] via-[#120f0c] to-[#1b140e]">
        <div className="absolute -left-40 -top-40 h-96 w-96 animate-pulse rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-96 w-96 animate-pulse rounded-full bg-primary-strong/15 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <Card className="max-w-md border border-border bg-surface-1/70 p-6 text-center shadow-2xl backdrop-blur-lg">
          <CardContent>
            <motion.div
              initial={{ rotate: -15, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="mb-4 flex justify-center"
            >
              <Dumbbell className="h-12 w-12 text-primary drop-shadow-[0_0_12px_rgba(251,191,36,0.45)]" />
            </motion.div>

            <h1 className="warm-accent-text mb-2 text-3xl font-semibold">
              {getGreeting()}, {roleLabel} {name}
            </h1>
            <p className="text-muted-foreground">
              Bienvenido al sistema de gestión de{" "}
              <span className="font-medium text-primary">Mini Espacio</span>.
            </p>

            <p className="mt-3 text-sm text-muted-foreground">
              Usa el menú lateral para acceder a clientes, asistencias, pagos y
              reportes.
            </p>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2, duration: 0.8 }}
              className="mt-4 flex justify-center"
            >
              <Sparkles className="h-6 w-6 animate-pulse text-primary" />
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
