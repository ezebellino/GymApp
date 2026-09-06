import { useState } from "react";
import { LayoutTemplate } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useRoutineTemplatesQuery } from "@/services/routineTemplates.queries";
import type { RoutineTemplateSummary } from "@/types";
import ListPageLayout from "@/components/ListPageLayout";
import DataError from "@/components/DataError";
import CreateRoutineTemplateDialog from "@/components/CreateRoutineTemplateDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Header sticky del listado, mismo patrón que `Users.tsx` (dec. 7 del design
// de `redesign-list-page-layout`, ver el comentario de cabecera de ese
// archivo para el detalle de por qué cada clase está ahí).
const STICKY_HEAD_CLASS =
  "sticky top-0 z-10 bg-table-head px-4 font-bold text-label-caps uppercase text-muted-foreground shadow-[inset_0_-1px_0_var(--border-hairline)]";

function SkeletonRow() {
  return (
    <TableRow className="animate-pulse">
      <TableCell className="px-4 py-2">
        <div className="h-4 w-40 rounded bg-surface-2/40" />
      </TableCell>
      <TableCell className="px-4 py-2">
        <div className="h-4 w-20 rounded bg-surface-2/40" />
      </TableCell>
      <TableCell className="px-4 py-2">
        <div className="h-4 w-16 rounded bg-surface-2/40" />
      </TableCell>
      <TableCell className="px-4 py-2">
        <div className="h-4 w-16 rounded bg-surface-2/40" />
      </TableCell>
      <TableCell className="px-4 py-2">
        <div className="h-8 w-16 rounded bg-surface-2/40" />
      </TableCell>
    </TableRow>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <div className="mb-3 rounded-full border border-border bg-surface-2/30 px-4 py-2 text-label-caps uppercase text-muted-foreground">
        Sin plantillas
      </div>
      <p className="max-w-md text-sm leading-6 text-muted-foreground">
        Todavía no creaste ninguna plantilla de rutina. Creá la primera para poder
        asignarla a tus clientes.
      </p>
    </div>
  );
}

export default function Routines() {
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const { data, isPending, isError, refetch } = useRoutineTemplatesQuery();

  const rows: RoutineTemplateSummary[] = data ?? [];
  const total = rows.length;

  return (
    <>
      <ListPageLayout
        title="Rutinas"
        count={`${total} ${total === 1 ? "plantilla" : "plantillas"}`}
        primaryAction={
          <Button
            type="button"
            aria-label="Crear plantilla"
            onClick={() => setCreateOpen(true)}
          >
            <LayoutTemplate className="h-4 w-4 md:mr-2" />
            <span className="hidden md:inline">Crear plantilla</span>
          </Button>
        }
      >
        <div className="h-full">
          <Table containerClassName="h-full overflow-auto">
            <TableHeader>
              <TableRow className="border-none hover:bg-transparent">
                <TableHead className={STICKY_HEAD_CLASS}>Nombre</TableHead>
                <TableHead className={STICKY_HEAD_CLASS}>Etiqueta</TableHead>
                <TableHead className={STICKY_HEAD_CLASS}>Días</TableHead>
                <TableHead className={STICKY_HEAD_CLASS}>Miembros</TableHead>
                <TableHead className={STICKY_HEAD_CLASS}>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isPending && (
                <>
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </>
              )}

              {!isPending && isError && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={5} className="p-0">
                    <DataError
                      title="No se pudieron cargar las plantillas"
                      description="Intenta nuevamente en unos segundos."
                      onRetry={() => refetch()}
                    />
                  </TableCell>
                </TableRow>
              )}

              {!isPending && !isError && rows.length === 0 && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={5} className="p-0">
                    <EmptyState />
                  </TableCell>
                </TableRow>
              )}

              {!isPending &&
                !isError &&
                rows.map((template) => (
                  <TableRow
                    key={template.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/routines/${template.id}`)}
                  >
                    <TableCell className="px-4 py-2 font-medium text-foreground">
                      {template.name}
                    </TableCell>
                    <TableCell className="px-4 py-2">
                      <Badge variant="outline">{template.tag}</Badge>
                    </TableCell>
                    <TableCell className="px-4 py-2 text-muted-foreground">
                      {template.day_count}
                    </TableCell>
                    <TableCell className="px-4 py-2 text-muted-foreground">
                      {template.assignment_count}
                    </TableCell>
                    <TableCell className="px-4 py-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        aria-label={`Ver plantilla ${template.name}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          navigate(`/routines/${template.id}`);
                        }}
                      >
                        Ver
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      </ListPageLayout>

      <CreateRoutineTemplateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(template) => navigate(`/routines/${template.id}`)}
      />
    </>
  );
}
