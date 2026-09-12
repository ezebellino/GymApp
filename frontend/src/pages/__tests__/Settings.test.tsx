import { beforeEach, describe, expect, it, vi } from "vitest";

import Settings from "../Settings";
import { renderWithProviders, screen } from "../../test/renderWithProviders";

vi.mock("@/lib/http", async () => {
  const { createApiMock } = await import("../../test/apiMock");
  return createApiMock();
});

function seedRole(role: "owner" | "coach") {
  localStorage.setItem("access_token", "token-de-test");
  localStorage.setItem("user_name", "Usuario de Test");
  localStorage.setItem("user_role", role);
}

// Obligatoriamente asincrono: Settings devuelve temprano el placeholder
// "Cargando configuracion..." mientras loading === true, y solo renderiza los
// formularios cuando resuelve el GET /settings.
describe("vista de ajustes", () => {
  beforeEach(() => {
    seedRole("owner");
  });

  // CardTitle (components/ui/card) es un <div>, no un heading semantico, asi
  // que las cuatro secciones se buscan por texto y no por rol. La grilla de
  // dos columnas en xl / apilado por debajo de xl es puramente visual y no
  // se puede verificar con jsdom (no calcula layout): queda como escenario
  // manual (ver design.md, Plan de verificacion).
  it("muestra los títulos de las cuatro secciones del formulario", async () => {
    renderWithProviders(<Settings />, { route: "/settings" });

    expect(await screen.findByText("Negocio")).toBeInTheDocument();
    expect(screen.getByText("Contacto")).toBeInTheDocument();
    expect(screen.getByText("Cobro")).toBeInTheDocument();
    expect(screen.getByText("Operación")).toBeInTheDocument();
  });

  it("cada sección del formulario se presenta como una card", async () => {
    renderWithProviders(<Settings />, { route: "/settings" });

    const negocioTitle = await screen.findByText("Negocio");
    // La Card (components/ui/card) es la raiz que envuelve CardHeader +
    // CardTitle + CardContent: subimos hasta el data-slot="card" para
    // confirmar que la sección no quedó como un bloque de texto suelto.
    const card = negocioTitle.closest('[data-slot="card"]');
    expect(card).not.toBeNull();
    expect(card?.querySelector('[data-slot="card-header"]')).not.toBeNull();
    expect(card?.querySelector('[data-slot="card-content"]')).not.toBeNull();
  });

  it("no muestra la vista previa del negocio ni el resumen rapido", async () => {
    renderWithProviders(<Settings />, { route: "/settings" });

    // Esperar el render final: si el assert negativo corre mientras la vista
    // todavia muestra el loader, pasa en verde por accidente.
    await screen.findByText("Negocio");
    expect(screen.queryByText("Cargando configuracion...")).toBeNull();

    // Las 3 InfoCard viejas y la card lateral "Contexto operativo" ya no
    // existen.
    expect(
      screen.queryByRole("heading", { name: "Identidad y contacto" }),
    ).toBeNull();
    expect(screen.queryByRole("heading", { name: "Cobranza operativa" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Recordatorio mensual" })).toBeNull();
    expect(screen.queryByText("Contexto operativo")).toBeNull();

    // La columna derecha ("Vista previa del negocio", "Resumen rápido") y el
    // botón de WhatsApp que reemplazaba, se eliminaron por completo y no se
    // reintroducen al volver a usar Card (REMOVED Requirements de la spec).
    expect(screen.queryByText("Vista previa del negocio")).toBeNull();
    expect(screen.queryByText("Resumen rápido")).toBeNull();
    expect(
      screen.queryByRole("button", { name: /ver recordatorio en whatsapp/i }),
    ).toBeNull();
    expect(screen.queryByText("Completar WhatsApp")).toBeNull();
  });

  it("no muestra los campos deprecados de cuota base, tolerancia ni recordatorio", async () => {
    renderWithProviders(<Settings />, { route: "/settings" });

    await screen.findByText("Negocio");
    expect(screen.queryByText("Cargando configuracion...")).toBeNull();

    expect(screen.queryByText("Cuota mensual base")).toBeNull();
    expect(screen.queryByText("Días de tolerancia")).toBeNull();
    expect(screen.queryByText("Mensaje de recordatorio de pago")).toBeNull();
  });

  it("no muestra texto de ayuda debajo de los campos", async () => {
    renderWithProviders(<Settings />, { route: "/settings" });

    // "Moneda" es el campo que la spec usa como ejemplo de helper text
    // eliminado ("Se usa en precios de planes, pagos y reportes.").
    await screen.findByLabelText("Moneda");
    expect(
      screen.queryByText("Se usa en precios de planes, pagos y reportes."),
    ).toBeNull();
    expect(
      screen.queryByText(
        'El miembro las ve en "Mi cuota" junto al resto de los datos de pago.',
      ),
    ).toBeNull();
    expect(
      screen.queryByText(
        "Se muestra a un miembro recién invitado como guía inicial del gimnasio.",
      ),
    ).toBeNull();
  });

  it("muestra el boton Guardar cambios en la barra de accion al pie", async () => {
    renderWithProviders(<Settings />, { route: "/settings" });

    const button = await screen.findByRole("button", { name: "Guardar cambios" });
    expect(button).toBeEnabled();
  });

  it("con rol coach deja el formulario en solo lectura", async () => {
    seedRole("coach");
    renderWithProviders(<Settings />, { route: "/settings" });

    const gymNameInput = await screen.findByLabelText("Nombre del gimnasio");
    expect(gymNameInput).toBeDisabled();

    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeDisabled();
  });
});
