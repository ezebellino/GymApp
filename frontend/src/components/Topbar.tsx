import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function Topbar() {
  const navigate = useNavigate();
  const name = localStorage.getItem("user_name") || "Usuario";

  const logout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_name");
    navigate("/login", { replace: true });
  };

  return (
    <header className="h-14 border-b flex items-center justify-between px-4">
      <div className="font-medium">Panel</div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">{name}</span>
        <Button variant="outline" size="sm" onClick={logout}>Salir</Button>
      </div>
    </header>
  );
}
