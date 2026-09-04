# Verificación: adopt-kinetic-obsidian-theme

**Fecha**: 2026-09-04
**Veredicto**: PASA CON RESERVAS
**Diff verificado**: working tree sin commitear (vs `main`, misma rama actual) — backend
(`models.py`, `routers/auth.py`, `schemas.py`, migración `9812b6c09a1a`, `tests/test_theme.py`) y
frontend (tokens/CSS, `lib/theme.ts`, `stores/theme.ts`, `services/me*`, `Topbar.tsx`,
`Sidebar.tsx`, `App.jsx`, `index.html`, pase de ~900 clases en `src/pages` y `src/components`,
tests nuevos/actualizados).

## Escenarios de la spec

Verificados por QA contra la app real (Docker: db + backend + frontend), suite automatizada en
verde (`make test`: backend 21/21, frontend 16/16).

| Escenario | Cómo se verificó | Resultado |
|---|---|---|
| `app-shell` / Cliente del portal encuentra el toggle sin pasar por Ajustes | UI, login como cliente, snapshot de `/my-routine` | PASA |
| `app-shell` / El control refleja el modo actual sin ambigüedad | UI + `Topbar.test.tsx` | PASA |
| `app-shell` / Ajustes ya no tiene control de tema | UI, `/settings` como Dueño y Coach | PASA |
| `app-shell` / Badge de rol + card de identidad separados | UI, snapshot en los 3 roles | PASA |
| `app-shell` / Truncado de nombre/email largos | UI, screenshot sidebar cliente + código (`truncate` + `title`) | PASA |
| `app-shell` / Sidebar sin "Atajos" (Dueño y Coach) | UI + grep sobre `Sidebar.tsx` | PASA |
| `session-state` / Alternar modo cambia toda la pantalla al instante | UI, screenshots antes/después + `PATCH /auth/me/theme` 200 en Network | PASA |
| `session-state` / El modo sobrevive a recargar sin destello | UI, reload en dark, primer frame ya en dark (script anti-flash) | PASA |
| `session-state` / El modo sigue al usuario, no al dispositivo | UI, mismo usuario en 3 contextos de navegador aislados | PASA |
| `session-state` / Dos usuarios simultáneos no se pisan | UI, cliente + Dueño en contextos distintos, y mismo navegador con logout/login cruzado | PASA |
| `session-state` / Usuario sin preferencia ve dark por defecto | UI, usuario nuevo registrado en vivo, `theme_preference` NULL en DB | PASA |
| `app-settings-state` (REMOVED) / Nada ligado a tema en `app_settings` | Código: campo destructurado y excluido del payload de `PUT` | PASA |
| `settings-view` / `PUT /settings` sigue funcionando sin `theme_preference` | UI, click "Guardar cambios" → 200 en Network | PASA |
| `settings-view` / Cards de preview con acción real | UI + código (botón WhatsApp habilitado, `focusWhatsappField` implementado) | PASA (con matiz: no se ejercitó en vivo el caso "sin WhatsApp" para no alterar la config real del negocio; el código lo implementa) |

## Hallazgos

1. ~~**[bloqueante]** El toggle de tema reemplazó al botón "Nuevo cliente" en el Topbar~~ —
   **descartado tras confirmación del usuario**: es el comportamiento esperado, no una regresión
   accidental. `design.md` (dec. 11) y `proposal.md` se actualizaron para documentarlo
   explícitamente (el atajo de creación de cliente sigue disponible vía Dashboard y `/clients`).

2. **[mayor]** Contraste AA del acento ámbar en light mode: `--primary: #d97706` sobre
   `--surface-1: #ffffff` da **3.18:1**; sobre el patrón `bg-primary/10` de los pills da **2.85:1**
   (mayoría en `text-label-caps`, 11px, sin excepción de "texto grande" aplicable). Casos
   concretos: `Sidebar.tsx:68` (`text-primary/70` ≈2.3:1), `Settings.tsx:454`
   (`text-primary/85`), pills en `Settings.tsx:214`, `UserCard.tsx:486`,
   `AttendanceCalendar.tsx:59`, `EditClientDialog.tsx:136`. `design.md` fija "Light mode legible y
   con contraste AA en **toda** la app autenticada" como Goal y "condición necesaria del toggle", y
   la task 4.7 ("Pase de contraste en light mode... verificar") está marcada `[x]` sin que la
   propiedad se cumpla.

3. **[mayor]** `frontend/src/components/UserCard.tsx:665` — `text-emerald-100` sobrevivió al gate
   de grep (que solo cubre `zinc|amber|orange|lime`). Botón "WhatsApp progreso": en light mode,
   `text-emerald-100` (`#d1fae5`) sobre `bg-emerald-500/8` (≈blanco) da ≈**1.1:1**, botón
   invisible para un cliente con teléfono cargado.

4. **[menor]** `Login.tsx:156` y `RegisterClient.tsx:147` — el CTA principal conserva el gradiente
   hex literal de la paleta `dark-gold` eliminada (`#facc15`/`#fff7ed`/`#f97316`), pese a que la
   dec. 4 dice que el único lugar con hex crudo permitido es `index.css`.

5. **[menor]** `frontend/src/index.css`, `.app-shell-bg` — el `color-mix(..., black)` heredado del
   shell dark deja el canvas de light mode en ≈`#E0E0E0`/`#E4E6E8` en vez del `#F8FAFC` del design
   doc; se nota detrás del Topbar translúcido.

6. **[menor]** `text-muted-foreground` sobre `bg-surface-2` en light da 3.86:1; con texto de 11px
   (`Sidebar.tsx:103` badge de rol, `UserRoutine.tsx:299` header de tabla) no llega a AA.

7. **[menor]** `Topbar.tsx:136-144,184-192` — el toggle combina ícono de estado + `aria-label` de
   acción + `aria-pressed`, lo que un lector de pantalla anuncia de forma contradictoria ("Cambiar
   a modo claro, activado" en modo dark). Un `aria-label` de estado ("Modo oscuro") resolvería la
   ambigüedad.

8. **[menor]** `Login.tsx:167` — `bg-white/[0.03]` se mapeó a `bg-surface-2/5` en vez de
   `bg-surface-2` sin opacidad (como fija la tabla de la dec. 4); el botón "Registrar Cuenta" queda
   sin superficie visible en light mode.

9. **[menor]** `frontend/src/lib/theme.ts` — `THEME_MODES`/`ThemeModeDefinition` quedan sin
   consumidores (`Topbar.tsx` arma el copy a mano); código muerto.

## Sin verificar

- El caso "Resumen rápido con WhatsApp faltante" (escenario `settings-view`) no se ejercitó en
  vivo para no alterar la configuración real del negocio de la instancia de prueba; se validó por
  lectura de código (`focusWhatsappField`, `disabled={!settings.whatsapp_phone}`).
- No se corrió un audit de contraste automatizado (axe/Lighthouse) sobre toda la superficie light
  mode; los hallazgos 2, 3 y 6 salen de cálculo manual de contraste sobre los casos que el
  reviewer identificó — puede haber otros no relevados.

## Próximo paso

Ningún hallazgo bloqueante: el reemplazo de "Nuevo cliente" por el toggle es comportamiento
esperado (confirmado por el usuario; `design.md`/`proposal.md` actualizados en consecuencia). Las
reservas que quedan, a decisión del usuario antes de archivar:

- **Mayores** (2, 3): contraste AA del acento ámbar en light mode por debajo de 4.5:1 en varios
  call sites, y `text-emerald-100` sobreviviente en `UserCard.tsx` (botón "WhatsApp progreso" casi
  invisible en light). Ambos son arreglos acotados si se quieren resolver ahora.
- **Menores** (4-9): quedan a criterio del usuario/PO para este mismo change o como follow-up
  explícito, no bloquean el archive por sí solos.
