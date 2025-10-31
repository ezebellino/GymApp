// src/components/SpotlightSearch.tsx
import * as React from "react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerClose } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import UserCard from "./UserCard";
import { searchClients, fetchClientStats } from "@/services/search";
import type { Client, Role } from "@/types";

type Props = {
    open: boolean;
    onOpenChange: (next: boolean) => void;
    viewerRole: Role;
};

export default function SpotlightSearch({ open, onOpenChange, viewerRole }: Props) {
    const [query, setQuery] = React.useState("");
    const [results, setResults] = React.useState<Client[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [selected, setSelected] = React.useState<Client | null>(null);
    const [stats, setStats] = React.useState<Record<string, { lastPayment?: any; attendanceCount?: number }>>({});

    // Buscar con debounce simple
    React.useEffect(() => {
        const t = setTimeout(async () => {
            if (!query.trim()) {
                setResults([]);
                return;
            }
            setLoading(true);
            try {
                const data = await searchClients(query.trim());
                setResults(data);
                // precarga de stats
                const top = data.slice(0, 5);
                const entries = await Promise.all(
                    top.map(async (c) => [c.id, await fetchClientStats(c.id)] as const)
                );
                const map: typeof stats = {};
                entries.forEach(([id, pack]) => (map[id] = pack));
                setStats((prev) => ({ ...prev, ...map }));
            } finally {
                setLoading(false);
            }
        }, 300);
        return () => clearTimeout(t);
    }, [query]);

    // 👇 Nuevo: cerrar con ESC
    React.useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === "Escape") onOpenChange(false);
        };
        window.addEventListener("keydown", handleEsc);
        return () => window.removeEventListener("keydown", handleEsc);
    }, [onOpenChange]);

    return (
        <>
            {/* Command Palette */}
            <div className="fixed left-1/2 top-24 z-60 w-full max-w-2xl -translate-x-1/2">
                <Command className={`rounded-2xl border border-zinc-800 bg-zinc-900/80 backdrop-blur ${open ? "" : "hidden"}`}>
                    <CommandInput
                        placeholder="Buscar clientes por nombre / email / teléfono…"
                        value={query}
                        onValueChange={setQuery}
                    />
                    <CommandList>
                        {!loading && <CommandEmpty>Sin resultados</CommandEmpty>}
                        <CommandGroup heading="Clientes">
                            {results.map((c) => (
                                <CommandItem
                                    key={c.id}
                                    value={c.full_name}
                                    onSelect={() => setSelected(c)}
                                >
                                    <div className="flex items-center justify-between w-full">
                                        <div className="truncate">
                                            <div className="font-medium">{c.full_name}</div>
                                            <div className="text-xs text-zinc-400">
                                                {c.phone ?? "—"} • {c.email ?? "—"}
                                            </div>
                                        </div>
                                        <div className="text-xs text-zinc-400">
                                            {stats[c.id]?.attendanceCount ?? 0} asis.
                                        </div>
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </div>

            {/* Drawer con la Card */}
            <Drawer
                open={!!selected}
                onOpenChange={(open: boolean) => {
                    if (!open) setSelected(null);
                }}
            >
                <DrawerContent className="border-zinc-800 bg-zinc-950">
                    <div className="mx-auto w-full max-w-3xl p-4">
                        <DrawerHeader>
                            <DrawerTitle className="text-xl">Ficha del cliente</DrawerTitle>
                            <DrawerDescription className="text-zinc-400">
                                Vista {viewerRole === "owner" ? "completa (Owner)" : "para Coach"}.
                            </DrawerDescription>
                        </DrawerHeader>

                        {selected && (
                            <div className="px-4 pb-6">
                                <UserCard
                                    viewerRole={viewerRole}
                                    client={selected}
                                    stats={stats[selected.id]}
                                    onAction={(action, client) => {
                                        if (action === "checkin") {
                                            // ejemplo rápido (luego usá tu helper de toasts y modales)
                                            // POST /attendance/checkin { client_id: client.id }
                                        }
                                        if (action === "newPayment") {
                                            // Navegar /payments con client preseleccionado o abrir modal
                                        }
                                        if (action === "viewHistory") {
                                            // Navegar a detalle (si lo agregamos) o abrir modal de tabs pagos/asistencias
                                        }
                                    }}
                                />
                                <div className="mt-4 flex justify-end">
                                    <DrawerClose asChild>
                                        <Button variant="outline" className="border-zinc-700 hover:bg-zinc-800">
                                            Cerrar
                                        </Button>
                                    </DrawerClose>
                                </div>
                            </div>
                        )}
                    </div>
                </DrawerContent>
            </Drawer>
        </>
    );
}
