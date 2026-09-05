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
import { fetchUserStats, searchUsers } from "@/services/search";
import type { Payment, Role, User } from "@/types";
import { useNavigate } from "react-router-dom";

type Props = {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onCloseSpotlight?: () => void;
  onCloseAll?: () => void;
  viewerRole: Role;
};

type UserStats = {
  lastPayment?: Payment | null;
  attendanceCount?: number;
};

export default function SpotlightSearch({ open, onOpenChange, viewerRole }: Props) {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<User[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [selected, setSelected] = React.useState<User | null>(null);
  const [stats, setStats] = React.useState<Record<string, UserStats>>({});
  const navigate = useNavigate();

  const closeAll = React.useCallback(() => {
    setSelected(null);
    setQuery("");
    setResults([]);
    onOpenChange(false);
  }, [onOpenChange]);

  React.useEffect(() => {
    if (!open) return;

    const timer = setTimeout(async () => {
      if (!query.trim()) {
        setResults([]);
        return;
      }

      setLoading(true);
      try {
        const data = await searchUsers(query.trim());
        setResults(data);

        const top = data.slice(0, 5);
        const entries = await Promise.all(
          top.map(async (user) => [user.id, await fetchUserStats(user.id)] as const)
        );

        const nextStats: Record<string, UserStats> = {};
        entries.forEach(([id, pack]) => {
          nextStats[id] = pack;
        });

        setStats((prev) => ({ ...prev, ...nextStats }));
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [open, query]);

  React.useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeAll();
      }
    };

    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [closeAll]);

  if (!open && !selected) {
    return null;
  }

  return (
    <>
      {open ? (
        <div className="fixed inset-0 z-[70]">
          <button
            type="button"
            aria-label="Cerrar buscador"
            onClick={closeAll}
            className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_top,color-mix(in_srgb,var(--primary)_12%,transparent),transparent_35%),color-mix(in_srgb,var(--canvas)_78%,transparent)] backdrop-blur-sm"
          />

          <div className="relative z-10 mx-auto flex h-full w-full max-w-4xl items-start justify-center px-4 pb-6 pt-20 md:pt-24">
            <Command className="surface-panel warm-glow relative z-20 w-full overflow-hidden rounded-xl border border-border bg-surface-1">
              <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <div>
                  <p className="text-label-caps uppercase text-muted-foreground">
                    Busqueda rapida
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Usuarios, pagos e historial en un solo lugar
                  </p>
                </div>
                <div className="hidden items-center gap-2 rounded-full border border-border bg-surface-2/40 px-3 py-1 text-xs text-muted-foreground md:flex">
                  <Sparkles className="h-3.5 w-3.5 text-primary-strong" />
                  ESC para cerrar
                </div>
              </div>

              <CommandInput
                autoFocus
                placeholder="Buscar usuarios por nombre, email o telefono..."
                value={query}
                onValueChange={setQuery}
                className="text-base text-foreground placeholder:text-muted-foreground"
              />

              <CommandList className="warm-scrollbar max-h-[380px] px-2 pb-2">
                {!loading ? <CommandEmpty>Sin resultados</CommandEmpty> : null}
                <CommandGroup heading="Usuarios">
                  {results.map((user) => (
                    <CommandItem
                      key={user.id}
                      value={user.full_name}
                      className="rounded-xl border border-transparent px-3 py-3 text-foreground data-[selected=true]:border-primary/30 data-[selected=true]:bg-primary/10 data-[selected=true]:text-foreground"
                      onSelect={() => {
                        setSelected(user);
                        onOpenChange(false);
                      }}
                    >
                      <div className="flex w-full items-center justify-between gap-3">
                        <div className="truncate">
                          <div className="font-medium">{user.full_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {user.phone ?? "-"} • {user.email ?? "-"}
                          </div>
                        </div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-2/40 px-2.5 py-1 text-xs text-muted-foreground">
                          <Search className="h-3.5 w-3.5 text-primary-strong" />
                          {stats[user.id]?.attendanceCount ?? 0} asis.
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </div>
        </div>
      ) : null}

      <Drawer
        open={!!selected}
        onOpenChange={(isOpen: boolean) => {
          if (!isOpen) {
            closeAll();
          }
        }}
      >
        <DrawerContent className="flex h-[92vh] flex-col border-border bg-canvas">
          <div className="warm-scrollbar mx-auto w-full max-w-4xl flex-1 overflow-y-auto p-4">
            <DrawerHeader>
              <DrawerTitle className="text-xl">Ficha del cliente</DrawerTitle>
              <DrawerDescription className="text-muted-foreground">
                Vista {viewerRole === "owner" ? "completa (Dueño)" : "para Coach"}.
              </DrawerDescription>
            </DrawerHeader>

            {selected ? (
              <div className="px-4 pb-6">
                <UserCard
                  viewerRole={viewerRole}
                  client={selected}
                  stats={stats[selected.id] ?? undefined}
                  onAction={(action, user) => {
                    if (action === "viewHistory") {
                      closeAll();
                      const params = new URLSearchParams({
                        user_id: user.id,
                        q: user.full_name || "",
                      });
                      navigate(`/payments?${params.toString()}`);
                    }
                  }}
                />

                <div className="mt-4 flex justify-end">
                  <DrawerClose asChild>
                    <Button variant="outline" onClick={closeAll}>
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
