import { useEffect, useState } from "react";
import { PencilLine } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useDeleteExerciseMediaMutation,
  useExerciseMetaQuery,
  useUpdateExerciseMutation,
  useUploadExerciseMediaMutation,
} from "@/services/exercises.queries";
import { toastSuccess } from "@/lib/toast";
import type { Exercise } from "@/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exercise: Exercise;
};

// Edición de nombre/descripción/grupo/tipos/URL externa (mismo patrón que
// `EditMembershipPlanDialog`) más la media, que se maneja aparte: subir un
// archivo nuevo o quitar el archivo propio son mutaciones independientes del
// `PATCH` de campos (design D4/D5/D6), así que cada una tiene su propio botón
// y su propio estado de error/pendiente.
export default function EditExerciseDialog({ open, onOpenChange, exercise }: Props) {
  const [name, setName] = useState(exercise.name);
  const [description, setDescription] = useState(exercise.description ?? "");
  const [muscleGroup, setMuscleGroup] = useState(exercise.muscle_group ?? "");
  const [trainingTypes, setTrainingTypes] = useState<string[]>(exercise.training_types);
  const [externalMediaUrl, setExternalMediaUrl] = useState(exercise.external_media_url ?? "");
  const [error, setError] = useState<string | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  // H8 (verificación): `exercise` es la copia congelada que el listener de
  // clic guardó en `action.exercise` (`Exercises.tsx`); la subida/borrado de
  // media invalida el listado, pero ese objeto no cambia solo porque el
  // listado se refetchee. El preview de media lee de este estado, que sí se
  // actualiza con lo que devuelve cada mutación de media.
  const [mediaExercise, setMediaExercise] = useState<Exercise>(exercise);

  const { data: meta } = useExerciseMetaQuery();
  const updateMutation = useUpdateExerciseMutation();
  const uploadMutation = useUploadExerciseMediaMutation();
  const deleteMediaMutation = useDeleteExerciseMediaMutation();

  useEffect(() => {
    if (open) {
      setName(exercise.name);
      setDescription(exercise.description ?? "");
      setMuscleGroup(exercise.muscle_group ?? "");
      setTrainingTypes(exercise.training_types);
      setExternalMediaUrl(exercise.external_media_url ?? "");
      setError(null);
      setMediaError(null);
      setMediaExercise(exercise);
    }
  }, [open, exercise]);

  function toggleTrainingType(type: string) {
    setTrainingTypes((current) =>
      current.includes(type) ? current.filter((t) => t !== type) : [...current, type]
    );
  }

  const canSubmit = name.trim().length > 0;

  async function save() {
    setError(null);
    try {
      await updateMutation.mutateAsync({
        id: exercise.id,
        input: {
          name: name.trim(),
          description: description.trim() || null,
          muscle_group: muscleGroup || null,
          training_types: trainingTypes,
          external_media_url: externalMediaUrl.trim() || null,
        },
      });

      onOpenChange(false);
      toastSuccess("Ejercicio actualizado", "Los cambios ya se ven reflejados.");
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Error desconocido");
    }
  }

  async function handleUploadFile(file: File) {
    setMediaError(null);
    try {
      const updated = await uploadMutation.mutateAsync({ id: exercise.id, file });
      setMediaExercise(updated);
      toastSuccess("Archivo actualizado", "El nuevo archivo ya es la media principal.");
    } catch (err: any) {
      setMediaError(err?.response?.data?.detail ?? "No se pudo subir el archivo");
    }
  }

  async function handleRemoveFile() {
    setMediaError(null);
    try {
      const updated = await deleteMediaMutation.mutateAsync(exercise.id);
      setMediaExercise(updated);
      toastSuccess("Archivo eliminado", "Se conserva la URL externa si tenía una cargada.");
    } catch (err: any) {
      setMediaError(err?.response?.data?.detail ?? "No se pudo quitar el archivo");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-surface-1 text-foreground">
        <DialogHeader>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-label-caps uppercase text-primary-strong">
            <PencilLine className="h-3.5 w-3.5" />
            Editar ejercicio
          </div>
          <DialogTitle className="pt-3 text-2xl font-semibold text-foreground">
            Editar ejercicio
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Editar este ejercicio no altera las plantillas ni las sesiones que ya lo referencian.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">Nombre</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">Descripción (opcional)</label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">Grupo muscular (opcional)</label>
            <select
              value={muscleGroup}
              onChange={(e) => setMuscleGroup(e.target.value)}
              className="w-full rounded-md border border-border bg-surface-2/40 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Sin grupo muscular</option>
              {(meta?.muscle_groups ?? []).map((group) => (
                <option key={group} value={group}>
                  {group}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Tipos de entrenamiento (opcional)</label>
            <div className="flex flex-wrap gap-2">
              {(meta?.training_types ?? []).map((type) => (
                <label
                  key={type}
                  className="flex items-center gap-2 rounded-md border border-border bg-surface-2/20 px-3 py-1.5 text-sm text-foreground"
                >
                  <input
                    type="checkbox"
                    checked={trainingTypes.includes(type)}
                    onChange={() => toggleTrainingType(type)}
                    className="h-4 w-4 rounded border-border"
                  />
                  {type}
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">URL externa de media (opcional)</label>
            <Input
              value={externalMediaUrl}
              onChange={(e) => setExternalMediaUrl(e.target.value)}
              placeholder="https://youtube.com/..."
            />
          </div>

          <div className="space-y-2 rounded-md border border-border bg-surface-2/20 p-3">
            <p className="text-sm text-muted-foreground">Archivo propio</p>
            {/* El preview lee `media_kind` que ya vino del backend (design
                D3/D6): no reimplementa la prioridad archivo > URL externa acá. */}
            {mediaExercise.media_kind === "file" ? (
              <div className="space-y-2">
                {mediaExercise.media_content_type?.startsWith("video/") ? (
                  <video
                    controls
                    preload="metadata"
                    src={mediaExercise.media_file_url ?? undefined}
                    className="max-h-40 w-full rounded-md bg-black"
                  />
                ) : (
                  <img
                    src={mediaExercise.media_file_url ?? undefined}
                    alt={`Media de ${exercise.name}`}
                    className="max-h-40 rounded-md"
                  />
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={deleteMediaMutation.isPending}
                  onClick={handleRemoveFile}
                >
                  {deleteMediaMutation.isPending ? "Quitando..." : "Quitar archivo"}
                </Button>
              </div>
            ) : mediaExercise.media_kind === "external" ? (
              <p className="text-sm text-muted-foreground">
                Se muestra la URL externa como demostración. Subí un archivo para que pase a
                tener prioridad.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Este ejercicio no tiene media.</p>
            )}
            <input
              type="file"
              accept="video/mp4,image/gif,image/jpeg,image/png"
              disabled={uploadMutation.isPending}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUploadFile(file);
                e.target.value = "";
              }}
              className="w-full text-sm text-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-surface-2/40 file:px-3 file:py-1.5 file:text-sm"
            />
            {mediaError ? (
              <p role="alert" className="text-sm text-destructive">
                {mediaError}
              </p>
            ) : null}
          </div>
        </div>

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={updateMutation.isPending || !canSubmit}>
            {updateMutation.isPending ? "Guardando..." : "Guardar cambios"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
