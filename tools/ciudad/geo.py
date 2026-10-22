"""Geografía de la ciudad (v2), al estilo de las ciudades de mundo abierto
(Manhattan en Spider-Man, Liberty City en GTA IV, Gotham en Arkham Knight,
Pacific City en Crackdown): tres masas de tierra unidas por puentes.

- La Isla (15 km²): alargada como Manhattan. De norte a sur: Los Bloques, el
  Parque Central, Midtown, el Barrio Chino y el Centro en la punta, con La
  Roca (isla prisión) en la bahía.
- La Península (9 km²), al oeste de la ría: las Colinas al norte (se unen con
  la sierra), la Costa con la playa frente al océano y el Puerto frente a la isla.
- La Orilla Este (6 km²), al otro lado del río: el Distrito Cero y la Zona
  Industrial, cerrados al este por la sierra (por donde llega Jon).

Coordenadas en metros: x hacia el este, y hacia el sur. Se resuelven los
parámetros de forma para que cada barrio mida exactamente 3,00 km².
"""
import math
from shapely.geometry import Polygon, LineString, Point, box
from shapely.ops import unary_union
from shapely import affinity

TARGET = 3_000_000.0
FRAME = (-600.0, -900.0, 9000.0, 8000.0)
Y0 = 300.0


def polys(g):
    if g.is_empty:
        return []
    if g.geom_type == 'Polygon':
        return [g]
    return [p for x in getattr(g, 'geoms', []) for p in polys(x)]


def smooth(p, r=50):
    return p.buffer(r, quad_segs=10).buffer(-2 * r, quad_segs=10).buffer(r, quad_segs=10)


def bis(f, lo, hi, it=46):
    flo = f(lo)
    for _ in range(it):
        m = (lo + hi) / 2
        fm = f(m)
        if (fm > 0) == (flo > 0):
            lo, flo = m, fm
        else:
            hi = m
    return (lo + hi) / 2


def wob(t, seeds):
    return sum(a * math.sin(f * t + p) for a, f, p in seeds)


# --- La Isla -------------------------------------------------------------
def axis_x(y):
    return 4700 + 230 * math.sin((y - 3300) / 2300) - 0.07 * (y - 3300)


def half_w(y, y0, y1):
    if y <= y0 or y >= y1:
        return 0.0
    w = 1260 + 120 * math.sin(y / 950 + 0.7) + 55 * math.sin(y / 310)
    tn = min(1.0, (y - y0) / 600) ** 0.5
    ts = min(1.0, (y1 - y) / 1500)
    ts = math.sin(ts * math.pi / 2) ** 0.85
    return w * tn * ts


def island(y0, y1):
    ys = [y0 + (y1 - y0) * i / 400 for i in range(401)]
    west = [(axis_x(y) - half_w(y, y0, y1), y) for y in ys]
    east = [(axis_x(y) + half_w(y, y0, y1), y) for y in ys]
    return smooth(Polygon(west + east[::-1]).buffer(0), 30)


def roca(y1):
    c = (axis_x(y1) - 200, y1 + 650)
    e = affinity.scale(Point(c).buffer(1, quad_segs=32), 290, 150)
    return affinity.rotate(e, 18, origin=c)


# --- Agua entre tierras ---------------------------------------------------
def ria_shore(y, y0, y1):
    """Orilla oeste de la ría (la península y la tierra firme del noroeste)."""
    return axis_x(y) - max(half_w(y, y0, y1), 300) - (720 + 130 * math.sin(y / 1000 + 0.4))


def rio_shore(y, y0, y1):
    """Orilla este del río."""
    return axis_x(y) + max(half_w(y, y0, y1), 300) + (330 + 45 * math.sin(y / 480))


# --- La Península (oeste) --------------------------------------------------
def westland(y0, y1, cw):
    """Tierra firme al oeste: península entre la ría y el océano unida por el
    noroeste a la sierra. `cw` desplaza la costa del océano."""
    ys = [FRAME[1] + i * 40 for i in range(int((5200 - FRAME[1]) / 40) + 1)]
    east = [(ria_shore(y, y0, y1), y) for y in ys]
    # Costa del océano: al norte se aleja (la sierra), al sur se curva hacia la ría
    west = []
    for y in ys[::-1]:
        base = 2200 - cw + wob(y, [(150, 1 / 520, 0.3), (70, 1 / 190, 1.7), (25, 1 / 70, 0.2)])
        if y < 1600:   # al norte la tierra se ensancha hacia el oeste (sierra)
            base -= (1600 - y) * 1.6
        west.append((base, y))
    # Punta sur redondeada (playa en media luna)
    sx, sy = east[-1]
    tip = [(sx - 150, 5450), (sx - 600, 5720), (sx - 1150, 5820), (sx - 1700, 5720), (west[0][0] + 80, 5400)]
    poly = Polygon([(FRAME[0], FRAME[1])] + east + tip + west + [(FRAME[0], ys[0])]).buffer(0)
    return smooth(poly, 45)


# --- Orilla Este -----------------------------------------------------------
def eastland(y0, y1):
    ys = [FRAME[1] + i * 40 for i in range(int((4700 - FRAME[1]) / 40) + 1)]
    west = [(rio_shore(y, y0, y1), y) for y in ys]
    sx, sy = west[-1]
    coast = [(sx + 150, 5000), (sx + 500, 5250), (sx + 1100, 5380), (sx + 1800, 5400), (FRAME[2], 5420)]
    poly = Polygon(west + coast + [(FRAME[2], FRAME[1])]).buffer(0)
    return smooth(poly, 45)


def limit_line(pts, side_poly_pts):
    return Polygon(side_poly_pts).buffer(0)


def solve():
    ra = roca(7000).area
    y1 = bis(lambda y: island(Y0, y).area - (15e6 - ra), 5000, 9000)
    isl = island(Y0, y1)
    # Península: jugable al sur de la línea de la sierra (cuello noroeste)
    north_limit = lambda yn: Polygon([(FRAME[0], yn + 600), (3200, yn - 250), (3200, 9000), (FRAME[0], 9000)])

    def pen(cw, yn=900):
        return westland(Y0, y1, cw).intersection(north_limit(yn))
    cw = bis(lambda c: pen(c).area - 9e6, -1500, 2000)
    wl = westland(Y0, y1, cw)
    peninsula = pen(cw)
    # Orilla este: jugable al oeste de la sierra (x_s + ondulación)
    el = eastland(Y0, y1)

    def east_play(xs):
        ys = [FRAME[1] + i * 50 for i in range(int((FRAME[3] - FRAME[1]) / 50) + 1)]
        ridge = [(xs + wob(y, [(220, 1 / 650, 1.1), (90, 1 / 230, 0.4)]) - 0.18 * (y - 2500), y) for y in ys]
        lim = Polygon([(FRAME[0], ys[0])] + ridge + [(FRAME[0], ys[-1])]).buffer(0)
        north = box(FRAME[0], 0, FRAME[2], FRAME[3])
        return el.intersection(lim).intersection(north)
    xs = bis(lambda x: east_play(x).area - 6e6, 5500, 9000)
    return dict(y1=y1, island=isl, westland=wl, eastland=el, west=peninsula, east=east_play(xs), roca=roca(y1), cw=cw, xs=xs)


def side_poly(cx, cy, ang, below=True, L=30000):
    a = math.radians(ang)
    ux, uy = math.cos(a), math.sin(a)
    nx, ny = -uy, ux
    s = 1 if below else -1
    p1 = (cx - ux * L, cy - uy * L)
    p2 = (cx + ux * L, cy + uy * L)
    return Polygon([p1, p2, (p2[0] + s * nx * L, p2[1] + s * ny * L), (p1[0] + s * nx * L, p1[1] + s * ny * L)])


def stack(land, names, targets, xmid, angs, from_south=True, lo=-3000, hi=12000):
    """Parte una tierra en barrios por avenidas rectas."""
    out, lines = {}, {}
    rest = land
    for i, name in enumerate(names):
        if i == len(names) - 1:
            out[name] = rest
            break
        ang = angs[i]
        f = lambda y: rest.intersection(side_poly(xmid, y, ang, below=from_south)).area - targets[i]
        y = bis(f, lo, hi)
        part = rest.intersection(side_poly(xmid, y, ang, below=from_south))
        out[name] = part
        rest = rest.difference(part)
        lines[name] = (xmid, y, ang)
    return out, lines


def build():
    g = solve()
    D = {}
    rk = g['roca']
    parts, li = stack(g['island'], ['centro', 'chino', 'midtown', 'parque', 'bloques'],
                      [TARGET - rk.area, TARGET, TARGET, TARGET, TARGET], axis_x(3300), [-7, -5, -8, -6], True)
    D.update(parts)
    D['centro'] = unary_union([D['centro'], rk])
    # Península: Colinas al norte; el resto se parte por una avenida casi norte-sur:
    # la Costa al oeste (océano) y el Puerto al este (frente a la isla)
    pen = g['west']
    col, lc = stack(pen, ['colinas', 'resto'], [TARGET, 6e6], 1200, [10], False)
    D['colinas'] = col['colinas']
    rest = col['resto']
    # Avenida divisoria inclinada (de noreste a suroeste)
    def split_x(x):
        a = rest.intersection(side_poly(x, 4000, 84, below=False))
        return a
    xs = bis(lambda x: split_x(x).area - TARGET, -2000, 5000)
    D['puerto'] = split_x(xs)
    D['costa'] = rest.difference(D['puerto'])
    parts, le = stack(g['east'], ['cero', 'industrial'], [TARGET] * 2, 7000, [6], False)
    D.update(parts)
    g['districts'] = D
    g['cuts'] = {**li, **lc, **le, 'puerto/costa': (xs, 4000, 84)}
    return g


if __name__ == '__main__':
    g = build()
    print('y1', round(g['y1']), 'cw', round(g['cw']), 'xs', round(g['xs']))
    print('isla', round((g['island'].area + g['roca'].area) / 1e6, 4), 'oeste', round(g['west'].area / 1e6, 4), 'este', round(g['east'].area / 1e6, 4))
    for k, p in g['districts'].items():
        print(f'{k:10s} {p.area / 1e6:.4f} parts={len(polys(p))} bounds={[round(v) for v in p.bounds]}')
    print('total', round(sum(p.area for p in g['districts'].values()) / 1e6, 4))
