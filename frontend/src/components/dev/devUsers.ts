import type { Role } from "@/types";

// Las tres credenciales fijas de desarrollo. Única definición del lado frontend;
// la misma tabla vive en `backend/scripts/seed_dev_users.py` (duplicada a
// propósito, dec. 8 de `add-dev-role-switcher`) y está documentada en la skill
// `run-app`. Nada fuera de `components/dev/` debe importar este archivo: la única
// importación entrante a esta carpeta es el `import()` dinámico de `App.jsx`, y
// cualquier otra reintroduce las credenciales al bundle de producción.

export type DevUserId = "owner" | "coach" | "member";

export type DevUser = {
  id: DevUserId;
  label: string;
  email: string;
  password: string;
  role: Role;
};

const DEV_PASSWORD = "devdev123";

export const DEV_USERS: readonly DevUser[] = [
  {
    id: "owner",
    label: "Dueño",
    email: "dev.owner@miniespacio.local",
    password: DEV_PASSWORD,
    role: "owner",
  },
  {
    id: "coach",
    label: "Coach",
    email: "dev.coach@miniespacio.local",
    password: DEV_PASSWORD,
    role: "coach",
  },
  {
    id: "member",
    label: "Miembro",
    email: "dev.member@miniespacio.local",
    password: DEV_PASSWORD,
    role: "member",
  },
];
