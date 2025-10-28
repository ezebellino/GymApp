import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../src/lib/http";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { jwtDecode } from "jwt-decode";

type TokenResp = { access_token: string; token_type: string };
type TokenPayload = { name?: string; email?: string; sub?: string; role?: string; exp: number };

export default function Login() {
  const [email, setEmail] = useState("owner@librefuncional.com");
  const [password, setPassword] = useState("Cambiar123");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      // /auth/token espera x-www-form-urlencoded
      const body = new URLSearchParams();
      body.append("username", email);
      body.append("password", password);

      const { data } = await api.post<TokenResp>("/auth/token", body, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });

      localStorage.setItem("access_token", data.access_token);
      const payload = jwtDecode<TokenPayload>(data.access_token);
      localStorage.setItem("user_name", payload.name ?? payload.email ?? "Usuario");

      navigate("/", { replace: true });
    } catch (err) {
      alert("Credenciales inválidas");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh grid place-items-center">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 border rounded-2xl p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Ingresar</h1>
        <div className="space-y-2">
          <label className="text-sm">Email</label>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
        </div>
        <div className="space-y-2">
          <label className="text-sm">Password</label>
          <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
        </div>
        <Button className="w-full" disabled={loading}>{loading ? "Ingresando..." : "Entrar"}</Button>
      </form>
    </div>
  );
}
