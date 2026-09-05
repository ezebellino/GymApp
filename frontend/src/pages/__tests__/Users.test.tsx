import { Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import api from "@/lib/http";

import Users from "../Users";
import { fireEvent, renderWithProviders, screen, within } from "../../test/renderWithProviders";
import type { User } from "@/types";

vi.mock("@/lib/http", async () => {
  const { createApiMock } = await import("../../test/apiMock");
  return createApiMock();
});

function makeUser(overrides: Partial<User>): User {
  return {
    id: "u-1",
    first_name: "Ana",
    last_name: "Gomez",
    full_name: "Ana Gomez",
    age: null,
    birth_date: null,
    weight_kg: null,
    height_cm: null,
    email: "ana@example.com",
    email_verified: true,
    phone: "1155555555",
    phone_verified: false,
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

function mockUsersList(users: User[]) {
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url.startsWith("/users/")) {
      return Promise.resolve({
        data: users,
        status: 200,
        statusText: "OK",
        headers: { "x-total-count": String(users.length) },
        config: {},
      } as any);
    }
    return Promise.resolve({ data: [], status: 200, statusText: "OK", headers: {}, config: {} } as any);
  });
}

describe("vista de Usuarios", () => {
  it("muestra las columnas de la spec: Nombre, Contacto, Rol, Alta, Inicio en el gimnasio y Acciones", async () => {
    mockUsersList([makeUser({})]);

    renderWithProviders(<Users />, { route: "/users" });

    // Escopeado a la tabla: "Nombre" también existe como label del form de
    // `CreateUserDialog`, montado (oculto) desde que la vista abre.
    const table = await screen.findByRole("table");
    expect(within(table).getByText("Nombre")).toBeInTheDocument();
    expect(within(table).getByText("Contacto")).toBeInTheDocument();
    expect(within(table).getByText("Rol")).toBeInTheDocument();
    expect(within(table).getByText("Alta")).toBeInTheDocument();
    expect(within(table).getByText("Inicio en el gimnasio")).toBeInTheDocument();
    expect(within(table).getByText("Acciones")).toBeInTheDocument();
    expect(await screen.findByText("Ana Gomez")).toBeInTheDocument();
    expect(within(table).getByText("Miembro")).toBeInTheDocument();
  });

  it("el titulo de la pagina es 'Usuarios'", async () => {
    mockUsersList([makeUser({})]);

    renderWithProviders(<Users />, { route: "/users" });

    expect(
      await screen.findByRole("heading", { name: "Usuarios" })
    ).toBeInTheDocument();
  });

  it("el total en singular dice '1 usuario', no '1 usuarios' (hallazgo 9)", async () => {
    mockUsersList([makeUser({})]);

    renderWithProviders(<Users />, { route: "/users" });

    expect(await screen.findByText("1 usuario")).toBeInTheDocument();
    expect(screen.queryByText("1 usuarios")).toBeNull();
  });

  it("no muestra el UUID del usuario en la fila", async () => {
    mockUsersList([makeUser({ id: "11111111-1111-1111-1111-111111111111" })]);

    renderWithProviders(<Users />, { route: "/users" });

    await screen.findByText("Ana Gomez");
    expect(screen.queryByText("11111111-1111-1111-1111-111111111111")).toBeNull();
  });

  it("columna Contacto muestra el email cuando esta cargado", async () => {
    mockUsersList([makeUser({ email: "ana@example.com", phone: "1155555555" })]);

    renderWithProviders(<Users />, { route: "/users" });

    expect(await screen.findByText("ana@example.com")).toBeInTheDocument();
  });

  it("columna Contacto muestra el telefono cuando no hay email", async () => {
    mockUsersList([makeUser({ email: null, phone: "1155555555" })]);

    renderWithProviders(<Users />, { route: "/users" });

    await screen.findByText("Ana Gomez");
    expect(screen.getByText("1155555555")).toBeInTheDocument();
  });

  it("columna Contacto muestra '-' cuando no hay email ni telefono", async () => {
    mockUsersList([makeUser({ email: null, phone: null })]);

    renderWithProviders(<Users />, { route: "/users" });

    await screen.findByText("Ana Gomez");
    expect(screen.getByText("-")).toBeInTheDocument();
  });

  it("muestra el circulo verde para up_to_date, con texto accesible (no solo color)", async () => {
    mockUsersList([makeUser({ membership_indicator: "up_to_date" })]);

    renderWithProviders(<Users />, { route: "/users" });

    expect(await screen.findByRole("img", { name: "Al día con la cuota" })).toBeInTheDocument();
  });

  it("muestra el circulo naranja para overdue, con texto accesible", async () => {
    mockUsersList([makeUser({ membership_indicator: "overdue" })]);

    renderWithProviders(<Users />, { route: "/users" });

    expect(await screen.findByRole("img", { name: "En mora" })).toBeInTheDocument();
  });

  it("muestra el circulo rojo para suspended, con texto accesible", async () => {
    mockUsersList([makeUser({ membership_indicator: "suspended", membership_status: "cancelled" })]);

    renderWithProviders(<Users />, { route: "/users" });

    expect(await screen.findByRole("img", { name: "Membresía dada de baja" })).toBeInTheDocument();
  });

  it("no muestra ningun circulo cuando el usuario nunca fue miembro (indicator none)", async () => {
    mockUsersList([
      makeUser({
        role: "coach",
        membership_indicator: "none",
        membership_status: "none",
        membership_start_date: null,
      }),
    ]);

    renderWithProviders(<Users />, { route: "/users" });

    await screen.findByText("Ana Gomez");
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("la leyenda no es visible por defecto y aparece al hacer click en el icono de informacion", async () => {
    mockUsersList([makeUser({})]);

    renderWithProviders(<Users />, { route: "/users" });

    await screen.findByText("Ana Gomez");
    expect(screen.queryByText("Leyenda")).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: /ver leyenda de roles y estados/i })
    );

    expect(await screen.findByText("Leyenda")).toBeInTheDocument();
  });

  it("boton de WhatsApp deshabilitado cuando el usuario no tiene telefono", async () => {
    mockUsersList([makeUser({ phone: null })]);

    renderWithProviders(<Users />, { route: "/users" });

    const whatsapp = await screen.findByRole("button", {
      name: /enviar recordatorio por whatsapp a ana gomez/i,
    });
    expect(whatsapp).toBeDisabled();
  });

  it("boton de WhatsApp habilitado cuando el usuario tiene telefono", async () => {
    mockUsersList([makeUser({ phone: "1155555555" })]);

    renderWithProviders(<Users />, { route: "/users" });

    const whatsapp = await screen.findByRole("button", {
      name: /enviar recordatorio por whatsapp a ana gomez/i,
    });
    expect(whatsapp).not.toBeDisabled();
  });

  it("hay un unico control de paginacion en la vista", async () => {
    mockUsersList([makeUser({})]);

    renderWithProviders(<Users />, { route: "/users" });

    await screen.findByText("Ana Gomez");
    expect(screen.getAllByRole("button", { name: "Anterior" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Siguiente" })).toHaveLength(1);
  });

  it("el pie muestra el rango 'Mostrando X-Y de Z' (dec. 19.1: showRange ya no se oculta)", async () => {
    mockUsersList([makeUser({})]);

    renderWithProviders(<Users />, { route: "/users" });

    await screen.findByText("Ana Gomez");
    const rangeText = screen.getByText((_, element) => {
      const normalized = element?.textContent?.replace(/\s+/g, " ").trim();
      return normalized === "Mostrando 1-1 de 1";
    });
    expect(rangeText).toBeInTheDocument();
  });

  it("el boton Crear usuario abre el modal de alta", async () => {
    mockUsersList([makeUser({})]);

    renderWithProviders(<Users />, { route: "/users" });

    await screen.findByText("Ana Gomez");
    fireEvent.click(screen.getByRole("button", { name: /crear usuario/i }));

    expect(await screen.findByRole("heading", { name: "Crear usuario" })).toBeInTheDocument();
  });

  it("el boton Ver de una fila navega a la ficha del usuario", async () => {
    mockUsersList([makeUser({})]);

    renderWithProviders(
      <Routes>
        <Route path="/users" element={<Users />} />
        <Route path="/users/:id" element={<div>Ficha de u-1</div>} />
      </Routes>,
      { route: "/users" }
    );

    await screen.findByText("Ana Gomez");
    fireEvent.click(screen.getByRole("button", { name: /^ver perfil de ana gomez$/i }));

    expect(await screen.findByText("Ficha de u-1")).toBeInTheDocument();
  });
});
