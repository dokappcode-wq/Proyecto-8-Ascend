"""Geometría de la ciudad: rectángulo 6000 x 5000 m (30 km²), isla central
(la Ciudadela, 3 km²) y nueve barrios en anillo de 3 km² exactos cada uno.

Coordenadas en metros: x hacia el este, y hacia el sur (como el SVG).
La ría entra por el este, rodea la isla y desemboca por el oeste.
"""
import math
from shapely.geometry import Polygon, LineString, Point, box
from shapely.ops import unary_union
from shapely import affinity

W, H = 6000.0, 5000.0
RECT = box(0, 0, W, H)
TARGET = 3_000_000.0


def noise1(t, seeds):
    return sum(a * math.sin(f * t + p) for a, f, p in seeds)


def island_poly(cx, cy):
    pts = []
    n = 180
    for i in range(n):
        t = 2 * math.pi * i / n
        # Isla alargada este-oeste, con la punta oeste más afilada (proa)
        a = 1180 * (1 - 0.10 * max(0.0, math.cos(t + math.pi)) ** 3)
        b = 800
        r = 1 + noise1(t, [(0.035, 3, 0.4), (0.02, 5, 1.9), (0.012, 9, 0.7)])
        x = cx + a * math.cos(t) * r
        y = cy + b * math.sin(t) * r * (1 - 0.06 * math.cos(t))
        pts.append((x, y))
    p = Polygon(pts)
    p = affinity.rotate(p, -5, origin=(cx, cy))
    k = math.sqrt(TARGET / p.area)
    return affinity.scale(p, k, k, origin=(cx, cy))


def perim(s):
    """Punto del borde por parámetro s (sentido horario desde la esquina NO)."""
    s = s % 22000
    if s <= 6000:
        return (s, 0.0)
    if s <= 11000:
        return (W, s - 6000)
    if s <= 17000:
        return (17000 - s, H)
    return (0.0, 22000 - s)


def perim_path(s0, s1):
    """Puntos del borde de s0 a s1 en sentido horario (incluye esquinas)."""
    s0 %= 22000
    s1 %= 22000
    if s1 < s0:
        s1 += 22000
    pts = [perim(s0)]
    for c in (0, 6000, 11000, 17000, 22000, 28000, 33000, 39000):
        if s0 < c < s1:
            pts.append(perim(c))
    pts.append(perim(s1))
    return pts


class City:
    def __init__(self, dy=0.0):
        self.dy = dy
        self.cx, self.cy = 3000.0, 2230.0 + dy
        self.island = island_poly(self.cx, self.cy)
        b = self.island.bounds
        # Puntas de la isla (extremos oeste y este)
        self.tipW = min(self.island.exterior.coords, key=lambda p: p[0])
        self.tipE = max(self.island.exterior.coords, key=lambda p: p[0])
        d = dy
        # Línea central de la ría: tramo este (aguas arriba) y desembocadura (oeste)
        self.riverE = [self.tipE, (4520, 2190 + d), (4900, 2105 + d), (5300, 2160 + d), (5650, 2075 + d), (W, 2110 + d)]
        self.riverW = [self.tipW, (1520, 2330 + d), (1150, 2290 + d), (780, 2420 + d), (380, 2470 + d), (0, 2540 + d)]
        self.spokes = {}

    def ray_spoke(self, ang_deg, s, bends=()):
        """Frontera desde el centro de la isla hacia el borde (s). `bends`:
        codos [(fracción del tramo, desvío lateral en m)] para que siga avenidas."""
        a = math.radians(ang_deg)
        far = (self.cx + math.cos(a) * 4000, self.cy - math.sin(a) * 4000)
        ray = LineString([(self.cx, self.cy), far])
        hit = ray.intersection(self.island.exterior)
        if hit.geom_type == 'MultiPoint':
            hit = min(hit.geoms, key=lambda p: p.distance(Point(self.cx, self.cy)))
        q0 = (hit.x, hit.y)
        P = perim(s)
        L = math.hypot(P[0] - q0[0], P[1] - q0[1]) or 1
        nx, ny = -(P[1] - q0[1]) / L, (P[0] - q0[0]) / L
        pts = [(self.cx, self.cy), q0]
        for frac, off in bends:
            pts.append((q0[0] + (P[0] - q0[0]) * frac + nx * off, q0[1] + (P[1] - q0[1]) * frac + ny * off))
        pts.append(P)
        return pts

    def sector(self, spokeL, sL, spokeR, sR):
        ring = [spokeL[0]] + spokeL[1:] + perim_path(sL, sR)[1:-1] + list(reversed(spokeR[1:]))
        wedge = Polygon(ring)
        if not wedge.is_valid:
            wedge = wedge.buffer(0)
        return wedge.intersection(RECT).difference(self.island)

    def river_spoke(self, which):
        line = self.riverE if which == 'E' else self.riverW
        return [(self.cx, self.cy)] + line

    def north_area(self):
        """Área al norte de la ría (sin la isla)."""
        sW = 22000 - self.riverW[-1][1]
        sE = 6000 + self.riverE[-1][1]
        return self.sector(self.river_spoke('W'), sW, self.river_spoke('E'), sE).area


def bisect(f, lo, hi, it=60):
    flo = f(lo)
    for _ in range(it):
        mid = (lo + hi) / 2
        fm = f(mid)
        if (fm > 0) == (flo > 0):
            lo, flo = mid, fm
        else:
            hi = mid
    return (lo + hi) / 2


# Fronteras del anillo (sentido horario). Cada una: barrios a izquierda|derecha,
# ángulo de salida desde la isla y codos. Las dos fronteras de la ría son fijas.
NORTH = ['B3', 'B2', 'B1', 'B9']           # de la desembocadura a la ría este
NORTH_SPOKES = [                            # entre B3|B2, B2|B1, B1|B9
    (152, ((0.35, 90), (0.7, -60))),
    (96, ((0.3, -70), (0.65, 80))),
    (40, ((0.4, 110), (0.75, 40))),
]
SOUTH = ['B8', 'B7', 'B6', 'B5', 'B4']      # de la ría este a la desembocadura
SOUTH_SPOKES = [                            # entre B8|B7, B7|B6, B6|B5, B5|B4
    (-36, ((0.4, 120), (0.75, -50))),
    (-80, ((0.35, -90), (0.7, 60))),
    (-122, ((0.4, 100), (0.72, -40))),
    (-140, ((0.5, -120),)),
]


def build():
    # 1) Desplaza la ría y la isla en vertical hasta que el norte tenga 4 barrios justos (12 km²)
    dy = bisect(lambda d: City(d).north_area() - 4 * TARGET, -500, 500)
    c = City(dy)
    out = {}
    sW = 22000 - c.riverW[-1][1]
    sE = 6000 + c.riverE[-1][1]

    def chain_fwd(ids, spokes, startSpoke, s0, endSpoke, s1):
        """Resuelve de izquierda a derecha; el último barrio es el resto."""
        spokeL, sL = startSpoke, s0
        for i, bid in enumerate(ids):
            if i == len(ids) - 1:
                out[bid] = c.sector(spokeL, sL, endSpoke, s1)
                c.spokes[bid] = (spokeL, endSpoke)
                return
            ang, bends = spokes[i]
            f = lambda s: c.sector(spokeL, sL, c.ray_spoke(ang, s, bends), s).area - TARGET
            s = bisect(f, sL + 50, sL + 9000)
            sp = c.ray_spoke(ang, s, bends)
            out[bid] = c.sector(spokeL, sL, sp, s)
            c.spokes[bid] = (spokeL, sp)
            spokeL, sL = sp, s

    def chain_rev(ids, spokes, startSpoke, s0, endSpoke, s1):
        """Resuelve de derecha a izquierda; el primer barrio es el resto."""
        spokeR, sR = endSpoke, s1
        for i in range(len(ids) - 1, -1, -1):
            bid = ids[i]
            if i == 0:
                out[bid] = c.sector(startSpoke, s0, spokeR, sR)
                c.spokes[bid] = (startSpoke, spokeR)
                return
            ang, bends = spokes[i - 1]
            f = lambda s: TARGET - c.sector(c.ray_spoke(ang, s, bends), s, spokeR, sR).area
            s = bisect(f, sR - 9000, sR - 50)
            sp = c.ray_spoke(ang, s, bends)
            out[bid] = c.sector(sp, s, spokeR, sR)
            c.spokes[bid] = (sp, spokeR)
            spokeR, sR = sp, s

    chain_fwd(NORTH, NORTH_SPOKES, c.river_spoke('W'), sW, c.river_spoke('E'), sE)
    chain_rev(SOUTH, SOUTH_SPOKES, c.river_spoke('E'), sE, c.river_spoke('W'), sW + 22000)
    out['B10'] = c.island
    return c, out


if __name__ == '__main__':
    c, polys = build()
    print('dy', round(c.dy, 1))
    tot = 0
    for k in sorted(polys, key=lambda k: int(k[1:])):
        p = polys[k]
        tot += p.area
        b = p.bounds
        print(k, p.geom_type, round(p.area / 1e6, 4), 'km2', 'bbox', [round(v) for v in b], 'valid', p.is_valid)
    print('total', round(tot / 1e6, 4))
    u = unary_union(list(polys.values()))
    print('union area', round(u.area / 1e6, 4))
