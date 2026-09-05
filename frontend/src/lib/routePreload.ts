// Mapa único ruta -> import dinámico de la página, compartido entre `App.jsx`
// (donde arma cada `lazy(...)`) y `Sidebar.tsx` (que precarga el chunk en
// hover/focus, antes del click). Vite cachea por specifier: llamar al mismo
// `import("@/pages/X")` desde dos archivos no duplica el chunk, así que este
// mapa es la única fuente de verdad de qué ruta carga qué módulo — evita que
// una página nueva quede en `App.jsx` pero sin precarga en el sidebar, o
// viceversa.
export const routeImporters: Record<string, () => Promise<unknown>> = {
  "/dashboard": () => import("@/pages/Dashboard"),
  "/users": () => import("@/pages/Users"),
  "/payments": () => import("@/pages/Payments"),
  "/attendance": () => import("@/pages/Attendance"),
  "/routines": () => import("@/pages/Routines"),
  "/reports": () => import("@/pages/Reports"),
  "/settings": () => import("@/pages/Settings"),
  "/my-routine": () => import("@/pages/UserRoutine"),
};

// Dispara el import dinámico de la ruta sin esperar su resultado (el
// resultado real lo consume `React.lazy` cuando el router monta la página).
// Llamarlo más de una vez para la misma ruta es gratis: el navegador/Vite
// cachea la respuesta del chunk.
export function preloadRoute(path: string) {
  routeImporters[path]?.();
}
