"""Content-derived cache token shared by Python page generators."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

GEOMETRY_ASSETS = ("css/alive.css", "js/mandala.js", "js/indra.js")


def geometry_asset_version(root: Path) -> str:
    root = Path(root)
    contracts = json.loads(
        (root / "data" / "geometry-route-contracts.json").read_text(encoding="utf-8")
    )
    if contracts.get("asset_version_scheme") != "sha256-12":
        raise ValueError("geometry asset_version_scheme must be sha256-12")
    digest = hashlib.sha256()
    for relative in GEOMETRY_ASSETS:
        digest.update(relative.encode("utf-8"))
        digest.update(b"\0")
        digest.update((root / relative).read_bytes())
        digest.update(b"\0")
    return f"sha256-{digest.hexdigest()[:12]}"


def geometry_body_attributes(
    root: Path,
    relative_html_path: str,
    route_type: str,
    *,
    register: str,
    profile: str = "single",
) -> str:
    """Return the finalizer-compatible body contract for a generated page.

    Generators that hash one generated HTML page as the translation source for
    another must emit the final geometry attributes before taking that hash.
    The catch-all finalizer still owns every page and verifies these bytes.
    """
    root = Path(root)
    contracts = json.loads(
        (root / "data" / "geometry-route-contracts.json").read_text(encoding="utf-8")
    )
    roles = contracts.get("route_types", {}).get(route_type)
    register_contract = contracts.get("registers", {}).get(register)
    profile_contract = contracts.get("profiles", {}).get(profile)
    if not isinstance(roles, list) or not roles:
        raise ValueError(f"unknown or empty geometry route type: {route_type}")
    if not isinstance(register_contract, dict):
        raise ValueError(f"unknown geometry register: {register}")
    if not isinstance(profile_contract, dict):
        raise ValueError(f"unknown geometry profile: {profile}")

    relative = str(relative_html_path).replace("\\", "/").lstrip("/")
    if relative == "index.html":
        key = "/"
    elif relative.endswith("/index.html"):
        key = f"/{relative[:-len('index.html')]}"
    else:
        key = f"/{relative}"
    seed = hashlib.sha256(key.encode("utf-8")).hexdigest()[:16]
    intensity = float(register_contract["default_intensity"])
    return (
        f'data-route-type="{route_type}"'
        ' data-geometry="indra-web"'
        f' data-indra-intensity="{intensity:.3f}"'
        f' data-geometry-role="{" ".join(roles)}"'
        f' data-geometry-key="{key}"'
        f' data-geometry-seed="{seed}"'
        f' data-geometry-register="{register}"'
        f' data-geometry-profile="{profile}"'
        ' data-front-facing="general-audience"'
    )
