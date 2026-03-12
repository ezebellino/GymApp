import * as React from "react";
import { Search, Sparkles } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import UserCard from "./UserCard";
import { searchClients, fetchClientStats } from "@/services/search";
import type { Client, Role } from "@/types";
import { useNavigate } from "react-router-dom";

type Props = {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onCloseSpotlight?: () => void;
  onCloseAll?: () => void;
  viewerRole: Role;
};

export default function SpotlightSearch({ open, onOpenChange, viewerRole }: Props) {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<Client[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [selected, setSelected] = React.useState<Client | null>(null);
  const [stats, setStats] = React.useState<
    Record<string, { lastPayment?: unknown; attendanceCount?: number }>
  >({});
  const navigate = useNavigate();

  const closeAll = React.useCallback(() => {
    setSelected(null);
    setQuery("");
    setResults([]);
    onOpenChange(false);
  }, [onOpenChange]);

  React.useEffect(() => {
    const timer = setTimeout(async () => {
      if (!query.trim()) {
        setResults([]);
        return;
      }

      setLoading(true);
      try {
        const data = await searchClients(query.trim());
        setResults(data);

        const top = data.slice(0, 5);
        const entries = await Promise.all(
          top.map(async (client) => [client.id, await fetchClientStats(client.id)] as const)
        );
        const nextStats: typeof stats = {};
        entries.forEach(([id, pack]) => {
          nextStats[id] = pack;
        });
        setStats((prev) => ({ ...prev, ...nextStats }));
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  React.useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeAll();
    };

    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [closeAll]);

  return (
    <>
      <div
        className={`fixed inset-0 z-[60] transition ${
          open ? "pointer-events-auto" : "pointer-events-none"
        }`}
      >
        <button
          type="button"
          aria-label="Cerrar buscador"
          onClick={closeAll}
          className={`absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(250,204,21,0.12),transparent_35%),rgba(3,3,3,0.78)] backdrop-blur-sm transition-opacity ${
            open ? "opacity-100" : "opacity-0"
          }`}
        />

        <div className="relative mx-auto flex h-full w-full max-w-4xl items-start justify-center px-4 pb-6 pt-20 md:pt-24">
          <Command
            className={`surface-panel warm-glow w-full overflow-hidden rounded-[30px] border border-amber-200/10 bg-[#0c0b0a]/95 transition-all duration-200 ${
              open ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0"
            }`}
          >
            <div className="flex items-center justify-between border-b border-white/8 px-5 py-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">
                  Busqueda rapida
                </p>
                <p className="mt-1 text-sm text-zinc-300">
                  Clientes, pagos e historial en un solo lugar
                </p>
              </div>
              <div className="hidden items-center gap-2 rounded-full border border-amber-200/10 bg-white/[0.04] px-3 py-1 text-xs text-zinc-400 md:flex">
                <Sparkles className="h-3.5 w-3.5 text-amber-200" />
                ESC para cerrar
              </div>
            </div>

            <CommandInput
              placeholder="Buscar clientes por nombre, email o telefono..."
              value={query}
              onValueChange={setQuery}
              className="text-base text-zinc-100 placeholder:text-zinc-500"
            />

            <CommandList className="warm-scrollbar max-h-[380px] px-2 pb-2">
              {!loading && <CommandEmpty>Sin resultados</CommandEmpty>}
              <CommandGroup heading="Clientes">
                {results.map((client) => (
                  <CommandItem
                    key={client.id}
                    value={client.full_name}
                    className="rounded-2xl border border-transparent px-3 py-3 text-zinc-100 data-[selected=true]:border-amber-200/10 data-[selected=true]:bg-[linear-gradient(90deg,rgba(250,204,21,0.12),rgba(255,247,237,0.04),rgba(249,115,22,0.1))] data-[selected=true]:text-zinc-50"
                    onSelect={() => {
                      setSelected(client);
                      onOpenChange(false);
                    }}
                  >
                    <div className="flex w-full items-center justify-between gap-3">
                      <div className="truncate">
                        <div className="font-medium">{client.full_name}</div>
                        <div className="text-xs text-zinc-400">
                          {client.phone ?? "-"} • {client.email ?? "-"}
                        </div>
                      </div>
                      <div className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.04] px-2.5 py-1 text-xs text-zinc-300">
                        <Search className="h-3.5 w-3.5 text-amber-200" />
                        {stats[client.id]?.attendanceCount ?? 0} asis.
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </div>
      </div>

      <Drawer
        open={!!selected}
        onOpenChange={(isOpen: boolean) => {
          if (!isOpen) closeAll();
        }}
      >
        <DrawerContent className="flex h-[92vh] flex-col border-zinc-800 bg-zinc-950">
          <div className="warm-scrollbar mx-auto w-full max-w-4xl flex-1 overflow-y-auto p-4">
            <DrawerHeader>
              <DrawerTitle className="text-xl">Ficha del cliente</DrawerTitle>
              <DrawerDescription className="text-zinc-400">
                Vista {viewerRole === "owner" ? "completa (Dueño)" : "para Coach"}.
              </DrawerDescription>
            </DrawerHeader>

            {selected ? (
              <div className="px-4 pb-6">
                <UserCard
                  viewerRole={viewerRole}
                  client={selected}
                  stats={stats[selected.id]}
                  onAction={(action, client) => {
                    if (action === "viewHistory") {
                      closeAll();
                      const params = new URLSearchParams({
                        client_id: client.id,
                        q: client.full_name || "",
                      });
                      navigate(`/payments?${params.toString()}`);
                    }
                  }}
                />

                <div className="mt-4 flex justify-end">
                  <DrawerClose asChild>
                    <Button
                      variant="outline"
                      className="border-zinc-700 text-gray-100 hover:bg-zinc-800"
                      onClick={closeAll}
                    >
                      Cerrar
                    </Button>
                  </DrawerClose>
                </div>
              </div>
            ) : null}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
