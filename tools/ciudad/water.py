"""Agua: la ría (con sus dos brazos alrededor de la isla), la bahía de la
desembocadura y la franja de mar de la costa oeste."""
import math
from shapely.geometry import Polygon, LineString, Point
from shapely.ops import unary_union
from geo import RECT, H


def varbuf(points, w0, w1):
    """Polilínea con anchura que crece de w0 a w1 (m)."""
    parts = []
    n = len(points) - 1
    for i in range(n):
        a, b = points[i], points[i + 1]
        wa = w0 + (w1 - w0) * i / n
        wb = w0 + (w1 - w0) * (i + 1) / n
        seg = LineString([a, b])
        parts.append(seg.buffer((wa + wb) / 4, cap_style='round'))
    return unary_union(parts)


def coastline():
    """Línea de costa oeste: x(y) entre 40 y 260 m, con calas y un cabo."""
    pts = []
    for i in range(0, 101):
        y = H * i / 100
        x = 140 + 70 * math.sin(y / 420) + 45 * math.sin(y / 133 + 1.3)
        if 2350 < y < 2900:  # la bahía de la desembocadura se abre hacia el mar
            x += 0
        pts.append((x, y))
    return pts


def build_water(c):
    arms = c.island.buffer(120, quad_segs=24).difference(c.island)
    # El brazo norte (la ría principal) más ancho que el sur
    north_extra = c.island.buffer(175, quad_segs=24).difference(c.island)
    north_extra = north_extra.intersection(Polygon([(0, 0), (6000, 0), (6000, c.cy), (0, c.cy)]))
    arms = unary_union([arms, north_extra])
    riverE = varbuf(c.riverE, 190, 160)
    riverW = varbuf(c.riverW, 200, 330)
    coast = coastline()
    sea = Polygon([(-10, -10)] + coast + [(-10, H + 10)])
    # Bahía de la desembocadura (puerto): entrante de mar
    bay = Point(120, 2490).buffer(330).intersection(Polygon([(-10, 2200), (620, 2280), (620, 2800), (-10, 2840)]))
    water = unary_union([arms, riverE, riverW, sea, bay]).intersection(RECT)
    return {'water': water, 'sea': sea.intersection(RECT), 'coast': coast}
