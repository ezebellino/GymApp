import { Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import Payments from "../Payments";
import { fireEvent, renderWithProviders, screen } from "../../test/renderWithProviders";

vi.mock("@/lib/http", async () => {
  const { createApiMock } = await import("../../test/apiMock");
  return createApiMock();
});

describe("vista de Pagos (placeholder)", () => {
  it("ofrece un boton Planes que navega a la vista de planes", async () => {
    renderWithProviders(
      <Routes>
        <Route path="/payments" element={<Payments />} />
        <Route path="/plans" element={<div>Vista de Planes</div>} />
      </Routes>,
      { route: "/payments" }
    );

    expect(await screen.findByText("Pagos")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "Planes" }));

    expect(await screen.findByText("Vista de Planes")).toBeInTheDocument();
  });
});
