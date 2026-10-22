"""Exporta la maqueta 3D (v2): edificios con altura, suelo, agua, puentes,
tren elevado y las barreras de la Defensa."""
import json
import math
import random
from shapely.geometry import Point, LineString, Polygon
from shapely.ops import unary_union
from shapely import affinity
import city
from fabric import polys, lines, road_area
from geo import FRAME

g = city.build()
rnd = random.Random(5)


def flat(coords):
    pts = list(coords)[:-1]
    return [v for xy in pts for v in (round(xy[0], 1), round(xy[1], 1))]


def rings(p):
    return [flat(p.exterior.coords)] + [flat(i.coords) for i in p.interiors if len(i.coords) > 3]


ITEMS = []  # [altura, base, color, material, anillos]


def add(geom, h, col, mat='plain', base=0.0, simp=0.5):
    for q in polys(geom):
        q = q.simplify(simp)
        if q.is_empty or q.area < 4 or len(q.exterior.coords) < 4:
            continue
        ITEMS.append([round(h, 1), round(base, 1), col, mat, rings(q)])


KIND = {
    'tower': (['#9aa4b2', '#8b96a6', '#a8b3c2', '#7f8a99', '#b4bcc8'], 'win'),
    'mid': (['#b69a86', '#a3887a', '#c2a892', '#8f7a6e', '#c9b9a6'], 'win'),
    'walled': (['#9a8f86', '#8a7f78', '#a69a8e'], 'win'),
    'slab': (['#b9a48f', '#a99583'], 'win'),
    'old': (['#a5735a', '#b5846a', '#946652', '#c19a7e'], 'win'),
    'low': (['#e7dfcf', '#d9e4e6', '#efd9c4', '#cfe0d3', '#e9c9b8'], 'plain'),
    'villa': (['#f0ece4', '#e6dfd2'], 'plain'),
    'warehouse': (['#7d8794', '#6f7985', '#8e8a80'], 'plain'),
    'industrial': (['#6e6b66', '#7d7974', '#5f5c58'], 'plain'),
    'special': (['#c9c2b4'], 'plain'), 'glass': (['#7fc7dc'], 'plain'), 'stadium': (['#8c939c'], 'plain'),
    'prison': (['#7a7d82'], 'plain'), 'container': (['#b5544a', '#3e7cb1', '#c9a24a', '#5f8f5a', '#8a5aa0', '#c7c7c7'], 'plain'),
    'crane': (['#c96a3a'], 'plain'), 'tank': (['#c9ccd0'], 'plain'), 'chimney': (['#a7a29c'], 'plain'),
    'torre': (['#3a4458'], 'torre'), 'letters': (['#f5f2ea'], 'plain'), 'wheel': (['#e9c46a'], 'plain'),
    'coaster': (['#c95f5f'], 'plain'), 'lighthouse': (['#f0ece4'], 'plain'), 'fountain': (['#7ab8de'], 'plain'),
    'antenna': (['#c0c5cc'], 'plain'), 'pier': (['#6a6152'], 'plain'),
}

roads_all = [(l, c) for l, c, n in g['groads']]
for key, D in g['D'].items():
    A = D['areas']
    add(D['poly'], 0.5, '#3a3f47')                       # asfalto
    blocks = D.get('_blocks') or [b for b in polys(D['poly'].difference(road_area(D['roads'] + roads_all))) if b.area > 200]
    for b in blocks:
        add(b, 0.8, '#5b5f66', simp=1.0)                  # aceras
    for a in A['park']:
        add(a, 1.0, '#4e7046', simp=1.0)
    for a in A['forest']:
        add(a, 7.0, '#2f5236', simp=1.0)
    for a in A['beach']:
        add(a, 0.9, '#d6c79a', simp=1.0)
    for a in A['plaza'] + A['yard']:
        add(a, 0.95, '#6c7078', simp=1.0)
    for a in A['water'] + A['pool']:
        add(a, 0.3, '#2b6a95')
    for fp, h, kind in D['bld']:
        pal, mat = KIND.get(kind, (['#a0a0a0'], 'plain'))
        col = pal[int(abs(fp.centroid.x * 13 + fp.centroid.y * 7)) % len(pal)]
        if kind == 'tower' and h > 120 and rnd.random() < 0.5:
            col = rnd.choice(['#6f8fa8', '#5d7d96', '#8aa6bb'])
        add(fp, h, col, mat if h > 22 else 'plain')

# Tierra fuera de la ciudad (relieve aparte en el visor)
# Puentes: tablero y torres
for name, l, c, a, b in g['bridges']:
    if c == 'tunnel':
        continue
    add(l.buffer(17, cap_style='flat'), 3, '#8a8f97', base=24)
    L = l.length
    n = max(2, int(L / 70))
    for i in range(1, n):
        p = l.interpolate(i * L / n)
        add(p.buffer(5, cap_style='square'), 24, '#6e737b')
    if name in ('Puente de la Bahía', 'Puente del Este', 'Puente de la Ría'):
        for t in (0.3, 0.7):
            p = l.interpolate(t, normalized=True)
            add(p.buffer(9, cap_style='square'), 150 if name == 'Puente de la Bahía' else 110, '#c0392b' if name == 'Puente de la Bahía' else '#9aa0a8')
# Tren elevado
for l in g['elevated']:
    add(l.buffer(5, cap_style='flat'), 2, '#5a5f66', base=11)

json.dump({'items': ITEMS}, open('maq/city.json', 'w'), separators=(',', ':'))

# Barreras: anillos de cada barrio y la cúpula del Centro
B = []
for key, D in g['D'].items():
    for p in polys(D['poly']):
        r = p.buffer(-8).exterior.simplify(6)
        B.append([v for xy in r.coords for v in (round(xy[0], 1), round(xy[1], 1))])
# Relieve: alturas de la tierra no jugable (sierra) muestreadas en una rejilla
play = unary_union([D['poly'] for D in g['D'].values()])
wild = unary_union([g['westland'], g['eastland']])
x0, y0, x1, y1 = FRAME
step = 100
hm = []
for j in range(int((y1 - y0 + 4000) / step) + 1):
    row = []
    y = y0 - 2000 + j * step
    for i in range(int((x1 - x0 + 4000) / step) + 1):
        x = x0 - 2000 + i * step
        p = Point(x, y)
        if wild.contains(p) and not play.buffer(60).contains(p):
            dd = play.distance(p)
            n = math.sin(x / 600) * math.cos(y / 800) * 0.5 + math.sin(x / 230 + y / 310) * 0.25
            row.append(round(min(1.0, dd / 1800) * (420 + 200 * n) + 6, 1))
        elif x < x0 or x > x1 or y < y0 or y > y1:
            # fuera del marco: sierra al norte y al este, mar al oeste y al sur
            if (y < y0 and x > -200) or x > x1:
                row.append(round(300 + 150 * math.sin(x / 500 + y / 700), 1))
            else:
                row.append(-30)
        else:
            row.append(-30 if not play.contains(p) else 0)
    hm.append(row)
json.dump({'barriers': B, 'hm': hm, 'hm0': [x0 - 2000, y0 - 2000], 'step': step}, open('maq/extra.json', 'w'), separators=(',', ':'))
print(len(ITEMS), 'items', len(B), 'barreras', len(hm), 'x', len(hm[0]))
