// src/components/UserCard.tsx
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Client, Role, Payment } from "@/types";
import CheckinDialog from "./CheckinDialog";
import NewPaymentDialog from "./NewPaymentDialog";
import AttendanceCalendar from "./AttendanceCalendar";
import LastPayments from "./LastPayments";

type Props = {
  viewerRole: Role;
  client: Client;
  stats?: {
    lastPayment?: Payment | null;
    attendanceCount?: number;
  };
  onAction?: (action: "checkin" | "newPayment" | "viewHistory", client: Client) => void;
  onRefresh?: () => void;
};

export default function UserCard({ viewerRole, client, stats, onAction, onRefresh }: Props) {
  const lastPay = stats?.lastPayment;
  const attCount = stats?.attendanceCount ?? 0;

  const [openCheckin, setOpenCheckin] = useState(false);
  const [openPayment, setOpenPayment] = useState(false);

  return (
    <Card className="border-white/10 bg-zinc-900/70 backdrop-blur-sm shadow-[0_0_20px_rgba(0,255,255,0.08)]">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-xl text-zinc-100">
              <span className="bg-linear-to-r from-fuchsia-500 to-cyan-400 bg-clip-text text-transparent">
                {client.full_name}
              </span>
            </CardTitle>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-zinc-400">
              <span>Alta: {new Date(client.join_date).toLocaleDateString()}</span>
              <span className="text-zinc-600">•</span>
              {client.is_active ? <Badge>Activo</Badge> : <Badge variant="outline">Inactivo</Badge>}
            </div>
          </div>

          <div className="text-right text-sm">
            <div className="text-zinc-300">📱 {client.phone || "—"}</div>
            {viewerRole === "owner" && <div className="mt-0.5 text-zinc-400">✉️ {client.email ?? "—"}</div>}
          </div>
        </div>
      </CardHeader>

      {/* Contenido scrolleable */}
      <CardContent className="space-y-5 max-h-[80vh] overflow-y-auto pr-1">
        {/* Stats mini */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-white/10 p-3">
            <div className="text-xs text-zinc-400">Asistencias</div>
            <div className="mt-1 text-2xl font-semibold text-zinc-100">{attCount}</div>
          </div>

          <div className="rounded-xl border border-white/10 p-3">
            <div className="text-xs text-zinc-400">Último pago</div>
            {lastPay ? (
              <div className="mt-1">
                <div className="text-lg font-semibold text-zinc-100">
                  ${lastPay.amount.toFixed(0)}
                </div>
                <div className="text-xs text-zinc-400">
                  {String(lastPay.period_month).padStart(2, "0")}/{lastPay.period_year} • {lastPay.method ?? "—"}
                  {lastPay.method === "transfer" && lastPay.method_channel ? ` (${lastPay.method_channel})` : ""}
                </div>
              </div>
            ) : (
              <div className="mt-1 text-zinc-500">—</div>
            )}
          </div>
        </div>

        {/* Vista enriquecida */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Calendario de asistencias */}
          <AttendanceCalendar clientId={client.id} monthsBack={3} />

          {/* Últimos 3 pagos */}
          <div className="rounded-xl border border-white/10 bg-zinc-950/60 p-3">
            <div className="text-sm mb-2 text-zinc-300">Últimos pagos</div>
            <LastPayments clientId={client.id} />
          </div>
        </div>

        {/* Footer de acciones sticky */}
        <div className="sticky bottom-0 -mx-4 px-4 pt-3 pb-3 bg-gradient-to-t from-zinc-900/90 to-transparent backdrop-blur">
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              className="bg-zinc-800 hover:bg-zinc-700"
              onClick={() => {
                setOpenCheckin(true);
                onAction?.("checkin", client);
              }}
            >
              Registrar asistencia
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="border-cyan-400/40 hover:bg-cyan-400/10"
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
              className="hover:bg-zinc-800"
              onClick={() => onAction?.("viewHistory", client)}
            >
              Ver historial
            </Button>
          </div>
        </div>
      </CardContent>

      {/* Diálogos */}
      <CheckinDialog
        open={openCheckin}
        onOpenChange={setOpenCheckin}
        clientId={client.id}
        clientName={client.full_name}
        onSuccess={onRefresh}
      />
      <NewPaymentDialog
        open={openPayment}
        onOpenChange={setOpenPayment}
        clientId={client.id}
        clientName={client.full_name}
        onSuccess={onRefresh}
      />
    </Card>
  );
}
