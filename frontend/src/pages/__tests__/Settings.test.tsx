import { describe, expect, it, vi } from "vitest";

import Settings from "../Settings";
import { renderWithProviders, screen } from "../../test/renderWithProviders";

vi.mock("@/lib/http", async () => {
  const { createApiMock } = await import("../../test/apiMock");
  return createApiMock();
});

// Obligatoriamente asincrono: Settings devuelve temprano el placeholder
// "Cargando configuracion..." mientras loading === true, y solo renderiza los
// formularios cuando resuelve el GET /settings.
describe("vista de ajustes", () => {
  it("muestra los formularios de configuracion y la vista previa con su accion", async () => {
    renderWithProviders(<Settings />, { route: "/settings" });

    expect(
      await screen.findByText("Identidad y contacto del gimnasio"),
    ).toBeInTheDocument();
    expect(screen.getByText("Cobranza y medios de pago")).toBeInTheDocument();
    expect(screen.getByText("Mensaje de recordatorio de pago")).toBeInTheDocument();
    expect(screen.getByText("Vista previa del negocio")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /ver recordatorio en whatsapp/i }),
    ).toBeInTheDocument();
  });

  it("no muestra las InfoCard ni la card de contexto operativo dadas de baja", async () => {
    renderWithProviders(<Settings />, { route: "/settings" });

    // Esperar el render final: si el assert negativo corre mientras la vista
    // todavia muestra el loader, pasa en verde por accidente.
    await screen.findByText("Vista previa del negocio");
    expect(screen.queryByText("Cargando configuracion...")).toBeNull();

    // Las 3 InfoCard se buscan por ROL heading, no por texto suelto, y es a
    // proposito: sus titulos eran <h2>, mientras que dos de esos strings siguen
    // apareciendo -legitimamente- como texto normal en la pagina:
    //   - "Identidad y contacto" es prefijo del CardTitle del formulario;
    //   - "Recordatorio mensual" abre una linea del "Resumen rapido", que la spec
    //     si quiere. Ahi el ":" hoy queda fuera del <span>, asi que un matcher de
    //     texto exacto pasa por casualidad: basta mover el ":" adentro para
    //     ponerlo en rojo sin que se haya reintroducido ninguna InfoCard.
    expect(
      screen.queryByRole("heading", { name: "Identidad y contacto" }),
    ).toBeNull();
    expect(screen.queryByRole("heading", { name: "Cobranza operativa" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Recordatorio mensual" })).toBeNull();

    // "Contexto operativo" no era un heading sino el eyebrow del hero, y ningun
    // otro texto de la vista lo contiene: ahi el match por texto es seguro.
    expect(screen.queryByText("Contexto operativo")).toBeNull();

    // Control positivo: el "Resumen rapido" -que la spec conserva- sigue presente,
    // asi que los asserts negativos de arriba no pasan por pagina vacia.
    expect(screen.getByText("Resumen rápido")).toBeInTheDocument();
  });
});
