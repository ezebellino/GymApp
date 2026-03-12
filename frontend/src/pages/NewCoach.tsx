// src/pages/NewCoach.tsx
import { useState, FormEvent } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Swal from "sweetalert2";
import api from "@/lib/http";
import { useNavigate } from "react-router-dom";

export default function NewCoachPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        full_name: fullName.trim(),
        email: email.trim(),
        password,
      };

      const res = await api.post("/coaches", payload);

      console.log("Nuevo coach creado:", res.data);

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
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || "No se pudo crear el coach.";
      await Swal.fire({
        title: "Error",
        text: String(msg),
        icon: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
      <Card className="w-full max-w-md border-amber-200/10 bg-zinc-950/70 backdrop-blur-md">
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
              className="w-full border border-amber-300/25 bg-[linear-gradient(90deg,#facc15_0%,#fff7ed_48%,#f97316_100%)] font-medium text-black hover:opacity-90"
            >
              {loading ? "Creando…" : "Crear coach"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
