"""Página del plan de los barrios: historia, secundarias, actividades, sucesos,
rincones, un plano por barrio con todo colocado y el prompt para la IA de
guiones. También escribe docs/PLAN_BARRIOS.md y docs/guiones/*.md.

Uso: python barrios_page.py <carpeta de salida>
"""
import math
import os
import random
import sys
from shapely.geometry import box, Point
from shapely.ops import unary_union, nearest_points
import city
from plans import (esc, label, tcol, defs, i_anchor, i_gate, i_enc, i_tower, i_metro, barrier_svg, scale_bar, north, overlap, overview,
                   mix, GOLD, AMBER)
from render import base_map
from data import B, MARKS, ORDER
from fabric import polys
from barrios_plan import P, THREADS, prompt, where

ACT_COL = ['#ff8a3d', '#3ddc97', '#c79bff', '#ffd84d', '#4fc3ff', '#ff6b8b']
LETTERS = 'ABCDEF'


def mv(mid):
    c_ = MARKS[mid]['color']
    return f'--m:{c_};--mt:{mix(c_, "#ffffff", 0.35)}'


def chip(mid):
    m = MARKS[mid]
    return f'<span class="mk" style="{mv(mid)}">{esc(m["name"])}</span>'


def hm(mins):
    h, m = divmod(mins, 60)
    return f'{h} h {m:02d} min' if m else f'{h} h'


# --- Posiciones ---------------------------------------------------------------
class Spots:
    """Puntos válidos de un barrio: dentro de su tierra y fuera del agua interior."""

    def __init__(self, D):
        poly = D['poly']
        water = unary_union(D['areas'].get('water', []) or [Point(-9e9, -9e9).buffer(1)])
        self.area = poly.difference(water)
        self.inner = self.area.buffer(-55)
        if self.inner.is_empty:
            self.inner = self.area

    def snap(self, at):
        p = Point(at)
        if self.area.contains(p):
            return at
        q = nearest_points(self.area.buffer(-15), p)[0]
        return (q.x, q.y)

    def scatter(self, n, seed, near, avoid, minsep=230):
        rng = random.Random(seed)
        x0, y0, x1, y1 = self.inner.bounds
        pts = []
        for sep in (minsep, minsep * 0.7, minsep * 0.45, 60):
            tries = 0
            while len(pts) < n and tries < 3000:
                tries += 1
                if near and rng.random() < 0.75:
                    c = rng.choice(near)
                    p = (c[0] + rng.uniform(-380, 380), c[1] + rng.uniform(-380, 380))
                else:
                    p = (rng.uniform(x0, x1), rng.uniform(y0, y1))
                if not self.inner.contains(Point(p)):
                    continue
                if any(math.dist(p, q) < sep for q in pts) or any(math.dist(p, q) < 70 for q in avoid):
                    continue
                pts.append(p)
            if len(pts) >= n:
                break
        return pts


def resolve(key, pl):
    b = B[key]
    if pl == 'tower':
        return b['tower']
    if pl == 'anchor':
        return b['anchor']['at']
    if pl == 'inc':
        return b['incarnation']['at'] if b['incarnation'] else b['anchor']['at']
    for k, n, at, t in P[key]['places']:
        if k == pl:
            return at
    raise KeyError(pl)


def layout(g, key):
    """Coordenadas de todo lo que va en el plano del barrio (metros)."""
    d = P[key]
    S = Spots(g['D'][key])
    places = {k: S.snap(at) for k, n, at, t in d['places']}
    story = [S.snap(resolve(key, pl)) if pl not in places else places[pl] for t, pl, m, x in d['story']]
    side = [S.snap(resolve(key, pl)) if pl not in places else places[pl] for t, gv, pl, m, x in d['side']]
    avoid = list(places.values()) + story + side
    acts = []
    for i, (n, ty, c, mi, x, near) in enumerate(d['acts']):
        pts = S.scatter(c, ORDER.index(key) * 10 + i + 1, [places[k] for k in near], avoid)
        avoid += pts
        acts.append(pts)
    return places, story, side, acts


# --- Plano -----------------------------------------------------------------------
def mplan(g, key, lay):
    d = P[key]
    b = B[key]
    poly = g['D'][key]['poly']
    places, story, side, acts = lay
    mx0, my0, mx1, my1 = poly.bounds
    m = 150
    vx0, vy0, vx1, vy1 = mx0 - m, my0 - m, mx1 + m, my1 + m
    wv, hv = vx1 - vx0, vy1 - vy0
    if wv < hv * 0.8:
        c = (vx0 + vx1) / 2
        wv = hv * 0.8
        vx0, vx1 = c - wv / 2, c + wv / 2
    view = box(vx0, vy0, vx1, vy1)
    k = 1200 / wv
    W, H = 1200, hv * k
    mark = b['mark']
    mc = MARKS[mark]['color']
    tc = tcol(mark)
    idx = ORDER.index(key)
    parts = [f'<svg class="plan" viewBox="{vx0 * k:.1f} {vy0 * k:.1f} {W:.1f} {H:.1f}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Plano de misiones de {esc(b["name"])}">', defs()]
    parts.append(base_map(g, view, k, detail=True, focus=key))
    parts.append(barrier_svg(g, k, view, 5.0, only=[key]))
    # Recorrido de la historia en orden
    pts = [(x * k, y * k) for x, y in story]
    dpath = 'M' + ' L'.join(f'{x:.1f} {y:.1f}' for x, y in pts)
    parts.append(f'<path class="ly-h" d="{dpath}" fill="none" stroke="{tc}" stroke-width="2.4" stroke-dasharray="2 7" stroke-linecap="round" opacity="0.75"/>')

    mk = []

    def add(at, r, fn, cls, tip='', fixed=False):
        x, y = at[0] * k, at[1] * k
        mk.append({'x': x, 'y': y, 'ox': x, 'oy': y, 'r': r, 'fn': fn, 'cls': cls, 'tip': tip, 'fixed': fixed})

    reqs = []
    # Fronteras, Ancla, Encarnación, torre y metro (capa base)
    if idx > 0:
        prev = ORDER[idx - 1]
        at = B[prev]['exit']['at']
        for bname, bl, bc, ba, bb in g['bridges']:
            if ba == prev and bb == key:
                at = bl.coords[-1]
        add(at, 16, lambda x, y, pm=B[prev]['mark'], n=idx: i_gate(x, y, 13, pm, n), 'ly-b', 'Entrada', True)
        reqs.append((at, 'Entrada', tcol(B[prev]['mark']), 15, 700, 24, 'ly-b'))
    else:
        reqs.append(((7900, 420), 'Llegada desde la sierra', GOLD, 15, 700, 10, 'ly-b'))
    if b['exit']:
        e = b['exit']
        add(e['at'], 16, lambda x, y: i_gate(x, y, 13, mark, idx + 1), 'ly-b', 'Salida', True)
        reqs.append((e['at'], f'Salida → {B[e["to"]]["name"]}', tc, 15, 700, 24, 'ly-b'))
    add(b['anchor']['at'], 17, lambda x, y: i_anchor(x, y, 14, mark), 'ly-b', b['anchor']['name'], True)
    reqs.append((b['anchor']['at'], b['anchor']['name'], AMBER, 15, 700, 26, 'ly-b'))
    if b['incarnation'] and key != 'centro':
        add(b['incarnation']['at'], 16, lambda x, y: i_enc(x, y, 15, mark), 'ly-b', b['incarnation']['name'], True)
    add(b['tower'], 13, lambda x, y: i_tower(x, y, 10.5), 'ly-b', 'Torre de la PDC')
    for at in b['metro']:
        add(at, 11, lambda x, y: i_metro(x, y, 9.5), 'ly-b', 'Metro')
    # Rincones
    for kk, n, at, t in d['places']:
        p = places[kk]
        add(p, 6, lambda x, y: f'<circle cx="{x:.1f}" cy="{y:.1f}" r="5" fill="#e6edf6" stroke="#06090d" stroke-width="2"/>', 'ly-p', n, True)
        reqs.append((p, n, '#e1e8f1', 14.5, 600, 10, 'ly-p'))
    # Historia
    for i, at in enumerate(story):
        t, pl, mins, x_ = d['story'][i]
        add(at, 14, lambda x, y, n=i + 1: (f'<circle cx="{x:.1f}" cy="{y:.1f}" r="12.5" fill="{tc}" stroke="#06090d" stroke-width="2.6"/>'
                                           f'<text x="{x:.1f}" y="{y + 5:.1f}" font-size="14" font-weight="700" text-anchor="middle" fill="#06090d">{n}</text>'),
            'ly-h', f'Historia {i + 1} · {t} ({mins} min)')
    # Secundarias
    for i, at in enumerate(side):
        t, gv, pl, mins, x_ = d['side'][i]
        add(at, 14, lambda x, y, n=i + 1: (f'<rect x="{x - 15:.1f}" y="{y - 10:.1f}" width="30" height="20" rx="4" fill="#e6edf6" stroke="#06090d" stroke-width="2.2"/>'
                                           f'<text x="{x:.1f}" y="{y + 4.6:.1f}" font-size="13" font-weight="700" text-anchor="middle" fill="#06090d">S{n}</text>'),
            'ly-s', f'Secundaria S{i + 1} · {t} ({mins} min)')
    # Actividades
    for a, pts_ in enumerate(acts):
        name = d['acts'][a][0]
        col = ACT_COL[a]
        for j, at in enumerate(pts_):
            add(at, 11, lambda x, y, c=col, L=LETTERS[a]: (f'<rect x="{x - 9.5:.1f}" y="{y - 9.5:.1f}" width="19" height="19" rx="3" fill="{c}" stroke="#06090d" stroke-width="2"/>'
                                                       f'<text x="{x:.1f}" y="{y + 4.6:.1f}" font-size="13" font-weight="700" text-anchor="middle" fill="#06090d">{L}</text>'),
                'ly-a', f'{LETTERS[a]} · {name} ({j + 1}/{len(pts_)})')
    # Separar marcadores que se pisan
    for it in range(200):
        moved = False
        for i in range(len(mk)):
            for j in range(i + 1, len(mk)):
                a_, b_ = mk[i], mk[j]
                dx, dy = b_['x'] - a_['x'], b_['y'] - a_['y']
                dist = math.hypot(dx, dy) or 0.01
                need = a_['r'] + b_['r'] + 2
                if dist < need:
                    push = (need - dist) / 2
                    ux, uy = (dx / dist, dy / dist) if dist > 0.02 else (math.cos(i + j), math.sin(i + j))
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
            parts.append(f'<line class="{m_["cls"]}" x1="{m_["ox"]:.1f}" y1="{m_["oy"]:.1f}" x2="{m_["x"]:.1f}" y2="{m_["y"]:.1f}" stroke="#dfe7f1" stroke-width="1" opacity="0.55"/>')
    placed = [(m_['x'] - m_['r'], m_['y'] - m_['r'], m_['x'] + m_['r'], m_['y'] + m_['r']) for m_ in mk]
    bx0, by0, bx1, by1 = vx0 * k, vy0 * k, vx1 * k, vy1 * k
    texts = []
    for at, text, colr, size, weight, gap, cls in reqs:
        x0_, y0_ = at[0] * k, at[1] * k
        tw = len(text) * size * 0.5
        best = None
        for dx, dy, anc in [(0, -gap - 2, 'middle'), (0, gap + size, 'middle'), (gap, size * 0.35, 'start'), (-gap, size * 0.35, 'end'),
                            (0, -gap - 2 - size * 1.3, 'middle'), (0, gap + size * 2.3, 'middle'), (gap + 10, -size, 'start'), (-gap - 10, -size, 'end')]:
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
        texts.append(f'<g class="{cls}">{label(x, y, text, size, colr, weight, anc)}</g>')
    for m_ in mk:
        tip = f'<title>{esc(m_["tip"])}</title>' if m_['tip'] else ''
        parts.append(f'<g class="{m_["cls"]}">{tip}{m_["fn"](m_["x"], m_["y"])}</g>')
    parts += texts
    parts.append(scale_bar(bx0 + 26, by1 - 20, k, 500, '500 m', 13))
    parts.append(north(bx1 - 28, by0 + 34, 14))
    parts.append('</svg>')
    return ''.join(parts)


# --- HTML --------------------------------------------------------------------------
CSS_EXTRA = r"""
.mk { color: var(--mt, var(--m)); }
.bh .num { color: var(--mt, var(--m)); }
.genre { font: 600 13px var(--display); letter-spacing: .18em; text-transform: uppercase; color: var(--mt, var(--m)); }
.title2 { font: 700 clamp(30px, 4.4vw, 46px)/1 var(--display); letter-spacing: .03em; }
.bh .tag { font-style: italic; }
.story { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); gap: 22px; align-items: start; }
.story .pre { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.story .pre p { font-size: 15.5px; }
.cast { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.cast div { border-left: 3px solid var(--line); padding: 2px 0 2px 12px; font-size: 14px; color: #c9d4e3; }
.cast div.vil { border-left-color: var(--pdc); }
.cast b { font-family: var(--display); font-size: 16px; letter-spacing: .03em; color: var(--fg); display: block; }
.twist { border: 1px solid var(--line); border-left: 4px solid var(--gold); background: var(--panel); padding: 10px 14px; display: flex; flex-direction: column; gap: 4px; }
.twist b { font: 700 12px var(--display); letter-spacing: .2em; text-transform: uppercase; color: var(--gold); }
.twist span { font-size: 14.5px; }
.planbox .toolbar { padding: 4px 2px 8px; }
.planbox .toolbar button { font: 600 13px var(--display); letter-spacing: .08em; text-transform: uppercase; color: var(--fg); background: var(--panel-2); border: 1px solid var(--line); padding: 5px 10px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
.planbox .toolbar button[aria-pressed="false"] { opacity: .5; text-decoration: line-through; }
.planbox .zbtn { position: static; }
.sw-h { width: 14px; height: 14px; border-radius: 50%; background: var(--mt, var(--m)); outline: 2px solid #06090d; }
.sw-s { width: 18px; height: 12px; border-radius: 3px; background: #e6edf6; }
.sw-a { width: 12px; height: 12px; border-radius: 2px; background: linear-gradient(90deg, #ff8a3d 0 33%, #3ddc97 33% 66%, #4fc3ff 66%); }
.sw-p { width: 9px; height: 9px; border-radius: 50%; background: #e6edf6; outline: 2px solid #06090d; }
.places { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 1px; background: var(--line); border: 1px solid var(--line); }
.places div { background: var(--panel); padding: 10px 14px; display: flex; flex-direction: column; gap: 3px; font-size: 14px; color: #c9d4e3; min-width: 0; }
.places b { font: 700 16px var(--display); letter-spacing: .03em; color: var(--fg); }
td.h { width: 40px; }
td.h span { display: inline-grid; place-items: center; width: 26px; height: 26px; border-radius: 50%; background: var(--mt, var(--m)); color: #06090d; font: 700 14px var(--display); }
td.s span { display: inline-grid; place-items: center; width: 32px; height: 22px; border-radius: 4px; background: #e6edf6; color: #06090d; font: 700 13px var(--display); }
td.min { white-space: nowrap; font-variant-numeric: tabular-nums; color: var(--muted); }
td.ttl { min-width: 150px; }
td.ttl b { font-family: var(--display); font-size: 16.5px; letter-spacing: .02em; }
td.ttl small { display: block; color: var(--muted); font-size: 12.5px; }
tfoot td { font: 600 14px var(--display); letter-spacing: .06em; color: var(--muted); background: var(--panel); }
.acts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.act { background: var(--panel); border: 1px solid var(--line); border-top: 4px solid var(--ac); padding: 12px 14px; display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.act .row { display: flex; align-items: center; gap: 10px; }
.act .L { display: inline-grid; place-items: center; width: 26px; height: 26px; border-radius: 4px; background: var(--ac); color: #06090d; font: 700 15px var(--display); flex: none; }
.act h5 { margin: 0; font: 700 18px/1.1 var(--display); letter-spacing: .03em; }
.act .ty { font: 600 12px var(--display); letter-spacing: .14em; text-transform: uppercase; color: var(--ac); }
.act p { font-size: 14px; color: #c9d4e3; }
.act .n { font-size: 13px; color: var(--muted); font-variant-numeric: tabular-nums; }
.events { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 22px; margin: 0; padding: 0; list-style: none; font-size: 14px; }
.events b { font-family: var(--display); font-size: 16px; letter-spacing: .02em; }
.events span { color: #c9d4e3; }
details.prompt { border: 1px solid var(--line); background: var(--panel); }
details.prompt summary { cursor: pointer; padding: 12px 14px; font: 700 15px var(--display); letter-spacing: .1em; text-transform: uppercase; color: var(--gold); display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
details.prompt summary small { font: 400 13px var(--body); letter-spacing: 0; text-transform: none; color: var(--muted); }
details.prompt .pbar { display: flex; gap: 8px; align-items: center; padding: 0 14px 10px; }
details.prompt .pbar span { font-size: 13px; color: var(--muted); }
details.prompt pre { margin: 0; padding: 14px; border-top: 1px solid var(--line); max-height: 460px; overflow: auto; white-space: pre-wrap; font: 13px/1.55 ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace; color: #d5dde8; background: #0b111a; }
.copy { font: 600 13px var(--display); letter-spacing: .08em; text-transform: uppercase; color: #1a1406; background: var(--gold); border: 0; padding: 6px 12px; cursor: pointer; }
.matrix td { min-width: 120px; font-size: 13.5px; }
.matrix td b { font-family: var(--display); font-size: 15px; letter-spacing: .02em; display: block; }
.matrix td span { color: var(--muted); font-size: 12.5px; }
.matrix td.bn { font: 700 16px var(--display); white-space: nowrap; }
.threads td { font-size: 13.5px; min-width: 150px; }
.threads td.bn { font: 700 16px var(--display); white-space: nowrap; min-width: 0; }
.threads td.empty { color: #3a4a62; }
.loop { margin: 0; padding: 0; list-style: none; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 1px; background: var(--line); border: 1px solid var(--line); counter-reset: s; }
.loop li { background: var(--panel); padding: 12px 14px; display: flex; flex-direction: column; gap: 4px; font-size: 14px; color: #c9d4e3; counter-increment: s; }
.loop li::before { content: counter(s); font: 700 26px/1 var(--display); color: var(--energy); }
.loop b { font: 700 16px var(--display); letter-spacing: .03em; color: var(--fg); }
.budget td.v { font: 700 18px var(--display); font-variant-numeric: tabular-nums; white-space: nowrap; color: var(--gold); }
.next { border: 1px solid var(--line); border-left: 4px solid var(--energy); background: var(--panel); padding: 16px 18px; display: flex; flex-direction: column; gap: 10px; }
.next ol { margin: 0; padding-left: 22px; display: flex; flex-direction: column; gap: 6px; font-size: 14.5px; }
.strip a { border-top-color: var(--m); }
@media (max-width: 1000px) { .acts { grid-template-columns: repeat(2, minmax(0, 1fr)); } .loop { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 900px) { .story { grid-template-columns: minmax(0, 1fr); } }
@media (max-width: 640px) { .acts, .events { grid-template-columns: minmax(0, 1fr); } .loop { grid-template-columns: minmax(0, 1fr); } }
"""

JS_EXTRA = r"""
document.querySelectorAll('[data-ly]').forEach((b) => {
  b.addEventListener('click', () => {
    const on = b.getAttribute('aria-pressed') !== 'true';
    b.setAttribute('aria-pressed', on);
    b.closest('figure').querySelectorAll('svg .' + b.dataset.ly).forEach((g) => { g.style.display = on ? '' : 'none'; });
  });
});
document.querySelectorAll('.copy').forEach((b) => {
  b.addEventListener('click', () => {
    const pre = b.closest('details').querySelector('pre');
    const note = b.nextElementSibling;
    const sel = () => { const r = document.createRange(); r.selectNodeContents(pre); const s = getSelection(); s.removeAllRanges(); s.addRange(r); };
    const done = (t) => { note.textContent = t; setTimeout(() => { note.textContent = ''; }, 2500); };
    try {
      navigator.clipboard.writeText(pre.textContent).then(() => done('Copiado'), () => { sel(); done('Texto seleccionado: cópialo con Ctrl+C'); });
    } catch (e) { sel(); done('Texto seleccionado: cópialo con Ctrl+C'); }
  });
});
"""


def barrio_html(g, i, key):
    d = P[key]
    b = B[key]
    lay = layout(g, key)
    svg = mplan(g, key, lay)
    s_min = sum(m for t, pl, m, x in d['story'])
    x_min = sum(m for t, gv, pl, m, x in d['side'])
    a_min = sum(c * mi for n, ty, c, mi, x, nr in d['acts'])
    cast = f'<div class="vil"><b>{esc(d["villain"][0])}</b>{esc(d["villain"][1])}</div>' + ''.join(f'<div><b>{esc(n)}</b>{esc(t)}</div>' for n, t in d['allies'])
    places = ''.join(f'<div><b>{esc(n)}</b>{esc(t)}</div>' for k, n, at, t in d['places'])
    srows = ''.join(f'<tr><td class="h"><span>{n + 1}</span></td><td class="ttl"><b>{esc(t)}</b><small>{esc(where(key, pl, B))}</small></td><td>{esc(x)}</td><td class="min">{m} min</td></tr>'
                    for n, (t, pl, m, x) in enumerate(d['story']))
    xrows = ''.join(f'<tr><td class="s"><span>S{n + 1}</span></td><td class="ttl"><b>{esc(t)}</b><small>{esc(gv)} · {esc(where(key, pl, B))}</small></td><td>{esc(x)}</td><td class="min">{m} min</td></tr>'
                    for n, (t, gv, pl, m, x) in enumerate(d['side']))
    acts = ''.join(f'''<div class="act" style="--ac:{ACT_COL[a]}"><div class="row"><span class="L">{LETTERS[a]}</span><div><h5>{c} {esc(n)}</h5><span class="ty">{esc(ty)}</span></div></div>
<p>{esc(x)}</p><span class="n">≈ {mi} min cada una · {hm(c * mi) if c * mi >= 60 else f"{c * mi} min"} en total</span></div>''' for a, (n, ty, c, mi, x, nr) in enumerate(d['acts']))
    events = ''.join(f'<li><b>{esc(n)}.</b> <span>{esc(t)}</span></li>' for n, t in d['events'])
    pr = esc(prompt(key, ORDER, B))
    inc = b['incarnation']
    enc = f'{inc["name"]}, {inc["role"]}' if inc else 'Ninguna (Jon ya lleva la Energía)'
    tb = ''.join(f'<button type="button" data-ly="{c}" aria-pressed="true"><span class="lg {sw}"></span>{t}</button>'
                 for c, t, sw in [('ly-h', 'Historia', 'sw-h'), ('ly-s', 'Secundarias', 'sw-s'), ('ly-a', 'Actividades', 'sw-a'), ('ly-p', 'Rincones', 'sw-p'), ('ly-b', 'Ancla, torre y metro', 'lg-anc')])
    return f'''
<article class="barrio" id="{key}" style="{mv(b['mark'])}">
  <div class="bh">
    <span class="num">{i + 1}</span>
    <div style="display:flex;flex-direction:column;gap:6px;min-width:0">
      <span class="genre">{esc(b['name'])} · {esc(d['genre'])}</span>
      <h3 class="title2">«{esc(d['title'])}»</h3>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px;min-width:0">
      <p class="tag">{esc(d['tone'])}</p>
      <div class="meta">{chip(b['mark'])}<span>Encarnación: <b>{esc(enc)}</b></span><span>Historia <b>{hm(s_min)}</b></span><span>Secundarias <b>{hm(x_min)}</b></span><span>Actividades <b>≈ {hm(a_min - a_min % 10)}</b></span></div>
    </div>
  </div>
  <div class="story">
    <div class="pre">
      <p>{esc(d['premise'])}</p>
      <div class="twist"><b>Giro</b><span>{esc(d['twist'])}</span></div>
      <div class="twist" style="border-left-color:var(--mt)"><b style="color:var(--mt)">Final del barrio</b><span>{esc(d['ending'])}</span></div>
    </div>
    <div class="cast"><h4>Personajes</h4>{cast}</div>
  </div>
  <figure class="planbox">
    <div class="toolbar">{tb}<span class="sp"></span><button class="zbtn" type="button" data-zoom="{i + 1} · {esc(b['name'])} · misiones">Ampliar</button></div>
    <div class="svgwrap">{svg}</div>
    <figcaption>Círculos numerados: historia en orden (la línea de puntos une sus misiones). S: secundarias. Letras: actividades (ver abajo). Puntos blancos: rincones. Pasa el ratón por un marcador para ver su nombre.</figcaption>
  </figure>
  <div><h4 style="margin-bottom:10px">Rincones · cada esquina, distinta</h4><div class="places">{places}</div></div>
  <div><h4 style="margin-bottom:10px">Historia · {hm(s_min)}</h4>
    <div class="tablewrap"><table><thead><tr><th>#</th><th>Misión</th><th>Qué pasa y cómo se juega</th><th>Duración</th></tr></thead><tbody>{srows}</tbody>
    <tfoot><tr><td></td><td colspan="2">Total historia</td><td class="min">{hm(s_min)}</td></tr></tfoot></table></div></div>
  <div><h4 style="margin-bottom:10px">Secundarias · {hm(x_min)}</h4>
    <div class="tablewrap"><table><thead><tr><th>#</th><th>Misión</th><th>Qué pasa</th><th>Duración</th></tr></thead><tbody>{xrows}</tbody>
    <tfoot><tr><td></td><td colspan="2">Total secundarias</td><td class="min">{hm(x_min)}</td></tr></tfoot></table></div></div>
  <div><h4 style="margin-bottom:10px">Actividades · seis formas de jugar</h4><div class="acts">{acts}</div></div>
  <div><h4 style="margin-bottom:10px">Sucesos por la calle</h4><ul class="events">{events}</ul></div>
  <details class="prompt"><summary>Prompt para la IA de guiones <small>{esc(b['name'])} · listo para copiar y pegar</small></summary>
    <div class="pbar"><button class="copy" type="button">Copiar prompt</button><span aria-live="polite"></span></div>
    <pre>{pr}</pre></details>
</article>'''


def page(g):
    CSS = open('base.css').read() + CSS_EXTRA
    JS = open('base.js').read() + JS_EXTRA
    tot_s = sum(m for k in ORDER for t, pl, m, x in P[k]['story'])
    tot_x = sum(m for k in ORDER for t, gv, pl, m, x in P[k]['side'])
    tot_a = sum(c * mi for k in ORDER for n, ty, c, mi, x, nr in P[k]['acts'])
    n_inst = sum(c for k in ORDER for n, ty, c, mi, x, nr in P[k]['acts'])
    types = {ty for k in ORDER for n, ty, c, mi, x, nr in P[k]['acts']}
    strip = ''.join(f'<a href="#{k}" style="{mv(B[k]["mark"])}"><b>{i + 1}</b><span>{esc(B[k]["name"])}</span><small>«{esc(P[k]["title"])}»</small></a>' for i, k in enumerate(ORDER))
    genres = ''.join(f'<tr><td class="n">{i + 1}</td><td class="bn"><a href="#{k}">{esc(B[k]["name"])}</a></td><td><b>«{esc(P[k]["title"])}»</b></td><td>{esc(P[k]["genre"])}</td><td>{esc(P[k]["villain"][0])}</td><td>{chip(B[k]["mark"])}</td></tr>' for i, k in enumerate(ORDER))
    mrows = ''
    for i, k in enumerate(ORDER):
        cells = ''.join(f'<td><b style="color:{ACT_COL[a]}">{LETTERS[a]} · {esc(n)}</b><span>{esc(ty)} · {c}</span></td>' for a, (n, ty, c, mi, x, nr) in enumerate(P[k]['acts']))
        mrows += f'<tr><td class="bn">{i + 1} · {esc(B[k]["name"])}</td>{cells}</tr>'
    thead = ''.join(f'<th>{esc(t)}</th>' for t, desc, per in THREADS)
    trows = ''
    for i, k in enumerate(ORDER):
        cells = ''.join(f'<td>{esc(per[k])}</td>' if k in per else '<td class="empty">—</td>' for t, desc, per in THREADS)
        trows += f'<tr><td class="bn">{i + 1} · {esc(B[k]["name"])}</td>{cells}</tr>'
    tdesc = ''.join(f'<li><b>{esc(t)}.</b> {esc(desc)}</li>' for t, desc, per in THREADS)
    barrios = ''.join(barrio_html(g, i, k) for i, k in enumerate(ORDER))
    ov = overview(g)
    return f'''<title>Barrios de Ibaia</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>{CSS}</style>
<div class="wrap">
<header class="top">
  <span class="eyebrow">ASCEND · Plan de contenido de la ciudad</span>
  <h1>BARRIOS</h1>
  <p class="lede">Diez barrios, diez historias que no se parecen entre sí: un thriller noir, una huelga, una sátira de la tele, un cuento oscuro, una fuga, un asesinato, un atraco, una catástrofe, una saga familiar y un asedio final. Cada barrio tiene <b>≈5 h de historia</b>, <b>≈5 h de secundarias</b>, <b>seis actividades que se juegan de forma distinta</b>, sucesos por la calle, rincones que explorar y un prompt listo para que una IA escriba su guion.</p>
  <div class="facts">
    <div><b>{tot_s // 60} h</b><span>de historia: 100 misiones</span></div>
    <div><b>{tot_x // 60} h</b><span>de secundarias: 100 misiones</span></div>
    <div><b>60</b><span>actividades: seis por barrio, ninguna repetida</span></div>
    <div><b>{n_inst}</b><span>sitios de actividad en los planos (≈{tot_a // 60} h)</span></div>
    <div><b>40</b><span>sucesos que aparecen por la calle</span></div>
    <div><b>{sum(len(P[k]["places"]) for k in ORDER)}</b><span>rincones con nombre y algo que hacer</span></div>
    <div><b>10</b><span>géneros, uno por barrio</span></div>
    <div><b>10</b><span>prompts para la IA de guiones</span></div>
  </div>
  <div class="ask">
    <b>Qué necesito para empezar</b>
    <ol>
      <li><b>Tu OK al plan</b> (o los cambios que quieras). Con el OK empiezo a programar el Distrito Cero.</li>
      <li><b>Iker como Encarnación de la Defensa</b> y <b>la Dra. Lasa como la Centralita</b>: las historias de Los Bloques, El Puerto y El Centro dependen de esto.</li>
      <li><b>Los guiones.</b> Mientras llegan los de la IA, programo con textos provisionales y los sustituyo después sin tocar la lógica.</li>
    </ol>
  </div>
  <nav class="toc" aria-label="Secciones"><a href="#como">Cómo se juega un barrio</a><a href="#generos">Las diez historias</a><a href="#hilos">Hilos</a><a href="#matriz">Actividades</a><a href="#barrios">Barrios</a><a href="#siguiente">Al dar el OK</a></nav>
  <nav class="strip" aria-label="Barrios en orden">{strip}</nav>
</header>

<section id="como">
  <h2>Cómo se juega un barrio</h2>
  <ol class="loop">
    <li><b>Llegar</b>Jon cruza la frontera que acaba de abrir. La primera misión presenta el barrio, su gente y su problema.</li>
    <li><b>Tomar la torre</b>Hacia la misión 3 o 4. Descubre en el mapa las actividades, secundarias y secretos.</li>
    <li><b>Copiar la marca</b>La Encarnación deja que Jon la copie cuando se gana su confianza, a mitad de la historia.</li>
    <li><b>Liberar</b>Secundarias, actividades y sucesos bajan el control de la PDC. A 0 % el barrio cambia de nombre y se abre el metro.</li>
    <li><b>Romper el Ancla</b>La última misión usa la marca nueva para llegar al Ancla. Cae la barrera al barrio siguiente.</li>
  </ol>
  <div class="tablewrap"><table class="budget">
    <thead><tr><th>Por barrio</th><th>Cuánto</th><th>Cómo se llega</th></tr></thead>
    <tbody>
      <tr><td>Historia</td><td class="v">≈ 5 h</td><td>10 misiones de 20 a 35 minutos, con cinemáticas y un jefe o una decisión en casi todas.</td></tr>
      <tr><td>Secundarias</td><td class="v">≈ 5 h</td><td>10 misiones con su propio personaje y su pequeña historia, de 25 a 35 minutos.</td></tr>
      <tr><td>Actividades</td><td class="v">2–4 h</td><td>6 actividades repetibles en {n_inst // 10}–{n_inst // 10 + 4} sitios del barrio; cada una con medallas.</td></tr>
      <tr><td>Exploración</td><td class="v">≈ 1 h</td><td>Rincones, 4 secretos, 3 expedientes, la postal y los sucesos de la calle.</td></tr>
    </tbody>
  </table></div>
</section>

<section id="generos">
  <h2>Las diez historias</h2>
  <p>Cada barrio cambia de género para que ninguno se parezca al anterior. Lo que no cambia es la estructura de arriba.</p>
  <div class="tablewrap"><table>
    <thead><tr><th>#</th><th>Barrio</th><th>Título</th><th>Género</th><th>Antagonista</th><th>Marca</th></tr></thead>
    <tbody>{genres}</tbody>
  </table></div>
</section>

<section id="hilos">
  <h2>Los hilos que cruzan la ciudad</h2>
  <ul class="plain">{tdesc}</ul>
  <div class="tablewrap"><table class="threads"><thead><tr><th>Barrio</th>{thead}</tr></thead><tbody>{trows}</tbody></table></div>
</section>

<section id="matriz">
  <h2>Sesenta actividades</h2>
  <p>Seis por barrio y ninguna se juega igual que otra del mismo barrio: oleadas, carreras, puzles, sigilo, persecuciones, rescates, fotografía, ritmo y más. El número es cuántas hay en el barrio.</p>
  <div class="tablewrap"><table class="matrix"><thead><tr><th>Barrio</th><th>A</th><th>B</th><th>C</th><th>D</th><th>E</th><th>F</th></tr></thead><tbody>{mrows}</tbody></table></div>
</section>

<section id="plano">
  <h2>La ciudad</h2>
  <figure class="mapbox">
    <div class="toolbar"><span class="sp"></span><button class="zbtn" type="button" data-zoom="Plano general de Ibaia">Ampliar</button></div>
    <div class="svgwrap">{ov}</div>
    <figcaption>Toca un barrio para ir a su plan.</figcaption>
  </figure>
</section>

<section id="barrios">
  <h2>Los diez barrios</h2>
  {barrios}
</section>

<section id="siguiente">
  <h2>Al dar el OK: el Distrito Cero</h2>
  <div class="next">
    <p>Programo el barrio 1 entero en Ibaia, en este orden, con pruebas automáticas en cada paso:</p>
    <ol>
      <li><b>Sistema de misiones de ciudad:</b> misiones con marcadores en el mapa, diálogos, objetivos, puntos de control y guardado; las secundarias se dan con un personaje en la calle.</li>
      <li><b>Historia «Línea Cero»:</b> las 10 misiones, con la decisión de Pello guardada para Los Bloques.</li>
      <li><b>Las 10 secundarias.</b></li>
      <li><b>Las 6 actividades:</b> bases acólitas por oleadas, el tranvía de la línea 0, las cabinas, las cámaras, las carreras de tejados y los buzones muertos.</li>
      <li><b>Sucesos, control de la PDC por porcentaje y la Torre.</b></li>
      <li><b>Rincones y secretos:</b> el Cine Ascenso, la cripta de San Roque, el mercado, el bar La Catenaria.</li>
    </ol>
    <p class="small">Los diálogos van con textos provisionales hasta que llegue el guion de la IA.</p>
  </div>
</section>

<footer>
  <span>Duraciones estimadas para un jugador que va a la historia sin perderse. Las posiciones de las actividades en los planos son orientativas y se ajustan al construir cada barrio.</span>
  <span>ASCEND · plan de los barrios, versión 1.</span>
</footer>
</div>

<dialog id="viewer" aria-label="Visor de planos">
  <div class="vbar"><span class="t"></span><button class="zbtn" type="button" data-z="out" aria-label="Alejar">−</button><button class="zbtn" type="button" data-z="in" aria-label="Acercar">+</button><button class="zbtn" type="button" data-z="close">Cerrar</button></div>
  <div class="vbody"></div>
</dialog>
<script>{JS}</script>
'''


def markdown():
    out = ['# Plan de los barrios', '', 'Generado por `tools/ciudad/barrios_page.py` a partir de `tools/ciudad/barrios_plan.py`. '
           'Cada barrio: ≈5 h de historia, ≈5 h de secundarias, 6 actividades, 4 sucesos y su prompt de guion (en `docs/guiones/`).', '']
    out += ['## Hilos', ''] + [f'- **{t}.** {desc}' for t, desc, per in THREADS] + ['']
    for i, k in enumerate(ORDER):
        d = P[k]
        b = B[k]
        out += [f'## {i + 1}. {b["name"]} — «{d["title"]}» ({d["genre"]})', '', d['premise'], '',
                f'- **Antagonista:** {d["villain"][0]}. {d["villain"][1]}',
                *[f'- **{n}:** {t}' for n, t in d['allies']],
                f'- **Giro:** {d["twist"]}', f'- **Final:** {d["ending"]}', '',
                '### Rincones', '', *[f'- **{n}:** {t}' for kk, n, at, t in d['places']], '',
                '### Historia', '', *[f'{n + 1}. **{t}** ({m} min, {where(k, pl, B)}). {x}' for n, (t, pl, m, x) in enumerate(d['story'])], '',
                '### Secundarias', '', *[f'{n + 1}. **{t}** ({m} min, {gv}, {where(k, pl, B)}). {x}' for n, (t, gv, pl, m, x) in enumerate(d['side'])], '',
                '### Actividades', '', *[f'- **{LETTERS[a]}. {n}** ({ty}, ×{c}, ≈{mi} min). {x}' for a, (n, ty, c, mi, x, nr) in enumerate(d['acts'])], '',
                '### Sucesos', '', *[f'- **{n}:** {t}' for n, t in d['events']], '']
    return '\n'.join(out)


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else 'page'
    os.makedirs(out, exist_ok=True)
    g = city.build()
    h = page(g)
    open(os.path.join(out, 'barrios.html'), 'w').write(h)
    print('barrios.html', len(h) // 1024, 'KB')
    root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'docs')
    open(os.path.join(root, 'PLAN_BARRIOS.md'), 'w').write(markdown())
    os.makedirs(os.path.join(root, 'guiones'), exist_ok=True)
    for i, k in enumerate(ORDER):
        open(os.path.join(root, 'guiones', f'{i + 1:02d}-{k}.md'), 'w').write(prompt(k, ORDER, B) + '\n')
    print('docs ok')
