import { Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import api from "@/lib/http";

import InvitationAccept from "../InvitationAccept";
import { renderWithProviders, screen } from "../../test/renderWithProviders";

vi.mock("@/lib/http", async () => {
  const { createApiMock } = await import("../../test/apiMock");
  return createApiMock();
});

function renderAt(route: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/invitacion/:channel/:token" element={<InvitationAccept />} />
    </Routes>,
    { route }
  );
}

describe("vista de invitacion (member-invitation)", () => {
  it("con un solo canal verificado, el formulario de contrasena esta deshabilitado y se indica que falta", async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: {
        first_name: "Juan",
        email_verified: true,
        phone_verified: false,
        can_set_password: false,
      },
      status: 200,
      statusText: "OK",
      headers: {},
      config: {},
    } as any);

    renderAt("/invitacion/email/tok-email-123");

    expect(await screen.findByText(/Hola Juan/i)).toBeInTheDocument();
    expect(screen.getByText(/Email verificado/i)).toBeInTheDocument();
    expect(screen.getByText(/WhatsApp pendiente de verificar/i)).toBeInTheDocument();
    expect(screen.getByText(/todavía falta verificar/i)).toBeInTheDocument();

    const submitButton = screen.getByRole("button", { name: /definir contraseña/i });
    expect(submitButton).toBeDisabled();
  });

  it("con ambos canales verificados, el formulario de contrasena se habilita", async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: {
        first_name: "Juan",
        email_verified: true,
        phone_verified: true,
        can_set_password: true,
      },
      status: 200,
      statusText: "OK",
      headers: {},
      config: {},
    } as any);

    renderAt("/invitacion/email/tok-email-456");

    expect(await screen.findByText(/Hola Juan/i)).toBeInTheDocument();
    expect(screen.getByText(/Email verificado/i)).toBeInTheDocument();
    expect(screen.getByText(/WhatsApp verificado/i)).toBeInTheDocument();
    expect(screen.queryByText(/todavía falta verificar/i)).toBeNull();

    const submitButton = screen.getByRole("button", { name: /definir contraseña/i });
    expect(submitButton).not.toBeDisabled();
  });
});
