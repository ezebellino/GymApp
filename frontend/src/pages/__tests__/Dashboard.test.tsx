import { beforeEach, describe, expect, it, vi } from "vitest";

import Dashboard from "../Dashboard";
import { renderWithProviders, screen } from "../../test/renderWithProviders";

vi.mock("@/lib/http", async () => {
  const { createApiMock } = await import("../../test/apiMock");
  return createApiMock();
});

beforeEach(() => {
  // La vista lee user_role en el efecto de montaje: hay que sembrarlo antes.
  localStorage.setItem("user_role", "owner");
  localStorage.setItem("user_name", "Duenio de Test");
});

describe("vista de dashboard", () => {
  it("muestra las cards de KPI que promete la spec", async () => {
    renderWithProviders(<Dashboard />, { route: "/dashboard" });

    // Son labels de estado derivado: aparecen recien cuando resuelven los efectos
    // de montaje, asi que el assert tiene que ser asincrono.
    expect(await screen.findByText("Clientes activos")).toBeInTheDocument();
    expect(await screen.findByText("Rutina base")).toBeInTheDocument();
    expect(await screen.findByText("Check-ins de hoy")).toBeInTheDocument();
  });

  it("no muestra una seccion de alertas de negocio", async () => {
    renderWithProviders(<Dashboard />, { route: "/dashboard" });

    // El assert negativo va DESPUES de esperar el render final: hacerlo antes
    // pasaria en verde por accidente.
    await screen.findByText("Clientes activos");

    expect(screen.queryByText(/alertas de negocio/i)).toBeNull();
  });
});
