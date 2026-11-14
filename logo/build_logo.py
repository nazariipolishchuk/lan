"""Build the Lan team logo as SVG and render each file to PNG with headless Chrome.

Layout is traced from Gemini variant 03.4, with ring ellipses least-squares fitted to its
pixels; grains are traced from logo/grain-reference.png, star from the same Gemini image. The L is kept whole on purpose. Usage: python build_logo.py [--no-blue-line]
"""
import math
import subprocess
import sys
import tempfile
from pathlib import Path

CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
OUT = Path(__file__).parent / "final-v3"

DARK_BG = "#030D0F"
GOLD, BLUE = "#E1BC64", "#9BC2D7"
GOLD_ON_LIGHT, BLUE_ON_LIGHT = "#C79A32", "#5E97BA"
INK = "#0A1418"

RING = dict(cx=363.6, cy=283.7, rx=272.9, ry=112.4, rot=-36.6, width=12)
ARC = dict(cx=389.5, cy=301.0, rx=286.4, ry=113.9, rot=142.1)
ARC_SPANS = [(10, 50), (180, 350)]  # visible parts of the blue line, degrees
ARC_WIDTH = 7
RING_GAP = 6  # thin dark gap on each side of the ring where it crosses the L
L_STEM_ZONE = (272, 340, 94, 225)  # the blue line passes behind the L here

L = "280,352 318,378 358,350 358,558 505,558 487,622 280,622"
A_OUTER = "640,302 730,302 868,622 790,622 768,558 612,558 590,622 513,622"
A_HOLE = "691,382 643,495 738,495"
N = "897,302 966,302 1122,492 1122,302 1195,302 1195,622 1128,622 970,432 970,622 897,622"
AXIS_X = 318.3
GRAIN_ROW_STEP = 87.1  # vertical distance between the two rows
# Upper-left grain, traced from the reference ear; the others are copies and mirrors of it.
GRAIN_UL = [
    (253.2, 143.7), (253.7, 145.2), (253.4, 146.6), (253.3, 148.0), (253.2, 149.4), (253.2, 150.8),
    (253.1, 152.3), (253.0, 153.7), (253.0, 155.1), (253.0, 156.5), (253.0, 157.9), (253.1, 159.4),
    (253.2, 160.8), (253.2, 162.2), (253.2, 163.6), (253.2, 165.0), (253.2, 166.5), (253.3, 167.9),
    (253.4, 169.3), (253.5, 170.7), (253.6, 172.1), (253.7, 173.6), (253.9, 175.0), (254.0, 176.4),
    (254.2, 177.8), (254.3, 179.2), (254.5, 180.7), (254.7, 182.1), (254.8, 183.5), (255.1, 184.9),
    (255.3, 186.3), (255.5, 187.8), (255.7, 189.2), (256.0, 190.6), (256.3, 192.0), (256.6, 193.4),
    (256.9, 194.9), (257.2, 196.3), (257.6, 197.7), (257.9, 199.1), (258.3, 200.5), (258.7, 202.0),
    (259.2, 203.4), (259.6, 204.8), (260.1, 206.2), (260.7, 207.6), (261.2, 209.1), (261.8, 210.5),
    (262.3, 211.9), (263.0, 213.3), (263.6, 214.7), (264.3, 216.2), (265.0, 217.6), (265.8, 219.0),
    (266.6, 220.4), (267.4, 221.8), (268.3, 223.3), (269.2, 224.7), (270.2, 226.1), (271.2, 227.5),
    (272.3, 228.9), (273.4, 230.4), (274.5, 231.8), (275.8, 233.2), (277.1, 234.6), (278.4, 236.0),
    (279.9, 237.5), (281.4, 238.9), (282.9, 240.3), (284.5, 241.7), (286.1, 243.2), (287.7, 244.6),
    (289.4, 246.0), (291.1, 247.4), (292.8, 248.8), (294.5, 250.3), (296.2, 251.7), (297.9, 253.1),
    (299.6, 254.5), (301.3, 255.9), (303.0, 257.4), (304.7, 258.8), (306.5, 260.2), (308.2, 261.6),
    (309.6, 263.0), (310.7, 264.5), (311.9, 264.9), (313.1, 267.3), (313.4, 264.9), (313.5, 264.5),
    (313.6, 263.0), (313.7, 261.6), (313.8, 260.2), (313.8, 258.8), (313.8, 257.4), (313.9, 255.9),
    (314.0, 254.5), (314.1, 253.1), (314.2, 251.7), (314.3, 250.3), (314.3, 248.8), (314.3, 247.4),
    (314.3, 246.0), (314.3, 244.6), (314.3, 243.2), (314.3, 241.7), (314.3, 240.3), (314.3, 238.9),
    (314.2, 237.5), (314.2, 236.0), (314.1, 234.6), (314.0, 233.2), (313.8, 231.8), (313.7, 230.4),
    (313.6, 228.9), (313.4, 227.5), (313.2, 226.1), (313.1, 224.7), (312.9, 223.3), (312.6, 221.8),
    (312.4, 220.4), (312.2, 219.0), (311.9, 217.6), (311.6, 216.2), (311.3, 214.7), (311.0, 213.3),
    (310.7, 211.9), (310.3, 210.5), (310.0, 209.1), (309.5, 207.6), (309.1, 206.2), (308.7, 204.8),
    (308.2, 203.4), (307.7, 202.0), (307.2, 200.5), (306.6, 199.1), (306.0, 197.7), (305.4, 196.3),
    (304.7, 194.9), (303.9, 193.4), (303.1, 192.0), (302.3, 190.6), (301.3, 189.2), (300.4, 187.8),
    (299.4, 186.3), (298.3, 184.9), (297.2, 183.5), (296.0, 182.1), (294.8, 180.7), (293.4, 179.2),
    (292.1, 177.8), (290.6, 176.4), (289.2, 175.0), (287.7, 173.6), (286.1, 172.1), (284.5, 170.7),
    (282.8, 169.3), (281.1, 167.9), (279.4, 166.5), (277.7, 165.0), (276.0, 163.6), (274.3, 162.2),
    (272.6, 160.8), (270.9, 159.4), (269.2, 157.9), (267.5, 156.5), (265.8, 155.1), (264.1, 153.7),
    (262.4, 152.3), (260.7, 150.8), (259.0, 149.4), (257.4, 148.0), (256.1, 146.6), (254.2, 145.2),
]


def grain(row, mirror):
    pts = [(2 * AXIS_X - x if mirror else x, y + row * GRAIN_ROW_STEP) for x, y in GRAIN_UL]
    return " ".join(f"{x:.1f},{y:.1f}" for x, y in pts)


GRAINS = [grain(row, mirror) for row in (0, 1) for mirror in (False, True)]
STAR = "318,39 335,86 386,103 335,120 318,176 301,120 250,103 301,86"
BEHIND_EAR = (238, 90, 160, 262)  # x, y, w, h: where the ring passes behind the ear


def poly_path(*polys):
    return " ".join("M" + p.replace(" ", " L") + " Z" for p in polys)


def arc_points(t0, t1, n=90):
    rad = math.radians(ARC["rot"])
    pts = []
    for i in range(n + 1):
        t = math.radians(t0 + (t1 - t0) * i / n)
        r = ARC["rx"] * ARC["ry"] / math.hypot(ARC["ry"] * math.cos(t), ARC["rx"] * math.sin(t))
        x, y = r * math.cos(t), r * math.sin(t)
        pts.append((ARC["cx"] + x * math.cos(rad) - y * math.sin(rad),
                    ARC["cy"] + x * math.sin(rad) + y * math.cos(rad)))
    return pts


def tapered(pts, width):
    """Crescent: full width in the middle of the arc, zero at both ends."""
    left, right = [], []
    last = len(pts) - 1
    for i, (x, y) in enumerate(pts):
        x0, y0 = pts[max(i - 1, 0)]
        x1, y1 = pts[min(i + 1, last)]
        dx, dy = x1 - x0, y1 - y0
        d = math.hypot(dx, dy) or 1
        w = width / 2 * min(1.0, 2.5 * math.sin(math.pi * i / last))
        left.append((x - dy / d * w, y + dx / d * w))
        right.append((x + dy / d * w, y - dx / d * w))
    both = left + right[::-1]
    return "M" + " L".join(f"{x:.1f},{y:.1f}" for x, y in both) + " Z"


def polyline(pts):
    return "M" + " L".join(f"{x:.1f},{y:.1f}" for x, y in pts)


def ring_svg(width, extra=""):
    r = RING
    return (f'<ellipse cx="{r["cx"]}" cy="{r["cy"]}" rx="{r["rx"]}" ry="{r["ry"]}" '
            f'transform="rotate({r["rot"]} {r["cx"]} {r["cy"]})" fill="none" '
            f'stroke-width="{width}" {extra}/>')


def svg(view, size, letters=None, bg=None, gold=GOLD, blue=BLUE, blue_line=True, ring_width=None):
    x, y, w, h = view
    big = f'x="{x}" y="{y}" width="{w}" height="{h}"'
    ring_width = ring_width or RING["width"]
    bx, by, bw, bh = BEHIND_EAR
    lx, ly, lw, lh = L_STEM_ZONE
    arcs = [arc_points(*s) for s in ARC_SPANS]
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x} {y} {w} {h}" '
        f'width="{size[0]}" height="{size[1]}">',
        "<title>Lan</title>",
        "<defs>",
        f'<mask id="ringCut" maskUnits="userSpaceOnUse" {big}>'
        f'<rect {big} fill="#fff"/><rect x="{bx}" y="{by}" width="{bw}" height="{bh}" fill="#000"/></mask>',
    ]
    parts.append(f'<mask id="arcCut" maskUnits="userSpaceOnUse" {big}>'
                 f'<rect {big} fill="#fff"/><rect x="{bx}" y="{by}" width="{bw}" height="{bh}" fill="#000"/>'
                 f'<rect x="{lx}" y="{ly}" width="{lw}" height="{lh}" fill="#000"/></mask>')
    if letters:
        halo = ring_svg(ring_width + 2 * RING_GAP, 'stroke="#000"')
        parts.append(f'<mask id="letterCut" maskUnits="userSpaceOnUse" {big}>'
                     f'<rect {big} fill="#fff"/>{halo}</mask>')
    parts.append("</defs>")
    if bg:
        parts.append(f'<rect {big} fill="{bg}"/>')
    if letters:
        parts.append(f'<path d="{poly_path(L)}" fill="{letters}" mask="url(#letterCut)"/>')
        parts.append(f'<path d="{poly_path(A_OUTER, A_HOLE)}" fill="{letters}" fill-rule="evenodd"/>')
        parts.append(f'<path d="{poly_path(N)}" fill="{letters}"/>')
    parts.append(f'<path d="{poly_path(*GRAINS)}" fill="{gold}"/>')
    parts.append(f'<path d="{poly_path(STAR)}" fill="{blue}"/>')
    parts.append('<g mask="url(#ringCut)">' + ring_svg(ring_width, f'stroke="{gold}"') + '</g>')
    parts.append('<g mask="url(#arcCut)">')
    if blue_line:
        for pts in arcs:
            parts.append(f'<path d="{tapered(pts, ARC_WIDTH)}" fill="{blue}"/>')
    parts.append("</g></svg>")
    return "\n".join(parts)


def render(svg_path, size):
    png = svg_path.with_suffix(".png")
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as profile:
        subprocess.run([
            CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
            f"--user-data-dir={profile}", "--default-background-color=00000000",
            f"--window-size={size[0]},{size[1]}", "--force-device-scale-factor=1",
            f"--screenshot={png}", svg_path.resolve().as_uri(),
        ], check=True, capture_output=True, timeout=120)
    return png


def main():
    line = "--no-blue-line" not in sys.argv
    OUT.mkdir(exist_ok=True)
    full, full_size = (43, -50, 1242, 762), (2484, 1524)
    icon, icon_size = (48, -60, 640, 640), (1024, 1024)
    files = {
        "lan-dark": svg(full, full_size, "#FFFFFF", DARK_BG, blue_line=line),
        "lan-white": svg(full, full_size, INK, "#FFFFFF", GOLD_ON_LIGHT, BLUE_ON_LIGHT, line),
        "lan-transparent-for-dark-bg": svg(full, full_size, "#FFFFFF", blue_line=line),
        "lan-transparent-for-light-bg": svg(full, full_size, INK, None, GOLD_ON_LIGHT, BLUE_ON_LIGHT, line),
        "lan-icon-dark": svg(icon, icon_size, bg=DARK_BG, blue_line=False, ring_width=16),
    }
    for name, text in files.items():
        path = OUT / f"{name}.svg"
        path.write_text(text, encoding="utf-8")
        size = icon_size if "icon" in name else full_size
        print("wrote", path, "and", render(path, size))


if __name__ == "__main__":
    main()
