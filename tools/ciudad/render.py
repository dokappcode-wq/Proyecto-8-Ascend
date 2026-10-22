"""Dibujo SVG estilo mapa de juego: tierra oscura, calles claras por jerarquía,
autopistas en ámbar, edificios sombreados por altura y agua profunda."""
import math
from shapely.geometry import box, Polygon, LineString, Point
from shapely.ops import unary_union
from shapely.strtree import STRtree
from fabric import polys, lines, road_area, ROAD_W

PAL = {
    'void': '#070a0f', 'ocean': '#0c2033', 'shore': '#18405f', 'wild': '#1a1f1c', 'wildline': '#283028',
    'asphalt': '#1b2027', 'block': '#262c34', 'b_lo': '#343b45', 'b_hi': '#a3afc2', 'park': '#22402b', 'forest': '#1b3424',
    'water': '#123754', 'beach': '#6a6043', 'plaza': '#39404a', 'yard': '#2b2f36', 'pool': '#41aee0',
    'hwy': '#e2b552', 'hwy_case': '#5e4818', 'ave': '#c5ccd5', 'st': '#7c8592', 'alley': '#4f5763', 'path': '#5b7a5f',
    'rail': '#8d96a3', 'elev': '#c9d0d9', 'barrier': '#ffb547',
}
KIND_COL = {'container': None, 'crane': '#c96a3a', 'tank': '#8a8f96', 'chimney': '#a0a4aa', 'torre': '#ffb547', 'prison': '#5a5f66',
            'stadium': '#4b5563', 'glass': '#6fb6c9', 'letters': '#f1efe7', 'wheel': '#e9c46a', 'coaster': '#c95f5f',
            'lighthouse': '#e8e2d0', 'fountain': '#5aa7d6', 'antenna': '#c0c5cc', 'pier': '#5a5348'}
CONT = ['#b5544a', '#3e7cb1', '#c9a24a', '#5f8f5a', '#8a5aa0', '#c7c7c7']


def hcol(h):
    t = max(0.0, min(1.0, (max(h, 0) / 240) ** 0.55))
    a = [int(PAL['b_lo'][i:i + 2], 16) for i in (1, 3, 5)]
    b = [int(PAL['b_hi'][i:i + 2], 16) for i in (1, 3, 5)]
    return '#' + ''.join(f'{round(a[i] + (b[i] - a[i]) * t):02x}' for i in range(3))


def ring_d(coords, k, prec=1):
    pts = [(round(x * k, prec), round(y * k, prec)) for x, y in coords]
    if prec == 0:
        pts = [(int(x), int(y)) for x, y in pts]
    s = [f'M{pts[0][0]:g} {pts[0][1]:g}']
    px, py = pts[0]
    for x, y in pts[1:-1]:
        dx, dy = round(x - px, prec), round(y - py, prec)
        s.append(f'l{dx:g} {dy:g}')
        px, py = x, y
    return ''.join(s) + 'z'


def poly_d(g, k, prec=1):
    out = []
    for p in polys(g):
        out.append(ring_d(p.exterior.coords, k, prec))
        for i in p.interiors:
            out.append(ring_d(i.coords, k, prec))
    return ''.join(out)


def line_d(g, k, prec=1):
    out = []
    for l in lines(g):
        pts = [(round(x * k, prec), round(y * k, prec)) for x, y in l.coords]
        s = f'M{pts[0][0]:g} {pts[0][1]:g}'
        px, py = pts[0]
        for x, y in pts[1:]:
            s += f'l{round(x - px, prec):g} {round(y - py, prec):g}'
            px, py = x, y
        out.append(s)
    return ''.join(out)


def P(geoms, k, fill, extra='', prec=1):
    d = ''.join(poly_d(g, k, prec) for g in geoms if g is not None and not g.is_empty)
    return f'<path d="{d}" fill="{fill}" fill-rule="evenodd"{extra}/>' if d else ''


def L(geoms, k, stroke, w, extra='', prec=1):
    d = ''.join(line_d(g, k, prec) for g in geoms if g is not None and not g.is_empty)
    return f'<path d="{d}" fill="none" stroke="{stroke}" stroke-width="{w:.2f}" stroke-linejoin="round" stroke-linecap="round"{extra}/>' if d else ''


def clip(geoms, view):
    out = []
    for g in geoms:
        if g is None or g.is_empty or not g.intersects(view):
            continue
        out.append(g if view.contains(g) else g.intersection(view))
    return out


def wild_contours(g, view):
    """Curvas de nivel en la tierra fuera de la ciudad (sierra)."""
    out = []
    playable = unary_union([D['poly'] for D in g['D'].values()])
    wild = unary_union([g['westland'], g['eastland']]).difference(playable.buffer(5))
    for c, rs in [((-300, -400), [500, 1000, 1500, 2000, 2500, 3000]), ((8600, 1500), [600, 1200, 1800, 2400, 3000, 3600]),
                  ((8900, 4300), [500, 1000, 1500, 2000]), ((-600, 3200), [600, 1200, 1800])]:
        for r in rs:
            ring = Point(c).buffer(r, quad_segs=24).exterior
            pts = []
            for i, (x, y) in enumerate(ring.coords):
                a = math.atan2(y - c[1], x - c[0])
                w = 1 + 0.06 * math.sin(5 * a + r / 300) + 0.03 * math.sin(11 * a)
                pts.append((c[0] + (x - c[0]) * w, c[1] + (y - c[1]) * w))
            out.append(LineString(pts).intersection(wild).intersection(view))
    return out


def district_layers(D, k, view, detail, roads_all):
    """Capas de un barrio: base de asfalto, manzanas, zonas, edificios."""
    out = []
    poly = D['poly']
    out.append(P(clip([poly], view), k, PAL['asphalt']))
    blocks = D.get('_blocks')
    if blocks is None:
        A0 = D['areas']
        holes = unary_union([road_area(D['roads'] + roads_all)] + [g_ for key in ('park', 'forest', 'water', 'beach', 'plaza', 'yard') for g_ in A0[key]])
        blocks = [b for b in polys(poly.difference(holes)) if b.area > 200]
        D['_blocks'] = blocks
    out.append(P(clip(blocks, view), k, PAL['block']))
    A = D['areas']
    out.append(P(clip(A['beach'], view), k, PAL['beach']))
    out.append(P(clip(A['yard'], view), k, PAL['yard']))
    out.append(P(clip(A['plaza'], view), k, PAL['plaza']))
    out.append(P(clip(A['park'], view), k, PAL['park']))
    out.append(P(clip(A['forest'], view), k, PAL['forest']))
    out.append(P(clip(A['water'], view), k, PAL['water']))
    out.append(P(clip(A['pool'], view), k, PAL['pool']))
    if detail:
        # Edificios agrupados por color (altura) para que el SVG sea ligero
        groups = {}
        for fp, h, kind in D['bld']:
            if not fp.intersects(view):
                continue
            if kind == 'container':
                col = CONT[int(abs(fp.centroid.x * 7 + fp.centroid.y * 3)) % len(CONT)]
            elif kind in KIND_COL and KIND_COL[kind]:
                col = KIND_COL[kind]
            else:
                col = hcol(h)
            groups.setdefault(col, []).append(fp)
        for col, gs in groups.items():
            out.append(P(gs, k, col, prec=1))
    else:
        # Plano general: manzanas sombreadas por la altura media de sus edificios
        tree = STRtree([b for b, h, kd in D['bld']])
        hs = [h for b, h, kd in D['bld']]
        groups = {}
        for b in clip(blocks, view):
            idx = tree.query(b)
            vals = [hs[i] for i in idx]
            hm = (sum(vals) / len(vals)) if vals else 0
            col = hcol(hm) if vals else PAL['block']
            groups.setdefault(col, []).append(b)
        for col, gs in groups.items():
            out.append(P(gs, k, col, prec=0))
        special = [(fp, kind) for fp, h, kind in D['bld'] if kind in KIND_COL and KIND_COL[kind] and kind not in ('container',)]
        for fp, kind in special:
            out.append(P(clip([fp], view), k, KIND_COL[kind], prec=1))
    return ''.join(out)


def road_layers(roads, k, view, detail):
    by = {}
    for l, c in roads:
        if not detail and c in ('alley', 'path'):
            continue
        by.setdefault(c, []).append(l)
    out = []
    scale = k if detail else k * 1.6
    for c in ('path', 'alley', 'st', 'ave'):
        if c in by:
            w = max(0.5, ROAD_W[c] * scale * (0.55 if c in ('st', 'alley') else 0.7))
            if not detail and c == 'st':
                w = max(0.45, 0.6 * w)
            dash = ' stroke-dasharray="2 2"' if c == 'path' else ''
            out.append(L(clip(by[c], view), k, PAL[c], w, dash))
    if 'hwy' in by:
        w = max(1.6, ROAD_W['hwy'] * scale * 0.85)
        out.append(L(clip(by['hwy'], view), k, PAL['hwy_case'], w + 1.4))
        out.append(L(clip(by['hwy'], view), k, PAL['hwy'], w))
    return ''.join(out)


def base_map(g, view, k, detail=False, focus=None):
    parts = []
    parts.append(P([box(*view.bounds)], k, PAL['ocean']))
    land = unary_union([g['westland'], g['eastland'], g['island'], g['roca']]).intersection(view)
    parts.append(P([land.buffer(28).difference(land)], k, PAL['shore'], ' opacity="0.55"'))
    parts.append(P([land], k, PAL['wild']))
    parts.append(L(wild_contours(g, view), k, PAL['wildline'], max(0.6, 3 * k)))
    roads_all = [(l, c) for l, c, n in g['groads']]
    for key, D in g['D'].items():
        if not D['poly'].intersects(view):
            continue
        dim = focus is not None and key != focus
        layer = district_layers(D, k, view, detail and not dim, roads_all)
        parts.append(f'<g opacity="{0.45 if dim else 1}">{layer}</g>')
    # Vías de tren y calles
    rails = [r for D in g['D'].values() for r in D['rail']]
    parts.append(L(clip(rails, view), k, PAL['rail'], max(0.5, 3 * k), f' stroke-dasharray="{max(1.5, 10 * k):.1f} {max(1, 6 * k):.1f}"'))
    allroads = []
    for key, D in g['D'].items():
        if focus is not None and key != focus and not detail:
            pass
        allroads += D['roads'] if (detail and (focus is None or key == focus)) else [(l, c) for l, c in D['roads'] if c not in ('alley', 'path')]
    parts.append(road_layers(allroads + roads_all, k, view, detail))
    # Puentes
    for name, l, c, a, b in g['bridges']:
        if not l.intersects(view):
            continue
        if c == 'tunnel':
            parts.append(L([l], k, PAL['ave'], max(1, 10 * k), f' stroke-dasharray="{max(2, 25 * k):.1f} {max(2, 18 * k):.1f}" opacity="0.7"'))
            continue
        w = max(2.4, 44 * k)
        parts.append(L([l], k, '#05080c', w + 2.6))
        parts.append(L([l], k, PAL['hwy'], w))
        parts.append(L([l], k, '#fff3cf', max(0.6, w * 0.18)))
    # Tren elevado
    parts.append(L(clip(g['elevated'], view), k, '#0b0f15', max(2.2, 16 * k)))
    parts.append(L(clip(g['elevated'], view), k, PAL['elev'], max(1, 7 * k), f' stroke-dasharray="{max(2, 24 * k):.1f} {max(1.2, 10 * k):.1f}"'))
    return ''.join(parts)
