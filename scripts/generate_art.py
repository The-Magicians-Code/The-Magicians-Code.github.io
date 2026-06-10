#!/usr/bin/env python3
"""Procedurally generate the SVG artwork used across the portfolio site.

Every asset in assets/img/ is deterministic (seeded), so re-running this
script reproduces the exact same files. No dependencies beyond the stdlib.

Usage:
    python3 scripts/generate_art.py
"""

from __future__ import annotations

import math
import random
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "assets" / "img"

W, H = 1200, 900

INK = "#0B0B10"
BONE = "#ECE9E2"
VIOLET = "#8B7CFF"
TEAL = "#5FD4C4"
GOLD = "#E0B458"
ROSE = "#E58FB4"


def svg(body: str, w: int = W, h: int = H, defs: str = "") -> str:
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" '
        f'width="{w}" height="{h}" fill="none">\n'
        f"<defs>{defs}</defs>\n{body}\n</svg>\n"
    )


def write(name: str, content: str) -> None:
    path = OUT / name
    path.write_text(content)
    print(f"  {path.relative_to(OUT.parent.parent)}  ({len(content) / 1024:.1f} kB)")


# ---------------------------------------------------------------- noise ----

def make_noise(seed: int):
    """Smooth 2D value noise built from a seeded gradient hash."""
    rng = random.Random(seed)
    gx = [[rng.uniform(0, math.tau) for _ in range(64)] for _ in range(64)]

    def lerp(a: float, b: float, t: float) -> float:
        t = t * t * (3 - 2 * t)
        return a + (b - a) * t

    def at(x: float, y: float) -> float:
        xi, yi = int(x) % 63, int(y) % 63
        xf, yf = x - int(x), y - int(y)
        a = gx[yi][xi]
        b = gx[yi][xi + 1]
        c = gx[yi + 1][xi]
        d = gx[yi + 1][xi + 1]
        return lerp(lerp(a, b, xf), lerp(c, d, xf), yf)

    return at


# ----------------------------------------------------- 01 · flow field ----

def art_flow() -> str:
    """'Deep Current' — flow-field filaments drifting across the frame."""
    noise = make_noise(11)
    rng = random.Random(7)
    paths = []
    n_lines = 240
    for i in range(n_lines):
        x = rng.uniform(-60, W + 60)
        y = rng.uniform(-60, H + 60)
        pts = [(x, y)]
        for _ in range(rng.randint(30, 60)):
            a = noise(x * 0.004, y * 0.004) * 1.55
            x += math.cos(a) * 16
            y += math.sin(a) * 16
            pts.append((x, y))
        d = "M" + " L".join(f"{px:.1f} {py:.1f}" for px, py in pts)
        t = i / n_lines
        if t < 0.58:
            color, op = BONE, rng.uniform(0.07, 0.20)
        elif t < 0.84:
            color, op = TEAL, rng.uniform(0.25, 0.55)
        else:
            color, op = VIOLET, rng.uniform(0.40, 0.75)
        wdt = rng.uniform(0.7, 2.1)
        paths.append(
            f'<path d="{d}" stroke="{color}" stroke-opacity="{op:.2f}" '
            f'stroke-width="{wdt:.1f}" stroke-linecap="round"/>'
        )
    defs = (
        f'<radialGradient id="g" cx="30%" cy="25%" r="90%">'
        f'<stop offset="0%" stop-color="#16161F"/>'
        f'<stop offset="100%" stop-color="{INK}"/></radialGradient>'
    )
    body = f'<rect width="{W}" height="{H}" fill="url(#g)"/>' + "".join(paths)
    return svg(body, defs=defs)


# -------------------------------------------------------- 02 · orbits ----

def art_orbits() -> str:
    """'Aurora Index' — instrument-like dashed orbits around a core."""
    rng = random.Random(23)
    cx, cy = W * 0.52, H * 0.5
    rings = []
    for i in range(26):
        r = 52 + i * 26 + rng.uniform(-6, 6)
        rot = rng.uniform(0, 360)
        dash = rng.choice(["none", f"{rng.randint(2, 70)} {rng.randint(8, 90)}"])
        color = rng.choices([BONE, GOLD, VIOLET, TEAL], weights=[5, 2, 2, 1])[0]
        op = rng.uniform(0.10, 0.55) if color == BONE else rng.uniform(0.35, 0.85)
        sw = rng.uniform(0.6, 1.6)
        squash = rng.uniform(0.88, 1.0)
        ring = (
            f'<ellipse cx="{cx}" cy="{cy}" rx="{r:.0f}" ry="{r * squash:.0f}" '
            f'stroke="{color}" stroke-opacity="{op:.2f}" stroke-width="{sw:.1f}"'
        )
        if dash != "none":
            ring += f' stroke-dasharray="{dash}"'
        ring += f' transform="rotate({rot:.0f} {cx} {cy})"/>'
        rings.append(ring)
    sats = []
    for _ in range(34):
        a = rng.uniform(0, math.tau)
        r = rng.uniform(60, 640)
        x, y = cx + math.cos(a) * r, cy + math.sin(a) * r * 0.94
        rad = rng.uniform(1.2, 4.2)
        color = rng.choice([BONE, GOLD, TEAL])
        sats.append(
            f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{rad:.1f}" fill="{color}" '
            f'fill-opacity="{rng.uniform(0.5, 1):.2f}"/>'
        )
    defs = (
        f'<radialGradient id="core" cx="50%" cy="50%" r="50%">'
        f'<stop offset="0%" stop-color="{GOLD}" stop-opacity=".9"/>'
        f'<stop offset="100%" stop-color="{GOLD}" stop-opacity="0"/></radialGradient>'
        f'<radialGradient id="bg" cx="52%" cy="50%" r="85%">'
        f'<stop offset="0%" stop-color="#15131D"/>'
        f'<stop offset="100%" stop-color="{INK}"/></radialGradient>'
    )
    body = (
        f'<rect width="{W}" height="{H}" fill="url(#bg)"/>'
        f'<circle cx="{cx}" cy="{cy}" r="90" fill="url(#core)"/>'
        f'<circle cx="{cx}" cy="{cy}" r="10" fill="{GOLD}"/>'
        + "".join(rings)
        + "".join(sats)
    )
    return svg(body, defs=defs)


# ---------------------------------------------------- 03 · warped grid ----

def art_grid() -> str:
    """'Signal & Noise' — a measurement grid bent by an unseen field."""
    noise = make_noise(41)
    lines = []

    def warp(x: float, y: float) -> tuple[float, float]:
        dx = math.sin(noise(x * 0.003, y * 0.003)) * 46
        dy = math.cos(noise(x * 0.0026 + 9, y * 0.0026)) * 46
        return x + dx, y + dy

    for row in range(0, 37):
        y0 = row * (H / 36)
        pts = [warp(x, y0) for x in range(-40, W + 41, 24)]
        d = "M" + " L".join(f"{px:.1f} {py:.1f}" for px, py in pts)
        hot = 14 <= row <= 22
        color = TEAL if hot else BONE
        op = 0.5 if hot else 0.12
        lines.append(
            f'<path d="{d}" stroke="{color}" stroke-opacity="{op}" stroke-width="1"/>'
        )
    for col in range(0, 49):
        x0 = col * (W / 48)
        pts = [warp(x0, y) for y in range(-40, H + 41, 24)]
        d = "M" + " L".join(f"{px:.1f} {py:.1f}" for px, py in pts)
        hot = 30 <= col <= 36
        color = ROSE if hot else BONE
        op = 0.45 if hot else 0.10
        lines.append(
            f'<path d="{d}" stroke="{color}" stroke-opacity="{op}" stroke-width="1"/>'
        )
    defs = (
        f'<radialGradient id="bg" cx="60%" cy="40%" r="90%">'
        f'<stop offset="0%" stop-color="#101019"/>'
        f'<stop offset="100%" stop-color="{INK}"/></radialGradient>'
    )
    body = f'<rect width="{W}" height="{H}" fill="url(#bg)"/>' + "".join(lines)
    return svg(body, defs=defs)


# -------------------------------------------------- 04 · constellation ----

def art_constellation() -> str:
    """'Counterspell' — a constellation graph; nodes linked by proximity."""
    rng = random.Random(83)
    pts = []
    for _ in range(120):
        # bias points into loose clusters
        cx = rng.choice([W * 0.25, W * 0.55, W * 0.78])
        cy = rng.choice([H * 0.3, H * 0.62])
        pts.append((rng.gauss(cx, 150), rng.gauss(cy, 130)))
    edges, nodes = [], []
    for i, (x1, y1) in enumerate(pts):
        for x2, y2 in pts[i + 1:]:
            d2 = (x1 - x2) ** 2 + (y1 - y2) ** 2
            if d2 < 110**2:
                op = max(0.04, 0.4 - d2 / 110**2 * 0.36)
                edges.append(
                    f'<line x1="{x1:.0f}" y1="{y1:.0f}" x2="{x2:.0f}" y2="{y2:.0f}" '
                    f'stroke="{BONE}" stroke-opacity="{op:.2f}" stroke-width="0.8"/>'
                )
    for i, (x, y) in enumerate(pts):
        if not (-20 < x < W + 20 and -20 < y < H + 20):
            continue
        major = i % 17 == 0
        r = 5.0 if major else rng.uniform(1.2, 2.6)
        color = VIOLET if major else BONE
        nodes.append(
            f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{r:.1f}" fill="{color}" '
            f'fill-opacity="{1 if major else rng.uniform(0.4, 0.9):.2f}"/>'
        )
        if major:
            nodes.append(
                f'<circle cx="{x:.0f}" cy="{y:.0f}" r="14" stroke="{VIOLET}" '
                f'stroke-opacity="0.5" stroke-width="1"/>'
            )
    defs = (
        f'<radialGradient id="bg" cx="40%" cy="60%" r="95%">'
        f'<stop offset="0%" stop-color="#12121B"/>'
        f'<stop offset="100%" stop-color="{INK}"/></radialGradient>'
    )
    body = f'<rect width="{W}" height="{H}" fill="url(#bg)"/>' + "".join(edges) + "".join(nodes)
    return svg(body, defs=defs)


# ------------------------------------------------------- contour field ----

def art_contours() -> str:
    """Topographic contours used as a parallax background layer."""
    rng = random.Random(5)
    w, h = 1600, 1600
    cx, cy = w / 2, h / 2
    rings = []
    base_wobble = [(rng.uniform(0.5, 1.0), rng.uniform(0, math.tau)) for _ in range(5)]
    for i in range(34):
        r0 = 60 + i * 24
        pts = []
        for step in range(141):
            a = step / 140 * math.tau
            wob = sum(
                amp * math.sin(a * (k + 2) + ph + i * 0.22) * 9
                for k, (amp, ph) in enumerate(base_wobble)
            )
            r = r0 + wob
            pts.append((cx + math.cos(a) * r, cy + math.sin(a) * r))
        d = "M" + " L".join(f"{px:.0f} {py:.0f}" for px, py in pts) + " Z"
        op = 0.05 + 0.05 * math.sin(i * 0.5) ** 2
        rings.append(
            f'<path d="{d}" stroke="{BONE}" stroke-opacity="{op:.3f}" stroke-width="1"/>'
        )
    return svg("".join(rings), w=w, h=h)


# --------------------------------------------------------- studio mark ----

def art_mark() -> str:
    """The studio sigil: an asterisk-star drawn with overlapping strokes."""
    s = 240
    c = s / 2
    rays = []
    for i in range(6):
        a = i * math.tau / 6 + math.tau / 12
        x1, y1 = c + math.cos(a) * 26, c + math.sin(a) * 26
        x2, y2 = c + math.cos(a) * 96, c + math.sin(a) * 96
        rays.append(
            f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" '
            f'stroke="{BONE}" stroke-width="10" stroke-linecap="round"/>'
        )
    body = (
        "".join(rays)
        + f'<circle cx="{c}" cy="{c}" r="13" fill="{GOLD}"/>'
    )
    out = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {s} {s}" '
        f'width="{s}" height="{s}" fill="none">{body}</svg>\n'
    )
    return out


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    print("Generating artwork:")
    write("art-flow.svg", art_flow())
    write("art-orbits.svg", art_orbits())
    write("art-grid.svg", art_grid())
    write("art-constellation.svg", art_constellation())
    write("contours.svg", art_contours())
    write("mark.svg", art_mark())


if __name__ == "__main__":
    main()
