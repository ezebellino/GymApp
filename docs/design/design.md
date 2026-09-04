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
- **Brand Plaque:** Dark slate pill card framing the circular logo, uppercase company title, and tracked subtext.
- **Sidebar Links:** Full-width rounded items (`0.5rem`). Default state has transparent fill with low-contrast borders; active state gains an amber-tinted border (`#D97706`), amber text, and subtle glow.
- **Global Search Bar:** Fixed-height (38px) pill input centered in the header. Features an inset keyboard icon badge (`Ctrl/Cmd + K`) and muted placeholder text.

### 2. Operational Hero Greeting Card
- A commanding banner housing greeting text and quick launchers.
- Surface background: Dark slate with an inner amber glow gradient.
- Features the pill badge: `CENTRO OPERATIVO` in uppercase tracking.
- House quick-trigger action buttons with high-visibility icon prefixes.

### 3. Action Buttons
- **Primary Amber (`Ir a rutinas`):** Solid `#F59E0B` fill, `#09090B` bold typography. Hover triggers an energetic brightness lift and a soft outer glow (`box-shadow: 0 0 20px rgba(245, 158, 11, 0.4)`).
- **Secondary Ghost / Outlined:** Dark surface `#18181B` with `1px solid rgba(255, 255, 255, 0.12)`. On hover, borders brighten to `#71717A` with a `#27272A` background.
- **Destructive / Logout:** `#D97706` background with warm dark contrast for clean session exits.

### 4. KPI Metric Cards
- Modular grid units displaying an uppercase metric label (`CLIENTES ACTIVOS`), bold oversized numerical stat (`metric-kpi`), circular iconography container, and supporting progress notes.
- Hover state introduces a micro-elevation scale (`transform: translateY(-2px)`) with border highlight transitioning from neutral to subtle amber.

### 5. Data Tables & Quick Forms
- **Data Table:** Borderless interior with alternating subtle zebra or hairline horizontal dividers (`rgba(255, 255, 255, 0.05)`). Column headers use `label-caps` in muted slate. Empty state provides clear status messaging with dashed containment.
- **Check-in Quick Form:** Compact vertical layout with high-contrast input boxes, explicit focus rings (`2px solid #F59E0B`), and UUID quick-paste capability.

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
