import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { RoutineTemplateDay, RoutineTemplateExercise } from "@/types";
import { formatDate } from "@/lib/utils";
import { formatRestCompact, intensityValue, type IntensityScale } from "@/lib/intensity";

// Documento de la planilla imprimible de una copia de rutina ("PLAN DE
// ENTRENAMIENTO SEMANAL", A4 vertical: un bloque por día + la evaluación del
// mesociclo al pie), armado con `@react-pdf/renderer` — el layout es
// flexbox, no coordenadas en mm.
//
// La planilla existe para completarse a mano: las columnas RIR/RPE y PAUSA
// van vacías a propósito (el modelo de datos no las tiene) y de las cuatro
// semanas de "registro de cargas" solo se prellena SEM 1 con la carga
// planificada; el resto lo escribe el Miembro entrenando.
//
// Este archivo NO se importa desde una vista: lo importa `lib/routinePdf.ts`,
// que es quien lo renderiza y dispara la descarga. Los tipos de react-pdf no
// son componentes del DOM — nada de acá se monta en la app.

export type RoutineSheetProps = {
  memberName: string;
  templateName: string;
  templateTag?: string | null;
  startsOn?: string | null;
  days: RoutineTemplateDay[];
  gymName: string;
  trainerName?: string | null;
  // Escala en la que se imprime la intensidad. El dato guardado es siempre
  // RIR; esto solo decide cómo se lee (`lib/intensity.ts`).
  intensityScale?: IntensityScale;
};

// 8 filas es lo que trae el modelo impreso: con menos ejercicios el día
// igual deja renglones libres para agregar a mano.
const MIN_ROWS = 8;

const BORDER = "#828282";

// Anchos de columna en % del ancho útil de la hoja. Las cuatro semanas van
// dentro de un bloque propio (`weeks`) porque comparten un encabezado que las
// abarca: es una columna con dos filas, no cuatro columnas sueltas.
const COL = {
  index: "4.3%",
  name: "33.33%",
  sets: "6.99%",
  reps: "8.06%",
  rir: "8.6%",
  rest: "7.53%",
  weeks: "31.19%",
};

const styles = StyleSheet.create({
  page: {
    paddingVertical: 34,
    paddingHorizontal: 34,
    fontFamily: "Helvetica",
    fontSize: 7.5,
    color: "#000000",
  },

  title: { fontFamily: "Helvetica-Bold", fontSize: 16 },
  subtitle: { fontFamily: "Helvetica-Bold", fontSize: 8.5, color: "#6e6e6e", marginTop: 3 },

  fieldsRow: { flexDirection: "row", marginTop: 12 },
  fieldsCol: { width: "50%", paddingRight: 18 },
  // `flex-start`: un valor que ocupa dos líneas (un nombre de rutina largo)
  // deja la etiqueta alineada con la PRIMERA línea, no colgando al pie.
  field: { flexDirection: "row", alignItems: "flex-start", marginBottom: 5 },
  // `flexShrink: 0` en la etiqueta y `flexBasis: 0` en el valor: sin esto el
  // valor se dimensiona por su contenido y un nombre de rutina largo se
  // desborda por encima de la columna de la derecha (bug real observado con
  // "MESOCICLO / FICHA" pisando "FECHA INICIO").
  fieldLabel: { fontFamily: "Helvetica-Bold", fontSize: 8, flexShrink: 0 },
  fieldValue: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    marginLeft: 4,
    fontSize: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
    paddingBottom: 1,
  },
  rule: { borderBottomWidth: 2, borderBottomColor: "#000000", marginTop: 6 },

  dayBlock: { marginTop: 11 },
  dayBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#000000",
    paddingVertical: 3.5,
    paddingHorizontal: 8,
  },
  dayName: { fontFamily: "Helvetica-Bold", fontSize: 9, color: "#ffffff", width: "30%", flexShrink: 0 },
  dayFocus: { fontSize: 7.5, color: "#ffffff", flexGrow: 1, flexShrink: 1, flexBasis: 0 },

  table: { borderTopWidth: 0.5, borderLeftWidth: 0.5, borderColor: BORDER },
  headRow: { flexDirection: "row", backgroundColor: "#e5e5e5" },
  row: { flexDirection: "row", minHeight: 15.5 },
  cell: {
    borderRightWidth: 0.5,
    borderBottomWidth: 0.5,
    borderColor: BORDER,
    paddingVertical: 2.5,
    paddingHorizontal: 4,
    justifyContent: "center",
  },
  headCell: {
    fontFamily: "Helvetica-Bold",
    fontSize: 6.2,
    textAlign: "center",
    paddingVertical: 2.5,
  },
  center: { textAlign: "center" },
  // La celda de las semanas no dibuja su propio borde derecho/inferior: los
  // ponen las cuatro sub-celdas de adentro.
  weeksHead: { width: COL.weeks },
  weeksHeadTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 6.2,
    textAlign: "center",
    paddingVertical: 2.5,
    borderRightWidth: 0.5,
    borderBottomWidth: 0.5,
    borderColor: BORDER,
  },
  weeksRow: { flexDirection: "row" },
  weekCell: { width: "25%" },

  notesRow: { flexDirection: "row" },
  noteBox: {
    width: "50%",
    minHeight: 24,
    borderWidth: 0.5,
    borderColor: BORDER,
    borderTopWidth: 0,
    padding: 4,
  },
  noteLabel: { fontFamily: "Helvetica-Bold", fontSize: 7 },

  evaluation: { marginTop: 14, borderWidth: 1.5, borderColor: "#000000", padding: 8 },
  evaluationTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9.5,
    textAlign: "center",
    paddingBottom: 3,
    marginHorizontal: 70,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
  },
  evaluationRow: { flexDirection: "row", marginTop: 6 },
  evaluationBox: {
    flexGrow: 1,
    flexBasis: 0,
    minHeight: 72,
    borderWidth: 0.5,
    borderColor: BORDER,
    padding: 5,
  },
});

// La carga que se imprime en SEM 1: si todas las series planificadas van con
// el mismo peso es ese número; si la progresión las hace variar, el rango.
function plannedLoad(exercise: RoutineTemplateExercise): string {
  const weights = exercise.planned_sets?.map((set) => set.weight_kg) ?? [];
  if (weights.length === 0) {
    return exercise.base.weight_kg > 0 ? `${exercise.base.weight_kg}` : "";
  }
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  if (max <= 0) return "";
  return min === max ? `${min}` : `${min}-${max}`;
}

function ExerciseRow({
  position,
  exercise,
  scale,
}: {
  position: number;
  exercise?: RoutineTemplateExercise;
  scale: IntensityScale;
}) {
  return (
    <View style={styles.row}>
      <View style={[styles.cell, { width: COL.index }]}>
        <Text style={[styles.center, { fontFamily: "Helvetica-Bold" }]}>{position}</Text>
      </View>
      <View style={[styles.cell, { width: COL.name }]}>
        <Text>{exercise?.name ?? ""}</Text>
      </View>
      <View style={[styles.cell, { width: COL.sets }]}>
        <Text style={styles.center}>{exercise ? `${exercise.base.sets}` : ""}</Text>
      </View>
      <View style={[styles.cell, { width: COL.reps }]}>
        <Text style={styles.center}>{exercise ? `${exercise.base.reps}` : ""}</Text>
      </View>
      {/* Se imprime lo prescripto; sin prescripción la celda queda en blanco
          para completarla a mano, como antes de que estos campos existieran. */}
      <View style={[styles.cell, { width: COL.rir }]}>
        <Text style={styles.center}>
          {exercise?.rir !== null && exercise?.rir !== undefined
            ? `${intensityValue(exercise.rir, scale)}`
            : ""}
        </Text>
      </View>
      <View style={[styles.cell, { width: COL.rest }]}>
        <Text style={styles.center}>{exercise ? formatRestCompact(exercise.rest_seconds) : ""}</Text>
      </View>
      <View style={[styles.weeksRow, { width: COL.weeks }]}>
        <View style={[styles.cell, styles.weekCell]}>
          <Text style={styles.center}>{exercise ? plannedLoad(exercise) : ""}</Text>
        </View>
        <View style={[styles.cell, styles.weekCell]} />
        <View style={[styles.cell, styles.weekCell]} />
        <View style={[styles.cell, styles.weekCell]} />
      </View>
    </View>
  );
}

function TableHead({ scale }: { scale: IntensityScale }) {
  const tall = { justifyContent: "center" as const };
  return (
    <View style={styles.headRow}>
      <View style={[styles.cell, tall, { width: COL.index }]}>
        <Text style={styles.headCell}>#</Text>
      </View>
      <View style={[styles.cell, tall, { width: COL.name }]}>
        <Text style={styles.headCell}>EJERCICIO</Text>
      </View>
      <View style={[styles.cell, tall, { width: COL.sets }]}>
        <Text style={styles.headCell}>SER.</Text>
      </View>
      <View style={[styles.cell, tall, { width: COL.reps }]}>
        <Text style={styles.headCell}>REPS</Text>
      </View>
      <View style={[styles.cell, tall, { width: COL.rir }]}>
        {/* El encabezado dice en qué escala están los números impresos, pero
            conserva las dos siglas: la planilla se completa a mano y quien
            escriba puede usar la otra. */}
        <Text style={styles.headCell}>{scale === "rpe" ? "RPE/RIR" : "RIR/RPE"}</Text>
      </View>
      <View style={[styles.cell, tall, { width: COL.rest }]}>
        <Text style={styles.headCell}>PAUSA</Text>
      </View>
      <View style={styles.weeksHead}>
        <Text style={styles.weeksHeadTitle}>REGISTRO DE CARGAS (SEM 1 - 4)</Text>
        <View style={styles.weeksRow}>
          {["SEM 1", "SEM 2", "SEM 3", "SEM 4"].map((label) => (
            <View key={label} style={[styles.cell, styles.weekCell]}>
              <Text style={styles.headCell}>{label}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

// `wrap={false}`: el bloque de un día no se parte entre hojas — si no entra
// entero, arranca en la siguiente.
function DayBlock({ day, scale }: { day: RoutineTemplateDay; scale: IntensityScale }) {
  const rowCount = Math.max(MIN_ROWS, day.exercises.length);
  const focus = day.muscle_groups.length > 0 ? day.muscle_groups.join(" / ") : "";
  // `day.name` ya viene del backend como "Día N - Pecho/Tríceps"; repetir los
  // grupos acá y en ENFOQUE MUSCULAR daba "DÍA: DÍA 1 - PECHO/TRÍCEPS" al
  // lado de "ENFOQUE MUSCULAR: Pecho / Tríceps". Se imprime solo "DÍA N".

  return (
    <View style={styles.dayBlock} wrap={false}>
      <View style={styles.dayBar}>
        <Text style={styles.dayName}>DÍA {day.position}</Text>
        <Text style={styles.dayFocus}>ENFOQUE MUSCULAR: {focus}</Text>
      </View>

      <View style={styles.table}>
        <TableHead scale={scale} />
        {Array.from({ length: rowCount }, (_, i) => (
          <ExerciseRow key={i} position={i + 1} exercise={day.exercises[i]} scale={scale} />
        ))}
      </View>

      <View style={styles.notesRow}>
        <View style={styles.noteBox}>
          <Text style={styles.noteLabel}>Warm-up / Activación:</Text>
        </View>
        <View style={[styles.noteBox, { borderLeftWidth: 0 }]}>
          <Text style={styles.noteLabel}>Notas / Feedback:</Text>
        </View>
      </View>
    </View>
  );
}

export function RoutineSheet(input: RoutineSheetProps) {
  const subtitle = input.trainerName
    ? `${input.gymName.toUpperCase()} • ${input.trainerName.toUpperCase()}`
    : input.gymName.toUpperCase();
  const ficha = input.templateTag
    ? `${input.templateName} (${input.templateTag})`
    : input.templateName;
  const scale: IntensityScale = input.intensityScale ?? "rir";

  return (
    <Document title={`Plan de entrenamiento · ${input.memberName}`} author={input.gymName}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>PLAN DE ENTRENAMIENTO SEMANAL</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>

        {/* "OBJETIVO" va siempre en blanco: no es un dato del sistema. */}
        <View style={styles.fieldsRow}>
          <View style={styles.fieldsCol}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>CLIENTE:</Text>
              <Text style={styles.fieldValue}>{input.memberName}</Text>
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>MESOCICLO / FICHA:</Text>
              <Text style={styles.fieldValue}>{ficha}</Text>
            </View>
          </View>
          <View style={styles.fieldsCol}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>OBJETIVO:</Text>
              <Text style={styles.fieldValue}> </Text>
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>FECHA INICIO:</Text>
              <Text style={styles.fieldValue}>
                {input.startsOn ? formatDate(input.startsOn) : " "}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.rule} />

        {input.days.map((day) => (
          <DayBlock key={day.day_id} day={day} scale={scale} />
        ))}

        <View style={styles.evaluation} wrap={false}>
          <Text style={styles.evaluationTitle}>EVALUACIÓN Y CONTROL DEL MESOCICLO</Text>
          <View style={styles.evaluationRow}>
            <View style={styles.evaluationBox}>
              <Text style={styles.noteLabel}>Conclusiones del Entrenador &amp; Progresiones Futuras:</Text>
            </View>
            <View style={[styles.evaluationBox, { marginLeft: 8 }]}>
              <Text style={styles.noteLabel}>
                Feedback General del Atleta (Fatiga, Recuperación, Molestias):
              </Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}
