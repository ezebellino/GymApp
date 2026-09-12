import { describe, expect, it } from "vitest";

import Dashboard from "../Dashboard";
import Attendance from "../Attendance";
import Tracking from "../Tracking";
import Reports from "../Reports";
import { renderWithProviders, screen } from "../../test/renderWithProviders";

// Las cuatro secciones quedaron vaciadas a la espera de una iteración futura: lo
// único que se garantiza es que la ruta sigue existiendo y muestra el estado
// "To Do", sin pegarle a la API (no hay `vi.mock("@/lib/http")` porque no hay
// ninguna llamada que mockear — si alguna vuelve a aparecer, este test se cae
// con un XHR real de jsdom y avisa).
describe("secciones pendientes", () => {
  it.each([
    ["/dashboard", <Dashboard key="d" />, "Inicio"],
    ["/tracking", <Tracking key="t" />, "Seguimiento"],
    ["/attendance", <Attendance key="a" />, "Asistencias"],
    ["/reports", <Reports key="r" />, "Reportes"],
  ])("%s muestra el placeholder To Do", (route, element, title) => {
    renderWithProviders(element, { route });

    expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    expect(screen.getByText("To Do")).toBeInTheDocument();
  });
});
