"""Planos v2: plano general interactivo y un plano por barrio, con las
barreras de la Defensa, anclas, fronteras, Encarnaciones, torres de la PDC,
metro, secretos y áreas bloqueadas."""
import math
from shapely.geometry import box, Point, LineString, Polygon
from shapely.ops import unary_union
from fabric import polys, lines
from render import base_map, PAL, poly_d, line_d, L as Lpath, P as Ppath, clip
from data import B, MARKS, ORDER
from geo import FRAME

GOLD = '#f2c45a'
PDC = '#e0605a'
AMBER = '#ffb547'


def esc(t):
    return t.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;')


def label(x, y, text, size, fill='#e6edf6', weight=600, anchor='middle', extra=''):
    return (f'<text x="{x:.1f}" y="{y:.1f}" font-size="{size}" font-weight="{weight}" text-anchor="{anchor}" fill="{fill}" '
            f'stroke="#06090d" stroke-width="{size * 0.3:.1f}" paint-order="stroke" stroke-linejoin="round"{extra}>{esc(text)}</text>')


def mix(c1, c2, t):
    a = [int(c1[i:i + 2], 16) for i in (1, 3, 5)]
    b = [int(c2[i:i + 2], 16) for i in (1, 3, 5)]
    return '#' + ''.join(f'{round(a[i] + (b[i] - a[i]) * t):02x}' for i in range(3))


def tcol(mid):
    return mix(MARKS[mid]['color'], '#ffffff', 0.3)


def defs():
    out = ['<defs>']
    for mid, m in MARKS.items():
        out.append(f'<pattern id="h-{mid}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">'
                   f'<rect width="6" height="6" fill="#06090d" fill-opacity="0.6"/><rect width="2.4" height="6" fill="{m["color"]}"/></pattern>')
    out.append('<filter id="glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3"/></filter>')
    out.append('</defs>')
    return ''.join(out)


# --- Iconos -----------------------------------------------------------------
def hexagon(x, y, r, rot=0.0):
    return ' '.join(f'{x + r * math.cos(math.radians(60 * i + rot)):.1f},{y + r * math.sin(math.radians(60 * i + rot)):.1f}' for i in range(6))


def i_anchor(x, y, s, mid):
    c = MARKS[mid]['color']
    return (f'<g class="anc"><polygon points="{hexagon(x, y, s)}" fill="#120c02" stroke="{AMBER}" stroke-width="{s * 0.26:.1f}"/>'
            f'<polygon points="{hexagon(x, y, s * 0.45)}" fill="{c}"/></g>')


def i_gate(x, y, s, mid, n):
    return (f'<g class="gate"><rect x="{x - s:.1f}" y="{y - s:.1f}" width="{2 * s:.1f}" height="{2 * s:.1f}" transform="rotate(45 {x:.1f} {y:.1f})" '
            f'fill="{MARKS[mid]["color"]}" stroke="#06090d" stroke-width="{s * 0.26:.1f}"/>'
            f'<text x="{x:.1f}" y="{y + s * 0.42:.1f}" font-size="{s * 1.15:.1f}" font-weight="700" text-anchor="middle" fill="#06090d">{n}</text></g>')


def star(x, y, r, n=5):
    return ' '.join(f'{x + math.cos(-math.pi / 2 + math.pi * i / n) * (r if i % 2 == 0 else r * 0.45):.1f},'
                    f'{y + math.sin(-math.pi / 2 + math.pi * i / n) * (r if i % 2 == 0 else r * 0.45):.1f}' for i in range(n * 2))


def i_enc(x, y, s, mid):
    return f'<polygon class="enc" points="{star(x, y, s)}" fill="{MARKS[mid]["color"]}" stroke="#06090d" stroke-width="{s * 0.16:.1f}"/>'


def i_tower(x, y, s):
    return (f'<g class="twr"><path d="M{x:.1f} {y - s * 1.2:.1f}L{x + s * 0.55:.1f} {y + s * 0.8:.1f}H{x - s * 0.55:.1f}Z" fill="{PDC}" stroke="#06090d" stroke-width="{s * 0.22:.1f}"/>'
            f'<circle cx="{x:.1f}" cy="{y - s * 1.2:.1f}" r="{s * 0.32:.1f}" fill="#ffd0cc"/></g>')


def i_metro(x, y, s):
    return (f'<g class="met"><circle cx="{x:.1f}" cy="{y:.1f}" r="{s:.1f}" fill="#e6edf6" stroke="#06090d" stroke-width="{s * 0.22:.1f}"/>'
            f'<text x="{x:.1f}" y="{y + s * 0.42:.1f}" font-size="{s * 1.2:.1f}" font-weight="700" text-anchor="middle" fill="#06090d">M</text></g>')


def i_secret(x, y, s, n=None):
    t = f'<text x="{x:.1f}" y="{y + s * 0.4:.1f}" font-size="{s * 1.1:.1f}" font-weight="700" text-anchor="middle" fill="#1a1406">{n}</text>' if n else ''
    return f'<g class="sec"><circle cx="{x:.1f}" cy="{y:.1f}" r="{s:.1f}" fill="{GOLD}" stroke="#06090d" stroke-width="{s * 0.22:.1f}"/>{t}</g>'


def i_block(x, y, s, mid):
    c = MARKS[mid]['color']
    return (f'<g class="blk"><circle cx="{x:.1f}" cy="{y:.1f}" r="{s:.1f}" fill="url(#h-{mid})" stroke="{c}" stroke-width="{s * 0.2:.1f}"/>'
            f'<rect x="{x - s * 0.36:.1f}" y="{y - s * 0.05:.1f}" width="{s * 0.72:.1f}" height="{s * 0.55:.1f}" rx="{s * 0.08:.1f}" fill="#06090d"/>'
            f'<path d="M{x - s * 0.22:.1f} {y - s * 0.02:.1f}v{-s * 0.2:.1f}a{s * 0.22:.1f} {s * 0.22:.1f} 0 0 1 {s * 0.44:.1f} 0v{s * 0.2:.1f}" fill="none" stroke="#06090d" stroke-width="{s * 0.14:.1f}"/></g>')


# --- Barreras -----------------------------------------------------------------
def barrier_svg(g, k, view, width=6.0, only=None):
    rings = []
    for key, D in g['D'].items():
        if only and key not in only:
            continue
        for p in polys(D['poly']):
            r = p.buffer(-max(4, 10)).exterior
            rings.append(r.intersection(view.buffer(50)))
    c = g['D']['centro']['poly']
    from shapely import affinity as _af
    dome = _af.scale(Point(4720, 6050).buffer(1, quad_segs=48), 1350, 860).exterior.intersection(view.buffer(50))
    out = ['<g class="lyr-barrier">']
    out.append(Lpath(rings, k, AMBER, width * 2.2, ' opacity="0.35" filter="url(#glow)"'))
    out.append(Lpath(rings, k, AMBER, width * 0.55, ' opacity="0.95"'))
    if only is None or 'centro' in only or 'chino' in only:
        out.append(Lpath([dome], k, AMBER, width * 0.5, f' stroke-dasharray="{width * 2:.1f} {width * 1.6:.1f}" opacity="0.85"'))
    out.append('</g>')
    return ''.join(out)


def route_pts():
    pts = [(8200, 380), (7700, 560)]
    for key in ORDER:
        d = B[key]
        if d['incarnation']:
            pts.append(d['incarnation']['at'])
        pts.append(d['anchor']['at'])
        if d['exit']:
            pts.append(d['exit']['at'])
    return pts


def smooth_d(pts, k):
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


def scale_bar(x, y, k, meters, text, fs=11):
    w = meters * k
    return (f'<g><rect x="{x - 8:.1f}" y="{y - 12 - fs:.1f}" width="{w + 16:.1f}" height="{22 + fs:.1f}" fill="#06090d" fill-opacity="0.75"/>'
            f'<rect x="{x:.1f}" y="{y:.1f}" width="{w / 2:.1f}" height="4" fill="#e6edf6"/><rect x="{x + w / 2:.1f}" y="{y:.1f}" width="{w / 2:.1f}" height="4" fill="#95a6bd"/>'
            + label(x, y - 5, '0', fs, '#c9d4e3', 600, 'start') + label(x + w, y - 5, text, fs, '#c9d4e3', 600, 'end') + '</g>')


def north(x, y, s):
    return (f'<g><path d="M{x:.1f} {y - s:.1f}L{x + s * 0.55:.1f} {y + s * 0.7:.1f}L{x:.1f} {y + s * 0.3:.1f}L{x - s * 0.55:.1f} {y + s * 0.7:.1f}Z" fill="#e6edf6"/>'
            + label(x, y + s * 1.9, 'N', 11, '#e6edf6', 700) + '</g>')


DLABEL = {'cero': (7150, 250), 'industrial': (6980, 2900), 'midtown': (4300, 4010), 'parque': (4700, 2560), 'bloques': (5200, 860),
          'colinas': (1500, 1000), 'puerto': (2350, 3500), 'costa': (1400, 4900), 'chino': (4150, 5000), 'centro': (4300, 6350)}
LANDMARKS = [('Torre de la Defensa', (4720, 5700)), ('La Roca', (4480, 7380)), ('Estadio del Norte', (4320, 820)), ('Observatorio', (1250, 1420)),
             ('Letras IBAIA', (2230, 1620)), ('Muelle de la Feria', (620, 4140)), ('Terminal de Contenedores', (2650, 4650)), ('Refinería', (6660, 4250)),
             ('Plaza del KM 0', (6850, 900)), ('Plaza de las Pantallas', (4690, 3380))]
WATER = [('OCÉANO', (200, 6500), 0), ('BAHÍA DE IBAIA', (3200, 7300), 0), ('LA RÍA', (3000, 2300), -84), ('RÍO ESTE', (6120, 2600), -86),
         ('SIERRA NORTE', (900, 100), 0), ('SIERRA DEL ESTE', (8300, 3000), -90)]
BRIDGE_LBL = {'Puente de Hierro': (6230, 1080), 'Puente del Este': (6030, 3400), 'Puente de la Ría': (2910, 1300), 'Puente de la Bahía': (2750, 5650), 'Túnel del Puerto': (3260, 3850)}


def overview(g):
    x0, y0, x1, y1 = FRAME
    view = box(x0, y0, x1, y1)
    k = 0.125
    W, H = (x1 - x0) * k, (y1 - y0) * k
    parts = [f'<svg class="map" viewBox="{x0 * k:.0f} {y0 * k:.0f} {W:.0f} {H:.0f}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Plano general de la ciudad">', defs()]
    parts.append(base_map(g, view, k, detail=False))
    # Cuadrícula de 1 km
    gl = ['<g class="lyr-grid">']
    for i in range(0, 9):
        x = i * 1000 * k
        gl.append(f'<line x1="{x}" y1="{y0 * k}" x2="{x}" y2="{y1 * k}" stroke="#c9d4e3" stroke-opacity="0.08"/>')
        gl.append(label(x + 500 * k, y0 * k + 14, 'ABCDEFGHI'[i], 11, '#95a6bd', 700))
    for j in range(0, 9):
        y = j * 1000 * k
        gl.append(f'<line x1="{x0 * k}" y1="{y}" x2="{x1 * k}" y2="{y}" stroke="#c9d4e3" stroke-opacity="0.08"/>')
        gl.append(label(x0 * k + 10, y + 500 * k + 4, str(j + 1), 11, '#95a6bd', 700))
    gl.append('</g>')
    parts += gl
    parts.append(barrier_svg(g, k, view, 3.4))
    # Zonas clicables
    z = ['<g class="zones">']
    for i, key in enumerate(ORDER):
        poly = g['D'][key]['poly']
        z.append(f'<a href="#{key}" class="bz" aria-label="{esc(B[key]["name"])}"><path d="{poly_d(poly, k)}" fill="{MARKS[B[key]["mark"]]["color"]}" fill-opacity="0" stroke="none"/></a>')
    z.append('</g>')
    parts += z
    parts.append(f'<g class="lyr-route"><path d="{smooth_d(route_pts(), k)}" fill="none" stroke="{GOLD}" stroke-width="2.2" stroke-dasharray="1 5" stroke-linecap="round"/></g>')
    m = ['<g class="lyr-blocked">'] + [i_block(at[0] * k, at[1] * k, 4.6, r) for key in ORDER for n, at, r in B[key]['blocked']] + ['</g>']
    m += ['<g class="lyr-secrets">'] + [i_secret(at[0] * k, at[1] * k, 3) for key in ORDER for n, at, t in B[key]['secrets']] + ['</g>']
    m += ['<g class="lyr-metro">'] + [i_metro(at[0] * k, at[1] * k, 4.4) for key in ORDER for at in B[key]['metro']] + ['</g>']
    m += ['<g class="lyr-pdc">'] + [i_tower(B[key]['tower'][0] * k, B[key]['tower'][1] * k, 5.5) for key in ORDER] + ['</g>']
    m += ['<g class="lyr-anchors">'] + [i_anchor(B[key]['anchor']['at'][0] * k, B[key]['anchor']['at'][1] * k, 7.5, B[key]['mark']) for key in ORDER] + ['</g>']
    m += ['<g class="lyr-gates">'] + [i_gate(B[key]['exit']['at'][0] * k, B[key]['exit']['at'][1] * k, 7.5, B[key]['mark'], i + 1) for i, key in enumerate(ORDER) if B[key]['exit']] + ['</g>']
    m += ['<g class="lyr-enc">'] + [i_enc(B[key]['incarnation']['at'][0] * k, B[key]['incarnation']['at'][1] * k, 8.5, B[key]['mark']) for key in ORDER if B[key]['incarnation']] + ['</g>']
    parts += m
    lab = ['<g class="lyr-labels" pointer-events="none">']
    for name, (x, y), rot in WATER:
        tr = f' transform="rotate({rot} {x * k:.1f} {y * k:.1f})"' if rot else ''
        lab.append(label(x * k, y * k, name, 13, '#5b86b3' if 'SIERRA' not in name else '#5d6a5c', 700, extra=f' letter-spacing="4"{tr}'))
    for name, (x, y) in BRIDGE_LBL.items():
        lab.append(label(x * k, y * k, name, 9.5, '#e2c88a', 600))
    for name, (x, y) in LANDMARKS:
        lab.append(label(x * k, y * k, name, 9.5, '#d5dde8', 600))
    for i, key in enumerate(ORDER):
        x, y = DLABEL[key]
        col = tcol(B[key]['mark'])
        lab.append(label(x * k, y * k - 13, str(i + 1), 15, col, 700))
        lab.append(label(x * k, y * k + 5, B[key]['name'].upper(), 15, '#f1f4f8', 700, extra=' letter-spacing="1.6"'))
        lab.append(label(x * k, y * k + 20, f'Marca: {MARKS[B[key]["mark"]]["name"]}', 11, col, 600))
    lab.append('</g>')
    parts += lab
    parts.append(scale_bar(x0 * k + 30, y1 * k - 24, k, 1000, '1 km'))
    parts.append(north(x1 * k - 30, y0 * k + 40, 14))
    parts.append('</svg>')
    return ''.join(parts)


def overlap(bx, boxes):
    o = 0
    for q in boxes:
        w = min(bx[2], q[2]) - max(bx[0], q[0])
        h = min(bx[3], q[3]) - max(bx[1], q[1])
        if w > 0 and h > 0:
            o += w * h
    return o


def plan(g, key):
    d = B[key]
    D = g['D'][key]
    poly = D['poly']
    mx0, my0, mx1, my1 = poly.bounds
    m = 140
    vx0, vy0, vx1, vy1 = mx0 - m, my0 - m, mx1 + m, my1 + m
    # Encuadre mínimo 4:3 para que no quede demasiado estrecho
    wv, hv = vx1 - vx0, vy1 - vy0
    if wv < hv * 0.8:
        c = (vx0 + vx1) / 2
        wv = hv * 0.8
        vx0, vx1 = c - wv / 2, c + wv / 2
    view = box(vx0, vy0, vx1, vy1)
    k = 1100 / wv
    W, H = 1100, hv * k
    col = MARKS[d['mark']]['color']
    tc = tcol(d['mark'])
    parts = [f'<svg class="plan" viewBox="{vx0 * k:.1f} {vy0 * k:.1f} {W:.1f} {H:.1f}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Plano de {esc(d["name"])}">', defs()]
    parts.append(base_map(g, view, k, detail=True, focus=key))
    parts.append(barrier_svg(g, k, view, 5.0, only=[key]))
    idx = ORDER.index(key)
    mk = []

    def add(x, y, r, fn, fixed=False):
        mk.append({'x': x * k, 'y': y * k, 'ox': x * k, 'oy': y * k, 'r': r, 'fn': fn, 'fixed': fixed})

    reqs = []
    if idx > 0:
        prev = ORDER[idx - 1]
        e = B[prev]['exit']
        at = e['at']
        for bname, bl, bc, ba, bb in g['bridges']:
            if ba == prev and bb == key:
                at = bl.coords[-1]
        add(*at, 17, lambda x, y, pm=B[prev]['mark'], n=idx: i_gate(x, y, 14, pm, n), True)
        reqs.append((at, f'Entrada: frontera {idx}', tcol(B[prev]['mark']), 18, 700, 26))
    else:
        add(7900, 420, 12, lambda x, y: f'<path d="M{x - 12:.1f} {y - 6:.1f}l-14 6l14 6z" fill="{GOLD}"/>', True)
        reqs.append(((7900, 420), 'Llegada de Jon desde la sierra', GOLD, 18, 700, 26))
    if d['exit']:
        e = d['exit']
        add(*e['at'], 17, lambda x, y: i_gate(x, y, 14, d['mark'], idx + 1), True)
        reqs.append((e['at'], f'Salida: frontera {idx + 1} → {B[e["to"]]["name"]}', tc, 18, 700, 26))
    a = d['anchor']
    add(*a['at'], 18, lambda x, y: i_anchor(x, y, 15, d['mark']), True)
    reqs.append((a['at'], a['name'], AMBER, 18, 700, 28))
    inc = d['incarnation']
    if inc:
        add(*inc['at'], 18, lambda x, y: i_enc(x, y, 17, d['mark']), True)
        reqs.append((inc['at'], f'{inc["name"]} · {inc["role"]}', tc, 18, 700, 26))
    add(*d['tower'], 14, lambda x, y: i_tower(x, y, 11))
    for at in d['metro']:
        add(*at, 12, lambda x, y: i_metro(x, y, 10.5))
    for n_, at, r in d['blocked']:
        add(*at, 17, lambda x, y, r=r: i_block(x, y, 15.5, r))
    for i, (n_, at, t) in enumerate(d['secrets']):
        add(*at, 15, lambda x, y, n=i + 1: i_secret(x, y, 13, n))
    for it in range(150):
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
    placed = [(m_['x'] - m_['r'], m_['y'] - m_['r'], m_['x'] + m_['r'], m_['y'] + m_['r']) for m_ in mk]
    for n_, at in d['zones']:
        reqs.append((at, n_, '#e1e8f1', 16.5, 600, 9))
    bx0, by0, bx1, by1 = vx0 * k, vy0 * k, vx1 * k, vy1 * k
    texts = []
    for at, text, colr, size, weight, gap in reqs:
        x0_, y0_ = at[0] * k, at[1] * k
        tw = len(text) * size * 0.5
        best = None
        for dx, dy, anc in [(0, -gap - 2, 'middle'), (0, gap + size, 'middle'), (gap, size * 0.35, 'start'), (-gap, size * 0.35, 'end'),
                            (0, -gap - 2 - size * 1.3, 'middle'), (0, gap + size * 2.3, 'middle')]:
            x, y = x0_ + dx, y0_ + dy
            if anc == 'middle':
                bb = [x - tw / 2, y - size, x + tw / 2, y + size * 0.3]
            elif anc == 'start':
                bb = [x, y - size, x + tw, y + size * 0.3]
            else:
                bb = [x - tw, y - size, x, y + size * 0.3]
            sh = max(0, bx0 + 4 - bb[0]) - max(0, bb[2] - (bx1 - 4))
            sv = max(0, by0 + 4 - bb[1]) - max(0, bb[3] - (by1 - 4))
            bb = [bb[0] + sh, bb[1] + sv, bb[2] + sh, bb[3] + sv]
            o = overlap(bb, placed)
            if best is None or o < best[0]:
                best = (o, x + sh, y + sv, anc, bb)
            if o == 0:
                break
        o, x, y, anc, bb = best
        placed.append(bb)
        texts.append(label(x, y, text, size, colr, weight, anc))
    for m_ in mk:
        parts.append(m_['fn'](m_['x'], m_['y']))
    parts += texts
    parts.append(scale_bar(bx0 + 26, by1 - 20, k, 500, '500 m', 13))
    parts.append(north(bx1 - 28, by0 + 34, 14))
    parts.append('</svg>')
    return ''.join(parts)


if __name__ == '__main__':
    import city
    g = city.build()
    ov = overview(g)
    open('out/overview.svg', 'w').write(ov)
    print('overview', len(ov) // 1024, 'KB')
    tot = len(ov)
    for key in ORDER:
        s = plan(g, key)
        open(f'out/plan-{key}.svg', 'w').write(s)
        tot += len(s)
        print(key, len(s) // 1024, 'KB')
    print('total', tot // 1024, 'KB')
