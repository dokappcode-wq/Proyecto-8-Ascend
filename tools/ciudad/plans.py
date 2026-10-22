"""Planos finales: plano general interactivo y un plano por barrio."""
import math
import json
from shapely.geometry import box, Point, LineString, Polygon
from shapely.ops import unary_union
from shapely import affinity
from city import build
from render import PAL, MARKCOL, mix, layer_path, layer_lines, draw_barrio, clipg, poly_d, line_d
from data import B, MARKS, ORDER, BRIDGE_NAMES, CITY

GOLD = '#f2c45a'
PDC = '#e0605a'


def esc(t):
    return t.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;')


def contours(center, radii, seed=0, sx=1.0, sy=1.0):
    out = []
    for i, r in enumerate(radii):
        pts = []
        for j in range(72):
            a = 2 * math.pi * j / 72
            w = 1 + 0.12 * math.sin(3 * a + seed + i * 0.7) + 0.07 * math.sin(5 * a + seed * 2)
            pts.append((center[0] + math.cos(a) * r * w * sx, center[1] + math.sin(a) * r * w * sy))
        out.append(Polygon(pts).exterior)
    return out


HILLS = [((300, 60), [140, 260, 380, 500], 1, 1.4, 0.8), ((5650, 330), [150, 300, 450, 600, 760], 2, 1.0, 1.1),
         ((3740, 3880), [90, 190, 290], 3, 1.0, 0.9), ((280, 4850), [120, 230, 340], 4, 1.4, 0.8)]


def star(x, y, r, n=5):
    pts = []
    for i in range(n * 2):
        a = -math.pi / 2 + math.pi * i / n
        rr = r if i % 2 == 0 else r * 0.45
        pts.append(f'{x + math.cos(a) * rr:.1f},{y + math.sin(a) * rr:.1f}')
    return ' '.join(pts)


def label(x, y, text, size, fill='#d7dfeb', weight=600, anchor='middle', cls='lbl', extra=''):
    return (f'<text class="{cls}" x="{x:.1f}" y="{y:.1f}" font-size="{size}" font-weight="{weight}" text-anchor="{anchor}" '
            f'fill="{fill}" stroke="#070a10" stroke-width="{size * 0.28:.1f}" paint-order="stroke" stroke-linejoin="round"{extra}>{esc(text)}</text>')


def defs():
    pats = []
    for mid, m in MARKS.items():
        pats.append(f'<pattern id="h-{mid}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">'
                    f'<rect width="6" height="6" fill="#070a10" fill-opacity="0.55"/><rect width="2.4" height="6" fill="{m["color"]}"/></pattern>')
    return '<defs>' + ''.join(pats) + '</defs>'


def gate_marker(x, y, color, num, s):
    return (f'<g class="gate"><rect x="{x - s:.1f}" y="{y - s:.1f}" width="{2 * s:.1f}" height="{2 * s:.1f}" transform="rotate(45 {x:.1f} {y:.1f})" '
            f'fill="{color}" stroke="#070a10" stroke-width="{s * 0.28:.1f}"/>'
            f'<text x="{x:.1f}" y="{y + s * 0.42:.1f}" font-size="{s * 1.15:.1f}" font-weight="700" text-anchor="middle" fill="#070a10">{num}</text></g>')


def lock_marker(x, y, mid, s):
    c = MARKS[mid]['color']
    return (f'<g class="blk"><circle cx="{x:.1f}" cy="{y:.1f}" r="{s:.1f}" fill="url(#h-{mid})" stroke="{c}" stroke-width="{s * 0.2:.1f}"/>'
            f'<rect x="{x - s * 0.36:.1f}" y="{y - s * 0.05:.1f}" width="{s * 0.72:.1f}" height="{s * 0.55:.1f}" rx="{s * 0.08:.1f}" fill="#070a10"/>'
            f'<path d="M{x - s * 0.22:.1f} {y - s * 0.02:.1f}v{-s * 0.2:.1f}a{s * 0.22:.1f} {s * 0.22:.1f} 0 0 1 {s * 0.44:.1f} 0v{s * 0.2:.1f}" fill="none" stroke="#070a10" stroke-width="{s * 0.14:.1f}"/></g>')


def secret_marker(x, y, n, s):
    return (f'<g class="sec"><circle cx="{x:.1f}" cy="{y:.1f}" r="{s:.1f}" fill="{GOLD}" stroke="#070a10" stroke-width="{s * 0.22:.1f}"/>'
            f'<text x="{x:.1f}" y="{y + s * 0.38:.1f}" font-size="{s * 1.1:.1f}" font-weight="700" text-anchor="middle" fill="#1a1406">{n}</text></g>')


def pdc_marker(x, y, s):
    return f'<rect class="pdc" x="{x - s:.1f}" y="{y - s:.1f}" width="{2 * s:.1f}" height="{2 * s:.1f}" fill="{PDC}" stroke="#070a10" stroke-width="{s * 0.3:.1f}"/>'


def phone_marker(x, y, s):
    return (f'<g class="tel"><rect x="{x - s:.1f}" y="{y - s:.1f}" width="{2 * s:.1f}" height="{2 * s:.1f}" rx="{s * 0.35:.1f}" fill="#e6edf6" stroke="#070a10" stroke-width="{s * 0.25:.1f}"/>'
            f'<path d="M{x - s * 0.5:.1f} {y - s * 0.15:.1f}q{s * 0.5:.1f} {-s * 0.55:.1f} {s:.1f} 0l-.01 {s * 0.3:.1f}h{-s * 0.25:.1f}v{-s * 0.12:.1f}h{-s * 0.5:.1f}v{s * 0.12:.1f}h{-s * 0.25:.1f}z" fill="#070a10"/>'
            f'<rect x="{x - s * 0.42:.1f}" y="{y + s * 0.12:.1f}" width="{s * 0.84:.1f}" height="{s * 0.42:.1f}" rx="{s * 0.1:.1f}" fill="#070a10"/></g>')


def route_points():
    pts = [B['B1']['entry']['at'], (3650, 700)]
    for bid in ORDER[:-1]:
        d = B[bid]
        if bid != 'B1' and d['incarnation']:
            pts.append(d['incarnation']['at'])
        pts.append(d['exit']['at'])
    pts.append((3000, 2210))
    return pts


def smooth(pts, k):
    """Curva suave (Catmull-Rom) en unidades del SVG."""
    p = [(x * k, y * k) for x, y in pts]
    d = f'M{p[0][0]:.1f} {p[0][1]:.1f}'
    for i in range(len(p) - 1):
        p0 = p[i - 1] if i > 0 else p[i]
        p1, p2 = p[i], p[i + 1]
        p3 = p[i + 2] if i + 2 < len(p) else p2
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        d += f'C{c1[0]:.1f} {c1[1]:.1f} {c2[0]:.1f} {c2[1]:.1f} {p2[0]:.1f} {p2[1]:.1f}'
    return d


def base_layers(c, wat, out, view, k, focus=None):
    parts = [layer_path([wat['sea'].intersection(view)], k, PAL['sea']),
             layer_path([wat['water'].difference(wat['sea']).intersection(view)], k, PAL['water'])]
    # Oleaje: líneas paralelas a la costa
    for off in (40, 95, 160):
        line = LineString([(x - off, y) for x, y in wat['coast']]).intersection(view)
        parts.append(layer_lines([line], k, '#16314f', max(0.6, 2 * k), ' opacity="0.8"'))
    for bid, b in out.items():
        if focus and bid != focus:
            if not b['poly'].intersects(view):
                continue
            parts.append(draw_barrio(b, bid, k, view, detail=False, dim=True))
        elif not focus:
            parts.append(draw_barrio(b, bid, k, view, detail=False))
    if focus:
        parts.append(draw_barrio(out[focus], focus, k, view, detail=True))
    hill = []
    for cen, radii, seed, sx, sy in HILLS:
        for ring in contours(cen, radii, seed, sx, sy):
            hill.append(ring)
    land_all = unary_union([b['land'] for b in out.values()])
    hl = [h.intersection(land_all).intersection(view) for h in hill]
    parts.append(layer_lines(hl, k, '#8aa17a', max(0.5, 2.2 * k), ' opacity="0.35"'))
    return parts


def bridges_svg(br, k, s, view):
    out = []
    for bid, (a, b) in br.items():
        if not view.intersects(LineString([a, b])):
            continue
        out.append(f'<line class="brg" x1="{a[0] * k:.1f}" y1="{a[1] * k:.1f}" x2="{b[0] * k:.1f}" y2="{b[1] * k:.1f}" stroke="{PDC}" stroke-width="{s:.1f}" stroke-dasharray="{s * 0.9:.1f} {s * 0.5:.1f}"/>')
    return out


def special_bridges(wat):
    """Puente de la Aduana (en pie) y el Transbordador (barquilla parada)."""
    w = wat['water']
    out = {}
    for name, x in (('aduana', 5250), ('transbordador', 900)):
        seg = LineString([(x, 1800), (x, 2900)]).intersection(w)
        segs = list(seg.geoms) if hasattr(seg, 'geoms') else [seg]
        s = max(segs, key=lambda g: g.length)
        out[name] = list(s.coords)
    return out


def overview(c, P, wat, out, br):
    k = 0.2
    view = box(0, 0, 6000, 5000)
    Wv, Hv = 6000 * k, 5000 * k
    pad = 26
    parts = [f'<svg class="map" viewBox="{-pad} {-pad} {Wv + pad * 2} {Hv + pad * 2}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Plano general de la ciudad">',
             defs(), f'<rect x="{-pad}" y="{-pad}" width="{Wv + pad * 2}" height="{Hv + pad * 2}" fill="{PAL["void"]}"/>']
    parts += base_layers(c, wat, out, view, k)
    # Cuadrícula de 1 km con referencias (A–F, 1–5)
    g = ['<g class="lyr-grid">']
    for i in range(7):
        x = i * 1000 * k
        g.append(f'<line x1="{x}" y1="0" x2="{x}" y2="{Hv}" stroke="#c9d4e3" stroke-opacity="0.13" stroke-width="0.8"/>')
    for j in range(6):
        y = j * 1000 * k
        g.append(f'<line x1="0" y1="{y}" x2="{Wv}" y2="{y}" stroke="#c9d4e3" stroke-opacity="0.13" stroke-width="0.8"/>')
    for i, ch in enumerate('ABCDEF'):
        g.append(label((i + 0.5) * 1000 * k, -9, ch, 13, '#95a6bd', 700))
        g.append(label((i + 0.5) * 1000 * k, Hv + 19, ch, 13, '#95a6bd', 700))
    for j in range(5):
        g.append(label(-13, (j + 0.5) * 1000 * k + 4, str(j + 1), 13, '#95a6bd', 700))
        g.append(label(Wv + 13, (j + 0.5) * 1000 * k + 4, str(j + 1), 13, '#95a6bd', 700))
    g.append('</g>')
    parts += g
    # Fronteras y zonas clicables
    zones = ['<g class="zones">']
    for bid in ORDER:
        poly = P[bid]
        col = MARKCOL[bid]
        zones.append(f'<a href="#{bid.lower()}" class="bz" data-b="{bid}" aria-label="{esc(B[bid]["name"])}">'
                     f'<path d="{poly_d(poly, k)}" fill="{col}" fill-opacity="0" stroke="{col}" stroke-width="1.6" stroke-dasharray="6 4"/></a>')
    zones.append('</g>')
    parts += zones
    # Puentes
    sb = special_bridges(wat)
    parts.append('<g class="lyr-bridges">')
    parts += bridges_svg(br, k, 4, view)
    a = sb['aduana']
    parts.append(f'<line x1="{a[0][0] * k:.1f}" y1="{a[0][1] * k:.1f}" x2="{a[-1][0] * k:.1f}" y2="{a[-1][1] * k:.1f}" stroke="#c9d4e3" stroke-width="4"/>')
    t = sb['transbordador']
    parts.append(f'<line x1="{t[0][0] * k:.1f}" y1="{t[0][1] * k:.1f}" x2="{t[-1][0] * k:.1f}" y2="{t[-1][1] * k:.1f}" stroke="#c9d4e3" stroke-width="1.6" stroke-dasharray="3 3"/>')
    parts.append('</g>')
    # Ruta del Destino
    parts.append(f'<g class="lyr-route"><path d="{smooth(route_points(), k)}" fill="none" stroke="{GOLD}" stroke-width="2.4" stroke-dasharray="1 6" stroke-linecap="round"/></g>')
    # Marcadores
    m = ['<g class="lyr-blocked">']
    for bid in ORDER:
        for name, at, req, txt in B[bid]['blocked']:
            m.append(lock_marker(at[0] * k, at[1] * k, req, 5.2))
    m.append('</g><g class="lyr-secrets">')
    for bid in ORDER:
        for i, (name, at, req, txt) in enumerate(B[bid]['secrets']):
            m.append(f'<circle cx="{at[0] * k:.1f}" cy="{at[1] * k:.1f}" r="3.4" fill="{GOLD}" stroke="#070a10" stroke-width="1"/>')
    m.append('</g><g class="lyr-pdc">')
    for bid in ORDER:
        for name, at in B[bid]['posts']:
            m.append(pdc_marker(at[0] * k, at[1] * k, 3.4))
    m.append('</g><g class="lyr-gates">')
    for i, bid in enumerate(ORDER[:-1]):
        e = B[bid]['exit']
        m.append(gate_marker(e['at'][0] * k, e['at'][1] * k, MARKS[B[bid]['mark']]['color'], i + 1, 8.5))
    m.append('</g><g class="lyr-enc">')
    for bid in ORDER:
        inc = B[bid]['incarnation']
        if inc:
            x, y = inc['at']
            m.append(f'<polygon points="{star(x * k, y * k, 9)}" fill="{MARKS[B[bid]["mark"]]["color"]}" stroke="#070a10" stroke-width="1.6"/>')
    m.append('</g>')
    parts += m
    # Rótulos de barrio
    lab = ['<g class="lyr-labels" pointer-events="none">']
    anchors = {'B1': (3900, 330), 'B2': (1350, 250), 'B3': (850, 1180), 'B4': (900, 3150), 'B5': (1250, 4560),
               'B6': (3050, 4420), 'B7': (5050, 4870), 'B8': (5350, 2560), 'B9': (5350, 1650), 'B10': (3000, 2620)}
    for i, bid in enumerate(ORDER):
        x, y = anchors[bid]
        col = MARKS[B[bid]['mark']]['color']
        lab.append(label(x * k, y * k - 12, f'{i + 1}', 15, col, 700))
        lab.append(label(x * k, y * k + 6, B[bid]['name'].upper(), 15, '#e6edf6', 700, extra=' letter-spacing="1.5"'))
        lab.append(label(x * k, y * k + 21, f'Marca: {MARKS[B[bid]["mark"]]["name"]}', 11.5, col, 600))
    lab.append(label(3000 * k, 2090 * k, 'TORRE DEL CONTROL', 9, '#e8a0a8', 700, extra=' letter-spacing="1.2"'))
    lab.append(label(60 * k, 3000 * k, 'MAR', 13, '#4f7aa6', 700, extra=f' letter-spacing="4" transform="rotate(-90 {60 * k} {3000 * k})"'))
    lab.append(label(5650 * k, 2010 * k, 'RÍA', 11, '#4f7aa6', 700, extra=' letter-spacing="3"'))
    lab.append('</g>')
    parts += lab
    # Escala y norte
    parts.append(scale_bar(40, Hv - 22, k, 1000, '1 km'))
    parts.append(north(Wv - 26, 36, 14))
    parts.append('</svg>')
    return ''.join(parts)


def scale_bar(x, y, k, meters, text, fs=10):
    w = meters * k
    return (f'<g class="scale"><rect x="{x - 8}" y="{y - 12 - fs}" width="{w + 16}" height="{22 + fs}" fill="#070a10" fill-opacity="0.75"/>'
            f'<rect x="{x}" y="{y}" width="{w / 2:.1f}" height="4" fill="#e6edf6"/><rect x="{x + w / 2:.1f}" y="{y}" width="{w / 2:.1f}" height="4" fill="#95a6bd"/>'
            + label(x, y - 5, '0', fs, '#c9d4e3', 600, 'start') + label(x + w, y - 5, text, fs, '#c9d4e3', 600, 'end') + '</g>')


def north(x, y, s):
    return (f'<g class="north"><path d="M{x} {y - s}L{x + s * 0.55} {y + s * 0.7}L{x} {y + s * 0.3}L{x - s * 0.55} {y + s * 0.7}Z" fill="#e6edf6"/>'
            + label(x, y + s * 1.8, 'N', 11, '#e6edf6', 700) + '</g>')


def barrio_plan(bid, c, P, wat, out, br):
    d = B[bid]
    poly = P[bid]
    minx, miny, maxx, maxy = poly.bounds
    m = 90
    minx, miny, maxx, maxy = minx - m, miny - m, maxx + m, maxy + m
    view = box(minx, miny, maxx, maxy)
    wm, hm = maxx - minx, maxy - miny
    k = 1000 / wm
    Wv, Hv = 1000, hm * k
    s = 1.0  # tamaño base de marcadores (unidades ≈ px a 1000 de ancho)
    parts = [f'<svg class="plan" viewBox="{minx * k:.1f} {miny * k:.1f} {Wv:.1f} {Hv:.1f}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Plano de {esc(d["name"])}">',
             defs(), f'<rect x="{minx * k:.1f}" y="{miny * k:.1f}" width="{Wv:.1f}" height="{Hv:.1f}" fill="{PAL["void"]}"/>']
    parts += base_layers(c, wat, out, view, k, focus=bid)
    col = MARKS[d['mark']]['color']
    tcol = mix(col, '#ffffff', 0.35)
    parts.append(f'<path d="{poly_d(poly, k)}" fill="none" stroke="{col}" stroke-width="2.4" stroke-dasharray="9 5"/>')
    parts += bridges_svg(br, k, 6, view)
    sb = special_bridges(wat)
    for name, pts in sb.items():
        if view.intersects(LineString(pts)):
            a, b = pts[0], pts[-1]
            dash = '' if name == 'aduana' else ' stroke-dasharray="4 4"'
            parts.append(f'<line x1="{a[0] * k:.1f}" y1="{a[1] * k:.1f}" x2="{b[0] * k:.1f}" y2="{b[1] * k:.1f}" stroke="#c9d4e3" stroke-width="{6 if name == "aduana" else 2.5}"{dash}/>')
    # Marcadores (se separan si se pisan) y rótulos (sin solaparse)
    idx = ORDER.index(bid)
    mk = []  # dict(x, y, r, fixed, draw)
    vx0, vy0, vx1, vy1 = minx * k, miny * k, maxx * k, maxy * k

    def add(x, y, r, fn, fixed=False):
        mk.append({'x': x * k, 'y': y * k, 'ox': x * k, 'oy': y * k, 'r': r, 'fn': fn, 'fixed': fixed})

    gates = []
    if idx > 0:
        prev = ORDER[idx - 1]
        e = B[prev]['exit']
        add(*e['at'], 19, lambda x, y, c=MARKS[B[prev]['mark']]['color'], n=idx: gate_marker(x, y, c, n, 16), True)
        gates.append((e['at'], f'Entrada: {e["name"]}', mix(MARKS[B[prev]['mark']]['color'], '#ffffff', 0.35)))
    else:
        e = d['entry']
        add(*e['at'], 12, lambda x, y: f'<path d="M{x - 12:.1f} {y + 4:.1f}l12 16l12 -16z" fill="{GOLD}" stroke="#070a10" stroke-width="2"/>', True)
        gates.append((e['at'], 'Llegada desde la colina', GOLD))
    if d['exit']:
        e = d['exit']
        add(*e['at'], 19, lambda x, y, n=idx + 1: gate_marker(x, y, col, n, 16), True)
        gates.append((e['at'], f'Salida: {e["name"]} → {B[e["to"]]["name"]}', tcol))
    inc = d['incarnation']
    if inc:
        add(*inc['at'], 19, lambda x, y: f'<polygon points="{star(x, y, 19)}" fill="{col}" stroke="#070a10" stroke-width="2.4"/>', True)
    for name, at in d['posts']:
        add(*at, 9, lambda x, y: pdc_marker(x, y, 7))
    for at in d['phones']:
        add(*at, 11, lambda x, y: phone_marker(x, y, 9))
    for name, at, req, txt in d['blocked']:
        add(*at, 15, lambda x, y, req=req: lock_marker(x, y, req, 14))
    for i, (name, at, req, txt) in enumerate(d['secrets']):
        add(*at, 13, lambda x, y, n=i + 1: secret_marker(x, y, n, 11.5))
    for it in range(120):
        moved = False
        for i in range(len(mk)):
            for j in range(i + 1, len(mk)):
                a_, b_ = mk[i], mk[j]
                dx, dy = b_['x'] - a_['x'], b_['y'] - a_['y']
                dist = math.hypot(dx, dy) or 0.01
                need = a_['r'] + b_['r'] + 2
                if dist < need:
                    push = (need - dist) / 2
                    ux, uy = (dx / dist, dy / dist) if dist > 0.02 else (1, 0)
                    if not a_['fixed'] and not b_['fixed']:
                        a_['x'] -= ux * push; a_['y'] -= uy * push; b_['x'] += ux * push; b_['y'] += uy * push
                    elif a_['fixed'] and not b_['fixed']:
                        b_['x'] += ux * push * 2; b_['y'] += uy * push * 2
                    elif b_['fixed'] and not a_['fixed']:
                        a_['x'] -= ux * push * 2; a_['y'] -= uy * push * 2
                    moved = True
        if not moved:
            break
    for m_ in mk:
        if math.hypot(m_['x'] - m_['ox'], m_['y'] - m_['oy']) > 4:
            parts.append(f'<line x1="{m_["ox"]:.1f}" y1="{m_["oy"]:.1f}" x2="{m_["x"]:.1f}" y2="{m_["y"]:.1f}" stroke="#dfe7f1" stroke-width="1" opacity="0.6"/>')
            parts.append(f'<circle cx="{m_["ox"]:.1f}" cy="{m_["oy"]:.1f}" r="2" fill="#dfe7f1"/>')
    # Rótulos
    placed = [(m_['x'] - m_['r'], m_['y'] - m_['r'], m_['x'] + m_['r'], m_['y'] + m_['r']) for m_ in mk]
    reqs = []
    for at, text, colr in gates:
        reqs.append((at, text, colr, 16, 700, 22))
    if inc:
        reqs.append((inc['at'], f'{inc["name"]} · {inc["role"]}', tcol, 16, 700, 22))
    gate_pts = [g[0] for g in gates]
    for name, at, txt in d['zones']:
        if any(math.hypot(at[0] - g[0], at[1] - g[1]) < 130 for g in gate_pts):
            continue
        reqs.append((at, name, '#dfe7f1', 15, 600, 7))
        parts.append(f'<circle cx="{at[0] * k:.1f}" cy="{at[1] * k:.1f}" r="2.4" fill="#dfe7f1"/>')

    def overlap(bx, boxes):
        o = 0
        for q in boxes:
            w = min(bx[2], q[2]) - max(bx[0], q[0])
            h = min(bx[3], q[3]) - max(bx[1], q[1])
            if w > 0 and h > 0:
                o += w * h
        return o

    for at, text, colr, size, weight, gap in reqs:
        x0, y0 = at[0] * k, at[1] * k
        tw = len(text) * size * 0.5
        best = None
        for dx, dy, anc in [(0, -gap - 2, 'middle'), (0, gap + size, 'middle'), (gap, size * 0.35, 'start'), (-gap, size * 0.35, 'end'),
                            (0, -gap - 2 - size * 1.3, 'middle'), (0, gap + size * 2.3, 'middle')]:
            x, y = x0 + dx, y0 + dy
            if anc == 'middle':
                bx = [x - tw / 2, y - size, x + tw / 2, y + size * 0.3]
            elif anc == 'start':
                bx = [x, y - size, x + tw, y + size * 0.3]
            else:
                bx = [x - tw, y - size, x, y + size * 0.3]
            sh = max(0, vx0 + 4 - bx[0]) - max(0, bx[2] - (vx1 - 4))
            bx = [bx[0] + sh, bx[1], bx[2] + sh, bx[3]]
            sv = max(0, vy0 + 4 - bx[1]) - max(0, bx[3] - (vy1 - 4))
            bx = [bx[0], bx[1] + sv, bx[2], bx[3] + sv]
            o = overlap(bx, placed)
            if best is None or o < best[0]:
                best = (o, x + sh, y + sv, anc, bx)
            if o == 0:
                break
        o, x, y, anc, bx = best
        placed.append(bx)
        parts.append(label(x, y, text, size, colr, weight, anc))
    for m_ in mk:
        parts.append(m_['fn'](m_['x'], m_['y']))
    parts.append(scale_bar(minx * k + 24, maxy * k - 18, k, 500, '500 m', 13))
    parts.append(north(maxx * k - 26, miny * k + 30, 13))
    parts.append('</svg>')
    return ''.join(parts)


if __name__ == '__main__':
    import sys
    c, P, wat, out, br = build()
    ov = overview(c, P, wat, out, br)
    open('out/overview.svg', 'w').write(ov)
    print('overview', len(ov) // 1024, 'KB')
    tot = len(ov)
    for bid in ORDER:
        sv = barrio_plan(bid, c, P, wat, out, br)
        open(f'out/plan-{bid}.svg', 'w').write(sv)
        tot += len(sv)
        print(bid, len(sv) // 1024, 'KB')
    print('total', tot // 1024, 'KB')
