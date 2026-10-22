"""Herramientas de trama urbana: redes de calles por jerarquía, manzanas,
parcelación en solares (división recursiva por el eje largo) y edificios."""
import math
import random
from shapely.geometry import Polygon, LineString, Point, MultiLineString, box, MultiPoint
from shapely.ops import unary_union, voronoi_diagram, linemerge
from shapely import affinity

ROAD_W = {'hwy': 34, 'ave': 26, 'st': 16, 'alley': 7, 'path': 4}


def polys(g):
    if g is None or g.is_empty:
        return []
    if g.geom_type == 'Polygon':
        return [g]
    return [p for x in getattr(g, 'geoms', []) for p in polys(x)]


def lines(g):
    if g is None or g.is_empty:
        return []
    if g.geom_type == 'LineString':
        return [g]
    if g.geom_type == 'LinearRing':
        return [LineString(g.coords)]
    return [l for x in getattr(g, 'geoms', []) for l in lines(x)]


def rot(p, ang, o):
    return affinity.rotate(p, ang, origin=o)


def grid_lines(region, origin, ang, sa, sb, offa=0.0, offb=0.0):
    """Rectas paralelas en dos direcciones (girada `ang`): `sa` es la
    separación entre las rectas 'verticales' (avenidas), `sb` entre las
    'horizontales' (calles). Devuelve (verticales, horizontales) recortadas."""
    minx, miny, maxx, maxy = rot(region, -ang, origin).bounds
    V, Hh = [], []
    x = origin[0] + offa + math.floor((minx - origin[0] - offa) / sa) * sa
    while x <= maxx + sa:
        l = rot(LineString([(x, miny - 50), (x, maxy + 50)]), ang, origin)
        V += lines(l.intersection(region))
        x += sa
    y = origin[1] + offb + math.floor((miny - origin[1] - offb) / sb) * sb
    while y <= maxy + sb:
        l = rot(LineString([(minx - 50, y), (maxx + 50, y)]), ang, origin)
        Hh += lines(l.intersection(region))
        y += sb
    return V, Hh


def voronoi_streets(region, cell, seed=1, jitter=0.4):
    """Calles irregulares (casco antiguo): aristas de un diagrama de Voronoi."""
    rnd = random.Random(seed)
    minx, miny, maxx, maxy = region.bounds
    pts = []
    y = miny - cell
    r = 0
    while y < maxy + cell:
        x = minx - cell + (cell / 2 if r % 2 else 0)
        while x < maxx + cell:
            pts.append((x + rnd.uniform(-jitter, jitter) * cell, y + rnd.uniform(-jitter, jitter) * cell))
            x += cell
        y += cell * 0.86
        r += 1
    vd = voronoi_diagram(MultiPoint(pts), envelope=region.envelope.buffer(cell * 2), edges=True)
    return lines(vd.intersection(region))


def contour_lines(region, hfun, levels, step=25.0):
    """Curvas de nivel de una función de altura (para carreteras de colina)."""
    minx, miny, maxx, maxy = region.bounds
    out = {}
    nx = int((maxx - minx) / step) + 2
    ny = int((maxy - miny) / step) + 2
    for L in levels:
        cells = []
        for j in range(ny):
            for i in range(nx):
                x, y = minx + i * step, miny + j * step
                if hfun(x + step / 2, y + step / 2) > L:
                    cells.append(box(x, y, x + step, y + step))
        if not cells:
            continue
        a = unary_union(cells).buffer(step * 0.6).buffer(-step * 0.6)
        a = a.simplify(step * 0.35)
        ls = []
        for p in polys(a):
            ls += lines(p.exterior.intersection(region))
        out[L] = [l.simplify(4) for l in ls if l.length > 120]
    return out


def chaikin(line, it=2):
    pts = list(line.coords)
    for _ in range(it):
        new = [pts[0]]
        for a, b in zip(pts[:-1], pts[1:]):
            new.append((0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]))
            new.append((0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]))
        new.append(pts[-1])
        pts = new
    return LineString(pts)


def road_area(roads):
    """roads: [(LineString, clase)] → polígono ocupado por la calzada."""
    parts = [l.buffer(ROAD_W[c] / 2, cap_style='flat', join_style='round') for l, c in roads if not l.is_empty]
    return unary_union(parts) if parts else Polygon()


def split_lot(p, target, rnd, depth=0, min_w=8):
    """División recursiva por la mitad del eje largo del rectángulo mínimo."""
    if p.area <= target or depth > 12:
        return [p]
    mrr = p.minimum_rotated_rectangle
    c = list(mrr.exterior.coords)
    e1 = (c[1][0] - c[0][0], c[1][1] - c[0][1])
    e2 = (c[2][0] - c[1][0], c[2][1] - c[1][1])
    L1, L2 = math.hypot(*e1), math.hypot(*e2)
    if L1 < L2:
        e1, e2, L1, L2 = e2, e1, L2, L1
    if L1 < min_w * 2:
        return [p]
    t = rnd.uniform(0.38, 0.62)
    cx, cy = mrr.centroid.x, mrr.centroid.y
    ux, uy = e1[0] / L1, e1[1] / L1
    mx, my = cx + ux * (t - 0.5) * L1, cy + uy * (t - 0.5) * L1
    vx, vy = -uy, ux
    big = L1 + L2 + 100
    half = Polygon([(mx + vx * big, my + vy * big), (mx - vx * big, my - vy * big),
                    (mx - vx * big - ux * big, my - vy * big - uy * big), (mx + vx * big - ux * big, my + vy * big - uy * big)])
    a = p.intersection(half)
    b = p.difference(half)
    out = []
    for q in polys(a) + polys(b):
        if q.area > 30:
            out += split_lot(q, target, rnd, depth + 1, min_w)
    return out


def blocks_from(land, roads, extra_holes=None, min_area=400):
    holes = road_area(roads)
    if extra_holes:
        holes = unary_union([holes] + list(extra_holes))
    return [b for b in polys(land.difference(holes)) if b.area > min_area]


def buildings(blocks, kind, seed=1, lot=900, setback=2.5, cover=1.0, hfun=None):
    """Edificios por solar. `hfun(lot, rnd)` da la altura."""
    rnd = random.Random(seed)
    out = []
    for b in blocks:
        b = b.buffer(-1.5, join_style='mitre')
        for q in polys(b):
            for l in split_lot(q, lot * rnd.uniform(0.7, 1.4), rnd):
                f = l.buffer(-setback, join_style='mitre') if setback else l
                if cover < 1.0:
                    f = affinity.scale(f, math.sqrt(cover), math.sqrt(cover))
                for fp in polys(f):
                    if fp.area < 40:
                        continue
                    h = hfun(fp, rnd) if hfun else 12
                    out.append((fp.simplify(0.6), h, kind))
    return out


def rect(cx, cy, w, h, ang=0.0):
    return affinity.rotate(box(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2), ang, origin=(cx, cy))


def ellipse(cx, cy, rx, ry, ang=0.0, n=40):
    e = affinity.scale(Point(cx, cy).buffer(1, quad_segs=n // 4), rx, ry)
    return affinity.rotate(e, ang, origin=(cx, cy))


def organic_grid(region, origin, ang, sa, sb, seed=1, amp=(10, 26), drop=0.18):
    """Cuadrícula irregular de casco antiguo: calles que ondulan, cambian de
    ancho de manzana y a veces se interrumpen (cruces en T)."""
    rnd = random.Random(seed)
    V, Hh = grid_lines(region.buffer(200), origin, ang, sa, sb)
    out = []
    for fam, ls in (('v', V), ('h', Hh)):
        for l in ls:
            if l.length < 40:
                continue
            A = rnd.uniform(*amp)
            lam = rnd.uniform(140, 320)
            ph = rnd.uniform(0, 6.28)
            n = max(2, int(l.length / 25))
            pts = []
            (x0, y0), (x1, y1) = l.coords[0], l.coords[-1]
            dx, dy = (x1 - x0) / l.length, (y1 - y0) / l.length
            for i in range(n + 1):
                t = i / n
                s_ = t * l.length
                off = A * math.sin(s_ / lam + ph) + 0.4 * A * math.sin(s_ / (lam * 0.37) + ph * 2)
                pts.append((x0 + dx * s_ - dy * off, y0 + dy * s_ + dx * off))
            ll = LineString(pts)
            # Cortes: tramos que desaparecen (cruces en T)
            segs = max(1, int(ll.length / (sb if fam == 'v' else sa)))
            cur = []
            for k in range(segs):
                a, b = k / segs, (k + 1) / segs
                piece = substring_line(ll, a, b)
                if rnd.random() < drop and 0 < k < segs - 1:
                    if cur:
                        out.append(LineString(cur))
                    cur = []
                    continue
                cs = list(piece.coords)
                cur = cur + cs[1:] if cur else cs
            if len(cur) > 1:
                out.append(LineString(cur))
    return [x for o in out for x in lines(o.intersection(region))]


def substring_line(l, a, b):
    from shapely.ops import substring
    return substring(l, a, b, normalized=True)
