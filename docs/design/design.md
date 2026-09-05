---
name: Kinetic Obsidian
colors:
  surface: '#131316'
  surface-dim: '#131316'
  surface-bright: '#39393c'
  surface-container-lowest: '#0e0e11'
  surface-container-low: '#1b1b1e'
  surface-container: '#1f1f22'
  surface-container-high: '#2a2a2d'
  surface-container-highest: '#353438'
  on-surface: '#e4e1e6'
  on-surface-variant: '#d8c3ad'
  inverse-surface: '#e4e1e6'
  inverse-on-surface: '#303033'
  outline: '#a08e7a'
  outline-variant: '#534434'
  surface-tint: '#ffb95f'
  primary: '#ffc174'
  on-primary: '#472a00'
  primary-container: '#f59e0b'
  on-primary-container: '#613b00'
  inverse-primary: '#855300'
  secondary: '#ffb77d'
  on-secondary: '#4d2600'
  secondary-container: '#d97707'
  on-secondary-container: '#432100'
  tertiary: '#ffc32d'
  on-tertiary: '#402d00'
  tertiary-container: '#e0a800'
  on-tertiary-container: '#584000'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffddb8'
  primary-fixed-dim: '#ffb95f'
  on-primary-fixed: '#2a1700'
  on-primary-fixed-variant: '#653e00'
  secondary-fixed: '#ffdcc3'
  secondary-fixed-dim: '#ffb77d'
  on-secondary-fixed: '#2f1500'
  on-secondary-fixed-variant: '#6e3900'
  tertiary-fixed: '#ffdf9f'
  tertiary-fixed-dim: '#f9bd22'
  on-tertiary-fixed: '#261a00'
  on-tertiary-fixed-variant: '#5c4300'
  background: '#131316'
  on-background: '#e4e1e6'
  surface-variant: '#353438'
  status-ok: '#10b981'
  status-warn: '#f59e0b'
  status-danger: '#ef4444'
typography:
  headline-hero:
    fontFamily: Plus Jakarta Sans
    fontSize: 36px
    fontWeight: '800'
    lineHeight: 44px
    letterSpacing: -0.03em
  headline-hero-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 26px
    fontWeight: '800'
    lineHeight: 34px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '700'
    lineHeight: 26px
    letterSpacing: -0.01em
  metric-kpi:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '800'
    lineHeight: 36px
    letterSpacing: -0.03em
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-caps:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.08em
  label-code:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  space-2xs: 0.25rem
  space-xs: 0.5rem
  space-sm: 0.75rem
  space-md: 1rem
  space-lg: 1.25rem
  space-xl: 1.5rem
  space-2xl: 2rem
  space-3xl: 3rem
  sidebar-width: 240px
  gutter: 1.25rem
  container-max-width: 1600px
  topbar-height: 4rem
  page-gutter-y: 1.5rem
---

## Brand & Style

This design system powers a high-efficiency boutique fitness and personalized training management suite. It merges the athletic grit of physical conditioning with the laser precision of modern SaaS operations. The design personality is deliberate, muscular, and focused—eradicating administrative friction so trainers and gym owners can navigate memberships, routines, check-ins, and cash flows without distraction.

The aesthetic direction is **Modern Dark Tactical** with an accompanying **Crisp Slate Light Mode**:
- **Tactical Utility:** Grounded in deep obsidian and charcoal tones with crisp 1px structural contours, inspired by performance hardware and telemetry dashboards.
- **Amber Luminescence:** Electric warm amber and radiant gold serve as functional energy triggers, guiding eyes toward high-priority operational workflows (active check-ins, urgent notifications, primary CTAs).
- **Density & Ergonomics:** High data legibility, compact tracking on metadata labels, tactile interactive surfaces with micro-scale responses, and distinct elevated surface layering.

## Colors

The palette leverages high-contrast luminescence against matte architectural darks, with a mirroring high-clarity daylight mode.

### Dark Theme (Default Operational State)
- **Base Canvas (`#09090B`):** Deep abyssal canvas providing infinite depth and optical comfort in dim training facilities.
- **Surface Level 1 (`#121215` / `#18181B`):** Subtle charcoal enclosures for sidebars, top app bars, and default card backgrounds.
- **Surface Level 2 (`#27272A`):** Interactive inputs, nested data clusters, and hovered rows.
- **Brand Primary Accent (`#F59E0B`):** Blazing amber for key affirmative buttons, active badges, and focus rings.
- **Gradients & Glows:** Linear gradient overlay `linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(24, 24, 27, 0) 65%)` reserved for the hero operational banner.

### Light Theme (Ambient Daylight State)
- **Base Canvas (`#F8FAFC`):** Crisp cool white delivering pristine visual ergonomics.
- **Surface Card (`#FFFFFF`):** High-clarity white containers with micro-borders (`#E2E8F0`).
- **Brand Primary Tone (`#D97706`):** Deep golden amber for solid backgrounds (buttons, active
  fills) paired with dark on-primary text — that pairing clears WCAG AA. On its own, as text or
  icon color over a light surface, `#D97706` falls short of AA (3.18:1 on white); use **Primary
  Strong (`#92400E`)** instead for that case (`--primary-strong` in light mode, mapped to the
  `text-primary-strong`/`bg-primary-strong` tokens) — same amber family, dark enough to clear AA
  as foreground text/icons on white, `--surface-2`, and the low-opacity accent tints.
- **Text Hierarchies:** Deep Slate (`#0F172A`) for bold readability paired with muted Slate
  (`#475569`) for contextual descriptors — darkened one step from the initial `#64748B` pick,
  which fell short of AA (3.86:1) against `--surface-2` cards.

### Status Indicators
Membership status dots (`MembershipDot`, `up_to_date`/`overdue`/`suspended`) use three semantic
tokens — `--status-ok`, `--status-warn`, `--status-danger` — never a raw palette class. In dark
mode they hold the same emerald-500/amber-500 values the UI already used (`--status-danger` is an
alias of `--destructive`). In **light mode they step down to emerald-700/amber-700** instead of
500/600: a 10px dot counts as a graphical object under WCAG 1.4.11 (minimum 3:1), and 500 lands at
≈2.36/≈2.05 against the shell's light surfaces — 600 only reaches ≈3.65/≈3.2, with no margin for
the antialiasing a small circular dot loses at its edge. Step 700 puts all three states in the same
≈5:1 band. Same reasoning that already justifies `--primary-strong` existing as a separate token
from `--primary` in light mode.

## Typography

The typographic hierarchy communicates authority, speed, and numerical clarity.

- **Primary Display & Headings (`Plus Jakarta Sans`):** Selected for its athletic geometry, open counters, and assertive presence. Numbers within metric cards render with robust physical weight.
- **Labels & Micro-copy (`Inter`):** Deployed for all uppercase category tags, table column headers, and shortcuts. The wide letter-spacing (`0.08em`) guarantees instant optical recognition even when glancing at a tablet mount across the gym counter.
- **Metric Figures:** Metrics (`metric-kpi`) are paired with strict tabular figures (`font-variant-numeric: tabular-nums`) to prevent horizontal jitter during live system refreshes.

## Layout & Spacing

The layout is built around a persistent operational command structure utilizing a fixed left-hand rail and an adaptable fluid canvas.

- **Grid Architecture:** A responsive 12-column fluid grid system with `1.25rem` gutters and adaptive margins.
- **Navigation Shell:**
  - **Sidebar:** Fixed `240px` navigation rail containing branding, core sections, and contextual owner summaries.
  - **Top Utility Bar:** Horizontal bar anchoring the global keyboard-navigable search input (`Ctrl/Cmd + K`), contextual actions, and user session termination.
- **Breakpoints:**
  - **Desktop (≥ 1280px):** 12-column grid. Hero spans 12 columns, KPI cards divide into 3 columns (4 cols each), followed by a 2-column operational split (4-col quick input / 8-col dynamic tables).
  - **Tablet (768px – 1279px):** Sidebar condenses into an icon-only 64px rail or drawer. KPIs transition to 2-column rows with unified vertical rhythm.
  - **Mobile (< 768px):** Single-column stack. Sidebar transitions to an off-canvas drawer. Tables switch to horizontally swipeable containers with fixed primary identifiers.

## Elevation & Depth

This system avoids heavy muddy drop shadows, relying on luminous layering, border containment, and ambient backdrops:

- **Level 0 (Base Canvas):** Pure flat surface (`#09090B` in dark, `#F8FAFC` in light).
- **Level 1 (Card & Module Layer):** Elevated container (`#18181B` / `#FFFFFF`) bounded by a hairline structural border: `1px solid rgba(255, 255, 255, 0.08)` in dark mode and `1px solid #E2E8F0` in light mode.
- **Level 2 (Interactive Floating Elements):** Dropdowns, dialogs, and popovers utilize an ambient diffused shadow tinted with amber undertones:
  - Dark: `0 12px 32px -4px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(245, 158, 11, 0.15)`
  - Light: `0 10px 25px -3px rgba(15, 23, 42, 0.08), 0 1px 2px 0 rgba(15, 23, 42, 0.04)`
- **Hero Aura:** The primary welcome card introduces a subtle ambient radial bloom behind the primary title: `radial-gradient(ellipse at top right, rgba(245, 158, 11, 0.15) 0%, transparent 70%)`.

## Shapes

The design maintains an aerodynamic yet grounded shape language, balancing soft-industrial contours with pill ergonomics:

- **Dashboard Containers & Cards:** Configured at `rounded-xl` (`1rem` / `16px`) for structural cards and panels, creating a cohesive framing system.
- **Badges & Micro Pills:** Full radius (`rounded-full` / `9999px`) used for telemetry pills, operational tags (`CENTRO OPERATIVO`), and icon buttons.
- **Inputs & Standard Buttons:** `rounded-lg` (`0.5rem` / `8px`) to maintain sharp, tool-like efficiency.

## Components

### 1. Navigation Elements
- **Brand Plaque:** Dark slate pill card framing the circular logo, uppercase company title, and tracked subtext. Sits in its own padded block at the top of the Sidebar (`px-4 pt-4 pb-2` — top margin equal to the rest of the Sidebar's gutter, no bottom border, no fixed height). It's deliberately **not** tied to `topbar-height`: the owner asked for no continuous horizontal line between the Sidebar and the Topbar, so the plaque's own height is independent of the Top Utility Bar's.
- **Sidebar Links:** Full-width rounded items (`0.5rem`). Default state has transparent fill with low-contrast borders; active state gains an amber-tinted border (`#D97706`), amber text, and subtle glow.
- **Top Utility Bar:** Fixed-height (`topbar-height`, `4rem` / 64px), sticky. Its inner row shares the **same max-width container** as the page content below it (same horizontal gutters and `container-max-width`), so its left/right edges line up with the content's edges at any viewport ≥ 1280px. The left slot carries no content (no section name); center holds the global search; right holds theme toggle / session actions.

### 2. Operational Hero Greeting Card
- A commanding banner housing greeting text and quick launchers.
- Surface background: Dark slate with an inner amber glow gradient.
- Features the pill badge: `CENTRO OPERATIVO` in uppercase tracking.
- House quick-trigger action buttons with high-visibility icon prefixes.
- **Scope: exclusive to the Dashboard.** No list view (Users, Payments, Attendance, Routines)
  uses this pattern — a list view's header is the compact single-row header described in
  "6. List Page" below.

### 3. Action Buttons
- **Primary Amber (`Ir a rutinas`):** Solid `#F59E0B` fill, `#09090B` bold typography. Hover triggers an energetic brightness lift and a soft outer glow (`box-shadow: 0 0 20px rgba(245, 158, 11, 0.4)`).
- **Secondary Ghost / Outlined:** Dark surface `#18181B` with `1px solid rgba(255, 255, 255, 0.12)`. On hover, borders brighten to `#71717A` with a `#27272A` background.
- **Destructive / Logout:** `#D97706` background with warm dark contrast for clean session exits.

### 4. KPI Metric Cards
- Modular grid units displaying an uppercase metric label (`CLIENTES ACTIVOS`), bold oversized numerical stat (`metric-kpi`), circular iconography container, and supporting progress notes.
- Hover state introduces a micro-elevation scale (`transform: translateY(-2px)`) with border highlight transitioning from neutral to subtle amber.

### 5. Data Tables & Quick Forms
- **Data Table:** Borderless interior with alternating subtle zebra or hairline horizontal dividers (`rgba(255, 255, 255, 0.05)`). Column headers use `label-caps` in muted slate, weight **700** (bold) — the weight a bare `<th>` inherits from the user-agent stylesheet, which `label-caps` itself doesn't carry as a `font-weight` submodifier (a documented gap; see note below). Empty state provides clear status messaging with dashed containment.
- **Column header band:** the row of column headers sits on `--table-head`, a token defined per mode as `color-mix(in srgb, var(--surface-2) 40%, var(--surface-1))` — the same tone a translucent `surface-2/40` band would give, but resolved to an **opaque** color. Opacity matters wherever this header is `sticky` over content that scrolls underneath it (a List Page's table body, "6." below): a translucent band would let scrolled rows show through.
- **Check-in Quick Form:** Compact vertical layout with high-contrast input boxes, explicit focus rings (`2px solid #F59E0B`), and UUID quick-paste capability.
- **List page footer:** the pagination row shows the range ("Showing X-Y of Z") on the left and the page-size selector + prev/next + "page N / M" on the right, both in the same row from `sm` up. The total repeating the header's count pill is an accepted redundancy, not an oversight.
- *Future criterion, not part of this change:* five other hand-written `<thead>` blocks in the repo (Attendance, Reports ×2, Dashboard, UserRoutine) should adopt `ui/table.tsx` and this same header style (`--table-head` band, bold `label-caps`) when those views are reimplemented — one table styling convention for the app instead of two.
- *Open debt, not part of this pass:* `--text-label-caps` (front-matter `typography`) carries line-height and letter-spacing but no `font-weight` submodifier, so the `text-label-caps` utility itself renders at the browser's inherited weight rather than the 700 the typography spec calls for. Fixing it at the token level is correct long-term, but today ~30 call sites use `text-label-caps` with no weight override of their own (Dashboard, Reports, Settings, Sidebar, UserCard, SpotlightSearch, dialogs) — adding the submodifier would restyle all of them at once, well beyond the scope of whichever change touches a single table. Column headers that need the bold weight today set `font-bold` explicitly alongside `text-label-caps` until this is fixed at the source.

### 6. List Page
The layout pattern for any listing view with a table (Users; Payments and Attendance adopt it
when they are reimplemented). Distinct from the Operational Hero Greeting Card, which stays
exclusive to the Dashboard: a list page never uses a hero banner or a separate legend card.

**The whole view is a single Card (Level 1: hairline border + surface background), not just the
table.** Header, filter toolbar, table body and pagination footer all live inside one panel, read
as one contained surface rather than four loose blocks with a frame around the middle one. The
Card occupies the remaining viewport height (`calc(100dvh - topbar-height - 2 × page-gutter-y)`)
and its own padding — this fixed-height behavior applies only at `lg` (≥ 1024px, the same
breakpoint where the Sidebar stops being a drawer); below that, the Card reverts to natural
height and page-level scroll. Four zones, top to bottom, all inside that Card:
- **Compact single-row header:** page title (own `<h1>` — the Top Utility Bar shows no section
  name, so there's no duplication to avoid), an optional adornment next to the title (e.g. a
  legend info icon), a total-count pill, and the primary action — all in one row, no hero, no
  aura, no description text underneath.
- **Filter toolbar:** search and future filters. No uppercase label above the input; an
  `aria-label` carries the accessible name instead.
- **Table body, inside an inner frame:** the table and its column header sit in an inner frame
  (hairline border, smaller radius than the Card, no background of its own — the surface behind
  it is the Card's) with its own internal scroll and a **fixed column header** that stays visible
  while the body scrolls, sitting on the opaque `--table-head` band (see "5." above) so scrolled
  rows never show through. Column headers use `label-caps` in muted slate, weight 700, same as
  any other data table. Per-row actions are `rounded-full` icon-buttons, each with an accessible
  name. Below `lg` the table keeps only its horizontal swipe-to-scroll (see Breakpoints, Mobile).
- **Single pagination footer:** exactly one pagination control, below the table — range ("Showing
  X-Y of Z") on the left and page-size selector + prev/next + "page X / Y" on the right, both in
  the same row from `sm` up. Repeating the total from the header's count pill is an accepted
  redundancy, not an oversight.
- **Primary action, icon-only below 768px:** under `md` (768px) the primary action shows only
  its icon, with a fixed `aria-label` that stays even where the text label is visually hidden.

### Popover
Interactive floating elements. Level 2 elevation (see Elevation & Depth), `rounded-xl`, opaque
background (never translucent — floating content over a dense table has to stay legible), no
portal. Not modal: no focus trap, no backdrop, closes on Escape, click/tap outside, or focus
moving outside its wrapper.

## Notas de adopción (Mini Espacio)

- Este documento es la **fuente de verdad del nuevo tema visual** del frontend, reemplazando los
  tres temas actuales (`dark-gold`, `dark-copper`, `dark-olive` en `frontend/src/lib/theme.ts`).
  Esos tres se eliminan del selector de Ajustes.
- En su lugar, Ajustes expone un **toggle simple dark/light** (un solo switch, no un selector de
  múltiples paletas) que alterna entre el modo dark tactical y el light mode "Crisp Slate"
  descriptos arriba.
- Referencia visual: mockups de dashboard en dark y light compartidos en la issue de rediseño
  (ver `README.md` / issue de GitHub vinculada).
- Cualquier change de OpenSpec que toque estilos globales (`index.css`, `theme.ts`, componentes de
  `src/components/ui/**`) debe partir de este documento, no de las paletas actuales.
