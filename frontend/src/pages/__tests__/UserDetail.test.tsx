import { Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import api from "@/lib/http";

import UserDetail from "../UserDetail";
import { fireEvent, renderWithProviders, screen, waitFor, within } from "../../test/renderWithProviders";
import type { User } from "@/types";

vi.mock("@/lib/http", async () => {
  const { createApiMock } = await import("../../test/apiMock");
  return createApiMock();
});

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "u-1",
    first_name: "Ana",
    last_name: "Gomez",
    full_name: "Ana Gomez",
    age: 30,
    birth_date: "1996-01-01",
    weight_kg: 60,
    height_cm: 165,
    email: "ana@example.com",
    email_verified: true,
    phone: "1155555555",
    phone_verified: true,
    role: "member",
    is_active: true,
    membership_status: "active",
    membership_start_date: "2026-01-01T00:00:00",
    membership_cancelled_at: null,
    membership_indicator: "up_to_date",
    invitation_status: "access_active",
    created_at: "2026-01-01T00:00:00",
    ...overrides,
  };
}

function renderAt(route: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/users/:id" element={<UserDetail />} />
    </Routes>,
    { route }
  );
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

// jwt-decode solo le pide al token el formato `header.payload.firma` en
// base64url; no valida la firma. Alcanza con un payload fabricado a mano para
// que `useSessionStore` pueda leer el claim `role` (patrón de
// `components/__tests__/Sidebar.test.tsx`, ver `frontend/AGENTS.md`).
function base64Url(payload: Record<string, unknown>): string {
  return btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fakeToken(email: string): string {
  const header = base64Url({ alg: "none", typ: "JWT" });
  const payload = base64Url({ email, exp: 9999999999 });
  return `${header}.${payload}.signature`;
}

function seedRole(role: "owner" | "coach") {
  localStorage.setItem("access_token", fakeToken("viewer@miniespacio.test"));
  localStorage.setItem("user_name", "Viewer de Test");
  localStorage.setItem("user_role", role);
}

describe("ficha de detalle de un usuario", () => {
  it("muestra el perfil, el rol y el estado de membresia del usuario", async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === "/users/u-1") {
        return jsonResponse(makeUser({}));
      }
      return jsonResponse({});
    });

    renderAt("/users/u-1");

    expect(await screen.findByRole("heading", { name: "Ana Gomez" })).toBeInTheDocument();
    expect(screen.getByText("Miembro")).toBeInTheDocument();
    expect(screen.getByText("Perfil")).toBeInTheDocument();
    expect(screen.getByText("Membresía")).toBeInTheDocument();
    expect(screen.getByText("ana@example.com")).toBeInTheDocument();
    expect(screen.getByText("Invitación al portal")).toBeInTheDocument();
    expect(screen.getByText("Acceso activo")).toBeInTheDocument();
  });

  it("no muestra la seccion de invitacion para un usuario que no es Miembro", async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === "/users/u-2") {
        return jsonResponse(
          makeUser({
            id: "u-2",
            role: "coach",
            membership_status: "none",
            membership_indicator: "none",
            membership_start_date: null,
            invitation_status: "none",
          })
        );
      }
      return jsonResponse({});
    });

    renderAt("/users/u-2");

    expect(await screen.findByRole("heading", { name: "Ana Gomez" })).toBeInTheDocument();
    expect(screen.getByText("Coach")).toBeInTheDocument();
    expect(screen.queryByText("Invitación al portal")).toBeNull();
  });

  describe("verificacion manual de contacto", () => {
    it("muestra el estado de verificacion junto al email y al telefono", async () => {
      vi.mocked(api.get).mockImplementation((url: string) => {
        if (url === "/users/u-1") {
          return jsonResponse(makeUser({ email_verified: true, phone_verified: false }));
        }
        return jsonResponse({});
      });

      renderAt("/users/u-1");
      await screen.findByRole("heading", { name: "Ana Gomez" });

      expect(screen.getByText("Verificado")).toBeInTheDocument();
      expect(screen.getByText("Sin verificar")).toBeInTheDocument();
    });

    it("ofrece verificar el contacto cuando hay un dato cargado sin verificar", async () => {
      seedRole("owner");
      vi.mocked(api.get).mockImplementation((url: string) => {
        if (url === "/users/u-1") {
          return jsonResponse(makeUser({ email_verified: false, phone_verified: true }));
        }
        return jsonResponse({});
      });

      renderAt("/users/u-1");
      await screen.findByRole("heading", { name: "Ana Gomez" });

      expect(screen.getByRole("button", { name: "Verificar contacto" })).toBeInTheDocument();
    });

    it("no ofrece verificar el contacto cuando ambos datos ya estan verificados", async () => {
      seedRole("owner");
      vi.mocked(api.get).mockImplementation((url: string) => {
        if (url === "/users/u-1") {
          return jsonResponse(makeUser({ email_verified: true, phone_verified: true }));
        }
        return jsonResponse({});
      });

      renderAt("/users/u-1");
      await screen.findByRole("heading", { name: "Ana Gomez" });

      expect(screen.queryByRole("button", { name: "Verificar contacto" })).toBeNull();
    });

    it("no ofrece verificar el contacto cuando no hay datos cargados", async () => {
      seedRole("owner");
      vi.mocked(api.get).mockImplementation((url: string) => {
        if (url === "/users/u-1") {
          return jsonResponse(
            makeUser({ email: null, phone: null, email_verified: false, phone_verified: false })
          );
        }
        return jsonResponse({});
      });

      renderAt("/users/u-1");
      await screen.findByRole("heading", { name: "Ana Gomez" });

      expect(screen.queryByRole("button", { name: "Verificar contacto" })).toBeNull();
    });

    it("verifica el contacto desde el modal y la ficha refleja ambos datos verificados", async () => {
      seedRole("owner");
      let emailVerified = false;
      let phoneVerified = false;
      vi.mocked(api.get).mockImplementation((url: string) => {
        if (url === "/users/u-1") {
          return jsonResponse(
            makeUser({ email_verified: emailVerified, phone_verified: phoneVerified })
          );
        }
        return jsonResponse({});
      });
      vi.mocked(api.post).mockImplementation((url: string) => {
        if (url === "/users/u-1/contact/verify") {
          emailVerified = true;
          phoneVerified = true;
          return jsonResponse(makeUser({ email_verified: true, phone_verified: true }));
        }
        return jsonResponse({});
      });

      renderAt("/users/u-1");
      await screen.findByRole("heading", { name: "Ana Gomez" });

      fireEvent.click(screen.getByRole("button", { name: "Verificar contacto" }));
      const dialog = await screen.findByRole("dialog", { hidden: true });
      fireEvent.click(within(dialog).getByRole("button", { name: "Verificar contacto" }));

      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith("/users/u-1/contact/verify", {});
      });
      await waitFor(() => {
        expect(screen.getAllByText("Verificado")).toHaveLength(2);
      });
    });

    it("cancelar el modal de verificacion no dispara ninguna mutacion", async () => {
      seedRole("owner");
      vi.mocked(api.get).mockImplementation((url: string) => {
        if (url === "/users/u-1") {
          return jsonResponse(makeUser({ email_verified: false, phone_verified: true }));
        }
        return jsonResponse({});
      });

      renderAt("/users/u-1");
      await screen.findByRole("heading", { name: "Ana Gomez" });

      fireEvent.click(screen.getByRole("button", { name: "Verificar contacto" }));
      const dialog = await screen.findByRole("dialog", { hidden: true });
      fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));

      expect(api.post).not.toHaveBeenCalled();
    });
  });

  describe("acciones de membresia desde la ficha", () => {
    it("da de baja la membresia desde el modal de confirmacion y refleja el nuevo estado", async () => {
      seedRole("owner");
      let membershipStatus: User["membership_status"] = "active";
      vi.mocked(api.get).mockImplementation((url: string) => {
        if (url === "/users/u-1") {
          return jsonResponse(makeUser({ membership_status: membershipStatus }));
        }
        return jsonResponse({});
      });
      vi.mocked(api.post).mockImplementation((url: string) => {
        if (url === "/users/u-1/membership/cancel") {
          membershipStatus = "cancelled";
          return jsonResponse(makeUser({ membership_status: "cancelled" }));
        }
        return jsonResponse({});
      });

      renderAt("/users/u-1");
      await screen.findByRole("heading", { name: "Ana Gomez" });

      fireEvent.click(screen.getByRole("button", { name: "Dar de baja la membresía" }));
      const dialog = await screen.findByRole("dialog", { hidden: true });
      fireEvent.click(within(dialog).getByRole("button", { name: "Dar de baja la membresía" }));

      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith(
          "/users/u-1/membership/cancel",
          expect.anything()
        );
      });
      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Reactivar membresía" })).toBeInTheDocument();
      });
    });

    it("da de baja la membresia con la fecha elegida como cancelled_at", async () => {
      seedRole("owner");
      vi.mocked(api.get).mockImplementation((url: string) => {
        if (url === "/users/u-1") {
          return jsonResponse(makeUser({ membership_status: "active" }));
        }
        return jsonResponse({});
      });
      vi.mocked(api.post).mockImplementation((url: string) => {
        if (url === "/users/u-1/membership/cancel") {
          return jsonResponse(makeUser({ membership_status: "cancelled" }));
        }
        return jsonResponse({});
      });

      renderAt("/users/u-1");
      await screen.findByRole("heading", { name: "Ana Gomez" });

      fireEvent.click(screen.getByRole("button", { name: "Dar de baja la membresía" }));
      const dialog = await screen.findByRole("dialog", { hidden: true });
      const dateInput = dialog.querySelector('input[type="datetime-local"]') as HTMLInputElement;
      fireEvent.change(dateInput, { target: { value: "2026-01-01T10:00" } });
      fireEvent.click(within(dialog).getByRole("button", { name: "Dar de baja la membresía" }));

      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith("/users/u-1/membership/cancel", {
          cancelled_at: new Date("2026-01-01T10:00").toISOString(),
        });
      });
    });

    it("cancelar el modal de baja no dispara ninguna mutacion", async () => {
      seedRole("owner");
      vi.mocked(api.get).mockImplementation((url: string) => {
        if (url === "/users/u-1") {
          return jsonResponse(makeUser({ membership_status: "active" }));
        }
        return jsonResponse({});
      });

      renderAt("/users/u-1");
      await screen.findByRole("heading", { name: "Ana Gomez" });

      fireEvent.click(screen.getByRole("button", { name: "Dar de baja la membresía" }));
      const dialog = await screen.findByRole("dialog", { hidden: true });
      fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));

      expect(api.post).not.toHaveBeenCalled();
    });

    it("ofrece reactivar la membresia cuando esta dada de baja", async () => {
      seedRole("owner");
      vi.mocked(api.get).mockImplementation((url: string) => {
        if (url === "/users/u-1") {
          return jsonResponse(makeUser({ membership_status: "cancelled" }));
        }
        return jsonResponse({});
      });

      renderAt("/users/u-1");
      await screen.findByRole("heading", { name: "Ana Gomez" });

      expect(screen.getByRole("button", { name: "Reactivar membresía" })).toBeInTheDocument();
    });

    it("ofrece activar la membresia cuando el usuario nunca tuvo membresia", async () => {
      seedRole("owner");
      vi.mocked(api.get).mockImplementation((url: string) => {
        if (url === "/users/u-1") {
          return jsonResponse(
            makeUser({ membership_status: "none", membership_start_date: null })
          );
        }
        return jsonResponse({});
      });

      renderAt("/users/u-1");
      await screen.findByRole("heading", { name: "Ana Gomez" });

      expect(screen.getByRole("button", { name: "Activar membresía" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Reactivar membresía" })).toBeNull();
    });
  });

  describe("invitacion al portal desde la ficha", () => {
    it("abre el modal de invitacion y muestra el link de email con accion de copiar", async () => {
      seedRole("owner");
      vi.mocked(api.get).mockImplementation((url: string) => {
        if (url === "/users/u-1") {
          return jsonResponse(makeUser({ invitation_status: "none" }));
        }
        return jsonResponse({});
      });
      vi.mocked(api.post).mockImplementation((url: string) => {
        if (url === "/users/u-1/invitation") {
          return jsonResponse({
            email_link: "http://localhost/invitacion/email/tok-email",
            phone_link: "http://localhost/invitacion/phone/tok-phone",
            expires_at: "2026-01-08T00:00:00",
          });
        }
        return jsonResponse({});
      });

      renderAt("/users/u-1");
      await screen.findByRole("heading", { name: "Ana Gomez" });

      fireEvent.click(screen.getByRole("button", { name: "Invitar" }));
      const dialog = await screen.findByRole("dialog", { hidden: true });
      fireEvent.click(within(dialog).getByRole("button", { name: "Invitar" }));

      await waitFor(() => {
        expect(within(dialog).getByDisplayValue("http://localhost/invitacion/email/tok-email"))
          .toBeInTheDocument();
      });
      expect(
        within(dialog).getByRole("button", { name: "Copiar link de invitación" })
      ).toBeEnabled();
    });

    it("deshabilita el boton de WhatsApp cuando el miembro no tiene celular", async () => {
      seedRole("owner");
      vi.mocked(api.get).mockImplementation((url: string) => {
        if (url === "/users/u-1") {
          return jsonResponse(makeUser({ phone: null, invitation_status: "none" }));
        }
        return jsonResponse({});
      });

      renderAt("/users/u-1");
      await screen.findByRole("heading", { name: "Ana Gomez" });

      fireEvent.click(screen.getByRole("button", { name: "Invitar" }));
      const dialog = await screen.findByRole("dialog", { hidden: true });

      expect(
        within(dialog).getByRole("button", { name: /Enviar por WhatsApp/ })
      ).toBeDisabled();
    });

    it("muestra el error de precondicion dentro del modal de invitacion", async () => {
      seedRole("owner");
      vi.mocked(api.get).mockImplementation((url: string) => {
        if (url === "/users/u-1") {
          return jsonResponse(makeUser({ phone: null, invitation_status: "none" }));
        }
        return jsonResponse({});
      });
      vi.mocked(api.post).mockImplementation((url: string) => {
        if (url === "/users/u-1/invitation") {
          return Promise.reject({
            response: {
              data: { detail: "El usuario necesita un celular cargado para poder invitarlo" },
            },
          });
        }
        return jsonResponse({});
      });

      renderAt("/users/u-1");
      await screen.findByRole("heading", { name: "Ana Gomez" });

      fireEvent.click(screen.getByRole("button", { name: "Invitar" }));
      const dialog = await screen.findByRole("dialog", { hidden: true });
      fireEvent.click(within(dialog).getByRole("button", { name: "Invitar" }));

      expect(await within(dialog).findByRole("alert")).toHaveTextContent(
        "El usuario necesita un celular cargado para poder invitarlo"
      );
    });

    it("no ofrece la accion de invitar cuando el acceso ya esta activo", async () => {
      seedRole("owner");
      vi.mocked(api.get).mockImplementation((url: string) => {
        if (url === "/users/u-1") {
          return jsonResponse(makeUser({ invitation_status: "access_active" }));
        }
        return jsonResponse({});
      });

      renderAt("/users/u-1");
      await screen.findByRole("heading", { name: "Ana Gomez" });

      expect(screen.queryByRole("button", { name: "Invitar" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Reenviar invitación" })).toBeNull();
    });
  });

  describe("permisos de gestion segun rol del viewer", () => {
    it("un coach no ve acciones de gestion en la ficha de otro coach", async () => {
      seedRole("coach");
      vi.mocked(api.get).mockImplementation((url: string) => {
        if (url === "/users/u-3") {
          return jsonResponse(
            makeUser({
              id: "u-3",
              role: "coach",
              phone_verified: false,
              email_verified: false,
              membership_status: "active",
            })
          );
        }
        return jsonResponse({});
      });

      renderAt("/users/u-3");
      await screen.findByRole("heading", { name: "Ana Gomez" });

      expect(screen.queryByRole("button", { name: "Dar de baja la membresía" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Activar membresía" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Reactivar membresía" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Verificar contacto" })).toBeNull();
      // Rol coach: sin card de Invitación al portal (isMemberRole=false), ya
      // cubierto por el test de arriba "no muestra la seccion de invitacion...".
    });
  });
});
