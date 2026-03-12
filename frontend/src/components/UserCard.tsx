import { useState } from "react";
import { BadgeCheck, CalendarClock, Mail, Phone, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Client, Payment, Role } from "@/types";
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

function methodLabel(method?: string | null) {
  if (!method) return "-";
  if (method === "cash") return "Efectivo";
  if (method === "transfer") return "Transferencia";
  return method;
}

export default function UserCard({
  viewerRole,
  client,
  stats,
  onAction,
  onRefresh,
}: Props) {
  const lastPay = stats?.lastPayment;
  const attendanceCount = stats?.attendanceCount ?? 0;

  const [openPayment, setOpenPayment] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);

  return (
    <Card className="overflow-hidden rounded-[28px] border-amber-200/10 bg-[#0d0b0a]/92 shadow-[0_24px_80px_-50px_rgba(249,115,22,0.55)]">
      <CardHeader className="border-b border-amber-200/10 bg-[linear-gradient(135deg,rgba(250,204,21,0.1),rgba(255,247,237,0.03)_45%,rgba(249,115,22,0.12))] pb-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="inline-flex rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-amber-100">
              Ficha del cliente
            </div>
            <CardTitle className="mt-4 text-2xl text-zinc-50">
              <span className="warm-accent-text">{client.full_name}</span>
            </CardTitle>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-zinc-200">
              <span>Alta: {new Date(client.join_date).toLocaleDateString("es-AR")}</span>
              <span className="text-zinc-600">•</span>
              {client.is_active ? (
                <Badge className="border-amber-300/20 bg-amber-300/10 text-amber-100 hover:bg-amber-300/10">
                  Activo
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="border-white/10 bg-white/[0.03] text-zinc-300"
                >
                  Inactivo
                </Badge>
              )}
            </div>
          </div>

          <div className="min-w-[190px] space-y-2 text-sm">
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-zinc-300">
              <Phone className="h-4 w-4 text-amber-200" />
              <span className="break-all">{client.phone || "Sin teléfono"}</span>
            </div>
            {viewerRole === "owner" ? (
              <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-zinc-400">
                <Mail className="h-4 w-4 text-amber-200" />
                <span className="break-all">{client.email ?? "Sin email"}</span>
              </div>
            ) : null}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 px-4 py-5 text-zinc-100 sm:px-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[22px] border border-amber-200/10 bg-[linear-gradient(135deg,rgba(250,204,21,0.08),rgba(255,255,255,0.02)_50%,rgba(249,115,22,0.08))] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                  Asistencias
                </p>
                <p className="mt-2 text-3xl font-semibold text-zinc-50">
                  {attendanceCount}
                </p>
                <p className="mt-1 text-sm text-zinc-400">Registradas en el historial reciente</p>
              </div>
              <div className="rounded-2xl bg-white/[0.05] p-3 text-amber-100">
                <CalendarClock className="h-5 w-5" />
              </div>
            </div>
          </div>

          <div className="rounded-[22px] border border-amber-200/10 bg-[linear-gradient(135deg,rgba(249,115,22,0.12),rgba(255,247,237,0.03)_50%,rgba(250,204,21,0.08))] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                  Último pago
                </p>
                {lastPay ? (
                  <>
                    <p className="mt-2 text-3xl font-semibold text-zinc-50">
                      ${lastPay.amount.toFixed(0)}
                    </p>
                    <p className="mt-1 text-sm text-zinc-400">
                      {String(lastPay.period_month).padStart(2, "0")}/{lastPay.period_year} •{" "}
                      {methodLabel(lastPay.method)}
                      {lastPay.method === "transfer" && lastPay.method_channel
                        ? ` (${lastPay.method_channel})`
                        : ""}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="mt-2 text-3xl font-semibold text-zinc-50">-</p>
                    <p className="mt-1 text-sm text-zinc-400">Todavía no registra pagos</p>
                  </>
                )}
              </div>
              <div className="rounded-2xl bg-white/[0.05] p-3 text-amber-100">
                <Wallet className="h-5 w-5" />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <AttendanceCalendar clientId={client.id} monthsBack={3} />

          <div className="rounded-[24px] border border-white/10 bg-zinc-950/60 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-zinc-100">
              <BadgeCheck className="h-4 w-4 text-amber-200" />
              Últimos pagos
            </div>
            <LastPayments clientId={client.id} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-white/10 pt-4">
          <Button
            size="sm"
            className="border border-amber-300/20 bg-[linear-gradient(90deg,rgba(250,204,21,0.14),rgba(255,247,237,0.06),rgba(249,115,22,0.16))] text-amber-50 hover:opacity-95"
            onClick={() => setOpenEdit(true)}
          >
            Editar datos
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="border-white/10 bg-white/[0.03] text-zinc-100 hover:bg-white/[0.08]"
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
            className="text-zinc-100 hover:bg-white/[0.06]"
            onClick={() => onAction?.("viewHistory", client)}
          >
            Ver historial
          </Button>
        </div>
      </CardContent>

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
