#!/usr/bin/env python3
"""Verifica el `## Plan de verificación` del `design.md` de un change de OpenSpec.

Chequea el formato rígido de la dec. 7 de `add-verification-gates-to-opsx-flow/design.md`
(sección única, línea de riesgo con nivel válido, invariantes, tabla de tests de 3 columnas
con al menos una fila `backend`/`frontend`) y que cada test nombrado en la tabla exista de
verdad en el repo (dec. 9): `backend` -> el archivo existe y contiene `def <caso>(`; `frontend`
-> el archivo existe y matchea `(it|test)\\(\\s*["'`]<caso>`; `manual` -> sin chequeo.

Los headings y las líneas dentro de bloques de código fenced (```) se ignoran, para que un
`design.md` que repita `## Plan de verificación` dentro de un ejemplo siga contando como
sección única.

Uso:
  python3 .agents/bin/check_plan.py --change <nombre>   # openspec/changes/<nombre>/design.md
  python3 .agents/bin/check_plan.py --design <ruta>     # ruta directa a un design.md

Salida:
  exit 0  el plan cumple. Última línea de stdout: `riesgo=<bajo|medio|alto>`.
  exit 1  el plan no cumple. Una línea `FALLA: <motivo>` por problema encontrado.
  exit 2  error de uso (change inexistente, design.md inexistente, argumentos inválidos).
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

SECTION_HEADING = "## Plan de verificación"
NIVELES_VALIDOS = {"bajo", "medio", "alto"}
CAPAS_VALIDAS = {"backend", "frontend", "manual"}

RIESGO_RE = re.compile(r"^\*\*Riesgo\*\*:\s*(?P<nivel>\S+)\s*—\s*(?P<criterio>.+)$")
RIESGO_PREFIX_RE = re.compile(r"^\*\*Riesgo\*\*:")
INVARIANTE_RE = re.compile(r"^- I\d+\.\s+\S")
HEADING2_RE = re.compile(r"^## ")
HEADING3_RE = re.compile(r"^### ")
FENCE_RE = re.compile(r"^\s*```")


def usage_error(msg: str) -> int:
    print(f"ERROR: {msg}", file=sys.stderr)
    return 2


def strip_fences(text: str) -> tuple[list[str], int | None]:
    """Devuelve (líneas de `text` que no están dentro de un bloque ``` ```, línea del
    fence sin cerrar o `None`).

    Las líneas delimitadoras (las que abren/cierran el fence) también se excluyen. Si
    el documento termina con un fence abierto, se corta ahí: el resto del documento
    (incluida la sección que se busca) quedaría tragado como "código", así que se
    devuelve el número de línea (1-indexed) del fence que nunca cerró en vez de
    fingir que el texto siguiente no existe.
    """
    out: list[str] = []
    in_fence = False
    fence_open_at: int | None = None
    for i, line in enumerate(text.splitlines(), start=1):
        if FENCE_RE.match(line):
            in_fence = not in_fence
            fence_open_at = i if in_fence else None
            continue
        if not in_fence:
            out.append(line)
    return out, fence_open_at


def section_lines(lines: list[str], start_idx: int) -> list[str]:
    """Líneas de la sección que arranca en `start_idx` (la del heading `## ...`)
    hasta el próximo heading de nivel 2 (exclusive) o el fin del documento."""
    body: list[str] = []
    for line in lines[start_idx + 1 :]:
        if HEADING2_RE.match(line):
            break
        body.append(line)
    return body


def heading_matches(line: str, heading: str) -> bool:
    """`True` si `line` es exactamente `heading` o lo tiene como prefijo seguido
    de espacio (p. ej. `### Invariantes del change` matchea `### Invariantes`)."""
    if line == heading:
        return True
    return (
        line.startswith(heading)
        and len(line) > len(heading)
        and line[len(heading)].isspace()
    )


def subsection_lines(body: list[str], heading: str) -> list[str] | None:
    """Líneas bajo un `### <heading>` dentro de `body`, hasta el próximo heading
    (### o ##) o el fin de `body`. `None` si el heading no aparece.

    El heading se matchea por **prefijo** (ver `heading_matches`): un heading real
    puede traer texto extra después (`### Invariantes del change`) y sigue contando
    como la sección `### Invariantes`."""
    idx = next((i for i, line in enumerate(body) if heading_matches(line, heading)), None)
    if idx is None:
        return None
    out: list[str] = []
    for line in body[idx + 1 :]:
        if HEADING2_RE.match(line) or HEADING3_RE.match(line):
            break
        out.append(line)
    return out


def split_table_row(row: str) -> list[str] | None:
    stripped = row.strip()
    if not stripped.startswith("|"):
        return None
    parts = stripped.split("|")
    # Una fila bien formada empieza y termina en "|": el split dej a strings
    # vacíos en las puntas.
    if parts and parts[0].strip() == "":
        parts = parts[1:]
    if parts and parts[-1].strip() == "":
        parts = parts[:-1]
    return [p.strip() for p in parts]


def is_separator_row(cells: list[str]) -> bool:
    return all(set(c) <= {"-", ":", " "} and c.strip("-: ") == "" for c in cells)


def check_design(text: str) -> tuple[list[str], str | None]:
    """Devuelve (fallas, riesgo). `riesgo` es `None` si hay fallas."""
    fallas: list[str] = []
    lines, fence_open_at = strip_fences(text)
    if fence_open_at is not None:
        return ([f"bloque de código sin cerrar en línea {fence_open_at}"], None)

    heading_idxs = [i for i, line in enumerate(lines) if line.strip() == SECTION_HEADING]
    if not heading_idxs:
        return ([f"falta la sección '{SECTION_HEADING}'"], None)
    if len(heading_idxs) > 1:
        return ([f"la sección '{SECTION_HEADING}' aparece más de una vez"], None)

    body = section_lines(lines, heading_idxs[0])

    # --- Riesgo -------------------------------------------------------
    riesgo_prefix_lines = [line for line in body if RIESGO_PREFIX_RE.match(line.strip())]
    nivel: str | None = None
    if not riesgo_prefix_lines:
        fallas.append("falta la línea '**Riesgo**: <nivel> — <criterio>'")
    elif len(riesgo_prefix_lines) > 1:
        fallas.append("hay más de una línea '**Riesgo**: ...'")
    else:
        match = RIESGO_RE.match(riesgo_prefix_lines[0].strip())
        if not match:
            fallas.append(
                "la línea de riesgo no tiene el formato "
                "'**Riesgo**: <nivel> — <criterio>' (falta el '—' o el criterio)"
            )
        else:
            nivel = match.group("nivel")
            if nivel not in NIVELES_VALIDOS:
                fallas.append(
                    f"nivel de riesgo inválido: '{nivel}' (debe ser bajo, medio o alto)"
                )
                nivel = None

    # --- Invariantes ----------------------------------------------------
    invariantes = subsection_lines(body, "### Invariantes")
    if invariantes is None:
        fallas.append("falta la sección '### Invariantes'")
    elif not any(INVARIANTE_RE.match(line) for line in invariantes):
        fallas.append("'### Invariantes' no tiene ningún ítem '- I<n>. ...'")

    # --- Tests ------------------------------------------------------------
    tests_body = subsection_lines(body, "### Tests")
    if tests_body is None:
        fallas.append("falta la sección '### Tests'")
    else:
        table_rows = [row for row in tests_body if row.strip().startswith("|")]
        parsed_rows = [split_table_row(row) for row in table_rows]
        parsed_rows = [r for r in parsed_rows if r is not None]

        if len(parsed_rows) < 2:
            fallas.append("la tabla de '### Tests' no tiene encabezado y filas de datos")
        else:
            header = parsed_rows[0]
            if len(header) != 3:
                fallas.append(
                    f"la tabla de '### Tests' no tiene 3 columnas (encabezado: {header})"
                )
            data_rows = parsed_rows[1:]
            if data_rows and is_separator_row(data_rows[0]):
                data_rows = data_rows[1:]

            if not data_rows:
                fallas.append("la tabla de '### Tests' no tiene ninguna fila de datos")

            has_automated_row = False
            for cells in data_rows:
                if len(cells) != 3:
                    fallas.append(f"fila de la tabla de Tests mal formada: {cells}")
                    continue
                capa_raw, archivo_raw, caso_raw = cells
                capa = capa_raw.strip().strip("`").strip().lower()
                archivo = archivo_raw.strip().strip("`").strip()
                caso = caso_raw.strip().strip("`").strip()

                if capa not in CAPAS_VALIDAS:
                    fallas.append(
                        f"capa inválida '{capa_raw}' en la tabla de Tests "
                        "(debe ser backend, frontend o manual)"
                    )
                    continue

                if capa == "manual":
                    if archivo != "—":
                        fallas.append(
                            f"fila manual con Archivo distinto de '—': '{archivo}'"
                        )
                    continue

                has_automated_row = True
                file_path = ROOT / archivo
                if not file_path.is_file():
                    fallas.append(f"{archivo}: no existe (caso '{caso}')")
                    continue

                content = file_path.read_text(encoding="utf-8", errors="replace")
                if capa == "backend":
                    pattern = re.compile(r"def\s+" + re.escape(caso) + r"\s*\(")
                else:
                    pattern = re.compile(r'(it|test)\(\s*["\'`]' + re.escape(caso))
                if not pattern.search(content):
                    fallas.append(f"{archivo}: no se encontró el caso '{caso}'")

            if not has_automated_row:
                fallas.append(
                    "la tabla de '### Tests' no tiene ninguna fila 'backend' o 'frontend' "
                    "(no alcanza con solo 'manual')"
                )

    if fallas:
        return (fallas, None)
    return ([], nivel)


def resolve_design_path(argv: list[str]) -> Path | int:
    change = None
    design = None
    args = argv[1:]
    i = 0
    while i < len(args):
        arg = args[i]
        if arg == "--change" and i + 1 < len(args):
            change = args[i + 1]
            i += 2
        elif arg == "--design" and i + 1 < len(args):
            design = args[i + 1]
            i += 2
        else:
            return usage_error(f"argumento desconocido o incompleto: '{arg}'")

    if change and design:
        return usage_error("pasá --change o --design, no los dos")
    if not change and not design:
        return usage_error("falta --change <nombre> o --design <ruta>")

    if change:
        change_dir = ROOT / "openspec" / "changes" / change
        if not change_dir.is_dir():
            return usage_error(f"change inexistente: '{change}' ({change_dir})")
        design_path = change_dir / "design.md"
    else:
        design_path = Path(design)
        if not design_path.is_absolute():
            design_path = Path.cwd() / design_path

    if not design_path.is_file():
        return usage_error(f"design.md inexistente: {design_path}")

    return design_path


def main() -> int:
    design_path = resolve_design_path(sys.argv)
    if isinstance(design_path, int):
        return design_path

    text = design_path.read_text(encoding="utf-8")
    fallas, nivel = check_design(text)

    if fallas:
        for falla in fallas:
            print(f"FALLA: {falla}")
        return 1

    print(f"riesgo={nivel}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
