// src/components/UserCard.tsx
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Client, Role, Payment } from "@/types";
import NewPaymentDialog from "./NewPaymentDialog";
import AttendanceCalendar from "./AttendanceCalendar";
import LastPayments from "./LastPayments";
import EditClientDialog from "./EditClientDialog";

type Props = {
  viewerRole: Role;
  client: Client;
  stats?: {
    lastPayment?: Payment | null;
    attendanceCount?: number;
  };
  onAction?: (action: "checkin" | "newPayment" | "viewHistory", client: Client) => void;
  onRefresh?: () => void;
  onCloseAll?: () => void;
};

export default function UserCard({
  viewerRole,
  client,
  stats,
  onAction,
  onRefresh,
}: Props) {
  const lastPay = stats?.lastPayment;
  const attCount = stats?.attendanceCount ?? 0;

  const [openPayment, setOpenPayment] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);

  return (
    <Card className="border-white/10 bg-zinc-900/70 backdrop-blur-sm shadow-[0_0_20px_rgba(0,255,255,0.08)]">
      <CardHeader className="sm:pb-3 pb-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-xl text-zinc-100">
              <span className="bg-linear-to-r from-fuchsia-500 to-cyan-400 bg-clip-text text-transparent">
                {client.full_name}
              </span>
            </CardTitle>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-zinc-100">
              <span>Alta: {new Date(client.join_date).toLocaleDateString()}</span>
              <span className="text-zinc-600">•</span>
              {client.is_active ? (
                <Badge>Activo</Badge>
              ) : (
                <Badge variant="outline">Inactivo</Badge>
              )}
            </div>
          </div>

          <div className="text-right text-sm">
            <div className="text-zinc-300">📱 {client.phone || "—"}</div>
            {viewerRole === "owner" && (
              <div className="mt-0.5 text-zinc-400">✉️ {client.email ?? "—"}</div>
            )}
          </div>
        </div>
      </CardHeader>

      {/* 👇 sin max-height ni overflow: el scroll lo maneja el Drawer */}
      <CardContent className="text-zinc-100 sm:px-6 px-4 space-y-4">
        {/* Stats mini */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-white/10 p-3">
            <div className="text-xs text-zinc-400">Asistencias</div>
            <div className="mt-1 text-2xl font-semibold text-zinc-100">
              {attCount}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 p-3">
            <div className="text-xs text-zinc-400">Último pago</div>
            {lastPay ? (
              <div className="mt-1">
                <div className="text-lg font-semibold text-zinc-100">
                  ${lastPay.amount.toFixed(0)}
                </div>
                <div className="text-xs text-zinc-400">
                  {String(lastPay.period_month).padStart(2, "0")}/{lastPay.period_year} •{" "}
                  {lastPay.method ?? "—"}
                  {lastPay.method === "transfer" && lastPay.method_channel
                    ? ` (${lastPay.method_channel})`
                    : ""}
                </div>
              </div>
            ) : (
              <div className="mt-1 text-zinc-500">—</div>
            )}
          </div>
        </div>

        {/* Vista enriquecida */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-3">
          {/* Calendario de asistencias */}
          <AttendanceCalendar clientId={client.id} monthsBack={3} />

          {/* Últimos 3 pagos */}
          <div className="rounded-xl border border-white/10 bg-zinc-950/60 p-3">
            <div className="text-sm mb-2 text-zinc-200">Últimos pagos</div>
            <LastPayments clientId={client.id} />
          </div>
        </div>

        {/* Acciones al final (ya no sticky) */}
        <div className="mt-4 pt-3 border-t border-white/10 flex flex-wrap gap-2">
          <Button
            size="sm"
            className="text-gray-100 bg-zinc-800 hover:bg-zinc-700"
            onClick={() => setOpenEdit(true)}
          >
            Editar datos
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="text-gray-100 border-cyan-400/40 hover:bg-cyan-400/10"
            onClick={() => {
              setOpenPayment(true);
              onAction?.("newPayment", client);
            }}
          >
            Crear pago
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className="text-gray-100 hover:bg-zinc-800"
            onClick={() => onAction?.("viewHistory", client)}
          >
            Ver historial
          </Button>
        </div>
      </CardContent>

      {/* Diálogos */}
      <NewPaymentDialog
        open={openPayment}
        onOpenChange={setOpenPayment}
        clientId={client.id}
        clientName={client.full_name}
        onSuccess={onRefresh}
      />
      <EditClientDialog
        open={openEdit}
        onOpenChange={setOpenEdit}
        client={client}
        onSuccess={onRefresh}
      />
    </Card>
  );
}
