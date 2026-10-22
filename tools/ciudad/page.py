"""Genera la página de diseño de la ciudad (HTML) con los planos en línea."""
import math
import os
import shutil
from shapely.geometry import box
from city import build
from plans import overview, barrio_plan, route_points, esc, GOLD
from render import mix
from data import B, MARKS, ORDER, NEW_MARKS, NEW_COMBOS, LIMITS, CITY

c, P, wat, out, br = build()
OUT = 'page'
os.makedirs(f'{OUT}/img', exist_ok=True)
for v in ('ciudad', 'isla', 'ria', 'sur'):
    shutil.copy(f'out/maq-{v}.jpg', f'{OUT}/img/maq-{v}.jpg')


def km2(a):
    return f'{a / 1e6:.2f}'.replace('.', ',')


def kmf(v, d=1):
    return f'{v / 1000:.{d}f}'.replace('.', ',')


def grid_refs(poly):
    refs = []
    for j in range(5):
        for i in range(6):
            cell = box(i * 1000, j * 1000, (i + 1) * 1000, (j + 1) * 1000)
            if poly.intersection(cell).area > 0.04 * cell.area:
                refs.append(f'{"ABCDEF"[i]}{j + 1}')
    return refs


def mv(mid):
    """Variables CSS de una marca: color y versión clara para texto."""
    c_ = MARKS[mid]['color']
    return f'--m:{c_};--mt:{mix(c_, "#ffffff", 0.35)}'


def chip(mid, extra=''):
    m = MARKS[mid]
    new = ' <em>nueva</em>' if m['state'] == 'nueva' else ''
    return f'<span class="mk" style="{mv(mid)}">{esc(m["name"])}{new}{extra}</span>'


def pips(n):
    return '<span class="pips" aria-label="Presencia de la PDC: {} de 5">'.format(n) + ''.join(f'<i class="{"on" if i < n else ""}"></i>' for i in range(5)) + '</span>'


route = route_points()
route_len = sum(math.hypot(route[i + 1][0] - route[i][0], route[i + 1][1] - route[i][1]) for i in range(len(route) - 1))
n_secrets = sum(len(B[b]['secrets']) for b in ORDER)
n_blocked = sum(len(B[b]['blocked']) for b in ORDER)
n_phones = sum(len(B[b]['phones']) for b in ORDER)
n_new = sum(1 for m in MARKS.values() if m['state'] == 'nueva')

CSS = r"""
/* Página de diseño con la identidad de ASCEND: oscura, azul de la Energía y dorado del Destino.
   Columna de lectura centrada; los planos ocupan todo el ancho y se amplían en un visor. */
:root {
  color-scheme: dark;
  --bg: #090d14;
  --panel: #101722;
  --panel-2: #141d2b;
  --line: #24324a;
  --fg: #e6edf6;
  --muted: #95a6bd;
  --energy: #4aa3ff;
  --gold: #f2c45a;
  --pdc: #e0605a;
  --display: 'Rajdhani', 'Arial Narrow', Arial, sans-serif;
  --body: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
  --measure: 68ch;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--fg); font: 400 15px/1.6 var(--body); }
.wrap { max-width: 1180px; margin: 0 auto; padding-block: 40px 80px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); display: flex; flex-direction: column; gap: 64px; }
h1, h2, h3, h4 { font-family: var(--display); font-weight: 700; line-height: 1.1; margin: 0; text-wrap: balance; }
h1 { font-size: clamp(56px, 11vw, 120px); letter-spacing: .16em; line-height: .95; }
h2 { font-size: clamp(28px, 4vw, 40px); letter-spacing: .04em; }
h3 { font-size: clamp(26px, 3.4vw, 34px); letter-spacing: .04em; }
h4 { font-size: 15px; letter-spacing: .16em; text-transform: uppercase; color: var(--gold); }
p { margin: 0; max-width: var(--measure); }
a { color: var(--energy); }
a:focus-visible, button:focus-visible, summary:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }
.eyebrow { font: 600 13px var(--display); letter-spacing: .24em; text-transform: uppercase; color: var(--energy); }
.muted { color: var(--muted); }
header.top { display: flex; flex-direction: column; gap: 18px; }
.lede { font-size: 18px; max-width: 70ch; }
.facts { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1px; background: var(--line); border: 1px solid var(--line); }
.facts div { background: var(--panel); padding: 14px 16px; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.facts b { font: 700 30px/1 var(--display); font-variant-numeric: tabular-nums; letter-spacing: .02em; }
.facts span { font-size: 13px; color: var(--muted); }
.ask { border: 1px solid var(--line); border-left: 3px solid var(--gold); background: var(--panel); padding: 18px 20px; display: flex; flex-direction: column; gap: 10px; max-width: 820px; }
.ask ol { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 6px; }
nav.toc { display: flex; flex-wrap: wrap; gap: 8px; }
nav.toc a { text-decoration: none; color: var(--fg); border: 1px solid var(--line); padding: 6px 12px; font: 600 14px var(--display); letter-spacing: .08em; text-transform: uppercase; }
nav.toc a:hover { border-color: var(--energy); }
section { display: flex; flex-direction: column; gap: 22px; scroll-margin-top: 16px; }
figure { margin: 0; display: flex; flex-direction: column; gap: 8px; min-width: 0; }
figure img { width: 100%; height: auto; display: block; border: 1px solid var(--line); background: var(--panel); }
figcaption { font-size: 13px; color: var(--muted); }
.pillars { display: grid; grid-template-columns: repeat(auto-fit, minmax(270px, 1fr)); gap: 1px; background: var(--line); border: 1px solid var(--line); }
.pillars div { background: var(--panel); padding: 16px 18px; display: flex; flex-direction: column; gap: 6px; }
.pillars b { font: 700 18px var(--display); letter-spacing: .04em; }
.pillars p { font-size: 14px; color: #c9d4e3; }
/* Plano general */
.mapbox { background: var(--panel); border: 1px solid var(--line); padding: 10px; display: flex; flex-direction: column; gap: 10px; }
.toolbar { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.toolbar button, .zbtn { font: 600 13px var(--display); letter-spacing: .08em; text-transform: uppercase; color: var(--muted); background: var(--panel-2); border: 1px solid var(--line); padding: 5px 10px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
.toolbar button[aria-pressed="true"] { color: var(--fg); border-color: #3a4d6e; }
.toolbar button[aria-pressed="false"] { opacity: .55; text-decoration: line-through; }
.toolbar .sp { flex: 1; }
.sw { display: inline-block; width: 12px; height: 12px; }
.svgwrap { overflow-x: auto; }
svg.map, svg.plan { width: 100%; height: auto; display: block; min-width: 560px; }
svg text { font-family: var(--display); }
.bz path { transition: fill-opacity .15s; cursor: pointer; }
.bz:hover path, .bz:focus path { fill-opacity: .14; stroke-width: 3; }
.legend { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px 16px; font-size: 13px; color: var(--muted); }
.legend li { display: inline-flex; align-items: center; gap: 7px; }
.lg { display: inline-block; flex: none; }
.lg-gate { width: 11px; height: 11px; background: var(--energy); transform: rotate(45deg); outline: 2px solid #070a10; }
.lg-star { width: 14px; height: 14px; background: var(--gold); clip-path: polygon(50% 0, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%); }
.lg-sec { width: 12px; height: 12px; border-radius: 50%; background: var(--gold); }
.lg-blk { width: 13px; height: 13px; border-radius: 50%; border: 2px solid #ff6fa8; background: repeating-linear-gradient(45deg, #ff6fa8 0 2px, transparent 2px 5px); }
.lg-pdc { width: 10px; height: 10px; background: var(--pdc); }
.lg-tel { width: 12px; height: 12px; border-radius: 3px; background: #e6edf6; }
.lg-route { width: 22px; height: 0; border-top: 3px dotted var(--gold); }
.lg-brg { width: 22px; height: 0; border-top: 4px dashed var(--pdc); }
.lg-wall { width: 22px; height: 0; border-top: 4px solid #c9a46a; }
/* Ruta de marcas */
.strip { display: grid; grid-template-columns: repeat(10, minmax(0, 1fr)); gap: 4px; }
.strip a { text-decoration: none; color: var(--fg); background: var(--panel); border: 1px solid var(--line); border-top: 4px solid var(--m); padding: 8px 8px 10px; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.strip a:hover { background: var(--panel-2); }
.strip b { font: 700 22px/1 var(--display); color: var(--m); }
.strip span { font: 600 13px var(--display); letter-spacing: .04em; overflow-wrap: anywhere; }
.strip small { font-size: 12px; color: var(--muted); }
.tablewrap { overflow-x: auto; border: 1px solid var(--line); }
table { border-collapse: collapse; width: 100%; font-size: 14px; }
th, td { text-align: left; vertical-align: top; padding: 10px 12px; border-bottom: 1px solid var(--line); }
th { font: 600 12px var(--display); letter-spacing: .14em; text-transform: uppercase; color: var(--muted); background: var(--panel); }
td.n { font: 700 18px var(--display); font-variant-numeric: tabular-nums; color: var(--gold); width: 36px; }
tbody tr:nth-child(odd) td { background: rgba(255,255,255,.015); }
.mk { display: inline-flex; align-items: center; gap: 6px; font: 600 13px var(--display); letter-spacing: .06em; text-transform: uppercase; color: var(--m); border: 1px solid var(--m); padding: 1px 8px; white-space: nowrap; }
.mk::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: var(--m); }
.mk em { font-style: normal; color: #1a1406; background: var(--gold); padding: 0 5px; margin-left: 2px; }
/* Barrios */
.barrio { border-top: 1px solid var(--line); padding-top: 26px; display: flex; flex-direction: column; gap: 18px; scroll-margin-top: 16px; }
.bh { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 4px 18px; align-items: start; }
.bh .num { font: 700 64px/0.9 var(--display); color: var(--m); font-variant-numeric: tabular-nums; grid-row: span 2; }
.bh .tag { color: #c9d4e3; font-size: 16px; }
.meta { display: flex; flex-wrap: wrap; gap: 6px 14px; align-items: center; font-size: 13px; color: var(--muted); }
.meta b { color: var(--fg); font-weight: 600; }
.pips { display: inline-flex; gap: 3px; vertical-align: middle; }
.pips i { width: 9px; height: 9px; border: 1px solid var(--pdc); }
.pips i.on { background: var(--pdc); }
.bgrid { display: grid; grid-template-columns: minmax(0, 1.65fr) minmax(0, 1fr); gap: 20px; align-items: start; }
.planbox { background: var(--panel); border: 1px solid var(--line); padding: 8px; position: relative; }
.planbox .zbtn { position: absolute; top: 14px; right: 14px; }
.side { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
.side dl { margin: 0; display: flex; flex-direction: column; gap: 12px; }
.side dt { font: 600 12px var(--display); letter-spacing: .16em; text-transform: uppercase; color: var(--muted); }
.side dd { margin: 2px 0 0; font-size: 14px; }
.side dd b { font-family: var(--display); font-size: 17px; letter-spacing: .03em; }
.gatecard { border: 1px solid var(--line); border-left: 4px solid var(--m); background: var(--panel); padding: 12px 14px; display: flex; flex-direction: column; gap: 6px; }
.gatecard .gt { font: 700 18px var(--display); letter-spacing: .03em; }
.gatecard p { font-size: 14px; color: #c9d4e3; }
.cols { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 22px; }
.cols > div { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.cols ul, .cols ol { margin: 0; padding-left: 0; list-style: none; display: flex; flex-direction: column; gap: 8px; font-size: 14px; }
.cols li b { font-family: var(--display); font-size: 16px; letter-spacing: .02em; }
.cols li span { color: #b8c5d6; }
ol.secrets li { display: grid; grid-template-columns: 22px minmax(0, 1fr); gap: 8px; }
ol.secrets li::before { content: attr(data-n); width: 20px; height: 20px; border-radius: 50%; background: var(--gold); color: #1a1406; font: 700 13px/20px var(--display); text-align: center; margin-top: 2px; }
ul.blocked li { display: flex; flex-direction: column; gap: 3px; }
.small { font-size: 14px; color: #c9d4e3; }
/* Galería y marcas */
.gallery { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.marks { display: grid; grid-template-columns: repeat(auto-fit, minmax(330px, 1fr)); gap: 14px; }
.markcard { background: var(--panel); border: 1px solid var(--line); border-top: 4px solid var(--m); padding: 16px 18px; display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.markcard h3 { color: var(--m); font-size: 28px; }
.markcard .who { font-size: 13px; color: var(--muted); }
.markcard dl { margin: 0; display: grid; grid-template-columns: 74px minmax(0, 1fr); gap: 6px 10px; font-size: 14px; }
.markcard dt { font: 700 13px var(--display); letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
.markcard dd { margin: 0; }
.markcard .key { border-top: 1px solid var(--line); padding-top: 8px; font-size: 14px; }
.backs { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 12px; }
.backs > div { background: var(--panel); border: 1px solid var(--line); border-left: 4px solid var(--m); padding: 12px 14px; display: flex; flex-direction: column; gap: 6px; }
.backs ul { margin: 0; padding-left: 18px; font-size: 14px; display: flex; flex-direction: column; gap: 4px; }
.steps { margin: 0; padding-left: 22px; display: flex; flex-direction: column; gap: 10px; max-width: 860px; }
.steps b { font-family: var(--display); font-size: 17px; letter-spacing: .04em; }
.plain { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 6px; max-width: 860px; }
footer { border-top: 1px solid var(--line); padding-top: 18px; font-size: 13px; color: var(--muted); display: flex; flex-direction: column; gap: 8px; }
/* Visor */
dialog#viewer { width: min(96vw, 1500px); height: min(92vh, 1100px); max-width: none; max-height: none; padding: 0; border: 1px solid var(--line); background: var(--bg); color: var(--fg); }
dialog#viewer::backdrop { background: rgba(3, 5, 9, .82); }
.vbar { display: flex; gap: 6px; align-items: center; padding: 8px 10px; border-bottom: 1px solid var(--line); background: var(--panel); }
.vbar .t { font: 700 16px var(--display); letter-spacing: .06em; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vbody { overflow: auto; height: calc(100% - 48px); cursor: grab; }
.vbody svg { display: block; min-width: 0; }

.mk { color: var(--mt, var(--m)); }
.strip b { color: var(--mt, var(--m)); }
.bh .num { color: var(--mt, var(--m)); }
.markcard h3 { color: var(--mt, var(--m)); }
ul.have { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 10px; font-size: 14px; }
ul.have li { display: flex; flex-wrap: wrap; gap: 4px 8px; align-items: center; }
@media (max-width: 700px) { .facts { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 900px) {
  .bgrid, .cols { grid-template-columns: minmax(0, 1fr); }
  .gallery { grid-template-columns: minmax(0, 1fr); }
  .strip { grid-template-columns: repeat(5, minmax(0, 1fr)); }
}
@media (max-width: 520px) {
  .strip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .bh .num { font-size: 48px; }
}
@media (prefers-reduced-motion: reduce) { * { transition: none !important; scroll-behavior: auto !important; } }
"""

JS = r"""
(() => {
  const map = document.querySelector('svg.map');
  document.querySelectorAll('[data-layer]').forEach((b) => {
    b.addEventListener('click', () => {
      const on = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', on);
      map.querySelectorAll('.' + b.dataset.layer).forEach((g) => { g.style.display = on ? '' : 'none'; });
    });
  });
  const dlg = document.getElementById('viewer');
  const body = dlg.querySelector('.vbody');
  const title = dlg.querySelector('.t');
  let zoom = 1, svg = null;
  const apply = () => { if (svg) svg.style.width = (body.clientWidth - 2) * zoom + 'px'; };
  const open = (src, name) => {
    body.innerHTML = '';
    svg = src.cloneNode(true);
    svg.style.minWidth = '0';
    body.appendChild(svg);
    title.textContent = name;
    zoom = 1;
    dlg.showModal();
    apply();
  };
  document.querySelectorAll('[data-zoom]').forEach((b) => {
    b.addEventListener('click', () => open(b.closest('figure').querySelector('svg'), b.dataset.zoom));
  });
  const setZoom = (z) => {
    const cx = (body.scrollLeft + body.clientWidth / 2) / (svg.clientWidth || 1);
    const cy = (body.scrollTop + body.clientHeight / 2) / (svg.clientHeight || 1);
    zoom = Math.max(1, Math.min(6, z));
    apply();
    body.scrollLeft = cx * svg.clientWidth - body.clientWidth / 2;
    body.scrollTop = cy * svg.clientHeight - body.clientHeight / 2;
  };
  dlg.querySelector('[data-z="in"]').addEventListener('click', () => setZoom(zoom * 1.6));
  dlg.querySelector('[data-z="out"]').addEventListener('click', () => setZoom(zoom / 1.6));
  dlg.querySelector('[data-z="close"]').addEventListener('click', () => dlg.close());
  let drag = null;
  body.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, l: body.scrollLeft, t: body.scrollTop }; });
  window.addEventListener('pointerup', () => { drag = null; });
  body.addEventListener('pointermove', (e) => {
    if (!drag) return;
    body.scrollLeft = drag.l - (e.clientX - drag.x);
    body.scrollTop = drag.t - (e.clientY - drag.y);
  });
  window.addEventListener('resize', apply);
})();
"""


def barrio_html(i, bid):
    d = B[bid]
    m = MARKS[d['mark']]
    poly = P[bid]
    land = out[bid]['land'].area
    water = poly.area - land
    minx, miny, maxx, maxy = poly.bounds
    refs = grid_refs(poly)
    plan = barrio_plan(bid, c, P, wat, out, br)
    inc = d['incarnation']
    enc = (f'<dd><b>{esc(inc["name"])}</b>, {esc(inc["role"])}. {esc(d["incarnationText"])}</dd>' if inc
           else f'<dd>{esc(d["incarnationText"])}</dd>')
    if d['exit']:
        e = d['exit']
        to = B[e['to']]
        gate = (f'<div class="gatecard"><span class="eyebrow" style="color:var(--mt)">Frontera {i + 1} · salida hacia {esc(to["name"])}</span>'
                f'<span class="gt">{esc(e["name"])}</span><p>{esc(e["text"])}</p><div>{chip(d["mark"], " · llave")}</div></div>')
    else:
        gate = f'<div class="gatecard"><span class="eyebrow" style="color:var(--mt)">Final</span><p>{esc(d["exitText"])}</p></div>'
    zones = ''.join(f'<li><b>{esc(n)}</b><br><span>{esc(t)}</span></li>' for n, at, t in d['zones'])
    secrets = ''.join(f'<li data-n="{k + 1}"><div><b>{esc(n)}</b><br><span>{esc(t)}</span></div></li>' for k, (n, at, req, t) in enumerate(d['secrets']))
    blocked = ''.join(f'<li><div>{chip(req)}</div><b>{esc(n)}</b><span>{esc(t)}</span></li>' for n, at, req, t in d['blocked']) or '<li><span>Ninguna: es el último barrio.</span></li>'
    return f'''
<article class="barrio" id="{bid.lower()}" style="{mv(d['mark'])}">
  <div class="bh">
    <span class="num">{i + 1}</span>
    <h3>{esc(d['name'])}</h3>
    <div style="display:flex;flex-direction:column;gap:8px">
      <p class="tag">{esc(d['tagline'])}</p>
      <div class="meta">
        {chip(d['mark'])}
        <span><b>{km2(poly.area)} km²</b> ({km2(land)} de tierra · {km2(water)} de agua)</span>
        <span>{kmf(maxx - minx)} × {kmf(maxy - miny)} km</span>
        <span>Cuadrículas <b>{', '.join(refs)}</b></span>
        <span>PDC {pips(d['pdc'])}</span>
      </div>
    </div>
  </div>
  <div class="bgrid">
    <figure class="planbox">
      <button class="zbtn" type="button" data-zoom="{i + 1} · {esc(d['name'])}">Ampliar</button>
      <div class="svgwrap">{plan}</div>
    </figure>
    <div class="side">
      <dl>
        <div><dt>Encarnación</dt>{enc}</div>
        <div><dt>Llegada</dt><dd>{esc(d['arrive'])}</dd></div>
        <div><dt>Relieve</dt><dd>{esc(d['relief'])}</dd></div>
        <div><dt>Ambiente</dt><dd>{esc(d['mood'])}</dd></div>
      </dl>
      {gate}
    </div>
  </div>
  <div class="cols">
    <div><h4>Zonas e hitos</h4><ul>{zones}</ul></div>
    <div><h4>Secretos</h4><ol class="secrets">{secrets}</ol></div>
    <div>
      <h4>Áreas bloqueadas</h4><ul class="blocked">{blocked}</ul>
      <h4>PDC</h4><p class="small">{esc(d['pdcText'])}</p>
      <h4>Fuentes de carga</h4><p class="small">{esc(d['sources'])}</p>
      <h4>Acólitos</h4><p class="small">{esc(d['acolytes'])}</p>
    </div>
  </div>
</article>'''


def page():
    ov = overview(c, P, wat, out, br)
    strip = ''.join(f'<a href="#{b.lower()}" style="{mv(B[b]["mark"])}"><b>{i + 1}</b><span>{esc(B[b]["name"])}</span><small>{esc(MARKS[B[b]["mark"]]["name"])}{" · nueva" if MARKS[B[b]["mark"]]["state"] == "nueva" else ""}</small></a>' for i, b in enumerate(ORDER))
    rows = ''
    for i, b in enumerate(ORDER[:-1]):
        e = B[b]['exit']
        rows += (f'<tr><td class="n">{i + 1}</td><td><b>{esc(B[b]["name"])}</b> → {esc(B[e["to"]]["name"])}</td>'
                 f'<td><b>{esc(e["name"])}</b></td><td>{chip(B[b]["mark"])}</td><td>{esc(e["text"])}</td></tr>')
    barrios = ''.join(barrio_html(i, b) for i, b in enumerate(ORDER))
    newmarks = ''
    for mid, nm in NEW_MARKS.items():
        m = MARKS[mid]
        newmarks += f'''<div class="markcard" style="{mv(mid)}">
  <h3>{esc(m['name'])}</h3><span class="who">Encarnación: {esc(nm['who'])}</span>
  <dl><dt>Disparo</dt><dd>{esc(nm['fire'])}</dd><dt>Q</dt><dd>{esc(nm['q'])}</dd><dt>R</dt><dd>{esc(nm['r'])}</dd>
  <dt>G</dt><dd>{esc(nm['g'])}</dd><dt>X</dt><dd>{esc(nm['x'])}</dd><dt>Pasiva</dt><dd>{esc(nm['passive'])}</dd><dt>Fuentes</dt><dd>{esc(nm['sources'])}</dd></dl>
  <p class="key"><b>Llave de frontera:</b> {esc(nm['key'])}</p></div>'''
    have = ''.join(f'<li>{chip(mid)} <span class="muted">{esc(B[MARKS[mid]["barrio"]]["name"])}:</span> {esc(B[MARKS[mid]["barrio"]]["exit"]["name"])}</li>' for mid in ['energia', 'hilo', 'gravedad', 'temperatura', 'alas'])
    newmarks += f'''<div class="markcard" style="--m:#95a6bd;--mt:#c9d4e3">
  <h3>Las cinco que ya existen</h3><span class="who">Mismos poderes que en el juego; en la ciudad se consiguen aquí y abren estas fronteras.</span>
  <ul class="have">{have}</ul></div>'''
    combos = ''.join(f'<tr><td><b>{esc(a)}</b></td><td>{esc(b_)}</td><td>{esc(c_)}</td><td>{esc(d_)}</td></tr>' for a, b_, c_, d_ in NEW_COMBOS)
    backs = ''
    for mid in ['marea', 'temperatura', 'raiz', 'eco', 'sombra', 'alas', 'sangre']:
        items = [(b, n) for b in ORDER for n, at, req, t in B[b]['blocked'] if req == mid]
        if not items:
            continue
        li = ''.join(f'<li><b>{esc(n)}</b> <span class="muted">({esc(B[b]["name"])})</span></li>' for b, n in items)
        backs += f'<div style="{mv(mid)}">{chip(mid)}<ul>{li}</ul></div>'
    limits = ''.join(f'<li><b>{esc(a)}:</b> {esc(t)}</li>' for a, t in LIMITS)
    toggles = [('lyr-route', 'Ruta', '<span class="lg lg-route"></span>'), ('lyr-gates', 'Fronteras', '<span class="lg lg-gate"></span>'),
               ('lyr-enc', 'Encarnaciones', '<span class="lg lg-star"></span>'), ('lyr-secrets', 'Secretos', '<span class="lg lg-sec"></span>'),
               ('lyr-blocked', 'Áreas bloqueadas', '<span class="lg lg-blk"></span>'), ('lyr-pdc', 'PDC', '<span class="lg lg-pdc"></span>'),
               ('lyr-bridges', 'Puentes', '<span class="lg lg-brg"></span>'), ('lyr-labels', 'Rótulos', ''), ('lyr-grid', 'Cuadrícula', '')]
    tb = ''.join(f'<button type="button" data-layer="{cls}" aria-pressed="true">{sw}{esc(t)}</button>' for cls, t, sw in toggles)
    html = f'''<title>Ciudad de Ibaia</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>{CSS}</style>
<div class="wrap">
<header class="top">
  <span class="eyebrow">ASCEND · Diseño del mapa de la ciudad</span>
  <h1>IBAIA</h1>
  <p class="lede">La ciudad a la que mira Jon al final del prólogo: <b>30 km²</b> repartidos en <b>diez barrios de 3 km² exactos</b>. Cada barrio guarda una Encarnación y su marca es la llave para cruzar al siguiente. Se recorre en espiral, desde la colina del prólogo hasta la isla del centro, donde la PDC tiene a Iker.</p>
  <div class="facts">
    <div><b>30,00 km²</b><span>6 × 5 km, con la ría y la costa</span></div>
    <div><b>10 × 3,00</b><span>barrios de 3 km² (área calculada)</span></div>
    <div><b>10</b><span>marcas, una por barrio ({n_new} nuevas)</span></div>
    <div><b>9</b><span>fronteras que se abren con una marca</span></div>
    <div><b>{n_secrets}</b><span>secretos con nombre, más 30 expedientes</span></div>
    <div><b>{n_blocked}</b><span>áreas que piden una marca posterior</span></div>
    <div><b>{kmf(route_len)} km</b><span>de ruta principal (≈{round(route_len / 9.5 / 60)} min a la carrera)</span></div>
    <div><b>{n_phones}</b><span>teléfonos públicos de viaje rápido</span></div>
  </div>
  <div class="ask">
    <b>Qué necesito que decidas</b>
    <ol>
      <li><b>El nombre de la ciudad.</b> Ibaia («el río») es provisional.</li>
      <li><b>¿Se puede copiar a Narbaiza?</b> Propongo que sí: la Sangre sería la décima marca y el cierre del acto. Si no, el barrio 10 queda solo como final.</li>
      <li><b>Orden fijo o con elección.</b> La espiral es lineal; se puede dejar elegir el orden de Los Jardines y La Ópera.</li>
      <li><b>Las cinco marcas nuevas</b> (Marea, Raíz, Eco, Sombra y Sangre) y los nombres de las Encarnaciones.</li>
    </ol>
  </div>
  <nav class="toc" aria-label="Secciones">
    <a href="#reglas">Reglas</a><a href="#plano">Plano general</a><a href="#ruta">Ruta de marcas</a><a href="#barrios">Barrios</a>
    <a href="#maqueta">Maqueta</a><a href="#marcas">Marcas nuevas</a><a href="#volver">Volver</a><a href="#bordes">Bordes</a><a href="#construir">Cómo se construye</a>
  </nav>
</header>

<figure>
  <img src="img/maq-ciudad.jpg" width="1600" height="900" alt="Vista aérea de la maqueta de volúmenes de la ciudad: la isla fortificada en el centro, la ría, el puerto a la izquierda y la sierra al fondo">
  <figcaption>Maqueta de volúmenes generada con los mismos planos de esta página (alturas por tipo de barrio). La isla del centro es la Ciudadela; la ría la rodea y sale al mar por la izquierda.</figcaption>
</figure>

<section id="reglas">
  <h2>Las reglas de la ciudad</h2>
  <div class="pillars">
    <div><b>El Cierre</b><p>Tras la fuga de Jon, la PDC selló la ciudad en diez sectores. Cada frontera tiene un obstáculo pensado para gente corriente: un ascensor sin corriente, una trinchera sin pasarelas, una ría sin barquilla. Nadie contaba con alguien que copia marcas.</p></div>
    <div><b>Una marca por barrio</b><p>En cada barrio vive una Encarnación, y su marca es justo la que vence el obstáculo de la salida. Se copia con las reglas de siempre: contacto y voluntad.</p></div>
    <div><b>Nueve fronteras</b><p>Se abren en orden. Una vez abierta, una frontera queda abierta en los dos sentidos y sirve de atajo.</p></div>
    <div><b>Volver con marcas nuevas</b><p>{n_blocked} áreas de barrios anteriores solo se abren con marcas posteriores: un metro inundado, cámaras blindadas, azoteas sin acceso. Premian volver.</p></div>
    <div><b>Viaje rápido y pisos francos</b><p>Dos teléfonos públicos por barrio ({n_phones} en total): la Centralita, la voz de la resistencia, llama en ellos. Un piso franco por barrio para guardar y mejorar.</p></div>
    <div><b>La torre como brújula</b><p>La Torre del Control (180 m) se ve desde los diez barrios. Los cinco puentes levadizos de la isla están siempre a la vista y siempre levantados, hasta el final.</p></div>
    <div><b>Liberar un barrio (propuesta)</b><p>Cada barrio tiene tres puestos de la PDC: control, antena y drones. Si los neutralizas, bajan las patrullas en ese barrio.</p></div>
  </div>
</section>

<section id="plano">
  <h2>Plano general</h2>
  <p class="muted">Cuadrícula de 1 km (A–F, 1–5). Toca un barrio para ir a su ficha. Los rombos numerados son las fronteras en el orden en que se abren; la línea dorada es la ruta del Destino.</p>
  <figure class="mapbox">
    <div class="toolbar">{tb}<span class="sp"></span><button class="zbtn" type="button" data-zoom="Plano general de Ibaia">Ampliar</button></div>
    <div class="svgwrap">{ov}</div>
    <ul class="legend">
      <li><span class="lg lg-gate"></span>Frontera (color de la marca que la abre)</li>
      <li><span class="lg lg-star"></span>Encarnación</li>
      <li><span class="lg lg-sec"></span>Secreto</li>
      <li><span class="lg lg-blk"></span>Área bloqueada (color de la marca que pide)</li>
      <li><span class="lg lg-pdc"></span>Puesto de la PDC</li>
      <li><span class="lg lg-brg"></span>Puente levadizo levantado</li>
      <li><span class="lg lg-wall"></span>Muralla</li>
      <li><span class="lg lg-route"></span>Ruta principal</li>
    </ul>
  </figure>
</section>

<section id="ruta">
  <h2>La ruta de las marcas</h2>
  <p>Jon llega con la Energía, la marca que copió en el pueblo. A partir de ahí, cada barrio le da la llave del siguiente.</p>
  <nav class="strip" aria-label="Barrios en orden">{strip}</nav>
  <div class="tablewrap"><table>
    <thead><tr><th>#</th><th>Paso</th><th>Frontera</th><th>Llave</th><th>Cómo se cruza</th></tr></thead>
    <tbody>{rows}</tbody>
  </table></div>
</section>

<section id="barrios">
  <h2>Los diez barrios</h2>
  <p class="muted">Cada plano muestra las manzanas y solares del barrio, sus hitos, la Encarnación (estrella), las fronteras de entrada y salida (rombos), los secretos numerados, las áreas bloqueadas (círculo rayado con candado), los puestos de la PDC (cuadrados rojos) y los teléfonos (iconos blancos). Usa «Ampliar» para ver el detalle.</p>
  {barrios}
</section>

<section id="maqueta">
  <h2>Vistas de la maqueta</h2>
  <div class="gallery">
    <figure><img src="img/maq-isla.jpg" width="1600" height="900" loading="lazy" alt="La Ciudadela vista desde el Barrio Alto: la fortaleza en estrella con la Torre del Control y la ría alrededor"><figcaption>La Ciudadela desde el Barrio Alto: lo que Jon ve antes de volar hasta la isla.</figcaption></figure>
    <figure><img src="img/maq-ria.jpg" width="1600" height="900" loading="lazy" alt="La boca de la ría con el puerto pesquero de colores a la izquierda y los astilleros en primer plano"><figcaption>La boca de la ría: La Lonja a la izquierda y Los Astilleros delante, con el cementerio de barcos en la playa.</figcaption></figure>
    <figure><img src="img/maq-sur.jpg" width="1600" height="900" loading="lazy" alt="El sur de la ciudad: el Barrio Verde invadido por la vegetación, el parque y la trama radial de la Ópera"><figcaption>El sur: el Barrio Verde, el parque de Los Jardines y la trama radial de La Ópera.</figcaption></figure>
  </div>
</section>

<section id="marcas">
  <h2>Las cinco marcas nuevas</h2>
  <p>Con la misma estructura que las cinco del juego: disparo, movilidad (Q), tres habilidades (R, G, X) y una pasiva. Energía, Hilo, Gravedad, Temperatura y Alas no cambian.</p>
  <div class="marks">{newmarks}</div>
  <h4>Combos nuevos</h4>
  <div class="tablewrap"><table><thead><tr><th>Combo</th><th>Marcas</th><th>Cómo</th><th>Efecto</th></tr></thead><tbody>{combos}</tbody></table></div>
</section>

<section id="volver">
  <h2>Qué abre cada marca al volver</h2>
  <p>Las áreas bloqueadas, agrupadas por la marca que las abre. Son las razones para volver a los barrios ya recorridos.</p>
  <div class="backs">{backs}</div>
</section>

<section id="bordes">
  <h2>Los bordes del mapa</h2>
  <p>Nunca se ve el vacío: alrededor de los 30 km² hay mar, sierra y valle modelados a baja resolución, como en el prólogo.</p>
  <ul class="plain">{limits}</ul>
</section>

<section id="construir">
  <h2>Cómo se construye</h2>
  <ul class="plain">
    <li><b>Escala real.</b> 1 unidad = 1 m, como el resto del juego. Cruzar un barrio a la carrera lleva unos 3 minutos; la ruta completa, unos {round(route_len / 9.5 / 60)}.</li>
    <li><b>Carga por celdas.</b> La ciudad se trocea en celdas de 250 m (480 en total). Cerca de Jon, detalle completo hasta unos 600 m; hasta 1,5 km, manzanas simplificadas; más lejos, una silueta por barrio y la Torre siempre visible. La calidad automática y la niebla que ya existen ajustan esas distancias.</li>
    <li><b>Generada desde estos planos.</b> Las manzanas y solares de esta página se exportan como datos y los edificios se montan con el kit de ciudad del Distrito Cero (fachadas, cornisas, azoteas, neones), con una paleta por barrio.</li>
    <li><b>Hecho a mano.</b> Plazas, hitos, las nueve fronteras, las Encarnaciones, los secretos y las áreas bloqueadas: unas 15–20 piezas por barrio.</li>
    <li><b>Colisión, PDC y guardado por celda.</b> Solo las celdas cercanas tienen colisión y enemigos; la PDC navega con la rejilla A* que ya usan los guardias de la base. Se guardan las fronteras abiertas, los secretos, las áreas abiertas y los teléfonos.</li>
  </ul>
  <h4>Fases</h4>
  <ol class="steps">
    <li><b>Maqueta jugable.</b> Toda la ciudad en volúmenes grises con carga por celdas, la ría, la isla y las nueve fronteras funcionando con marcas de prueba.</li>
    <li><b>Distrito Cero y Casco Viejo.</b> Energía e Hilo ya existen.</li>
    <li><b>La Lonja, Los Astilleros y Altos Hornos.</b> Marca nueva: Marea (Gravedad y Temperatura ya existen).</li>
    <li><b>Los Jardines, La Ópera y El Viaducto.</b> Marcas nuevas: Raíz, Eco y Sombra.</li>
    <li><b>Barrio Alto y La Ciudadela.</b> Alas ya existe; marca nueva: Sangre. Final del acto.</li>
  </ol>
  <p class="muted">Cada marca nueva es tanto trabajo como lo fue cada una de las cinco actuales (poderes, efectos, interfaz y pruebas). Con 30 km², la densidad sale de generar los edificios desde datos; el detalle a mano se concentra donde se juega.</p>
</section>

<footer>
  <span>Áreas calculadas sobre la geometría de los planos: cada barrio mide 3,00 km² (incluida su parte de ría o mar) y el conjunto, 30,00 km². Planos y maqueta generados a partir de los mismos datos.</span>
  <span>ASCEND · propuesta de diseño, sujeta a tus decisiones.</span>
</footer>
</div>

<dialog id="viewer" aria-label="Visor de planos">
  <div class="vbar"><span class="t"></span><button class="zbtn" type="button" data-z="out" aria-label="Alejar">−</button><button class="zbtn" type="button" data-z="in" aria-label="Acercar">+</button><button class="zbtn" type="button" data-z="close">Cerrar</button></div>
  <div class="vbody"></div>
</dialog>
<script>{JS}</script>
'''
    return html


if __name__ == '__main__':
    h = page()
    open(f'{OUT}/ciudad.html', 'w').write(h)
    print(len(h) // 1024, 'KB')
