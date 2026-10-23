"""Exporta Ibaia (ciudad v2) al juego: src/world/maps/ibaia/cityData.js

El juego no lee polígonos de shapely: recibe cajas orientadas (edificios,
puentes, tren elevado), polígonos planos cuantizados (aceras, parques, agua),
una máscara de tierra/agua, el relieve de la sierra y los datos de cada barrio
(barrera, Ancla, zonas y puntos de viaje).

Coordenadas del juego: X = x - 4500, Z = y - 3500 (el norte es -Z).
Uso: venv/bin/python export_game.py
"""
import base64
import json
import math
import os
import random
import numpy as np
import shapely
from shapely.geometry import Point, LineString, Polygon, box
from shapely.ops import unary_union, nearest_points
from shapely import affinity, contains_xy
from shapely.prepared import prep
from shapely.strtree import STRtree
import city
import data
from fabric import polys, lines, road_area, ROAD_W
from geo import FRAME

OX, OZ = 4500.0, 3500.0
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'world', 'maps', 'ibaia', 'cityData.js')

KINDS = ['tower', 'mid', 'walled', 'slab', 'old', 'low', 'villa', 'warehouse', 'industrial', 'special', 'glass', 'stadium',
         'prison', 'container', 'crane', 'tank', 'chimney', 'torre', 'letters', 'wheel', 'coaster', 'lighthouse', 'fountain',
         'antenna', 'pier']
LAYERS = ['blocks', 'park', 'forest', 'beach', 'plaza', 'water', 'slag']
# Altura de cada puente (tablero) y de los tramos de rampa sobre el agua
BRIDGE_H = {'Puente de Hierro': 12, 'Puente del Este': 14, 'Puente de la Ría': 12, 'Puente de la Bahía': 18, 'Pasarela de La Roca': 4}
RAIL_Y = 12.0

g = city.build()
rnd = random.Random(11)


def gx(x):
    return x - OX


def gz(y):
    return y - OZ


def b64(arr):
    return base64.b64encode(np.ascontiguousarray(arr).tobytes()).decode('ascii')


# ---------------------------------------------------------------- Edificios
def frame_angle(p):
    mrr = p.minimum_rotated_rectangle
    if mrr.geom_type != 'Polygon':
        return 0.0
    c = list(mrr.exterior.coords)
    e1 = (c[1][0] - c[0][0], c[1][1] - c[0][1])
    e2 = (c[2][0] - c[1][0], c[2][1] - c[1][1])
    if math.hypot(*e2) > math.hypot(*e1):
        e1 = e2
    return math.atan2(e1[1], e1[0])


def decompose(q, depth, out):
    """Cajas alineadas (en el marco girado) que cubren el polígono q."""
    if q.area < 12:
        return
    x0, y0, x1, y1 = q.bounds
    fill = q.area / max((x1 - x0) * (y1 - y0), 1e-9)
    if fill >= 0.86 or depth >= 4 or min(x1 - x0, y1 - y0) < 5:
        out.append((x0, y0, x1, y1))
        return
    if x1 - x0 >= y1 - y0:
        m = (x0 + x1) / 2
        halves = [box(x0 - 1, y0 - 1, m, y1 + 1), box(m, y0 - 1, x1 + 1, y1 + 1)]
    else:
        m = (y0 + y1) / 2
        halves = [box(x0 - 1, y0 - 1, x1 + 1, m), box(x0 - 1, m, x1 + 1, y1 + 1)]
    for hb in halves:
        for part in polys(q.intersection(hb)):
            decompose(part, depth + 1, out)


def obbs_of(p):
    ang = frame_angle(p)
    q = affinity.rotate(p, -ang, origin=(0, 0), use_radians=True)
    rects = []
    decompose(q, 0, rects)
    ca, sa = math.cos(ang), math.sin(ang)
    res = []
    for x0, y0, x1, y1 in rects:
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        res.append((cx * ca - cy * sa, cx * sa + cy * ca, (x1 - x0) / 2, (y1 - y0) / 2, ang))
    return res


bld = []  # (cx, cz, hw, hd, ang, h, kind, var, district)
specials = []
DKEYS = list(data.ORDER)
for key, D in g['D'].items():
    for fp, h, kind in D['bld']:
        var = int(abs(fp.centroid.x * 13 + fp.centroid.y * 7)) % 251
        if kind in ('tank', 'chimney', 'wheel', 'lighthouse', 'fountain', 'antenna', 'glass', 'torre'):
            c = fp.centroid
            r = math.sqrt(fp.area / math.pi)
            specials.append({'k': kind, 'x': round(gx(c.x), 1), 'z': round(gz(c.y), 1), 'r': round(r, 1), 'h': h})
        for p in polys(fp):
            for cx, cy, hw, hd, ang in obbs_of(p):
                bld.append((gx(cx), gz(cy), hw, hd, ang, h, KINDS.index(kind), var, DKEYS.index(key)))

n = len(bld)
A = np.array(bld, dtype=np.float64)
ang = np.mod(A[:, 4], math.pi)
B_CX = np.round(A[:, 0] * 4).astype(np.int16)
B_CZ = np.round(A[:, 1] * 4).astype(np.int16)
B_ANG = np.round(ang / math.pi * 65535).astype(np.uint16)
B_HW = np.round(A[:, 2] * 50).astype(np.uint16)
B_HD = np.round(A[:, 3] * 50).astype(np.uint16)
B_H = np.round(A[:, 5] * 20).astype(np.uint16)
B_KIND = A[:, 6].astype(np.uint8)
B_VAR = A[:, 7].astype(np.uint8)
B_DIST = A[:, 8].astype(np.uint8)
buildings_bin = b''.join(x.tobytes() for x in (B_CX, B_CZ, B_ANG, B_HW, B_HD, B_H, B_KIND, B_VAR, B_DIST))
print('cajas de edificios', n, 'de', sum(len(D['bld']) for D in g['D'].values()), 'edificios')

bld_union = unary_union([fp for D in g['D'].values() for fp, h, k in D['bld']])
bld_prep = prep(bld_union.buffer(2.0))


# ---------------------------------------------------------------- Capas planas
def enc_polys(geoms, simp):
    """[n, (anillos, (puntos, x, z…)…)…] en Int16 de medio metro."""
    out = []
    cnt = 0
    for gm in geoms:
        for p in polys(gm):
            p = p.simplify(simp)
            for q in polys(p):
                if q.area < 6:
                    continue
                rings = [q.exterior] + [r for r in q.interiors if Polygon(r).area > 6]
                out.append(len(rings))
                for r in rings:
                    pts = list(r.coords)[:-1]
                    out.append(len(pts))
                    for x, y in pts:
                        out += [round(gx(x) * 2), round(gz(y) * 2)]
                cnt += 1
    return np.array([cnt] + out, dtype=np.int16), cnt


roads_all = [(l, c) for l, c, nme in g['groads']]
layers = {k: [] for k in LAYERS}
land_polys = []
for key, D in g['D'].items():
    a = D['areas']
    land_polys.append(D['poly'])
    blocks = [b for b in polys(D['poly'].difference(road_area(D['roads'] + roads_all))) if b.area > 200]
    layers['blocks'] += blocks
    layers['park'] += a['park']
    layers['forest'] += a['forest']
    layers['beach'] += a['beach'] + a['sand']
    layers['plaza'] += a['plaza'] + a['yard']
    layers['water'] += a['water'] + a['pool']
    layers['slag'] += a['slag']
layer_bin = {}
for k, v in layers.items():
    arr, cnt = enc_polys(v, 1.0 if k == 'blocks' else 1.5)
    layer_bin[k] = arr
    print(f'capa {k}: {cnt} polígonos, {arr.nbytes // 1024} KB')
dist_arr, _ = enc_polys(land_polys, 1.0)

# ---------------------------------------------------------------- Árboles
trees = []
def scatter(geoms, per_m2, scale):
    for gm in geoms:
        for p in polys(gm):
            k = int(p.area * per_m2)
            if k <= 0:
                continue
            x0, y0, x1, y1 = p.bounds
            xs = np.random.default_rng(len(trees) + 7).uniform(x0, x1, k * 3)
            ys = np.random.default_rng(len(trees) + 9).uniform(y0, y1, k * 3)
            inside = contains_xy(p, xs, ys)
            m = 0
            for x, y in zip(xs[inside], ys[inside]):
                if m >= k:
                    break
                if bld_prep.contains(Point(x, y)):
                    continue
                trees.append((round(gx(x) * 2), round(gz(y) * 2), int(scale * (0.7 + 0.6 * rnd.random()) * 20)))
                m += 1


scatter(layers['forest'], 1 / 110, 1.15)
scatter(layers['park'], 1 / 420, 1.0)
T = np.array(trees, dtype=np.int16).reshape(-1)
print('árboles', len(trees))

# ---------------------------------------------------------------- Farolas y marcas viales
all_land = unary_union(land_polys)
land_prep = prep(all_land.buffer(-3))
lamps = []
dashes = []
def along(l, step, off):
    L = l.length
    s = step / 2
    while s < L:
        p = l.interpolate(s)
        q = l.interpolate(min(L, s + 0.5))
        dx, dy = q.x - p.x, q.y - p.y
        d = math.hypot(dx, dy) or 1
        yield p, dx / d, dy / d
        s += step


all_roads = roads_all + [(l, c) for D in g['D'].values() for l, c in D['roads']]
for l, c in all_roads:
    if c not in ROAD_W or c in ('path', 'alley'):
        continue
    for ln in lines(l):
        w = ROAD_W[c] / 2 + 1.2
        step = {'hwy': 46, 'ave': 38, 'st': 52}[c]
        for p, dx, dy in along(ln, step, w):
            for side in (-1, 1):
                x, y = p.x - dy * w * side, p.y + dx * w * side
                pt = Point(x, y)
                if land_prep.contains(pt) and not bld_prep.contains(pt):
                    lamps.append((round(gx(x) * 2), round(gz(y) * 2), int(round(math.atan2(-dx * side, dy * side) / math.pi * 127))))
        if c in ('hwy', 'ave'):
            for p, dx, dy in along(ln, 12, 0):
                if land_prep.contains(p):
                    dashes.append((round(gx(p.x) * 2), round(gz(p.y) * 2), int(round(math.atan2(dy, dx) / math.pi * 127))))
LAMPS = np.array(lamps, dtype=np.int16).reshape(-1)
DASH = np.array(dashes, dtype=np.int16).reshape(-1)
print('farolas', len(lamps), 'marcas', len(dashes))

# ---------------------------------------------------------------- Máscara de tierra (4 m)
x0, y0, x1, y1 = FRAME
CELL = 4.0
cols = int((x1 - x0) / CELL)
rows = int((y1 - y0) / CELL)
land_geom = unary_union([g['westland'], g['eastland'], g['island'], g['roca']])
xs = x0 + (np.arange(cols) + 0.5) * CELL
runs = []
for j in range(rows):
    y = y0 + (j + 0.5) * CELL
    row = contains_xy(land_geom, xs, np.full(cols, y))
    # Tramos alternos empezando por agua
    k = 0
    for i in np.flatnonzero(np.diff(np.concatenate([[0], row.astype(np.int8), [0]])) != 0):
        runs.append(i - k)
        k = i
    runs.append(cols - k)
    runs.append(0xFFFF)  # fin de fila
MASK = np.array(runs, dtype=np.uint16)
print('máscara', cols, 'x', rows, len(runs), 'tramos')

# ---------------------------------------------------------------- Relieve de la sierra (50 m)
STEP = 50.0
hx0, hy0 = x0 - 2000, y0 - 2000
hcols = int((x1 - x0 + 4000) / STEP) + 1
hrows = int((y1 - y0 + 4000) / STEP) + 1
play = unary_union(land_polys)
wild = unary_union([g['westland'], g['eastland']]).difference(play)
gxs = hx0 + np.arange(hcols) * STEP
H = np.zeros((hrows, hcols), dtype=np.float64)
play_prep = prep(play)
for j in range(hrows):
    y = hy0 + j * STEP
    ys = np.full(hcols, y)
    in_land = contains_xy(land_geom, gxs, ys)
    in_play = contains_xy(play, gxs, ys)
    dd_row = shapely.distance(play, shapely.points(gxs, ys))
    for i in range(hcols):
        x = gxs[i]
        outside = x < x0 or x > x1 or y < y0 or y > y1
        if in_play[i]:
            H[j, i] = 0
        elif in_land[i] or (outside and ((y < y0 and x > -200) or x > x1)):
            dd = dd_row[i]
            n = math.sin(x / 600) * math.cos(y / 800) * 0.5 + math.sin(x / 230 + y / 310) * 0.25
            t = min(1.0, max(0.0, (dd - 20) / 1700))
            t = t * t * (3 - 2 * t)
            H[j, i] = t * (430 + 210 * n) + 2 * min(1.0, dd / 60)
        else:
            H[j, i] = -12
HM = np.round(H * 10).astype(np.int16).reshape(-1)
print('relieve', hcols, 'x', hrows)


# ---------------------------------------------------------------- Puentes y tren elevado
def profile(line, H):
    """Puntos [x, z, y] del tablero: rampas desde cada orilla hasta H sobre el agua."""
    L = line.length
    wet = line.difference(land_geom)
    segs = [s for s in lines(wet) if s.length > 2]
    if not segs:
        return None
    s0 = min(line.project(Point(s.coords[0])) for s in segs)
    s0 = min(s0, min(line.project(Point(s.coords[-1])) for s in segs))
    s1 = max(max(line.project(Point(s.coords[0])), line.project(Point(s.coords[-1]))) for s in segs)
    R = min(H / 0.12, (s1 - s0) / 2)
    hfun = lambda s: H * max(0.0, min(1.0, (s - s0) / R, (s1 - s) / R))
    ss = sorted(set([s0 - 6, s0, s0 + R, s1 - R, s1, s1 + 6] + [line.project(Point(c)) for c in line.coords]))
    # Tramos largos: un punto cada 60 m (las rampas quedan rectas)
    fine = []
    for a, b in zip(ss, ss[1:]):
        k = max(1, int((b - a) / 60))
        fine += [a + (b - a) * i / k for i in range(k)]
    fine.append(ss[-1])
    pts = []
    for s in fine:
        s = max(0.0, min(L, s))
        if s < s0 - 6.5 or s > s1 + 6.5:
            continue
        p = line.interpolate(s)
        pts.append([round(gx(p.x), 2), round(gz(p.y), 2), round(hfun(s), 2)])
    return pts


bridges_out = []
all_bridges = list(g['bridges']) + [(nm, l, c, 'centro', 'centro') for D in g['D'].values() for nm, l, c in D.get('bridges', [])]
for name, l, c, a, b in all_bridges:
    if c == 'tunnel':
        continue
    pts = profile(l, BRIDGE_H.get(name, 10))
    if pts:
        bridges_out.append({'name': name, 'w': ROAD_W[c] - 4, 'pts': pts, 'towers': name in ('Puente de la Bahía', 'Puente del Este', 'Puente de la Ría'),
                            'color': '#c0392b' if name == 'Puente de la Bahía' else '#8f969f'})
rail_out = []
for l in g['elevated']:
    pts = [[round(gx(x), 1), round(gz(y), 1)] for x, y in l.coords]
    rail_out.append(pts)

# ---------------------------------------------------------------- Barrios, barreras y destinos
def snap_road(key, x, y, maxd=400):
    """Punto de calle cercano a (x, y) fuera de edificios."""
    D = g['D'][key]
    cand = [l for l, c in D['roads'] if c in ('st', 'ave', 'hwy')] + [l for l, c in roads_all]
    ml = unary_union([ln for l in cand for ln in lines(l)]).intersection(D['poly'].buffer(-30))
    if ml.is_empty:
        return x, y
    p = Point(x, y)
    q = nearest_points(ml, p)[0]
    if bld_prep.contains(q):
        for r in range(4, 60, 4):
            for a in range(0, 360, 30):
                t = Point(q.x + r * math.cos(math.radians(a)), q.y + r * math.sin(math.radians(a)))
                if D['poly'].buffer(-30).contains(t) and not bld_prep.contains(t):
                    return t.x, t.y
    return q.x, q.y


def ring_coords(geom, simp):
    out = []
    for p in polys(geom):
        r = p.exterior.simplify(simp)
        out.append([v for xy in list(r.coords)[:-1] for v in (round(gx(xy[0]), 1), round(gz(xy[1]), 1))])
    return out


districts = []
for key in data.ORDER:
    D = g['D'][key]
    info = data.B[key]
    mark = data.MARKS[info['mark']]
    poly = D['poly']
    zones = []
    for nm, (x, y) in info['zones']:
        sx, sy = snap_road(key, x, y)
        zones.append({'name': nm, 'x': round(gx(x), 1), 'z': round(gz(y), 1), 'gx': round(gx(sx), 1), 'gz': round(gz(sy), 1)})
    rp = poly.representative_point() if key != 'centro' else polys(poly)[0].representative_point()
    biggest = max(polys(poly), key=lambda p: p.area)
    cx, cy = snap_road(key, biggest.centroid.x, biggest.centroid.y)
    ax, ay = info['anchor']['at']
    entry = {
        'id': key, 'name': info['name'], 'mark': info['mark'], 'markName': mark['name'], 'color': mark['color'],
        'area': info['area'], 'tagline': info['tagline'], 'pdc': info['pdc'],
        'anchor': {'name': info['anchor']['name'], 'x': round(gx(ax), 1), 'z': round(gz(ay), 1)},
        'center': {'x': round(gx(cx), 1), 'z': round(gz(cy), 1)},
        'label': {'x': round(gx(biggest.centroid.x), 1), 'z': round(gz(biggest.centroid.y), 1)},
        'zones': zones,
        'outline': ring_coords(poly, 8),
        'barrier': ring_coords(poly.buffer(-8), 5),
    }
    inc = info.get('incarnation')
    if inc:
        entry['incarnation'] = {'name': inc['name'], 'role': inc['role'], 'x': round(gx(inc['at'][0]), 1), 'z': round(gz(inc['at'][1]), 1)}
    districts.append(entry)

# Jon llega por la Autovía de la Sierra: aparece en el primer punto de la autovía dentro del Distrito Cero
auto = LineString([(8200, 380), (7600, 640), (7000, 960), (6560, 1120)])
inner = g['D']['cero']['poly'].buffer(-60)
spawn = None
for s in np.arange(0, auto.length, 5):
    p = auto.interpolate(s)
    if inner.contains(p) and not bld_prep.contains(p):
        q = auto.interpolate(s + 20)
        spawn = {'x': round(gx(p.x), 1), 'z': round(gz(p.y), 1), 'dx': round(q.x - p.x, 2), 'dz': round(q.y - p.y, 2)}
        break
print('aparición', spawn)

# ---------------------------------------------------------------- PDC y enemigos
# Presencia según el nivel PDC de cada barrio (1 Distrito Cero … 5 el Centro):
# su torre de vigilancia, controles en las entradas de los puentes y del metro,
# patrullas a pie por calles rectas y libres, francotiradores en azoteas
# (nivel ≥ 2), drones sobre las avenidas (nivel ≥ 3) y los campamentos de los
# Acólitos del diseño. Todo dentro de la barrera del barrio.
bld_list = [(fp, h, k) for D in g['D'].values() for fp, h, k in D['bld']]
bld_tree = STRtree([b[0] for b in bld_list])
inner_of = {k: g['D'][k]['poly'].buffer(-26) for k in data.ORDER}


def clear_at(x, y, r):
    p = Point(x, y)
    return all(bld_list[i][0].distance(p) >= r for i in bld_tree.query(p.buffer(r)))


def segment_clear(a, b, r):
    s = LineString([a, b]).buffer(r)
    return not any(bld_list[i][0].intersects(s) for i in bld_tree.query(s))


def district_of(x, y):
    p = Point(x, y)
    for k in data.ORDER:
        if inner_of[k].contains(p):
            return k
    return None


def road_lines(key, classes):
    D = g['D'][key]
    out = []
    for l, c in D['roads'] + roads_all:
        if c in classes:
            out += [(ln, c) for ln in lines(l.intersection(inner_of[key]))]
    return out


def road_dir(key, x, y):
    """Dirección (rad, en el plano XZ del juego) y ancho de la calle más cercana."""
    p = Point(x, y)
    ln, c = min(road_lines(key, ('st', 'ave', 'hwy')), key=lambda lc: lc[0].distance(p))
    s = ln.project(p)
    a = ln.interpolate(max(0.0, s - 4))
    b = ln.interpolate(min(ln.length, s + 4))
    return math.atan2(b.y - a.y, b.x - a.x), ROAD_W[c]


def free_near(key, x, y, r=5, maxd=90):
    """Punto libre de edificios (radio r) cerca de (x, y), dentro de la barrera."""
    for d in range(0, maxd, 4):
        for a in range(0, 360, 24 if d else 360):
            t = (x + d * math.cos(math.radians(a)), y + d * math.sin(math.radians(a)))
            if inner_of[key].contains(Point(t)) and clear_at(t[0], t[1], r):
                return t
    return None


pdc_posts = []
taken = []  # (x, y) de lo ya colocado, para repartir


def add_post(key, kind, name, x, y):
    if not inner_of[key].contains(Point(x, y)):
        return
    ang, w = road_dir(key, x, y)
    pdc_posts.append({'id': f'{key}-{kind}-{len([p for p in pdc_posts if p["d"] == key])}', 'd': key, 'kind': kind, 'name': name,
                      'x': round(gx(x), 1), 'z': round(gz(y), 1), 'ang': round(ang, 3), 'w': w})
    taken.append((x, y))


for key in data.ORDER:
    info = data.B[key]
    tx, ty = snap_road(key, *info['tower'])
    add_post(key, 'tower', f'Torre de vigilancia · {info["name"]}', tx, ty)
    for k, m in enumerate(info['metro']):
        mx, my = snap_road(key, *m)
        add_post(key, 'metro', f'Control del metro · {info["name"]}', mx, my)
# Controles a la entrada de cada puente (a ~30 m de la orilla, tierra adentro)
for br in bridges_out:
    for end, nxt in ((br['pts'][0], br['pts'][1]), (br['pts'][-1], br['pts'][-2])):
        ex, ey = end[0] + OX, end[1] + OZ
        dx, dy = ex - (nxt[0] + OX), ey - (nxt[1] + OZ)
        L = math.hypot(dx, dy) or 1
        px, py = ex + dx / L * 34, ey + dy / L * 34
        key = district_of(px, py)
        if key:
            add_post(key, 'bridge', f'Control · {br["name"]}', px, py)

pdc_patrols = []
prng = random.Random(23)
for key in data.ORDER:
    lvl = data.B[key]['pdc']
    for kind, n, classes, L, sep in (('foot', 2 + 2 * lvl, ('st', 'ave'), 110, 230), ('drone', max(0, lvl - 2) * 2, ('ave', 'hwy'), 170, 300)):
        cands = []
        for ln, c in road_lines(key, classes):
            s = 10.0
            while s + L < ln.length - 10:
                a = ln.interpolate(s)
                b = ln.interpolate(s + L)
                if abs(a.distance(b) - L) < 6 and segment_clear((a.x, a.y), (b.x, b.y), 2.2):
                    cands.append(((a.x, a.y), (b.x, b.y)))
                s += 45
        prng.shuffle(cands)
        got = 0
        for a, b in cands:
            if got >= n:
                break
            m = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
            if any(math.hypot(m[0] - t[0], m[1] - t[1]) < sep for t in taken):
                continue
            taken.append(m)
            got += 1
            pdc_patrols.append({'id': f'{key}-{kind}-{got}', 'd': key, 'kind': kind,
                                'pts': [[round(gx(a[0]), 1), round(gz(a[1]), 1)], [round(gx(b[0]), 1), round(gz(b[1]), 1)]]})

# Francotiradores en azoteas de 14–45 m cerca de los puestos y las zonas del barrio
pdc_snipers = []
for key in data.ORDER:
    lvl = data.B[key]['pdc']
    n = lvl - 1 + (1 if key == 'industrial' else 0)
    if n <= 0:
        continue
    focus = [(p['x'] + OX, p['z'] + OZ) for p in pdc_posts if p['d'] == key] + [z for _, z in data.B[key]['zones']]
    cands = []
    for i in bld_tree.query(inner_of[key]):
        fp, h, kind = bld_list[i]
        if not (14 <= h <= 45) or kind in ('tank', 'chimney', 'crane', 'container', 'antenna', 'wheel') or fp.area < 150:
            continue
        rp = fp.representative_point()
        if not fp.buffer(-3).contains(rp) or not inner_of[key].contains(rp):
            continue
        d, fx, fy = min((math.hypot(rp.x - x, rp.y - y), x, y) for x, y in focus)
        if d < 140:
            cands.append((d, rp.x, rp.y, h, fx, fy))
    cands.sort()
    got = []
    for d, x, y, h, fx, fy in cands:
        if len(got) >= n:
            break
        if any(math.hypot(x - u, y - v) < 180 for u, v in got):
            continue
        got.append((x, y))
        pdc_snipers.append({'id': f'{key}-sniper-{len(got)}', 'd': key, 'x': round(gx(x), 1), 'z': round(gz(y), 1), 'y': round(h, 2),
                            'yaw': round(math.atan2(fx - x, fy - y), 3)})

# Campamentos de los Acólitos (secretos y textos del diseño)
ACOLYTE_CAMPS = [('industrial', 'Altar del horno apagado', (6620, 3080)), ('parque', 'Campamento del bosque', (4500, 1750)),
                 ('chino', 'Altar de los Acólitos', (3950, 5050)), ('bloques', 'Sótano del estadio', (4200, 900))]
acolyte_cells = []
for key, name, (x, y) in ACOLYTE_CAMPS:
    t = free_near(key, x, y, r=7)
    if t:
        acolyte_cells.append({'id': f'{key}-acolitos', 'd': key, 'name': name, 'x': round(gx(t[0]), 1), 'z': round(gz(t[1]), 1), 'n': 3 if key != 'bloques' else 2})
print('PDC:', len(pdc_posts), 'puestos,', len(pdc_patrols), 'patrullas,', len(pdc_snipers), 'francotiradores,', len(acolyte_cells), 'campamentos de Acólitos')

# Hitos para el plano: carreteras principales simplificadas
major = []
for l, c in all_roads:
    if c in ('hwy', 'ave'):
        for ln in lines(l):
            s = ln.simplify(12)
            major.append([c == 'hwy'] + [v for xy in s.coords for v in (round(gx(xy[0])), round(gz(xy[1])))])

city_json = {
    'name': data.CITY['name'],
    'origin': [OX, OZ],
    'frame': [gx(x0), gz(y0), gx(x1), gz(y1)],
    'kinds': KINDS,
    'layers': LAYERS,
    'buildings': len(bld),
    'mask': {'x0': gx(x0), 'z0': gz(y0), 'cell': CELL, 'cols': cols, 'rows': rows},
    'relief': {'x0': gx(hx0), 'z0': gz(hy0), 'cell': STEP, 'cols': hcols, 'rows': hrows},
    'districts': districts,
    'bridges': bridges_out,
    'rail': {'y': RAIL_Y, 'lines': rail_out},
    'specials': specials,
    'spawn': spawn,
    'roads': major,
    'torre': {'x': gx(4720), 'z': gz(5770)},
    'dome': {'x': gx(4720), 'z': gz(6050), 'rx': 1350, 'ry': 640, 'rz': 860},
    'pdc': {'posts': pdc_posts, 'patrols': pdc_patrols, 'snipers': pdc_snipers, 'acolytes': acolyte_cells},
}
bins = {
    'buildings': base64.b64encode(buildings_bin).decode('ascii'),
    'land': b64(dist_arr),
    **{k: b64(v) for k, v in layer_bin.items()},
    'trees': b64(T), 'lamps': b64(LAMPS), 'dashes': b64(DASH), 'mask': b64(MASK), 'relief': b64(HM),
}
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, 'w') as f:
    f.write('// Generado por tools/ciudad/export_game.py a partir del diseño de la ciudad (v2). No editar a mano.\n')
    f.write('/* eslint-disable */\n')
    f.write('export const CITY = ' + json.dumps(city_json, ensure_ascii=False, separators=(',', ':')) + ';\n')
    f.write('export const BIN = ' + json.dumps(bins, separators=(',', ':')) + ';\n')
print('escrito', OUT, os.path.getsize(OUT) // 1024, 'KB')
