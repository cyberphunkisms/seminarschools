"""Content-derived cache token shared by Python page generators."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

GEOMETRY_ASSETS = (
    "data/geometry-route-contracts.json",
    "css/alive.css",
    "js/mandala.js",
    "js/indra.js",
)


def geometry_exemption_for_path(contracts: dict, relative_html_path: str) -> str | None:
    coverage = contracts.get("coverage", {})
    star_routes = coverage.get("star_page_routes")
    control_prefixes = coverage.get("control_page_prefixes")
    if (
        not isinstance(star_routes, list)
        or len(star_routes) != int(coverage.get("expected_current_star_pages", -1))
        or len(set(star_routes)) != len(star_routes)
    ):
        raise ValueError("geometry contract must declare the exact canonical star_page_routes")
    if not isinstance(control_prefixes, list) or not control_prefixes:
        raise ValueError("geometry contract must declare source-only control_page_prefixes")
    relative = str(relative_html_path).replace("\\", "/").lstrip("/")
    if relative in star_routes:
        return str(coverage.get("star_page_exemption_value") or "star-file")
    if any(relative.startswith(str(prefix)) for prefix in control_prefixes):
        return str(coverage.get("control_page_exemption_value") or "internal-control")
    return None


def is_star_page(contracts: dict, relative_html_path: str) -> bool:
    return geometry_exemption_for_path(contracts, relative_html_path) == contracts.get(
        "coverage", {}
    ).get("star_page_exemption_value")


def is_geometry_exempt(contracts: dict, relative_html_path: str) -> bool:
    return geometry_exemption_for_path(contracts, relative_html_path) is not None


def opacity_bounds(contracts: dict) -> tuple[float, float]:
    bounds = contracts.get("presentation", {}).get("opacity_bounds", {})
    minimum = float(bounds.get("minimum", -1))
    maximum = float(bounds.get("maximum", -1))
    if minimum < 0 or maximum > 1 or minimum > maximum:
        raise ValueError("geometry contract must declare valid presentation.opacity_bounds")
    return minimum, maximum


def valid_opacity(contracts: dict, value: object) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    minimum, maximum = opacity_bounds(contracts)
    return number if minimum <= number <= maximum else None


def owner_opacity_for_key(contracts: dict, key: str, route_type: str) -> float | None:
    overrides = contracts.get("presentation", {}).get("owner_fade_overrides")
    if not isinstance(overrides, list):
        raise ValueError("geometry contract must declare presentation.owner_fade_overrides")
    for override in overrides:
        selectors = [
            name
            for name in ("exact_path", "path_prefix", "route_type")
            if isinstance(override.get(name), str)
        ]
        if len(selectors) != 1:
            raise ValueError("each geometry owner fade override must have exactly one selector")
        matches = (
            override.get("exact_path") == key
            or (
                isinstance(override.get("path_prefix"), str)
                and key.startswith(override["path_prefix"])
            )
            or override.get("route_type") == route_type
        )
        if matches:
            opacity = valid_opacity(contracts, override.get("opacity"))
            if opacity is None:
                raise ValueError(
                    f"invalid geometry owner opacity for {override.get('owner', selectors[0])}"
                )
            return opacity
    return None


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
    profile: str = "dual-field",
    intensity: float | None = None,
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
    exemption = geometry_exemption_for_path(contracts, relative_html_path)
    if exemption:
        raise ValueError(
            f"{relative_html_path}: {exemption} pages must not receive public rainbow geometry"
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
    register_intensity = valid_opacity(contracts, register_contract.get("default_intensity"))
    if register_intensity is None:
        raise ValueError(f"invalid geometry register intensity: {register}")
    owner_intensity = owner_opacity_for_key(contracts, key, route_type)
    page_intensity = valid_opacity(contracts, intensity)
    resolved_intensity = (
        owner_intensity
        if owner_intensity is not None
        else page_intensity if page_intensity is not None else register_intensity
    )
    fade_source = (
        "page"
        if owner_intensity is not None or page_intensity is not None
        else "route-register"
    )
    return (
        f'data-route-type="{route_type}"'
        ' data-geometry="indra-web"'
        f' data-indra-intensity="{resolved_intensity:.3f}"'
        f' data-indra-fade-source="{fade_source}"'
        f' data-geometry-role="{" ".join(roles)}"'
        f' data-geometry-key="{key}"'
        f' data-geometry-seed="{seed}"'
        f' data-geometry-register="{register}"'
        f' data-geometry-profile="{profile}"'
        ' data-front-facing="general-audience"'
    )
