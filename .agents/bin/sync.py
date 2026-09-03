#!/usr/bin/env python3
"""Sincroniza la estructura de agentes multi-proveedor desde .agents/.

`.agents/` es la unica fuente de verdad. Este script materializa lo que cada
proveedor necesita para verla:

  skills    .agents/skills/            -> symlink en .claude/skills
                                          (Codex ya lee .agents/skills nativo)
  comandos  .agents/commands/<ns>-<n>.md -> symlink en .claude/commands/<ns>/<n>.md
                                          y en .codex/prompts/<ns>-<n>.md
  roles     .agents/skills/role-<n>/   -> wrapper generado en .claude/agents/<n>.md
                                          y en .codex/agents/<n>.toml
                                          (formatos incompatibles: md+yaml vs toml)

Uso:
  python3 .agents/bin/sync.py            # aplica (idempotente)
  python3 .agents/bin/sync.py --check    # no escribe; exit 1 si hay drift (CI)
  python3 .agents/bin/sync.py --force    # respalda en .bak lo que estorbe y sigue
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REGISTRY = ROOT / ".agents" / "registry.json"
GEN_HEADER = "GENERADO por .agents/bin/sync.py desde .agents/registry.json - NO EDITAR A MANO"

check = "--check" in sys.argv
force = "--force" in sys.argv
changes: list[str] = []
drift: list[str] = []


def note(action: str, path: Path) -> None:
    rel = path.relative_to(ROOT)
    (drift if check else changes).append(f"{action:9} {rel}")


def ensure_symlink(link: Path, target: Path) -> None:
    """link -> target, con target relativo al directorio de link."""
    want = os.path.relpath(target, link.parent)
    if link.is_symlink():
        if os.readlink(link) == want:
            return
        note("relink", link)
        if not check:
            link.unlink()
            link.symlink_to(want)
        return
    if link.exists():
        if not force:
            print(
                f"ERROR: {link.relative_to(ROOT)} existe y no es symlink.\n"
                f"       Borralo o corre con --force (lo respalda en .bak).",
                file=sys.stderr,
            )
            sys.exit(2)
        note("backup", link)
        if not check:
            link.replace(link.with_suffix(link.suffix + ".bak"))
    note("link", link)
    if not check:
        link.parent.mkdir(parents=True, exist_ok=True)
        link.symlink_to(want)


def write_if_changed(path: Path, content: str) -> None:
    if path.exists() and path.read_text() == content:
        return
    note("write" if path.exists() else "create", path)
    if not check:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content)


def claude_agent(role: dict) -> str:
    cfg = role.get("claude", {})
    fm = [f"name: {role['name']}", f"description: {role['description']}"]
    if cfg.get("tools"):
        fm.append(f"tools: {cfg['tools']}")
    if cfg.get("model"):
        fm.append(f"model: {cfg['model']}")
    return (
        "---\n" + "\n".join(fm) + "\n---\n\n"
        f"<!-- {GEN_HEADER} -->\n\n"
        f"Adopta el rol definido en `.agents/skills/{role['skill']}/SKILL.md`.\n\n"
        "Lee ese archivo COMPLETO antes de actuar y respeta sus reglas y sus limites.\n"
        "Es la unica fuente de verdad del rol, compartida con los demas proveedores.\n"
    )


def codex_agent(role: dict) -> str:
    cfg = role.get("codex", {})
    lines = [
        f"# {GEN_HEADER}",
        "",
        f'name = "{role["name"].replace("-", "_")}"',
        f'description = "{role["description"]}"',
    ]
    for key in ("model", "model_reasoning_effort", "sandbox_mode"):
        if cfg.get(key):
            lines.append(f'{key} = "{cfg[key]}"')
    lines += [
        "developer_instructions = \"\"\"",
        f"Adopta el rol definido en .agents/skills/{role['skill']}/SKILL.md",
        "",
        "Lee ese archivo COMPLETO antes de actuar y respeta sus reglas y sus limites.",
        "Es la unica fuente de verdad del rol, compartida con los demas proveedores.",
        "\"\"\"",
        "",
    ]
    return "\n".join(lines)


def main() -> int:
    reg = json.loads(REGISTRY.read_text())

    # 1. Skills: un symlink por app hacia su .agents/skills
    for entry in reg["skillDirs"]:
        canonical = ROOT / entry["canonical"]
        if not canonical.is_dir():
            continue  # app sin skills propias todavia
        ensure_symlink(ROOT / entry["claudeLink"], canonical)

    # 2. Comandos: mismo cuerpo, dos nombres segun proveedor
    cmds = reg["commands"]
    cdir = ROOT / cmds["canonicalDir"]
    for md in sorted(cdir.glob("*.md")):
        ns, _, name = md.stem.partition("-")
        claude = ROOT / cmds["claudeDir"] / (f"{ns}/{name}.md" if name else f"{ns}.md")
        codex = ROOT / cmds["codexDir"] / md.name
        ensure_symlink(claude, md)
        ensure_symlink(codex, md)

    # 3. Roles: wrappers generados (los formatos no permiten symlink)
    for role in reg["roles"]:
        skill = ROOT / ".agents" / "skills" / role["skill"] / "SKILL.md"
        if not skill.exists():
            print(f"ERROR: falta {skill.relative_to(ROOT)}", file=sys.stderr)
            return 2
        write_if_changed(ROOT / ".claude" / "agents" / f"{role['name']}.md", claude_agent(role))
        write_if_changed(ROOT / ".codex" / "agents" / f"{role['name']}.toml", codex_agent(role))

    if check:
        if drift:
            print("Drift detectado (corre `make agents-sync`):")
            print("\n".join("  " + d for d in drift))
            return 1
        print("OK: .claude/ y .codex/ estan en sync con .agents/")
        return 0

    if changes:
        print("\n".join("  " + c for c in changes))
    print(f"Sync completo: {len(changes)} cambio(s).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
