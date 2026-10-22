"""Dibujo SVG de la ciudad: plano general y planos de barrio."""
import math
from shapely.geometry import box, Polygon, LineString, Point
from shapely.ops import unary_union

PAL = {
    'void': '#070a10', 'land': '#161e2b', 'built': '#2b3547', 'green': '#1c3324', 'path': '#2e5238',
    'water': '#0e2740', 'sea': '#0b2036', 'plaza': '#243145', 'special': '#3d4a61', 'rail': '#5d6c86',
    'wall': '#c9a46a', 'viaduct': '#7b88a1', 'beach': '#3a3829', 'slag': '#3b2f2a', 'grid': '#1f2a3b',
}

MARKCOL = {
    'B1': '#2f8bff', 'B2': '#e9edf5', 'B3': '#3557ff', 'B4': '#a24dff', 'B5': '#2ee6d6', 'B6': '#5fbf3f',
    'B7': '#d8e83a', 'B8': '#8c86a8', 'B9': '#ff6fa8', 'B10': '#d62839',
}


def mix(c1, c2, t):
    a = [int(c1[i:i + 2], 16) for i in (1, 3, 5)]
    b = [int(c2[i:i + 2], 16) for i in (1, 3, 5)]
    return '#' + ''.join(f'{round(a[i] + (b[i] - a[i]) * t):02x}' for i in range(3))


def ring_d(coords, k):
    pts = [(round(x * k), round(y * k)) for x, y in coords]
    out = []
    px, py = pts[0]
    out.append(f'M{px} {py}')
    for x, y in pts[1:-1]:
        out.append(f'l{x - px} {y - py}')
        px, py = x, y
    return ''.join(out) + 'z'


def poly_d(g, k=1.0):
    if g.is_empty:
        return ''
    if g.geom_type == 'Polygon':
        s = ring_d(g.exterior.coords, k)
        for i in g.interiors:
            s += ring_d(i.coords, k)
        return s
    if hasattr(g, 'geoms'):
        return ''.join(poly_d(x, k) for x in g.geoms)
    return ''


def line_d(g, k=1.0):
    if g.is_empty:
        return ''
    if g.geom_type == 'LineString':
        pts = [(round(x * k), round(y * k)) for x, y in g.coords]
        s = f'M{pts[0][0]} {pts[0][1]}'
        px, py = pts[0]
        for x, y in pts[1:]:
            s += f'l{x - px} {y - py}'
            px, py = x, y
        return s
    if g.geom_type in ('LinearRing',):
        return line_d(LineString(g.coords), k)
    if hasattr(g, 'geoms'):
        return ''.join(line_d(x, k) for x in g.geoms)
    return ''


def layer_path(geoms, k, fill, extra=''):
    d = ''.join(poly_d(g, k) for g in geoms)
    if not d:
        return ''
    return f'<path d="{d}" fill="{fill}" fill-rule="evenodd"{extra}/>'


def layer_lines(geoms, k, stroke, width, extra=''):
    d = ''.join(line_d(g, k) for g in geoms)
    if not d:
        return ''
    return f'<path d="{d}" fill="none" stroke="{stroke}" stroke-width="{width}" stroke-linejoin="round" stroke-linecap="round"{extra}/>'


def clipg(geoms, view):
    out = []
    for g in geoms:
        if not g.intersects(view):
            continue
        out.append(g if view.contains(g) else g.intersection(view))
    return out


def draw_barrio(b, bid, k, view, detail=True, dim=False):
    """Capas de un barrio. k: escala (unidades SVG por metro)."""
    L = b['layers']
    tint = MARKCOL[bid]
    built = L['built'] if (detail or not L['blocks']) else L['blocks']
    bc = mix(PAL['built'], tint, 0.16 if not dim else 0.05)
    sc = mix(PAL['special'], tint, 0.42 if not dim else 0.1)
    out = []
    land = clipg([b['land']], view)
    out.append(layer_path(land, k, PAL['land']))
    out.append(layer_path(clipg(L['beach'], view), k, PAL['beach']))
    out.append(layer_path(clipg(L['slag'], view), k, PAL['slag']))
    out.append(layer_path(clipg(L['green'], view), k, PAL['green']))
    out.append(layer_lines(clipg(L['path'], view), k, PAL['path'], max(0.6, 5 * k)))
    out.append(layer_path(clipg(L['plaza'], view), k, PAL['plaza']))
    out.append(layer_path(clipg(L['water'], view), k, PAL['water']))
    out.append(layer_path(clipg(built, view), k, bc))
    out.append(layer_path(clipg(L['special'], view), k, sc))
    out.append(layer_lines(clipg(L['rail'], view), k, PAL['rail'], max(0.8, 6 * k), f' stroke-dasharray="{max(2, 18 * k):.1f} {max(1.5, 10 * k):.1f}"'))
    out.append(layer_lines(clipg(L['wall'], view), k, PAL['wall'], max(1.2, 12 * k)))
    vi = clipg(L['viaduct'], view)
    out.append(layer_lines(vi, k, '#0b0f17', max(2.4, 34 * k)))
    out.append(layer_lines(vi, k, PAL['viaduct'], max(1.6, 24 * k)))
    g = ''.join(out)
    return f'<g opacity="{0.5 if dim else 1}">{g}</g>'
