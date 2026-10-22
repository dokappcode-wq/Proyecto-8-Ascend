"""Trama urbana procedural por zonas: cuadrículas (con chaflán), tramas
orgánicas (Voronoi), calles paralelas, polígonos industriales, diques, etc.

Cada generador devuelve listas de polígonos por capa:
  blocks (manzanas edificadas), park (zonas verdes), water (agua añadida:
  diques, estanques), plaza (espacio abierto pavimentado), special (edificios
  singulares), lines (líneas a dibujar: vías, viaductos, murallas).
"""
import math
import random
from shapely.geometry import Polygon, LineString, Point, MultiPolygon, box
from shapely.ops import unary_union, voronoi_diagram
from shapely import affinity
from shapely.geometry import MultiPoint


def polys(g):
    if g.is_empty:
        return []
    if g.geom_type == 'Polygon':
        return [g]
    if hasattr(g, 'geoms'):
        out = []
        for x in g.geoms:
            out += polys(x)
        return out
    return []


def chamfer_rect(cx, cy, w, h, ch):
    hw, hh = w / 2, h / 2
    if ch <= 0:
        return Polygon([(cx - hw, cy - hh), (cx + hw, cy - hh), (cx + hw, cy + hh), (cx - hw, cy + hh)])
    return Polygon([
        (cx - hw + ch, cy - hh), (cx + hw - ch, cy - hh), (cx + hw, cy - hh + ch), (cx + hw, cy + hh - ch),
        (cx + hw - ch, cy + hh), (cx - hw + ch, cy + hh), (cx - hw, cy + hh - ch), (cx - hw, cy - hh + ch)])


def grid_blocks(region, angle=0, bw=110, bh=110, street=18, ch=0, origin=None, keep=0.35):
    """Cuadrícula girada `angle` grados; recorta las manzanas al borde."""
    if region.is_empty:
        return []
    o = origin or (region.centroid.x, region.centroid.y)
    # Trabaja en el sistema girado
    reg = affinity.rotate(region, -angle, origin=o)
    minx, miny, maxx, maxy = reg.bounds
    px, py = bw + street, bh + street
    out = []
    i0 = math.floor((minx - o[0]) / px) - 1
    i1 = math.ceil((maxx - o[0]) / px) + 1
    j0 = math.floor((miny - o[1]) / py) - 1
    j1 = math.ceil((maxy - o[1]) / py) + 1
    for i in range(i0, i1):
        for j in range(j0, j1):
            cx = o[0] + i * px
            cy = o[1] + j * py
            b = chamfer_rect(cx, cy, bw, bh, ch)
            inter = b.intersection(reg)
            if inter.is_empty or inter.area < keep * b.area:
                continue
            for q in polys(inter):
                if q.area > 120:
                    out.append(affinity.rotate(q, angle, origin=o))
    return out


def voronoi_blocks(region, cell=50, street=8, seed=1, jitter=0.45, minarea=150):
    """Trama orgánica: celdas de Voronoi de puntos en rejilla perturbada."""
    if region.is_empty:
        return []
    rnd = random.Random(seed)
    minx, miny, maxx, maxy = region.bounds
    pts = []
    y = miny - cell
    row = 0
    while y < maxy + cell:
        x = minx - cell + (cell / 2 if row % 2 else 0)
        while x < maxx + cell:
            pts.append((x + rnd.uniform(-jitter, jitter) * cell, y + rnd.uniform(-jitter, jitter) * cell))
            x += cell
        y += cell * 0.87
        row += 1
    vd = voronoi_diagram(MultiPoint(pts), envelope=region.envelope.buffer(cell * 2))
    out = []
    shrunk = region.buffer(-street / 2)
    for cellp in vd.geoms:
        q = cellp.buffer(-street / 2, join_style='mitre')
        q = q.intersection(shrunk)
        for p in polys(q):
            if p.area > minarea:
                out.append(p.simplify(1.5))
    return out


def cut(blocks, cutter):
    """Quita a las manzanas lo que ocupa `cutter` (avenidas, plazas…)."""
    if cutter is None or cutter.is_empty:
        return blocks
    out = []
    for b in blocks:
        d = b.difference(cutter)
        out += [p for p in polys(d) if p.area > 120]
    return out


def avenue(points, width):
    return LineString(points).buffer(width / 2, cap_style='flat', join_style='round')


def halls(blocks, seed=3, fill=0.75):
    """Naves industriales dentro de manzanas grandes (rectángulos alineados)."""
    rnd = random.Random(seed)
    out = []
    for b in blocks:
        mrr = b.minimum_rotated_rectangle
        if mrr.area < 2500:
            out.append(b)
            continue
        c = list(mrr.exterior.coords)
        e1 = (c[1][0] - c[0][0], c[1][1] - c[0][1])
        e2 = (c[2][0] - c[1][0], c[2][1] - c[1][1])
        L1, L2 = math.hypot(*e1), math.hypot(*e2)
        ang = math.degrees(math.atan2(e1[1], e1[0]))
        n = 1 if L1 < 140 else (2 if L1 < 260 else 3)
        cx, cy = mrr.centroid.x, mrr.centroid.y
        for k in range(n):
            w = L1 / n * rnd.uniform(0.62, 0.82)
            h = L2 * rnd.uniform(0.5, fill)
            off = (k + 0.5) / n - 0.5
            r = box(-w / 2, -h / 2, w / 2, h / 2)
            r = affinity.rotate(r, ang, origin=(0, 0))
            dx = e1[0] / L1 * off * L1 + e2[0] / L2 * rnd.uniform(-0.12, 0.12) * L2
            dy = e1[1] / L1 * off * L1 + e2[1] / L2 * rnd.uniform(-0.12, 0.12) * L2
            r = affinity.translate(r, cx + dx, cy + dy)
            r = r.intersection(b)
            out += [p for p in polys(r) if p.area > 200]
    return out


def patios(blocks, depth=20):
    """Manzanas de ensanche: edificación perimetral con patio interior."""
    out = []
    for b in blocks:
        inner = b.buffer(-depth, join_style='mitre')
        if inner.is_empty or inner.area < 0.12 * b.area:
            out.append(b)
        else:
            out += polys(b.difference(inner))
    return out


def lots(blocks, size=26, seed=5):
    """Divide manzanas en solares (casas) con calles de 1 m entre ellas."""
    out = []
    for i, b in enumerate(blocks):
        if b.area < size * size * 2.2:
            out.append(b)
            continue
        out += voronoi_blocks(b, cell=size, street=1.6, seed=seed + i, jitter=0.3, minarea=40)
    return out


def scatter_houses(region, n, size=(14, 22), seed=7):
    rnd = random.Random(seed)
    out = []
    minx, miny, maxx, maxy = region.bounds
    tries = 0
    while len(out) < n and tries < n * 30:
        tries += 1
        p = Point(rnd.uniform(minx, maxx), rnd.uniform(miny, maxy))
        if not region.contains(p):
            continue
        w, h = rnd.uniform(*size), rnd.uniform(*size)
        r = affinity.rotate(box(p.x - w / 2, p.y - h / 2, p.x + w / 2, p.y + h / 2), rnd.uniform(0, 90), origin=p)
        if any(r.distance(o) < 8 for o in out):
            continue
        out.append(r)
    return out


def curvy_paths(region, n, seed=11, width=5):
    """Caminos de parque: curvas suaves entre puntos del borde."""
    rnd = random.Random(seed)
    lines = []
    ext = list(region.exterior.coords) if region.geom_type == 'Polygon' else list(max(region.geoms, key=lambda g: g.area).exterior.coords)
    for k in range(n):
        a = ext[rnd.randrange(len(ext))]
        b = ext[rnd.randrange(len(ext))]
        mx, my = (a[0] + b[0]) / 2 + rnd.uniform(-160, 160), (a[1] + b[1]) / 2 + rnd.uniform(-160, 160)
        pts = []
        for t in [i / 24 for i in range(25)]:
            x = (1 - t) ** 2 * a[0] + 2 * (1 - t) * t * mx + t * t * b[0]
            y = (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * my + t * t * b[1]
            pts.append((x, y))
        line = LineString(pts).intersection(region)
        if not line.is_empty:
            lines.append(line)
    return lines


def star_fort(cx, cy, r, n=7, bastion=0.22, rot=0.0):
    """Recinto abaluartado (estrella) de n baluartes."""
    pts = []
    for i in range(n * 2):
        a = rot + math.pi * i / n
        rr = r * (1 + bastion) if i % 2 == 0 else r * (1 - bastion * 0.35)
        pts.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr))
    return Polygon(pts)
