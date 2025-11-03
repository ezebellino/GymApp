// src/pages/NewCoach.tsx
import { useState, FormEvent } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Swal from "sweetalert2";
// import api from "@/lib/http"; // cuando tengas el endpoint

export default function NewCoachPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        full_name: fullName.trim(),
        email: email.trim(),
        password,
        role: "coach",
      };

      console.log("Nuevo coach (stub):", payload);

      // 👇 cuando tengas endpoint:
      // await api.post("/coaches", payload);

      await Swal.fire({
        title: "Coach creado",
        text: "El nuevo coach fue registrado correctamente.",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      });

      setFullName("");
      setEmail("");
      setPassword("");
    } catch (e) {
      await Swal.fire({
        title: "Error",
        text: "No se pudo crear el coach.",
        icon: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
      <Card className="w-full max-w-md border-white/10 bg-zinc-950/70 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-center text-amber-400">
            Registrar nuevo coach
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm text-zinc-400">Nombre completo</label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="bg-zinc-900/70 border-white/10 text-zinc-100"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm text-zinc-400">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-zinc-900/70 border-white/10 text-zinc-100"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm text-zinc-400">Contraseña inicial</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-zinc-900/70 border-white/10 text-zinc-100"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-linear-to-r from-fuchsia-500 to-cyan-400 text-black font-medium hover:opacity-90"
            >
              {loading ? "Creando…" : "Crear coach"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
