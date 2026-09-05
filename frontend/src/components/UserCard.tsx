import { useEffect, useState } from "react";
import {
  BadgeCheck,
  CalendarClock,
  Download,
  Mail,
  MessageCircle,
  Phone,
  Wallet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  AppSettings,
  Payment,
  Role,
  User,
  UserProgressSummary,
} from "@/types";
import NewPaymentDialog from "./NewPaymentDialog";
import AttendanceCalendar from "./AttendanceCalendar";
import LastPayments from "./LastPayments";
import EditUserDialog from "./EditUserDialog";
import api from "@/lib/http";
import { toastError, toastInfo, toastSuccess } from "@/lib/toast";

type Props = {
  viewerRole: Role;
  client: User;
  stats?: {
    lastPayment?: Payment | null;
    attendanceCount?: number;
  };
  onAction?: (action: "checkin" | "newPayment" | "viewHistory", client: User) => void;
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
  const [defaultFee, setDefaultFee] = useState(30000);
  const [quickPaying, setQuickPaying] = useState(false);
  const [downloadingReport, setDownloadingReport] = useState(false);
  const [sharingReport, setSharingReport] = useState(false);
  const [quickPaymentMethod, setQuickPaymentMethod] = useState<"cash" | "transfer">("cash");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { data } = await api.get<AppSettings>("/settings");
        if (!cancelled) {
          setDefaultFee(Number(data?.default_fee) || 30000);
        }
      } catch {
        const raw = localStorage.getItem("app_settings");
        if (!raw || cancelled) return;
        try {
          const parsed = JSON.parse(raw);
          if (!cancelled) {
            setDefaultFee(Number(parsed?.default_fee) || 30000);
          }
        } catch {
          // ignore parse errors
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleQuickPayment(method: "cash" | "transfer") {
    setQuickPaying(true);
    try {
      const now = new Date();
      await api.post("/payments", {
        user_id: client.id,
        amount: defaultFee,
        method,
        method_channel: null,
        note: "Cobro rapido de cuota mensual",
        period_month: now.getMonth() + 1,
        period_year: now.getFullYear(),
      });

      onRefresh?.();
      window.dispatchEvent(
        new CustomEvent("payments:created", { detail: { client_id: client.id } })
      );

      toastSuccess(
        "Pago rapido registrado",
        `Se registró la cuota vigente de ${client.full_name} por ${method === "cash" ? "efectivo" : "transferencia"}.`
      );
    } catch (error: any) {
      toastError(
        "No se pudo crear el pago rapido",
        error?.response?.data?.detail ?? "Revisa si el periodo ya fue cobrado."
      );
    } finally {
      setQuickPaying(false);
    }
  }

  function buildClientProgressPdf(summary: UserProgressSummary) {
    const escapePdf = (value: string) =>
      value.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");

    const text = (
      x: number,
      y: number,
      size: number,
      value: string,
      color = "1 1 1",
      font = "F1"
    ) =>
      `BT /${font} ${size} Tf ${color} rg 1 0 0 1 ${x} ${y} Tm (${escapePdf(value)}) Tj ET`;

    const rect = (
      x: number,
      y: number,
      width: number,
      height: number,
      fill = "0.09 0.09 0.10"
    ) => `${fill} rg ${x} ${y} ${width} ${height} re f`;

    const lines: string[] = [];
    const amber = "0.980 0.800 0.082";
    const cream = "1.000 0.969 0.929";
    const orange = "0.976 0.451 0.086";
    const emerald = "0.204 0.827 0.600";
    const zinc = "0.635 0.635 0.659";
    const white = "0.980 0.980 0.980";

    const score = Math.max(
      10,
      Math.min(
        100,
        Math.min(summary.log_count * 3, 40) +
          Math.min(summary.attendance_count * 2, 30) +
          Math.min((summary.top_improvement ? 1 : 0) * 30, 30)
      )
    );

    lines.push(rect(0, 0, 595, 842, "0.04 0.04 0.04"));
    lines.push(rect(44, 770, 120, 26, amber));
    lines.push(text(58, 779, 11, "REPORTE GYM", "0.04 0.04 0.04"));
    lines.push(text(44, 732, 24, summary.gym_name.slice(0, 32), white));
    lines.push(text(44, 707, 17, "PROGRESO Y CRECIMIENTO", cream));
    lines.push(
      text(
        44,
        688,
        10,
        `Cliente: ${summary.user_name} | Emitido: ${new Date().toLocaleDateString("es-AR")}`,
        zinc
      )
    );

    const cards = [
      ["ASISTENCIAS", String(summary.attendance_count), "presencias"],
      ["RUTINAS", String(summary.log_count), "cargas"],
      ["DIAS", String(summary.unique_days), "activos"],
      ["EJERCICIOS", String(summary.unique_exercises), "trabajados"],
    ];

    cards.forEach(([label, value, hint], index) => {
      const x = 44 + index * 132;
      lines.push(rect(x, 595, 118, 70, "0.10 0.10 0.11"));
      lines.push(text(x + 10, 645, 8, label, zinc));
      lines.push(text(x + 10, 623, 18, value, white));
      lines.push(text(x + 10, 606, 8, hint, zinc));
    });

    lines.push(rect(44, 505, 507, 72, "0.10 0.10 0.11"));
    lines.push(text(58, 553, 13, "INDICE GENERAL DE PROGRESO", white));
    lines.push(
      text(
        58,
        537,
        9,
        "Lectura simple del momento actual: constancia, asistencia y mejoras.",
        zinc
      )
    );
    lines.push(rect(58, 518, 320, 10, "0.15 0.15 0.16"));
    lines.push(rect(58, 518, Math.max(26, 3.2 * score), 10, score >= 65 ? emerald : amber));
    lines.push(text(466, 535, 24, `${score}/100`, white));

    lines.push(rect(44, 278, 507, 205, "0.10 0.10 0.11"));
    lines.push(text(58, 455, 13, "METRICA DE CRECIMIENTO", white));
    const chartTitle = summary.top_improvement
      ? `Crecimiento destacado en ${summary.top_improvement.exercise_name}`
      : "Constancia general y progreso acumulado";
    lines.push(text(58, 439, 9, chartTitle.slice(0, 82), zinc));

    const chart = summary.top_improvement
      ? [
          ["Inicio", summary.top_improvement.start_weight],
          ["Actual", summary.top_improvement.end_weight],
          ["Mejora", summary.top_improvement.delta_weight],
        ]
      : [
          ["Rutinas", summary.log_count],
          ["Asist.", summary.attendance_count],
          ["Dias", summary.unique_days],
        ];
    const maxValue = Math.max(...chart.map((item) => Number(item[1]) || 0), 1);
    const graphX = 70;
    const graphY = 306;
    const graphW = 452;
    const graphH = 100;
    lines.push(`0.25 0.25 0.27 RG ${graphX} ${graphY} m ${graphX} ${graphY + graphH} l S`);
    lines.push(`0.25 0.25 0.27 RG ${graphX} ${graphY} m ${graphX + graphW} ${graphY} l S`);
    const step = graphW / chart.length;
    chart.forEach(([label, rawValue], index) => {
      const value = Number(rawValue) || 0;
      const barH = Math.max(8, (value / maxValue) * graphH);
      const x = graphX + index * step + 28;
      lines.push(rect(x, graphY, 42, barH, index % 2 === 0 ? amber : orange));
      lines.push(text(x + 4, graphY - 12, 8, label, zinc));
      lines.push(text(x + 6, graphY + barH + 5, 8, `${value}`, white));
    });

    lines.push(rect(44, 104, 247, 150, "0.10 0.10 0.11"));
    lines.push(text(58, 228, 13, "DESTACADOS DE FUERZA", white));
    if (summary.best_exercise_name && typeof summary.best_weight_kg === "number") {
      lines.push(
        text(
          58,
          204,
          10,
          `Mejor marca: ${summary.best_exercise_name.slice(0, 18)} - ${summary.best_weight_kg} kg`,
          cream
        )
      );
    } else {
      lines.push(text(58, 204, 10, "Mejor marca: sin registros todavia", cream));
    }
    if (summary.top_improvement) {
      lines.push(
        text(
          58,
          178,
          9,
          `+${summary.top_improvement.delta_weight} kg en ${summary.top_improvement.exercise_name.slice(0, 18)}`,
          zinc
        )
      );
      lines.push(
        text(
          58,
          160,
          9,
          `${summary.top_improvement.start_weight} kg -> ${summary.top_improvement.end_weight} kg`,
          zinc
        )
      );
    } else {
      lines.push(text(58, 178, 9, "Aun no hay mejoras comparativas suficientes.", zinc));
    }
    lines.push(
      text(
        58,
        124,
        9,
        `Volumen acumulado: ${Math.round(summary.total_volume).toLocaleString("es-AR")}`,
        zinc
      )
    );

    lines.push(rect(304, 104, 247, 150, "0.10 0.10 0.11"));
    lines.push(text(318, 228, 13, "MENSAJE DE ALIENTO", white));
    const motivationLines = summary.motivation.match(/.{1,34}(\s|$)/g) ?? [summary.motivation];
    motivationLines.slice(0, 4).forEach((line, index) => {
      lines.push(text(318, 198 - index * 16, 10, line.trim(), index === 0 ? cream : zinc));
    });
    lines.push(
      text(
        318,
        124,
        9,
        `Ultimo entrenamiento: ${
          summary.last_training
            ? new Date(summary.last_training).toLocaleDateString("es-AR")
            : "sin datos"
        }`,
        zinc
      )
    );

    lines.push(
      text(
        44,
        78,
        8,
        "Mini Espacio | Seguimiento de progreso | Entrenamiento, constancia y evolucion real.",
        zinc
      )
    );

    const content = lines.join("\n");
    const contentBytes = new TextEncoder().encode(content);
    const objects = [
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
      `<< /Length ${contentBytes.length} >>\nstream\n${content}\nendstream`,
    ];

    let pdf = "%PDF-1.4\n";
    const offsets = [0];
    objects.forEach((object, index) => {
      offsets.push(pdf.length);
      pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });
    const xrefOffset = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += "0000000000 65535 f \n";
    offsets.slice(1).forEach((offset) => {
      pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
    });
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return new Blob([pdf], { type: "application/pdf" });
  }

  async function fetchProgressReport() {
    const { data } = await api.get<UserProgressSummary>(
      `/routines/users/${client.id}/progress-summary`
    );
    const blob = buildClientProgressPdf(data);
    const safeName = client.full_name.toLowerCase().replace(/\s+/g, "-");
    const filename = `progreso-${safeName}.pdf`;
    return { blob, filename };
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }

  async function handleDownloadProgressReport() {
    setDownloadingReport(true);
    try {
      const { blob, filename } = await fetchProgressReport();
      downloadBlob(blob, filename);

      toastSuccess(
        "PDF listo",
        `Se descargo el reporte de progreso de ${client.full_name}.`
      );
    } catch (error: any) {
      toastError(
        "No se pudo generar el PDF",
        error?.response?.data?.detail ?? "Intenta nuevamente en unos segundos."
      );
    } finally {
      setDownloadingReport(false);
    }
  }

  async function handleShareProgressReport() {
    if (!client.phone) {
      toastInfo(
        "Falta WhatsApp",
        "Este cliente no tiene telefono cargado para compartirle el reporte."
      );
      return;
    }

    setSharingReport(true);
    try {
      const { blob, filename } = await fetchProgressReport();
      let message =
        `Hola ${client.full_name}, te compartimos tu reporte de progreso de Mini Espacio. ` +
        `Segui asi, tu constancia ya esta mostrando resultados.`;

      try {
        const { data } = await api.get<UserProgressSummary>(
          `/routines/users/${client.id}/progress-summary`
        );
        const highlights: string[] = [];

        if (data.top_improvement) {
          highlights.push(
            `subiste ${data.top_improvement.delta_weight} kg en ${data.top_improvement.exercise_name}`
          );
        }
        if (typeof data.best_weight_kg === "number" && data.best_exercise_name) {
          highlights.push(
            `tu mejor marca actual es ${data.best_weight_kg} kg en ${data.best_exercise_name}`
          );
        }
        if (data.attendance_count > 0) {
          highlights.push(`ya llevas ${data.attendance_count} asistencias registradas`);
        }

        const summaryText = highlights.length
          ? `Lo mas lindo de este proceso: ${highlights.slice(0, 2).join(" y ")}. `
          : "";

        message =
          `Hola ${client.full_name}, te compartimos tu reporte de progreso de ${data.gym_name}. ` +
          summaryText +
          `${data.motivation}`;
      } catch {
        // keep the generic fallback message
      }

      const file = new File([blob], filename, { type: "application/pdf" });
      const canNativeShare =
        typeof navigator !== "undefined" &&
        typeof navigator.share === "function" &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] });

      if (canNativeShare) {
        await navigator.share({
          title: `Progreso de ${client.full_name}`,
          text: message,
          files: [file],
        });
        toastSuccess(
          "Reporte compartido",
          `Se abrio el flujo para enviarle el PDF a ${client.full_name}.`
        );
        return;
      }

      downloadBlob(blob, filename);

      const digits = client.phone.replace(/\D/g, "");
      const normalizedPhone = digits.startsWith("54") ? digits : `54${digits}`;
      const whatsappUrl = `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, "_blank", "noopener,noreferrer");

      toastInfo(
        "PDF listo para compartir",
        "Descargamos el reporte y abrimos WhatsApp con el mensaje preparado. En algunos navegadores el archivo se adjunta manualmente."
      );
    } catch (error: any) {
      toastError(
        "No se pudo preparar el reporte",
        error?.response?.data?.detail ?? "Intenta nuevamente en unos segundos."
      );
    } finally {
      setSharingReport(false);
    }
  }

  return (
    <Card className="overflow-hidden rounded-xl border-border bg-surface-1">
      <CardHeader className="border-b border-border bg-surface-2/40 pb-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="inline-flex rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-label-caps uppercase text-primary-strong">
              Ficha del cliente
            </div>
            <CardTitle className="mt-4 text-2xl text-foreground">
              <span className="warm-accent-text">{client.full_name}</span>
            </CardTitle>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-foreground">
              <span>
                Alta:{" "}
                {new Date(client.membership_start_date ?? client.created_at).toLocaleDateString(
                  "es-AR"
                )}
              </span>
              <span className="text-muted-foreground">•</span>
              {client.membership_status === "active" ? (
                <Badge className="border-primary/30 bg-primary/10 text-primary-strong hover:bg-primary/10">
                  Activo
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="border-border bg-surface-2/30 text-muted-foreground"
                >
                  {client.membership_status === "cancelled" ? "Dado de baja" : "Sin membresía"}
                </Badge>
              )}
            </div>
          </div>

          <div className="min-w-[190px] space-y-2 text-sm">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-2/30 px-3 py-2 text-muted-foreground">
              <Phone className="h-4 w-4 text-primary-strong" />
              <span className="break-all">{client.phone || "Sin teléfono"}</span>
            </div>
            {viewerRole === "owner" ? (
              <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-2/30 px-3 py-2 text-muted-foreground">
                <Mail className="h-4 w-4 text-primary-strong" />
                <span className="break-all">{client.email ?? "Sin email"}</span>
              </div>
            ) : null}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 px-4 py-5 text-foreground sm:px-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-primary/20 bg-primary/10 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-label-caps uppercase text-muted-foreground">
                  Asistencias
                </p>
                <p className="mt-2 text-3xl font-semibold text-foreground">
                  {attendanceCount}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">Registradas en el historial reciente</p>
              </div>
              <div className="rounded-full bg-primary/15 p-3 text-primary-strong">
                <CalendarClock className="h-5 w-5" />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-primary/20 bg-primary/10 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-label-caps uppercase text-muted-foreground">
                  Último pago
                </p>
                {lastPay ? (
                  <>
                    <p className="mt-2 text-3xl font-semibold text-foreground">
                      ${lastPay.amount.toFixed(0)}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {String(lastPay.period_month).padStart(2, "0")}/{lastPay.period_year} •{" "}
                      {methodLabel(lastPay.method)}
                      {lastPay.method === "transfer" && lastPay.method_channel
                        ? ` (${lastPay.method_channel})`
                        : ""}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="mt-2 text-3xl font-semibold text-foreground">-</p>
                    <p className="mt-1 text-sm text-muted-foreground">Todavía no registra pagos</p>
                  </>
                )}
              </div>
              <div className="rounded-full bg-primary/15 p-3 text-primary-strong">
                <Wallet className="h-5 w-5" />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <AttendanceCalendar clientId={client.id} monthsBack={3} />

          <div className="rounded-xl border border-border bg-canvas/60 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
              <BadgeCheck className="h-4 w-4 text-primary-strong" />
              Últimos pagos
            </div>
            <LastPayments clientId={client.id} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          <Button size="sm" onClick={() => setOpenEdit(true)}>
            Editar datos
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="border-border bg-surface-2/40 text-foreground hover:border-primary/30 hover:bg-surface-2/70"
            onClick={() => {
              setOpenPayment(true);
              onAction?.("newPayment", client);
            }}
          >
            Crear pago
          </Button>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              className={
                quickPaymentMethod === "cash"
                  ? "border-primary/30 bg-primary/10 text-primary-strong"
                  : "border-border bg-surface-2/40 text-foreground hover:border-primary/30 hover:bg-surface-2/70"
              }
              onClick={() => setQuickPaymentMethod("cash")}
            >
              Efectivo
            </Button>
            <Button
              size="sm"
              variant="outline"
              className={
                quickPaymentMethod === "transfer"
                  ? "border-primary/30 bg-primary/10 text-primary-strong"
                  : "border-border bg-surface-2/40 text-foreground hover:border-primary/30 hover:bg-surface-2/70"
              }
              onClick={() => setQuickPaymentMethod("transfer")}
            >
              Transferencia
            </Button>
            <Button
              size="sm"
              onClick={() => handleQuickPayment(quickPaymentMethod)}
              disabled={quickPaying}
            >
              {quickPaying
                ? "Cobrando..."
                : `Cobro rapido $${defaultFee.toLocaleString("es-AR")}`}
            </Button>
          </div>

          <Button
            size="sm"
            variant="ghost"
            className="text-foreground hover:bg-surface-2/40"
            onClick={() => onAction?.("viewHistory", client)}
          >
            Ver historial
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="border-border bg-surface-2/40 text-foreground hover:border-primary/30 hover:bg-surface-2/70"
            onClick={handleDownloadProgressReport}
            disabled={downloadingReport}
          >
            <Download className="mr-2 h-4 w-4" />
            {downloadingReport ? "Generando PDF..." : "PDF progreso"}
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="border-emerald-500/20 bg-emerald-500/8 text-emerald-800 hover:bg-emerald-500/15 disabled:opacity-60 dark:text-emerald-100"
            onClick={handleShareProgressReport}
            disabled={sharingReport || !client.phone}
          >
            <MessageCircle className="mr-2 h-4 w-4" />
            {sharingReport ? "Preparando..." : "WhatsApp progreso"}
          </Button>
        </div>
      </CardContent>

      <NewPaymentDialog
        open={openPayment}
        onOpenChange={setOpenPayment}
        clientId={client.id}
        clientName={client.full_name}
        defaultFee={defaultFee}
        onSuccess={onRefresh}
      />
      <EditUserDialog
        open={openEdit}
        onOpenChange={setOpenEdit}
        user={client}
        onSuccess={onRefresh}
      />
    </Card>
  );
}
