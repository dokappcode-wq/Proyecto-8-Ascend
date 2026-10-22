"""Exporta la maqueta 3D: polígonos con altura y color por barrio."""
import json
import math
from shapely.geometry import Point, LineString
from city import build
from render import MARKCOL, mix
from fabric import polys

c, P, wat, out, br = build()


def hh(p, lo, hi):
    """Altura pseudoaleatoria estable según la posición."""
    x, y = p.centroid.x, p.centroid.y
    t = (math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1
    return lo + (hi - lo) * t


def flat(coords):
    pts = list(coords)[:-1]
    return [v for xy in pts for v in (round(xy[0], 1), round(xy[1], 1))]


def ring(p):
    return [flat(p.exterior.coords)] + [flat(i.coords) for i in p.interiors if len(i.coords) > 3]


ITEMS = []  # [h, base, colorHex, flat ring]


def add(p, h, col, base=0.0):
    for q in polys(p):
        q = q.simplify(0.8)
        if q.is_empty or q.area < 6 or len(q.exterior.coords) < 4:
            continue
        ITEMS.append([round(h, 1), round(base, 1), col, ring(q)])


PALS = {
    'B1': ['#b9ab97', '#a99a86', '#c4b6a0', '#9d8f7d', '#b3a48c'],
    'B2': ['#c79a6b', '#b8865a', '#d0a87a', '#a97b55', '#c2926a', '#e0c7a0'],
    'B3': ['#d9d2c3', '#5f8fb0', '#c66a4f', '#e2c26b', '#7fa37a', '#d9d2c3', '#cfc6b4'],
    'B4': ['#7d8894', '#6c7682', '#8e98a3', '#5e6873', '#9a8a7a'],
    'B5': ['#6e5a4c', '#5d4c41', '#7a6556', '#4f4640', '#86705d'],
    'B6': ['#8a937a', '#7d8a6c', '#96a07f', '#6f7b5f'],
    'B7': ['#d8cfbe', '#cbc0aa', '#e3dbca', '#bfb39b'],
    'B8': ['#6b6560', '#77706a', '#5d5853', '#837a70', '#6f6a74'],
    'B9': ['#e6e1d6', '#ddd6c8', '#efeae0', '#d3c9b8'],
    'B10': ['#5f6470', '#585d68', '#6a6f7b'],
}


def pick(bid, g):
    x, y = g.centroid.x, g.centroid.y
    t = (math.sin(x * 3.1 + y * 7.7) * 9871.13) % 1
    pal = PALS[bid]
    return mix(pal[int(t * len(pal)) % len(pal)], MARKCOL[bid], 0.1)


BUILT_H = {'B1': (18, 30), 'B2': (6, 12), 'B3': (6, 11), 'B4': (8, 14), 'B5': (12, 24), 'B6': (5, 10),
           'B7': (18, 28), 'B8': (6, 18), 'B9': (8, 13), 'B10': (12, 18)}
core = Point(2400, 1030).buffer(370)

for bid, b in out.items():
    L = b['layers']
    tint = MARKCOL[bid]
    bcol = mix('#8d96a6', tint, 0.22)
    add(b['land'], 0.6, '#4a4f58', 0)
    for g in L['green']:
        add(g, 0.9, '#4d6b42', 0)
    for g in L['plaza'] + L['beach']:
        add(g, 0.8, '#5a5a52' if g in L['beach'] else '#596273', 0)
    for g in L['slag']:
        add(g, 22 if bid == 'B4' else 26, '#4a3f38' if bid == 'B5' else '#5b4a52', 0)
    lo, hi = BUILT_H[bid]
    for g in L['built']:
        h = hh(g, lo, hi)
        if bid == 'B2' and core.contains(g.centroid):
            h = hh(g, 14, 22)
        if bid in ('B3', 'B4') and g.area > 1500:
            h = hh(g, 12, 24)
        if bid == 'B2' and g.area < 400 and Point(700, 330).distance(g.centroid) < 160:
            h = 2.5
        add(g, h, pick(bid, g))
    for g in L['special']:
        a = g.area
        h = 14
        if bid == 'B5':
            h = 60 if 4000 < a < 7000 else 70 if a > 12000 and a < 20000 else 90 if a < 700 and a > 500 else 72 if a < 400 else 18
        elif bid == 'B10':
            h = 180
        elif bid == 'B7':
            h = 110 if a < 1000 else 26
        elif bid == 'B9':
            h = 22 if a > 30000 else 45 if a > 3000 else 14
        elif bid == 'B6':
            h = 30 if a < 1000 else 14
        elif bid == 'B1':
            h = 12
        elif bid == 'B2':
            h = 30
        elif bid == 'B3':
            h = 3
        elif bid == 'B4':
            h = 9 if a < 9000 else 25
        if bid == 'B4' and g.area < 9000 and g.area > 1000:
            add(g, h, '#7a5646')
        else:
            add(g, h, mix('#b4bac4', tint, 0.18))
    for g in L['water']:
        add(g, 0.3, '#2b5a80', 0)

# Hitos sueltos
extra = [
    (Point(3520, 540).buffer(22, cap_style=3), 48, '#9aa6bb'),       # Hotel Excelsior
    (Point(2612, 828).buffer(8, cap_style=3), 62, '#c9b28a'),        # Torre de San Telmo
    (Point(470, 2290).buffer(7), 35, '#e9e2d0'),                      # Faro de la Barra
    (Point(5265, 790).buffer(9, cap_style=3), 58, '#d8c9b6'),        # Torre de la basílica
]
for g, h, col in extra:
    add(g, h, col)
# Grúa Roja: dos patas y viga
for x in (1735, 1785):
    add(Point(x, 2610).buffer(4, cap_style=3), 70, '#c0392b')
add(LineString([(1700, 2610), (1830, 2610)]).buffer(5, cap_style=2), 8, '#c0392b', 70)
# Muralla de la Ciudadela (40 m) y del Casco Viejo (12 m)
for g in out['B10']['layers']['wall']:
    add(LineString(g.coords).buffer(13, cap_style=2), 40, '#8f8573')
for g in out['B2']['layers']['wall']:
    add(g.buffer(5, cap_style=2), 12, '#a0927a')
# Viaductos (tablero a 22 m + pilares)
for g in out['B8']['layers']['viaduct']:
    add(g.buffer(12, cap_style=2), 3, '#8790a3', 22)
    L = g.length
    for i in range(int(L // 60) + 1):
        p = g.interpolate(i * 60)
        add(p.buffer(3.5, cap_style=3), 22, '#5d6577')
# Puentes levadizos levantados (tableros inclinados: se dibujan como dos bloques)
for bid, (a, b) in br.items():
    seg = LineString([a, b])
    add(seg.interpolate(0.15, normalized=True).buffer(10, cap_style=3), 26, '#b03a3a')
    add(seg.interpolate(0.85, normalized=True).buffer(10, cap_style=3), 26, '#b03a3a')

json.dump({'items': ITEMS}, open('maq/city.json', 'w'), separators=(',', ':'))
print(len(ITEMS), 'items')
