import { useEffect, useMemo, useState } from "react";
import { fetchClients } from "@/services/clients";
import type { Client } from "@/types";
import Pagination from "@/components/Pagination";
import { useDebounce } from "../hooks/useDebounce";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export default function Clients() {
  const [items, setItems] = useState<Client[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 400);
  const [limit, setLimit] = useState(10);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);

  // para reiniciar offset cuando cambia la búsqueda
  useEffect(() => {
    setOffset(0);
  }, [debouncedQ, limit]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const { items, total } = await fetchClients({
          q: debouncedQ || undefined,
          limit,
          offset,
        });
        if (mounted) {
          setItems(items);
          setTotal(total);
        }
      } catch (e) {
        // Podés agregar toasts
        console.error(e);
      } finally {
        mounted && setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [debouncedQ, limit, offset]);

  const rows = useMemo(() => items, [items]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Clientes</h1>

      <Card className="p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <Input
            placeholder="Buscar por nombre, email o teléfono…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="max-w-md"
          />
          <Pagination
            total={total}
            limit={limit}
            offset={offset}
            onChange={({ limit, offset }) => {
              setLimit(limit);
              setOffset(offset);
            }}
          />
        </div>

        <div className="border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3">Nombre</th>
                <th className="text-left p-3">Email</th>
                <th className="text-left p-3">Teléfono</th>
                <th className="text-left p-3">Estado</th>
                <th className="text-left p-3">Alta</th>
              </tr>
            </thead>
            <tbody>
              {!loading && rows.length === 0 && (
                <tr>
                  <td className="p-4 text-muted-foreground" colSpan={5}>
                    No hay resultados.
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td className="p-4 text-muted-foreground" colSpan={5}>
                    Cargando…
                  </td>
                </tr>
              )}
              {!loading &&
                rows.map((c) => (
                  <tr key={c.id} className="border-t">
                    <td className="p-3">{c.full_name}</td>
                    <td className="p-3">{c.email ?? "—"}</td>
                    <td className="p-3">{c.phone ?? "—"}</td>
                    <td className="p-3">
                      {c.is_active ? (
                        <Badge>Activo</Badge>
                      ) : (
                        <Badge variant="outline">Inactivo</Badge>
                      )}
                    </td>
                    <td className="p-3">
                      {new Date(c.join_date).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end">
          <Pagination
            total={total}
            limit={limit}
            offset={offset}
            onChange={({ limit, offset }) => {
              setLimit(limit);
              setOffset(offset);
            }}
          />
        </div>
      </Card>
    </div>
  );
}
