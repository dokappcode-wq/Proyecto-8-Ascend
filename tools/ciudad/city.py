"""Construye la ciudad completa: barrios (geo), agua (water) y la trama de
cada barrio (fabric). Devuelve un diccionario de capas por barrio."""
import math
from shapely.geometry import Polygon, LineString, Point, box
from shapely.ops import unary_union
from shapely import affinity
from geo import build as build_geo, RECT, W, H
from water import build_water
from fabric import (polys, grid_blocks, voronoi_blocks, cut, avenue, halls, patios, lots,
                    scatter_houses, curvy_paths, star_fort, chamfer_rect)


def empty():
    return {k: [] for k in ('built', 'blocks', 'green', 'water', 'plaza', 'special', 'rail', 'wall', 'viaduct', 'road', 'path', 'beach', 'slag')}


def both(L, items):
    L['built'] += items
    L['blocks'] += items


def B1(land, ctx):
    L = empty()
    plaza = Point(3650, 700).buffer(82)
    shore = land.intersection(ctx['water'].buffer(70))
    depot = box(2900, 120, 3260, 420)
    subst = box(4350, 350, 4650, 600)
    aves = unary_union([avenue([(2760, 300), (4300, 1100)], 34), avenue([(4300, 0), (3700, 640)], 26),
                        avenue([(2700, 820), (4100, 820)], 24)])
    rest = land.difference(plaza).difference(shore).difference(depot).difference(subst)
    g = grid_blocks(rest, angle=-14, bw=118, bh=118, street=20, ch=16, origin=(3650, 700))
    g = cut(g, aves)
    L['built'] = patios(g, 22)
    L['special'] = halls(polys(land.intersection(depot)), seed=2) + halls(polys(land.intersection(subst)), seed=4)
    L['plaza'] = [plaza]
    L['green'] = polys(shore)
    L['rail'] = [LineString([(3080, 420), (3080, 640), (3650, 700), (4200, 860), (4400, 1050)])]
    L['road'] = [LineString([(4300, 0), (3700, 640)])]
    return L


def B2(land, ctx):
    L = empty()
    core_c = (2400, 1030)
    wall = Point(core_c).buffer(370)
    siete = affinity.rotate(box(2260, 860, 2560, 1230), 8, origin=core_c).intersection(land)
    cem = Point(700, 330).buffer(150).intersection(land)
    monte = Polygon([(0, 0), (900, 0), (760, 160), (420, 250), (120, 160), (0, 151)]).intersection(land)
    plaza = box(2600, 1030, 2700, 1120)
    cath = affinity.rotate(box(2520, 820, 2620, 870), 8, origin=(2570, 845))
    medieval = wall.intersection(land).difference(siete).difference(plaza).difference(cath.buffer(10))
    both(L, grid_blocks(siete, angle=8, bw=22, bh=92, street=6, origin=core_c, keep=0.2))
    both(L, voronoi_blocks(medieval, cell=36, street=6, seed=21))
    arr = land.difference(wall.buffer(8)).difference(cem.buffer(10)).difference(monte)
    trench = LineString([(2098, 1741), (1418, 1113), (593, 676), (0, 151)]).buffer(45)
    arr = arr.difference(trench)
    vb = voronoi_blocks(arr, cell=62, street=10, seed=22)
    L['blocks'] += vb
    L['built'] += lots(vb, size=22, seed=23)
    L['green'] += polys(cem) + polys(monte) + polys(land.intersection(trench))
    both(L, grid_blocks(cem, angle=-20, bw=40, bh=8, street=5, keep=0.5))
    L['special'] = [cath]
    L['plaza'] = [plaza]
    L['wall'] = [wall.exterior.intersection(land.buffer(1))]
    L['rail'] = [LineString([(2098, 1741), (1418, 1113), (593, 676), (0, 151)])]
    return L


def B3(land, ctx):
    L = empty()
    water = ctx['water']
    dock_band = land.intersection(water.buffer(170)).intersection(box(250, 1800, 1950, 2600))
    ind = box(250, 1820, 1700, 2080).intersection(land).difference(dock_band)
    fish = Polygon([(300, 900), (1500, 1150), (1550, 1820), (250, 1820)]).intersection(land)
    coast_strip = land.intersection(ctx['sea'].buffer(110))
    rest = land.difference(dock_band).difference(ind).difference(fish).difference(coast_strip)
    both(L, halls(grid_blocks(dock_band, angle=-6, bw=120, bh=70, street=16, keep=0.3), seed=31))
    both(L, halls(grid_blocks(ind, angle=-6, bw=130, bh=90, street=18), seed=32, fill=0.85))
    vf = voronoi_blocks(fish, cell=44, street=7, seed=33)
    vr = voronoi_blocks(rest, cell=58, street=9, seed=35)
    L['blocks'] += vf + vr
    L['built'] += lots(vf, size=16, seed=34) + lots(vr, size=20, seed=36)
    L['beach'] = polys(coast_strip)
    # Muelles (espigones) hacia la ría y rompeolas con el faro
    piers = []
    for x in range(420, 1800, 150):
        p = affinity.rotate(box(x - 14, 2150, x + 14, 2330), -6, origin=(x, 2150))
        piers.append(p.intersection(water.buffer(30)))
    L['special'] += [p for p in piers if not p.is_empty]
    L['special'].append(LineString([(260, 2120), (380, 2210), (470, 2300)]).buffer(11))
    return L


def B4(land, ctx):
    L = empty()
    water = ctx['water']
    docks = []
    for x in range(860, 1820, 190):
        d = affinity.rotate(box(x, 2380, x + 46, 2700), 4, origin=(x, 2380)).intersection(RECT)
        docks.append(d)
    docks_u = unary_union(docks)
    yard = box(700, 2380, 1950, 2780).intersection(land).difference(docks_u.buffer(14))
    ind = box(200, 2750, 1950, 3150).intersection(land)
    graves = box(150, 2950, 560, 3700).intersection(land)
    colonia = Polygon([(650, 3250), (1350, 3250), (1250, 3760), (650, 3820)]).intersection(land)
    scrap = LineString([(2173, 2915), (1159, 3839), (0, 4573)]).buffer(30).intersection(land)
    coast_strip = land.intersection(ctx['sea'].buffer(90))
    rest = land.difference(yard).difference(ind).difference(graves).difference(colonia).difference(scrap).difference(coast_strip).difference(docks_u)
    L['water'] += [d.intersection(land.buffer(5)) for d in docks]
    both(L, halls(grid_blocks(yard, angle=4, bw=140, bh=80, street=18, keep=0.25), seed=41))
    both(L, halls(grid_blocks(ind, angle=4, bw=150, bh=100, street=20), seed=42, fill=0.8))
    both(L, grid_blocks(colonia, angle=4, bw=58, bh=40, street=10))
    vr = voronoi_blocks(rest, cell=70, street=10, seed=43)
    L['blocks'] += vr
    L['built'] += lots(vr, size=24, seed=44)
    hulls = []
    for i, (x, y, r) in enumerate([(260, 3020, 30), (330, 3160, -20), (250, 3330, 15), (380, 3470, 40), (290, 3610, -10)]):
        hulls.append(affinity.rotate(Point(x, y).buffer(1).buffer(0).union(Point(x, y).buffer(1)), 0))
        e = affinity.scale(Point(x, y).buffer(30), 2.4, 0.6)
        hulls.append(affinity.rotate(e, r, origin=(x, y)))
    L['special'] += [h for h in hulls if h.area > 50] + polys(scrap)
    L['beach'] = polys(coast_strip)
    L['slag'] = polys(scrap)
    return L


def B5(land, ctx):
    L = empty()
    slag = Polygon([(0, 4600), (520, 4640), (700, 5000), (0, 5000)]).intersection(land)
    frig = box(1880, 4470, 2260, 4800).intersection(land)
    yard = box(1400, 4230, 2320, 4420).intersection(land)
    camp = box(650, 4120, 1000, 4320).intersection(land)
    rest = land.difference(slag).difference(frig).difference(yard).difference(camp)
    g = grid_blocks(rest, angle=22, bw=210, bh=150, street=24, keep=0.3)
    furn = [Point(1500, 4050).buffer(42), Point(1750, 3800).buffer(42)]
    towers = [Point(800, 4450).buffer(70), Point(1000, 4620).buffer(70)]
    stacks = [Point(1950, 4050).buffer(14), Point(1620, 3930).buffer(10)]
    sp = unary_union(furn + towers + stacks).buffer(18)
    L['built'] += halls(cut(g, sp), seed=51, fill=0.8)
    L['special'] += furn + towers + stacks + [frig]
    L['built'] += scatter_houses(camp, 14, size=(8, 14), seed=52)
    L['slag'] = polys(slag)
    for k in range(6):
        y = 4250 + k * 28
        L['rail'].append(LineString([(1400, y), (2320, y + 30)]))
    L['rail'].append(LineString([(1400, 4300), (900, 3900), (500, 3700)]))
    return L


def B6(land, ctx):
    L = empty()
    park = Polygon([(2480, 3000), (3150, 3000), (3700, 3620), (3820, 4000), (3300, 4380), (2420, 4420), (2330, 3800)]).intersection(land)
    verde = Polygon([(3250, 4380), (3820, 4000), (4150, 4460), (4621, 5000), (3200, 5000)]).intersection(land)
    lake = affinity.scale(Point(2860, 4110).buffer(100), 1.8, 1.0)
    green_house = affinity.rotate(box(3060, 3700, 3220, 3780), -10, origin=(3140, 3740))
    rest = land.difference(park).difference(verde)
    L['green'] += polys(park.difference(lake))
    L['water'] += [lake]
    L['special'] += [green_house, box(2960, 3360, 2990, 3390)]
    L['path'] += curvy_paths(park.difference(lake), 9, seed=61)
    vb = grid_blocks(verde, angle=0, bw=88, bh=88, street=14)
    L['blocks'] += vb
    L['built'] += lots(vb, size=24, seed=62)
    L['green'] += polys(verde)  # el barrio invadido: manzanas sobre verde
    vr = voronoi_blocks(rest, cell=60, street=9, seed=63)
    L['blocks'] += vr
    L['built'] += lots(vr, size=22, seed=64)
    return L


def B7(land, ctx):
    L = empty()
    c = (4750, 4150)
    plaza = Point(c).buffer(70)
    radials = unary_union([avenue([c, (c[0] + math.cos(a) * 1100, c[1] + math.sin(a) * 1100)], 26) for a in [i * math.pi / 4 + 0.2 for i in range(8)]])
    rings = unary_union([Point(c).buffer(r + 11).difference(Point(c).buffer(r - 11)) for r in (230, 520)])
    stadium = affinity.scale(Point(5450, 4600).buffer(100), 1.6, 1.15)
    rest = land.difference(plaza).difference(stadium.buffer(30))
    g = grid_blocks(rest, angle=12, bw=96, bh=96, street=16, ch=10, origin=c)
    g = cut(g, unary_union([radials, rings]))
    L['built'] += patios(g, 18)
    L['plaza'] = [plaza]
    L['special'] += [stadium, affinity.rotate(box(4705, 3980, 4795, 4080), 12, origin=c), Point(4300, 3600).buffer(16)]
    return L


def B8(land, ctx):
    L = empty()
    L['built'] += voronoi_blocks(land, cell=32, street=5, seed=81)
    L['viaduct'] += [LineString([(3950, 2700), (5100, 3150), (6000, 3450)]), LineString([(4300, 2300), (5000, 3050), (5800, 3900)])]
    return L


def B9(land, ctx):
    L = empty()
    monte = Polygon([(5050, 0), (6000, 0), (6000, 1150), (5600, 1050), (5300, 700)]).intersection(land)
    palace = box(4560, 1330, 4840, 1480)
    gardens = box(4500, 1260, 4900, 1640).intersection(land)
    rest = land.difference(monte).difference(gardens)
    v = voronoi_blocks(rest, cell=88, street=12, seed=91)
    houses = []
    for i, b in enumerate(v):
        houses += scatter_houses(b.buffer(-6), 2 if b.area > 3500 else 1, size=(16, 30), seed=900 + i)
    L['built'] += houses
    L['green'] += polys(monte) + polys(gardens) + [b for b in v]
    L['special'] += [palace, Point(5250, 800).buffer(32), box(4960, 1060, 5040, 1120)]
    L['rail'] += [LineString([(4950, 1900), (5450, 600)])]
    L['path'] += curvy_paths(monte, 5, seed=92, width=4)
    return L


def B10(land, ctx):
    L = empty()
    cx, cy = 3000, 2210
    fort = affinity.scale(star_fort(cx, cy, 560, n=8, bastion=0.22, rot=0.2), 1.35, 1.0, origin=(cx, cy))
    inner = fort.buffer(-40)
    tower = Point(cx, cy).buffer(42)
    parade = box(2600, 2030, 2860, 2330)
    heli = Point(3520, 2470).buffer(45)
    rest = inner.difference(tower.buffer(40)).difference(parade).difference(heli.buffer(15))
    g = grid_blocks(rest, angle=0, bw=84, bh=84, street=14, origin=(cx, cy))
    L['built'] += g
    L['plaza'] += [parade, heli]
    L['special'] += [tower]
    L['wall'] += [fort.exterior]
    outside = land.difference(fort.buffer(25))
    L['green'] += polys(outside)
    return L


FAB = {'B1': B1, 'B2': B2, 'B3': B3, 'B4': B4, 'B5': B5, 'B6': B6, 'B7': B7, 'B8': B8, 'B9': B9, 'B10': B10}


def bridges(c, water):
    """Puentes levadizos de la isla: del borde de la isla a la orilla de enfrente."""
    out = {}
    for name, ang in [('B1', 78), ('B2', 128), ('B4', 198), ('B6', 262), ('B7', 300)]:
        a = math.radians(ang)
        far = (c.cx + math.cos(a) * 2500, c.cy - math.sin(a) * 2500)
        ray = LineString([(c.cx, c.cy), far])
        p0 = ray.intersection(c.island.exterior)
        if p0.geom_type == 'MultiPoint':
            p0 = list(p0.geoms)[0]
        seg = ray.intersection(water)
        segs = [g for g in (seg.geoms if hasattr(seg, 'geoms') else [seg]) if g.distance(p0) < 5]
        if not segs:
            continue
        s = segs[0]
        out[name] = [list(s.coords)[0], list(s.coords)[-1]]
    return out


def build():
    c, P = build_geo()
    wat = build_water(c)
    ctx = {'water': wat['water'], 'sea': wat['sea'], 'city': c}
    out = {}
    for bid, poly in P.items():
        land = poly.difference(wat['water'])
        layers = FAB[bid](land, ctx)
        out[bid] = {'poly': poly, 'land': land, 'layers': layers}
    return c, P, wat, out, bridges(c, wat['water'])


if __name__ == '__main__':
    c, P, wat, out, br = build()
    for k, v in out.items():
        n = {kk: len(vv) for kk, vv in v['layers'].items() if vv}
        print(k, 'land', round(v['land'].area / 1e6, 3), 'water', round((v['poly'].area - v['land'].area) / 1e6, 3), n)
    print('bridges', {k: [[round(x) for x in p] for p in v] for k, v in br.items()})
