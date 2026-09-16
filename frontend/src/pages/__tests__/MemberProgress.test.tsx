import { Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import api from "@/lib/http";

import MemberProgress from "../MemberProgress";
import { fireEvent, renderWithProviders, screen, waitFor } from "../../test/renderWithProviders";
import type { LoggedExercise, WorkoutSetLog } from "@/types";

// `member-routine-copies` (design D10): vista nueva de Progreso para
// Dueño/Coach — histórico filtrable por ejercicio y gráfico de evolución.
// Corrección del gate (hallazgo mayor 1 del `verification.md`): los tres
// filtros viajan como params al servidor, no se filtran en memoria sobre
// `limit: 200` — el mock de `/routines/users/u-1/logs` filtra según
// `config.params`, igual que haría el backend real.

vi.mock("@/lib/http", async () => {
  const { createApiMock } = await import("../../test/apiMock");
  return createApiMock();
});

function makeLog(overrides: Partial<WorkoutSetLog> = {}): WorkoutSetLog {
  return {
    id: "log-1",
    user_id: "u-1",
    assignment_day_id: "day-1",
    day_name: "Día 1",
    exercise_id: "ex-1",
    exercise_name: "Press banca",
    muscle_group: "Pecho",
    set_index: 1,
    reps: 8,
    weight_kg: 45,
    performed_on: "2026-01-05",
    performed_at: "2026-01-05T10:00:00",
    ...overrides,
  };
}

function jsonResponse(data: unknown) {
  return Promise.resolve({
    data,
    status: 200,
    statusText: "OK",
    headers: {},
    config: {},
  } as any);
}

// Filtra `logs` según `config.params` como haría el backend real (D6): el
// componente ya no puede confiar en que el servidor le mande todo y filtrar
// acá adentro — si volviera a filtrar en memoria, este mock seguiría
// funcionando igual porque el mock filtra por él, así que las aserciones de
// cada test son las que efectivamente detectan la regresión.
function mockData(logs: WorkoutSetLog[], loggedExercises: LoggedExercise[] = []) {
  vi.mocked(api.get).mockImplementation((url: string, config?: any) => {
    if (url === "/routines/users/u-1/logs") {
      const params = config?.params ?? {};
      const filtered = logs.filter((log) => {
        if (params.exercise_id && log.exercise_id !== params.exercise_id) return false;
        if (params.from && log.performed_on < params.from) return false;
        if (params.to && log.performed_on > params.to) return false;
        return true;
      });
      return jsonResponse(filtered);
    }
    if (url === "/routines/users/u-1/logged-exercises") return jsonResponse(loggedExercises);
    return jsonResponse([]);
  });
}

function renderAt(route: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/users/:id/progress" element={<MemberProgress />} />
      <Route path="/users/:id" element={<div>Ficha de usuario</div>} />
    </Routes>,
    { route }
  );
}

describe("vista de Progreso de un Miembro", () => {
  it("filtra el histórico por ejercicio", async () => {
    // Dos ejercicios distintos en el fixture: si el filtro no filtrara de
    // verdad, los dos seguirían apareciendo juntos.
    mockData(
      [
        makeLog({ id: "log-1", exercise_id: "ex-1", exercise_name: "Press banca" }),
        makeLog({ id: "log-2", exercise_id: "ex-2", exercise_name: "Sentadilla", weight_kg: 80 }),
      ],
      [
        { exercise_id: "ex-1", name: "Press banca", muscle_group: "Pecho" },
        { exercise_id: "ex-2", name: "Sentadilla", muscle_group: "Piernas" },
      ]
    );

    renderAt("/users/u-1/progress");

    // El filtro arranca en el ejercicio más reciente (design D10): con el
    // fixture ordenado, ex-1 es el `[0]` de la respuesta, así que solo su
    // registro se ve por defecto. Timeout explícito: la selección por
    // default ahora encadena DOS fetches (el inicial sin filtro y el que
    // dispara el efecto al fijar `exerciseId`), no uno solo.
    expect(
      await screen.findByText(/Press banca · #1 · 45 kg × 8/, {}, { timeout: 3000 })
    ).toBeInTheDocument();
    expect(screen.queryByText(/Sentadilla · #1 · 80 kg × 8/)).toBeNull();

    const select = screen.getByLabelText("Ejercicio") as HTMLSelectElement;
    (select as any).value = "ex-2";
    select.dispatchEvent(new Event("change", { bubbles: true }));

    expect(
      await screen.findByText(/Sentadilla · #1 · 80 kg × 8/, {}, { timeout: 3000 })
    ).toBeInTheDocument();
    expect(screen.queryByText(/Press banca · #1 · 45 kg × 8/)).toBeNull();
  });

  it("ofrece en el filtro un ejercicio que ya no está en la copia", async () => {
    // El filtro sale de `logged-exercises` (el histórico), no de la copia
    // vigente: un ejercicio retirado de la rutina sigue siendo filtrable.
    mockData(
      [makeLog({ exercise_id: "ex-1", exercise_name: "Press banca" })],
      [
        { exercise_id: "ex-1", name: "Press banca", muscle_group: "Pecho" },
        { exercise_id: "ex-9", name: "Ejercicio retirado", muscle_group: null },
      ]
    );

    renderAt("/users/u-1/progress");

    await screen.findByText(/Press banca · #1/, {}, { timeout: 3000 });
    const select = screen.getByLabelText("Ejercicio") as HTMLSelectElement;
    const options = Array.from(select.options).map((option) => option.textContent);
    expect(options).toContain("Ejercicio retirado");
  });

  it("avisa que el miembro no registró progreso en vez de mostrar tabla y gráfico vacíos", async () => {
    mockData([], []);

    renderAt("/users/u-1/progress");

    expect(
      await screen.findByText("Este Miembro todavía no tiene progreso registrado.")
    ).toBeInTheDocument();
    expect(screen.queryByText("Evolución del peso")).toBeNull();
    expect(screen.queryByText("Histórico")).toBeNull();
  });

  it("pide el histórico filtrado al servidor en vez de filtrar en memoria", async () => {
    // Hallazgo mayor 1: antes se pedía `limit: 200` sin más params y se
    // filtraba acá adentro. Este caso assertea la URL/params del `GET`, no
    // solo el resultado renderizado.
    mockData(
      [
        makeLog({ id: "log-1", exercise_id: "ex-1", exercise_name: "Press banca" }),
        makeLog({ id: "log-2", exercise_id: "ex-2", exercise_name: "Sentadilla" }),
      ],
      [
        { exercise_id: "ex-1", name: "Press banca", muscle_group: "Pecho" },
        { exercise_id: "ex-2", name: "Sentadilla", muscle_group: "Piernas" },
      ]
    );

    renderAt("/users/u-1/progress");
    await screen.findByLabelText("Ejercicio", {}, { timeout: 3000 });

    fireEvent.change(screen.getByLabelText("Ejercicio"), { target: { value: "ex-2" } });
    fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "2026-01-01" } });
    fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: "2026-01-31" } });

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith("/routines/users/u-1/logs", {
        params: { exercise_id: "ex-2", from: "2026-01-01", to: "2026-01-31", limit: 200 },
      });
    });
  });

  it("encuentra un registro más viejo que la ventana de doscientas marcas", async () => {
    // Fixture MÁS GRANDE QUE LA VENTANA (201+ filas) y el registro buscado
    // FUERA de ella: si el código volviera a filtrar en memoria sobre el
    // fetch sin `exercise_id`, "Peso muerto" nunca llegaría a la UI porque
    // no está en esa respuesta — solo la request CON `exercise_id: "ex-old"`
    // lo devuelve.
    const targetLog = makeLog({
      id: "log-old",
      exercise_id: "ex-old",
      exercise_name: "Peso muerto",
      weight_kg: 120,
      performed_on: "2024-01-01",
    });
    const windowLogs = Array.from({ length: 201 }, (_, i) =>
      makeLog({
        id: `log-recent-${i}`,
        exercise_id: "ex-1",
        exercise_name: "Press banca",
        performed_on: `2026-01-${String((i % 28) + 1).padStart(2, "0")}`,
      })
    );

    vi.mocked(api.get).mockImplementation((url: string, config?: any) => {
      if (url === "/routines/users/u-1/logged-exercises") {
        return jsonResponse([
          { exercise_id: "ex-1", name: "Press banca", muscle_group: "Pecho" },
          { exercise_id: "ex-old", name: "Peso muerto", muscle_group: "Piernas" },
        ]);
      }
      if (url === "/routines/users/u-1/logs") {
        const exerciseId = config?.params?.exercise_id;
        if (exerciseId === "ex-old") return jsonResponse([targetLog]);
        // "Ventana" de las 200+ marcas más recientes: ex-old nunca aparece acá.
        return jsonResponse(windowLogs);
      }
      return jsonResponse([]);
    });

    renderAt("/users/u-1/progress");
    await screen.findByLabelText("Ejercicio", {}, { timeout: 3000 });

    fireEvent.change(screen.getByLabelText("Ejercicio"), { target: { value: "ex-old" } });

    expect(
      await screen.findByText(/Peso muerto · #1 · 120 kg × 8/, {}, { timeout: 3000 })
    ).toBeInTheDocument();
  });
});
