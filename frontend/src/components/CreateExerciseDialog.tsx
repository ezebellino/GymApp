import { useEffect, useState } from "react";
import { Dumbbell } from "lucide-react";
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
  useCreateExerciseMutation,
  useExerciseMetaQuery,
  useUploadExerciseMediaMutation,
} from "@/services/exercises.queries";
import { toastSuccess } from "@/lib/toast";
import type { Exercise } from "@/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (exercise: Exercise) => void;
};

// Alta de ejercicio: nombre obligatorio, descripción/grupo/tipos/URL externa
// opcionales, y un input de archivo opcional. El alta con archivo son **dos
// requests** (design D12): primero `POST /exercises/`, y recién con el id
// creado, `POST /exercises/{id}/media`. Si la segunda falla, el ejercicio
// queda creado sin archivo y el diálogo ofrece reintentar solo la subida
// sobre ese mismo ejercicio — no se pierde el alta.
export default function CreateExerciseDialog({ open, onOpenChange, onCreated }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [muscleGroup, setMuscleGroup] = useState("");
  const [trainingTypes, setTrainingTypes] = useState<string[]>([]);
  const [externalMediaUrl, setExternalMediaUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [createdExercise, setCreatedExercise] = useState<Exercise | null>(null);

  const { data: meta } = useExerciseMetaQuery();
  const createMutation = useCreateExerciseMutation();
  const uploadMutation = useUploadExerciseMediaMutation();

  useEffect(() => {
    if (open) {
      setName("");
      setDescription("");
      setMuscleGroup("");
      setTrainingTypes([]);
      setExternalMediaUrl("");
      setFile(null);
      setError(null);
      setUploadError(null);
      setCreatedExercise(null);
    }
  }, [open]);

  function toggleTrainingType(type: string) {
    setTrainingTypes((current) =>
      current.includes(type) ? current.filter((t) => t !== type) : [...current, type]
    );
  }

  const canSubmit = name.trim().length > 0;

  async function uploadMedia(exercise: Exercise, mediaFile: File) {
    setUploadError(null);
    try {
      await uploadMutation.mutateAsync({ id: exercise.id, file: mediaFile });
      onOpenChange(false);
      onCreated?.(exercise);
      toastSuccess("Ejercicio creado", `${exercise.name} ya está disponible.`);
    } catch (err: any) {
      setUploadError(err?.response?.data?.detail ?? "No se pudo subir el archivo");
    }
  }

  async function save() {
    setError(null);
    try {
      const exercise = await createMutation.mutateAsync({
        name: name.trim(),
        description: description.trim() || null,
        muscle_group: muscleGroup || null,
        training_types: trainingTypes,
        external_media_url: externalMediaUrl.trim() || null,
      });

      if (file) {
        setCreatedExercise(exercise);
        await uploadMedia(exercise, file);
        return;
      }

      onOpenChange(false);
      onCreated?.(exercise);
      toastSuccess("Ejercicio creado", `${exercise.name} ya está disponible.`);
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Error desconocido");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-surface-1 text-foreground">
        <DialogHeader>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-label-caps uppercase text-primary-strong">
            <Dumbbell className="h-3.5 w-3.5" />
            Nuevo ejercicio
          </div>
          <DialogTitle className="pt-3 text-2xl font-semibold text-foreground">
            Crear ejercicio
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Nombre obligatorio; grupo muscular, tipos, URL externa y archivo son opcionales.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">Nombre</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Press de banca"
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">Descripción (opcional)</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Técnica, agarre, cadencia..."
            />
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
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">Archivo de media (opcional)</label>
            <input
              type="file"
              accept="video/mp4,image/gif,image/jpeg,image/png"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm text-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-surface-2/40 file:px-3 file:py-1.5 file:text-sm"
            />
          </div>
        </div>

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        {uploadError ? (
          <div className="space-y-2">
            <p role="alert" className="text-sm text-destructive">
              El ejercicio se creó, pero no se pudo subir el archivo: {uploadError}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!file || !createdExercise || uploadMutation.isPending}
              onClick={() => createdExercise && file && uploadMedia(createdExercise, file)}
            >
              {uploadMutation.isPending ? "Reintentando..." : "Reintentar subida"}
            </Button>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={save}
            // H10 (verificación): tras una falla parcial (el ejercicio ya se
            // creó, solo falló la subida) el botón primario reintentaría el
            // `POST /exercises/` con el mismo nombre y chocaría con un 409.
            // Con `createdExercise` seteado, la única vía de reintento es el
            // botón "Reintentar subida" de abajo.
            disabled={
              createMutation.isPending ||
              uploadMutation.isPending ||
              !canSubmit ||
              createdExercise != null
            }
          >
            {createMutation.isPending || uploadMutation.isPending ? "Creando..." : "Crear ejercicio"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
