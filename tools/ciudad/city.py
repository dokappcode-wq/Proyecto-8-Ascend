"""La ciudad completa: geografía (geo), red viaria global (autopistas,
avenidas fronterizas, puentes, tren elevado) y la trama de cada barrio."""
import math
import random
from shapely.geometry import Polygon, LineString, Point, box, MultiLineString
from shapely.ops import unary_union, linemerge
from shapely import affinity
import geo
from geo import polys, axis_x, half_w, ria_shore, rio_shore, FRAME, Y0
from fabric import (lines, grid_lines, voronoi_streets, contour_lines, chaikin, road_area, blocks_from,
                    buildings, rect, ellipse, split_lot, ROAD_W, organic_grid)

ISL_ANG = -6.0
ISL_O = (4700.0, 3300.0)


def tower_h(lo, hi, p=2.0):
    return lambda fp, r: lo + (hi - lo) * (r.random() ** p)


def D_empty(poly):
    return {'poly': poly, 'roads': [], 'areas': {k: [] for k in ('park', 'forest', 'water', 'beach', 'plaza', 'yard', 'sand', 'slag', 'pool')},
            'bld': [], 'rail': []}


def add_bld(D, items):
    D['bld'] += items


# ---------------------------------------------------------------------------
# Barrios de la isla
# ---------------------------------------------------------------------------
def island_grid(region, sa=240, sb=80, offa=0, offb=0):
    V, Hh = grid_lines(region, ISL_O, ISL_ANG, sa, sb, offa, offb)
    return V, Hh


def b_centro(D, ctx):
    poly = max(polys(D['poly']), key=lambda q: q.area)
    roca = min(polys(D['poly']), key=lambda q: q.area)
    tip = poly.intersection(geo.side_poly(4700, 6000, -7, below=True))
    north = poly.difference(tip)
    V, Hh = island_grid(north)
    D['roads'] += [(l, 'ave') for l in V] + [(l, 'st') for l in Hh]
    D['roads'] += [(l, 'st') for l in organic_grid(tip, (4700, 6300), -38, 150, 95, seed=11, amp=(8, 22))]
    D['roads'].append((LineString([(4720, 5300), (4720, 6550)]), 'ave'))  # avenida de la Torre
    plaza = Point(4720, 5770).buffer(115)
    torre = rect(4720, 5770, 62, 62, 45)
    batt = poly.intersection(Point(4690, 6880).buffer(360))
    heli = Point(5800, 5640).buffer(45)
    ferry = rect(4930, 6700, 140, 45, -35)
    D['areas']['plaza'] += [plaza, heli]
    D['areas']['park'] += polys(batt)
    holes = [plaza, batt, heli.buffer(10)]
    bl = blocks_from(poly, D['roads'] + ctx['groads'], holes)
    near = lambda fp: max(0.0, 1 - fp.centroid.distance(Point(4720, 5770)) / 1100)
    add_bld(D, buildings(bl, 'tower', seed=12, lot=1700, setback=2,
                         hfun=lambda fp, r: 70 + (110 + 250 * near(fp)) * (r.random() ** 1.15)))
    add_bld(D, [(torre, 520.0, 'torre'), (ferry, 14.0, 'special')])
    # La Roca: penal
    D['areas']['yard'].append(roca.buffer(-25))
    for i, (x, y, w, h) in enumerate([(4480, 7520, 160, 34), (4470, 7580, 160, 34), (4600, 7560, 60, 90), (4360, 7520, 40, 40)]):
        add_bld(D, [(rect(x, y, w, h, 18), 14.0 if i < 3 else 30.0, 'prison')])
    D['bridges'] = [('Pasarela de La Roca', LineString([(4660, 6930), (4560, 7420)]), 'st')]


def b_chino(D, ctx):
    poly = D['poly']
    walled = rect(4520, 4700, 230, 230, -22)
    grid_reg = poly.difference(walled.buffer(8))
    V, Hh = grid_lines(grid_reg, (4700, 4700), -22, 70, 70)
    for i, l in enumerate(V):
        D['roads'].append((l, 'st' if i % 3 == 0 else 'alley'))
    for i, l in enumerate(Hh):
        D['roads'].append((l, 'st' if i % 3 == 0 else 'alley'))
    D['roads'].append((LineString([(3600, 4350), (5850, 5250)]).intersection(poly), 'ave'))  # Calle del Mercado Nocturno
    bl = blocks_from(poly, D['roads'] + ctx['groads'], [walled.buffer(4)])
    add_bld(D, buildings(bl, 'mid', seed=21, lot=480, setback=0.8,
                         hfun=lambda fp, r: 18 + 34 * r.random() + (70 * r.random() if r.random() < 0.14 else 0)))
    inner = walled.buffer(-6)
    add_bld(D, buildings([inner], 'walled', seed=22, lot=140, setback=0.4, hfun=lambda fp, r: 32 + 22 * r.random()))
    for k in range(4):  # Lonja del pescado: espigones en la orilla oeste
        y = 4560 + k * 190
        x = axis_x(y) - half_w(y, Y0, ctx['y1'])
        add_bld(D, [(rect(x - 70, y, 150, 34, -6), 9.0, 'pier')])


def b_midtown(D, ctx):
    poly = D['poly']
    V, Hh = island_grid(poly)
    D['roads'] += [(l, 'ave') for l in V] + [(l, 'st') for l in Hh]
    gv = LineString([(3480, 2650), (5980, 4180)]).intersection(poly)
    D['roads'].append((gv, 'ave'))
    plaza = Polygon([(4560, 3330), (4840, 3500), (4800, 3570), (4520, 3400)])
    estacion = rect(5150, 3030, 170, 115, ISL_ANG)
    D['areas']['plaza'].append(plaza)
    bl = blocks_from(poly, D['roads'] + ctx['groads'], [plaza.buffer(6), estacion.buffer(8)])
    near = lambda fp: max(0.0, 1 - fp.centroid.distance(Point(4700, 3450)) / 1300)
    add_bld(D, buildings(bl, 'tower', seed=31, lot=1400, setback=1.5,
                         hfun=lambda fp, r: 50 + (80 + 190 * near(fp)) * (r.random() ** 1.25)))
    add_bld(D, [(estacion, 32.0, 'special')])


def b_parque(D, ctx):
    poly = D['poly']
    park = rect(4700, 2200, 1120, 820, ISL_ANG).intersection(poly)
    V, Hh = island_grid(poly.difference(park.buffer(20)))
    D['roads'] += [(l, 'ave') for l in V] + [(l, 'st') for l in Hh]
    # Avenidas que rodean el parque
    D['roads'].append((park.buffer(18).exterior, 'ave'))
    # Carreteras transversales hundidas
    for y in (2030, 2390):
        l = affinity.rotate(LineString([(4000, y), (5400, y)]), ISL_ANG, origin=(4700, y)).intersection(park)
        D['roads'].append((l, 'st'))
    resv = ellipse(4790, 1960, 270, 150, ISL_ANG)
    lake = Polygon([(4250, 2380), (4420, 2330), (4560, 2400), (4520, 2500), (4330, 2520), (4230, 2460)])
    zoo = rect(5080, 2480, 240, 170, ISL_ANG)
    D['areas']['park'].append(park)
    D['areas']['water'] += [resv, lake]
    D['areas']['plaza'].append(zoo)
    paths = []
    rnd = random.Random(41)
    for k in range(10):
        a = park.exterior.interpolate(rnd.random(), normalized=True)
        b = park.exterior.interpolate(rnd.random(), normalized=True)
        m = (a.x + b.x) / 2 + rnd.uniform(-180, 180), (a.y + b.y) / 2 + rnd.uniform(-150, 150)
        l = chaikin(LineString([(a.x, a.y), m, (b.x, b.y)]), 3).intersection(park).difference(resv).difference(lake)
        paths += lines(l)
    D['roads'] += [(l, 'path') for l in paths]
    add_bld(D, [(rect(4700, 2200, 46, 30, ISL_ANG), 22.0, 'special'),        # Castillo del Mirador
                (Point(5150, 2520).buffer(42), 26.0, 'glass'),               # Pajarera del zoo
                (rect(5390, 2140, 190, 95, ISL_ANG), 30.0, 'special')])      # Museo
    bl = blocks_from(poly, D['roads'] + ctx['groads'], [park.buffer(10), rect(5390, 2140, 200, 105, ISL_ANG)])
    add_bld(D, buildings(bl, 'tower', seed=42, lot=1300, setback=2, hfun=lambda fp, r: 35 + 130 * (r.random() ** 1.5)))


def b_bloques(D, ctx):
    poly = D['poly']
    punta = poly.intersection(Point(4690, 300).buffer(420))
    stadium = ellipse(4320, 950, 175, 130, ISL_ANG)
    reg = poly.difference(punta).difference(stadium.buffer(60))
    V, Hh = island_grid(reg, 240, 160)
    D['roads'] += [(l, 'ave') for l in V] + [(l, 'st') for l in Hh]
    D['areas']['park'] += polys(punta)
    D['areas']['plaza'].append(stadium.buffer(55))
    add_bld(D, [(stadium, 30.0, 'stadium')])
    bl = blocks_from(poly, D['roads'] + ctx['groads'], [punta, stadium.buffer(60)])
    rnd = random.Random(51)
    proj, rest = [], []
    for b in bl:
        (proj if b.area > 26000 and rnd.random() < 0.55 else rest).append(b)
    for b in proj:  # proyectos: torres en barra sobre césped
        D['areas']['park'].append(b)
        c = b.centroid
        for k in range(3):
            fp = rect(c.x + (k - 1) * 60, c.y + rnd.uniform(-25, 25), 18, 72, ISL_ANG + 90 * (k % 2) * 0 + rnd.uniform(-4, 4))
            fp = fp.intersection(b.buffer(-8))
            if not fp.is_empty and fp.area > 300:
                add_bld(D, [(fp, rnd.uniform(42, 70), 'slab')])
    add_bld(D, buildings(rest, 'mid', seed=52, lot=650, setback=1, hfun=lambda fp, r: 14 + 14 * r.random()))


# ---------------------------------------------------------------------------
# Península
# ---------------------------------------------------------------------------
def hills(x, y):
    h = 270 * math.exp(-(((x - 1250) / 520) ** 2 + ((y - 1500) / 600) ** 2))
    h += 190 * math.exp(-(((x - 2000) / 380) ** 2 + ((y - 1100) / 330) ** 2))
    h += 120 * math.exp(-(((x - 1500) / 700) ** 2 + ((y - 2200) / 420) ** 2))
    return h


def b_colinas(D, ctx):
    poly = D['poly']
    cl = contour_lines(poly, hills, [35, 75, 115, 160, 205], step=22)
    roads = []
    for L, ls in cl.items():
        for l in ls:
            roads.append((chaikin(l, 2), 'st'))
    # Carretera del Mirador (zigzag hasta el observatorio) y accesos radiales
    zig = LineString([(2440, 1950), (2150, 1830), (2230, 1700), (1900, 1620), (1980, 1500), (1640, 1450), (1330, 1500)])
    roads.append((chaikin(zig, 2).intersection(poly), 'st'))
    for a in (LineString([(700, 2350), (1300, 1900), (1260, 1560)]), LineString([(2500, 900), (2050, 1080)]),
              LineString([(800, 1400), (1150, 1480)])):
        roads.append((chaikin(a, 2).intersection(poly), 'st'))
    D['roads'] += roads
    forest = poly.intersection(Point(1250, 1500).buffer(260)).union(poly.intersection(Point(2000, 1080).buffer(150)))
    resv = ellipse(1000, 2280, 190, 105, 20)
    D['areas']['park'].append(poly)  # laderas verdes
    D['areas']['forest'] += polys(forest)
    D['areas']['water'].append(resv)
    D['areas']['plaza'] += [Point(1250, 1500).buffer(55)]
    # Casas a lo largo de las carreteras (con piscina)
    rnd = random.Random(61)
    houses, pools = [], []
    taken = unary_union([forest, resv.buffer(20), Point(1250, 1500).buffer(70)])
    rarea = road_area(roads + ctx['groads'])
    for l, c in roads:
        for ll in lines(l):
            n = int(ll.length / 42)
            for i in range(n):
                p = ll.interpolate((i + 0.5) * ll.length / max(n, 1))
                q = ll.interpolate(min(ll.length, (i + 0.5) * ll.length / max(n, 1) + 3))
                dx, dy = q.x - p.x, q.y - p.y
                L = math.hypot(dx, dy) or 1
                nx, ny = -dy / L, dx / L
                for s in (1, -1):
                    if rnd.random() < 0.25:
                        continue
                    cx, cy = p.x + nx * s * 26, p.y + ny * s * 26
                    ang = math.degrees(math.atan2(dy, dx))
                    fp = rect(cx, cy, rnd.uniform(16, 26), rnd.uniform(12, 18), ang)
                    if not poly.contains(fp) or fp.intersects(rarea) or fp.intersects(taken) or any(fp.distance(h) < 6 for h in houses[-6:]):
                        continue
                    houses.append(fp)
                    if rnd.random() < 0.5:
                        pools.append(rect(cx + nx * s * 17, cy + ny * s * 17, 9, 5, ang))
    add_bld(D, [(h, 6 + 5 * rnd.random(), 'villa') for h in houses])
    D['areas']['pool'] += pools
    # Hitos: observatorio, letras, teatro, antenas
    add_bld(D, [(Point(1250, 1500).buffer(26), 18.0, 'special')])
    for k, ch in enumerate('IBAIA'):
        add_bld(D, [(rect(2120 + k * 34, 1700 - k * 12, 22, 6, -18), 15.0, 'letters')])
    theatre = Point(1720, 2230).buffer(70).intersection(box(1650, 2160, 1800, 2300)).union(Point(1720, 2230).buffer(30))
    add_bld(D, [(theatre, 8.0, 'special')])
    for k in range(3):
        add_bld(D, [(Point(2000 + k * 40, 1060 + k * 20).buffer(5), 70.0, 'antenna')])


def b_puerto(D, ctx):
    poly = D['poly']
    y1 = ctx['y1']
    ys = [2850 + i * 20 for i in range(int((5380 - 2850) / 20))]
    quay_line = LineString([(ria_shore(y, Y0, y1) - 25, y) for y in ys])
    yard = poly.intersection(quay_line.buffer(380, cap_style='flat'))
    railband = poly.intersection(quay_line.parallel_offset(470, 'left').buffer(70, cap_style='flat')) if False else Polygon()
    rest = poly.difference(yard.buffer(25))
    V, Hh = grid_lines(rest, (1900, 4000), 70, 200, 120)
    D['roads'] += [(l, 'st') for l in V + Hh]
    D['areas']['yard'] += polys(yard)
    # Pilas de contenedores en filas paralelas al muelle
    rnd = random.Random(71)
    for y in range(2950, 5300, 34):
        x0 = ria_shore(y, Y0, y1) - 70
        for k in range(5):
            x = x0 - k * 60
            fp = rect(x, y, 48, 12, 0)
            if yard.buffer(-6).contains(fp):
                add_bld(D, [(fp, 2.6 * rnd.randint(1, 4), 'container')])
    for y in range(3000, 5300, 210):  # grúas pórtico en el borde del muelle
        x = ria_shore(y, Y0, y1) - 18
        add_bld(D, [(rect(x, y, 30, 16, 0), 62.0, 'crane')])
    for k in range(6):  # vías del puerto
        x = 1500 + k * 14
        D['rail'].append(LineString([(x + 300, 2700), (x + 120, 3600), (x + 300, 5200)]).intersection(poly))
    dock = rect(2700, 5230, 60, 280, 8)
    D['areas']['water'].append(dock.intersection(poly))
    bl = blocks_from(rest, D['roads'] + ctx['groads'], [dock.buffer(15)])
    add_bld(D, buildings(bl, 'warehouse', seed=72, lot=2600, setback=6, hfun=lambda fp, r: 9 + 9 * r.random()))
    add_bld(D, [(rect(2480, 3000, 90, 60, 70), 22.0, 'special')])  # Aduana


def b_costa(D, ctx):
    poly = D['poly']
    ocean = ctx['ocean']
    beach = poly.intersection(ocean.buffer(90))
    canals_reg = rect(1330, 4320, 420, 330, 15).intersection(poly)
    land = poly.difference(beach)
    V, Hh = grid_lines(land.difference(canals_reg), (1100, 4000), 12, 150, 70)
    D['roads'] += [(l, 'st') for l in V] + [(l, 'alley') for l in Hh]
    D['areas']['beach'] += polys(beach)
    walk = beach.buffer(-4).exterior if beach.geom_type == 'Polygon' else None
    inner = land.intersection(ocean.buffer(105)).buffer(1)
    for l in lines(inner.boundary.intersection(land.buffer(-2))):
        D['roads'].append((l, 'path'))  # paseo marítimo
    canals = []
    for k in range(-2, 3):
        c = rect(1330 + k * 85, 4320, 16, 330, 15).intersection(canals_reg)
        canals += polys(c)
    D['areas']['water'] += canals
    # Muelle de la feria con noria y montaña rusa
    pier = rect(760, 4210, 330, 42, 0)
    D['areas']['plaza'].append(pier)
    add_bld(D, [(Point(640, 4210).buffer(24), 60.0, 'wheel'), (rect(760, 4210, 120, 30, 0), 18.0, 'coaster'),
                (Point(1760, 5790).buffer(9), 34.0, 'lighthouse')])
    bl = blocks_from(land, D['roads'] + ctx['groads'], [c.buffer(4) for c in canals])
    near_sea = lambda fp: fp.distance(ocean) < 260
    add_bld(D, buildings(bl, 'low', seed=81, lot=420, setback=2.5,
                         hfun=lambda fp, r: (18 + 26 * r.random()) if near_sea(fp) and r.random() < 0.4 else 6 + 8 * r.random()))


# ---------------------------------------------------------------------------
# Orilla este
# ---------------------------------------------------------------------------
def b_cero(D, ctx):
    poly = D['poly']
    old = poly.intersection(Point(6650, 950).buffer(780))
    plaza = Point(6850, 960).buffer(70)
    newer = poly.difference(old)
    D['roads'] += [(l, 'st') for l in organic_grid(old.difference(plaza), (6850, 960), 24, 120, 80, seed=91)]
    V, Hh = grid_lines(newer, (7300, 900), 12, 150, 85)
    D['roads'] += [(l, 'st') for l in V + Hh]
    D['areas']['plaza'].append(plaza)
    bl = blocks_from(poly, D['roads'] + ctx['groads'], [plaza.buffer(6)])
    add_bld(D, buildings(bl, 'old', seed=92, lot=520, setback=0.6, hfun=lambda fp, r: 10 + 13 * r.random()))
    add_bld(D, [(Point(6850, 960).buffer(9), 4.0, 'fountain'), (rect(6700, 1320, 130, 40, 12), 16.0, 'special')])


def b_industrial(D, ctx):
    poly = D['poly']
    V, Hh = grid_lines(poly, (6700, 3500), 8, 300, 220)
    D['roads'] += [(l, 'st') for l in V + Hh]
    tanks = []
    for i in range(3):
        for j in range(4):
            tanks.append(Point(6560 + i * 95, 3780 + j * 95).buffer(34))
    gas = [Point(6500, 2350).buffer(38), Point(6600, 2350).buffer(38)]
    plant = rect(6600, 3050, 210, 120, 8)
    chim = [Point(6560 + k * 45, 3130).buffer(9) for k in range(3)]
    cold = rect(6950, 2450, 250, 150, 8)
    holes = [unary_union(tanks).buffer(25), plant.buffer(12), cold.buffer(12)] + [g.buffer(10) for g in gas]
    bl = blocks_from(poly, D['roads'] + ctx['groads'], holes)
    add_bld(D, buildings(bl, 'industrial', seed=101, lot=3500, setback=8, hfun=lambda fp, r: 10 + 16 * r.random()))
    add_bld(D, [(t, 22.0, 'tank') for t in tanks] + [(g, 40.0, 'tank') for g in gas] + [(plant, 34.0, 'industrial'), (cold, 20.0, 'industrial')]
            + [(c, 120.0, 'chimney') for c in chim])
    D['areas']['yard'] += [unary_union(tanks).buffer(20).intersection(poly)]
    for k in range(6):
        D['rail'].append(LineString([(6750 + k * 14, 4300), (6850 + k * 14, 4800), (7400, 5400)]).intersection(poly))


BUILDERS = {'centro': b_centro, 'chino': b_chino, 'midtown': b_midtown, 'parque': b_parque, 'bloques': b_bloques,
            'colinas': b_colinas, 'puerto': b_puerto, 'costa': b_costa, 'cero': b_cero, 'industrial': b_industrial}


# ---------------------------------------------------------------------------
# Red global
# ---------------------------------------------------------------------------
def shore_road(poly, inset, keep):
    ring = poly.buffer(-inset).exterior
    out = []
    for l in lines(ring.intersection(keep)):
        out.append(l)
    return out


def global_roads(g):
    isl, y1 = g['island'], g['y1']
    R = []
    # Autopistas de la isla (oeste y este), sin las puntas
    west_keep = Polygon([(0, 700), (axis_x(700), 700), (axis_x(6300), 6300), (0, 6300)])
    east_keep = Polygon([(axis_x(700), 700), (9000, 700), (9000, 6300), (axis_x(6300), 6300)])
    R += [(l, 'hwy', 'Autopista del Oeste') for l in shore_road(isl, 32, west_keep)]
    R += [(l, 'hwy', 'Autopista del Este') for l in shore_road(isl, 32, east_keep)]
    # Península: paseo de la costa y vía del puerto
    pen = g['west']
    R += [(l, 'ave', 'Paseo de la Costa') for l in shore_road(pen, 140, Polygon([(-600, 1000), (1350, 1000), (1700, 5000), (2600, 5900), (-600, 6000)]))]
    R += [(l, 'hwy', 'Vía del Puerto') for l in shore_road(pen, 470, Polygon([(2100, 2700), (3200, 2700), (3200, 5500), (2500, 5500)]))]
    # Orilla este: calle del río y autovía de la sierra
    east = g['east']
    R += [(l, 'ave', 'Avenida del Río') for l in shore_road(east, 45, Polygon([(5000, 300), (6600, 300), (6700, 5000), (5800, 5000)]))]
    R.append((LineString([(8200, 380), (7600, 640), (7000, 960), (6560, 1120)]).intersection(east.buffer(400)), 'hwy', 'Autovía de la Sierra'))
    R.append((LineString([(6560, 1120), (6700, 2200), (6680, 3300), (6800, 4400), (7200, 5100)]).intersection(east), 'ave', 'Avenida de la Fundición'))
    # Avenidas fronterizas: los bordes compartidos entre barrios
    D = g['districts']
    keys = list(D)
    for i in range(len(keys)):
        for j in range(i + 1, len(keys)):
            sh = D[keys[i]].boundary.intersection(D[keys[j]].boundary)
            for l in lines(linemerge(sh) if sh.geom_type in ('MultiLineString',) else sh):
                if l.length > 80:
                    R.append((l, 'ave', 'frontera'))
    return R


def bridges(g):
    y1 = g['y1']
    B = []
    def ib(y, side):
        return (axis_x(y) + side * half_w(y, Y0, y1), y)
    B.append(('Puente de Hierro', LineString([(6450, 1150), ib(1180, 1)]), 'hwy', 'cero', 'bloques'))
    B.append(('Puente del Este', LineString([(6260, 3500), ib(3460, 1)]), 'hwy', 'industrial', 'midtown'))
    B.append(('Puente de la Ría', LineString([(2470, 1430), ib(1360, -1)]), 'hwy', 'colinas', 'bloques'))
    B.append(('Puente de la Bahía', LineString([(1950, 5810), (2500, 5800), ib(5330, -1)]), 'hwy', 'costa', 'chino'))
    B.append(('Túnel del Puerto', LineString([(2960, 3950), ib(3900, -1)]), 'tunnel', 'puerto', 'midtown'))
    return B


def elevated(g):
    y1 = g['y1']
    ys = [650 + i * 40 for i in range(int((5650 - 650) / 40))]
    main = LineString([(axis_x(y) + 380, y) for y in ys])
    branch = LineString([(axis_x(1150) + 380, 1150), (axis_x(1180) + half_w(1180, Y0, y1), 1180), (6450, 1150), (6700, 1320)])
    return [main, branch]


def build():
    g = geo.build()
    frame = box(*FRAME)
    land_all = unary_union([g['westland'], g['eastland'], g['island'], g['roca']])
    g['ocean'] = frame.difference(land_all)
    g['groads'] = global_roads(g)
    ctx = {'y1': g['y1'], 'ocean': g['ocean'], 'groads': [(l, c) for l, c, n in g['groads']]}
    g['D'] = {}
    for k, poly in g['districts'].items():
        D = D_empty(poly)
        BUILDERS[k](D, ctx)
        D['roads'] = [(l, c) for l, c in D['roads'] if l is not None and not l.is_empty]
        g['D'][k] = D
    g['bridges'] = bridges(g)
    g['elevated'] = elevated(g)
    return g


if __name__ == '__main__':
    import time
    t = time.time()
    g = build()
    tot = 0
    for k, D in g['D'].items():
        tot += len(D['bld'])
        print(f"{k:10s} roads={len(D['roads']):4d} bld={len(D['bld']):5d} areas={ {a: len(v) for a, v in D['areas'].items() if v} }")
    print('total buildings', tot, 'time', round(time.time() - t, 1))
