"""Página de diseño de la ciudad (v2) con los planos en línea y la maqueta."""
import os
import shutil
from shapely.geometry import box
import city
from plans import overview, plan, esc, mix, tcol, GOLD
from data import B, MARKS, ORDER, NEW_MARKS, NEW_COMBOS, LIMITS, CITY, REFS, BARRIERS, SYSTEMS
from fabric import polys

g = city.build()
OUT = 'page'
os.makedirs(f'{OUT}/img', exist_ok=True)
for v in ('ciudad', 'centro', 'midtown', 'colinas'):
    shutil.copy(f'out/maq-{v}.jpg', f'{OUT}/img/maq-{v}.jpg')

CSS = open('base.css').read()
JS = open('base.js').read()
CSS += r"""
.mk { color: var(--mt, var(--m)); }
.strip b, .bh .num, .markcard h3 { color: var(--mt, var(--m)); }
ul.have { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 10px; font-size: 14px; }
ul.have li { display: flex; flex-wrap: wrap; gap: 4px 8px; align-items: center; }
.refgrid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.ref { background: var(--panel); border: 1px solid var(--line); padding: 14px 16px; display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.ref h3 { font-size: 21px; letter-spacing: .02em; }
.ref .city { font: 600 12px var(--display); letter-spacing: .18em; text-transform: uppercase; color: var(--gold); }
.ref ul { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 5px; font-size: 14px; color: #c9d4e3; }
.barrier { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); gap: 22px; align-items: start; }
.barrier .txt { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
.barrier .txt p { font-size: 15px; }
.steps3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1px; background: var(--line); border: 1px solid var(--line); }
.steps3 div { background: var(--panel); padding: 12px 14px; display: flex; flex-direction: column; gap: 4px; }
.steps3 b { font: 700 16px var(--display); color: #ffcf85; letter-spacing: .04em; }
.steps3 span { font-size: 13px; color: #c9d4e3; }
.who { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px; }
.who div { border: 1px solid var(--line); background: var(--panel); padding: 12px 14px; display: flex; flex-direction: column; gap: 6px; font-size: 14px; }
.who div:first-child { border-color: #ffb547; }
.who b { font-family: var(--display); font-size: 17px; letter-spacing: .03em; }
.reveal { border: 1px solid #ffb547; background: linear-gradient(90deg, rgba(255,181,71,.12), rgba(255,181,71,0)); padding: 12px 16px; display: flex; flex-direction: column; gap: 4px; }
.reveal b { font: 700 13px var(--display); letter-spacing: .2em; text-transform: uppercase; color: #ffcf85; }
.refline { font-size: 13px; color: var(--muted); }
.refline b { color: #c9d4e3; font-weight: 600; }
.lg-anc { width: 14px; height: 14px; background: #ffb547; clip-path: polygon(25% 5%, 75% 5%, 100% 50%, 75% 95%, 25% 95%, 0 50%); }
.lg-bar { width: 22px; height: 0; border-top: 3px solid #ffb547; box-shadow: 0 0 6px #ffb547; }
.lg-twr { width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-bottom: 13px solid var(--pdc); }
.lg-met { width: 13px; height: 13px; border-radius: 50%; background: #e6edf6; }
.lg-hwy { width: 22px; height: 0; border-top: 4px solid #e2b552; }
.lg-elev { width: 22px; height: 0; border-top: 3px dashed #c9d0d9; }
.systems { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1px; background: var(--line); border: 1px solid var(--line); }
.systems div { background: var(--panel); padding: 14px 16px; display: flex; flex-direction: column; gap: 6px; }
.systems b { font: 700 17px var(--display); letter-spacing: .04em; }
.systems p { font-size: 14px; color: #c9d4e3; }
.cols ul.zonelist { display: flex; flex-direction: row; flex-wrap: wrap; gap: 6px; margin: 0; padding: 0; list-style: none; }
.zonelist li { border: 1px solid var(--line); padding: 3px 9px; font: 600 13px var(--display); letter-spacing: .04em; background: var(--panel); }
@media (max-width: 900px) {
  .refgrid, .barrier, .steps3, .who { grid-template-columns: minmax(0, 1fr); }
}
"""


def km2(a):
    return f'{a / 1e6:.2f}'.replace('.', ',')


def kmf(v, d=1):
    return f'{v / 1000:.{d}f}'.replace('.', ',')


def mv(mid):
    c_ = MARKS[mid]['color']
    return f'--m:{c_};--mt:{mix(c_, "#ffffff", 0.35)}'


def chip(mid, extra=''):
    m = MARKS[mid]
    new = ' <em>nueva</em>' if m['state'] == 'nueva' else ''
    return f'<span class="mk" style="{mv(mid)}">{esc(m["name"])}{new}{extra}</span>'


def pips(n):
    return f'<span class="pips" aria-label="Presencia de la PDC: {n} de 5">' + ''.join(f'<i class="{"on" if i < n else ""}"></i>' for i in range(5)) + '</span>'


def grid_refs(poly):
    out = []
    for j in range(0, 9):
        for i in range(0, 9):
            cell = box(i * 1000, j * 1000, (i + 1) * 1000, (j + 1) * 1000)
            if poly.intersection(cell).area > 0.05 * cell.area:
                out.append(f'{"ABCDEFGHI"[i]}{j + 1}')
    return out


def barrio_html(i, key):
    d = B[key]
    D = g['D'][key]
    poly = D['poly']
    minx, miny, maxx, maxy = poly.bounds
    inc = d['incarnation']
    enc = (f'<dd><b>{esc(inc["name"])}</b>, {esc(inc["role"])}. {esc(d["incarnationText"])}</dd>' if inc else f'<dd>{esc(d["incarnationText"])}</dd>')
    a = d['anchor']
    to = f' · abre el paso a {esc(B[d["exit"]["to"]]["name"])}' if d['exit'] else ' · final del acto'
    anchor = (f'<div class="gatecard" style="--m:#ffb547"><span class="eyebrow" style="color:#ffcf85">Ancla de la barrera{to}</span>'
              f'<span class="gt">{esc(a["name"])}</span><p>{esc(a["text"])}</p><div>{chip(d["mark"], " · llave")}</div></div>')
    reveal = ''
    if d.get('reveal'):
        reveal = f'<div class="reveal"><b>Revelación de mitad de juego</b><span>{esc(BARRIERS["reveal"])}</span></div>'
    zones = ''.join(f'<li>{esc(n)}</li>' for n, at in d['zones'])
    secrets = ''.join(f'<li data-n="{k + 1}"><div><b>{esc(n)}</b><br><span>{esc(t)}</span></div></li>' for k, (n, at, t) in enumerate(d['secrets']))
    blocked = ''.join(f'<li><div>{chip(r)}</div><b>{esc(n)}</b></li>' for n, at, r in d['blocked'])
    return f'''
<article class="barrio" id="{key}" style="{mv(d['mark'])}">
  <div class="bh">
    <span class="num">{i + 1}</span>
    <h3>{esc(d['name'])}</h3>
    <div style="display:flex;flex-direction:column;gap:8px">
      <p class="tag">{esc(d['tagline'])}</p>
      <div class="meta">
        {chip(d['mark'])}
        <span><b>{km2(poly.area)} km²</b></span>
        <span>{esc(d['area'])}</span>
        <span>{kmf(maxx - minx)} × {kmf(maxy - miny)} km</span>
        <span>Cuadrículas <b>{', '.join(grid_refs(poly))}</b></span>
        <span>PDC {pips(d['pdc'])}</span>
      </div>
      <p class="refline"><b>Inspirado en:</b> {esc(d['refs'])}</p>
    </div>
  </div>
  <div class="bgrid">
    <figure class="planbox">
      <button class="zbtn" type="button" data-zoom="{i + 1} · {esc(d['name'])}">Ampliar</button>
      <div class="svgwrap">{plan(g, key)}</div>
    </figure>
    <div class="side">
      <dl>
        <div><dt>Encarnación</dt>{enc}</div>
        <div><dt>Llegada</dt><dd>{esc(d['arrive'])}</dd></div>
        <div><dt>Aspecto</dt><dd>{esc(d['look'])}</dd></div>
        <div><dt>Ambiente</dt><dd>{esc(d['mood'])}</dd></div>
      </dl>
      {anchor}
      {reveal}
    </div>
  </div>
  <div class="cols">
    <div><h4>Zonas e hitos</h4><ul class="zonelist">{zones}</ul></div>
    <div><h4>Secretos</h4><ol class="secrets">{secrets}</ol></div>
    <div>
      <h4>Áreas bloqueadas</h4><ul class="blocked">{blocked}</ul>
      <h4>PDC</h4><p class="small">{esc(d['pdcText'])}</p>
      <h4>Fuentes de carga</h4><p class="small">{esc(d['sources'])}</p>
    </div>
  </div>
</article>'''


def page():
    n_secrets = sum(len(B[k]['secrets']) for k in ORDER)
    n_blocked = sum(len(B[k]['blocked']) for k in ORDER)
    n_new = sum(1 for m in MARKS.values() if m['state'] == 'nueva')
    n_bld = sum(len(D['bld']) for D in g['D'].values())
    refs = ''.join(f'<div class="ref"><span class="city">{esc(c)}</span><h3>{esc(n)}</h3><ul>{"".join(f"<li>{esc(x)}</li>" for x in xs)}</ul></div>' for n, c, xs in REFS)
    strip = ''.join(f'<a href="#{k}" style="{mv(B[k]["mark"])}"><b>{i + 1}</b><span>{esc(B[k]["name"])}</span><small>{esc(MARKS[B[k]["mark"]]["name"])}{" · nueva" if MARKS[B[k]["mark"]]["state"] == "nueva" else ""}</small></a>' for i, k in enumerate(ORDER))
    rows = ''
    for i, k in enumerate(ORDER):
        d = B[k]
        to = B[d['exit']['to']]['name'] if d['exit'] else 'Final'
        rows += (f'<tr><td class="n">{i + 1}</td><td><b>{esc(d["name"])}</b> → {esc(to)}</td><td><b>{esc(d["anchor"]["name"])}</b></td>'
                 f'<td>{chip(d["mark"])}</td><td>{esc(d["anchor"]["text"])}</td></tr>')
    barrios = ''.join(barrio_html(i, k) for i, k in enumerate(ORDER))
    newmarks = ''
    for mid, nm in NEW_MARKS.items():
        m = MARKS[mid]
        newmarks += f'''<div class="markcard" style="{mv(mid)}"><h3>{esc(m['name'])}</h3><span class="who">Encarnación: {esc(nm['who'])}</span>
  <dl><dt>Disparo</dt><dd>{esc(nm['fire'])}</dd><dt>Q</dt><dd>{esc(nm['q'])}</dd><dt>R</dt><dd>{esc(nm['r'])}</dd><dt>G</dt><dd>{esc(nm['g'])}</dd>
  <dt>X</dt><dd>{esc(nm['x'])}</dd><dt>Pasiva</dt><dd>{esc(nm['passive'])}</dd><dt>Fuentes</dt><dd>{esc(nm['sources'])}</dd></dl></div>'''
    have = ''.join(f'<li>{chip(mid)} <span class="muted">{esc(B[k]["name"])}</span></li>' for k in ORDER for mid in [B[k]['mark']] if MARKS[mid]['state'] == 'existe')
    newmarks += f'''<div class="markcard" style="--m:#95a6bd;--mt:#c9d4e3"><h3>Las cinco que ya existen</h3>
  <span class="who">Mismos poderes que en el juego; en la ciudad se consiguen en estos barrios.</span><ul class="have">{have}</ul></div>'''
    combos = ''.join(f'<tr><td><b>{esc(a)}</b></td><td>{esc(b_)}</td><td>{esc(c_)}</td><td>{esc(d_)}</td></tr>' for a, b_, c_, d_ in NEW_COMBOS)
    backs = ''
    for mid in ['raiz', 'sombra', 'eco', 'marea', 'alas', 'defensa']:
        items = [(k, n) for k in ORDER for n, at, r in B[k]['blocked'] if r == mid]
        if items:
            li = ''.join(f'<li><b>{esc(n)}</b> <span class="muted">({esc(B[k]["name"])})</span></li>' for k, n in items)
            backs += f'<div style="{mv(mid)}">{chip(mid)}<ul>{li}</ul></div>'
    systems = ''.join(f'<div><b>{esc(a)}</b><p>{esc(t)}</p></div>' for a, t in SYSTEMS)
    who = ''.join(f'<div><b>{esc(a)}</b><span>{esc(t)}</span></div>' for a, t in BARRIERS['who'])
    limits = ''.join(f'<li><b>{esc(a)}:</b> {esc(t)}</li>' for a, t in LIMITS)
    toggles = [('lyr-route', 'Ruta', '<span class="lg lg-route"></span>'), ('lyr-barrier', 'Barreras', '<span class="lg lg-bar"></span>'),
               ('lyr-anchors', 'Anclas', '<span class="lg lg-anc"></span>'), ('lyr-gates', 'Fronteras', '<span class="lg lg-gate"></span>'),
               ('lyr-enc', 'Encarnaciones', '<span class="lg lg-star"></span>'), ('lyr-pdc', 'Torres PDC', '<span class="lg lg-twr"></span>'),
               ('lyr-metro', 'Metro', '<span class="lg lg-met"></span>'), ('lyr-secrets', 'Secretos', '<span class="lg lg-sec"></span>'),
               ('lyr-blocked', 'Áreas bloqueadas', '<span class="lg lg-blk"></span>'), ('lyr-labels', 'Rótulos', ''), ('lyr-grid', 'Cuadrícula', '')]
    tb = ''.join(f'<button type="button" data-layer="{c}" aria-pressed="true">{sw}{esc(t)}</button>' for c, t, sw in toggles)
    ov = overview(g)
    return f'''<title>Ciudad de Ibaia</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>{CSS}</style>
<div class="wrap">
<header class="top">
  <span class="eyebrow">ASCEND · Mapa de la ciudad · versión 2</span>
  <h1>IBAIA</h1>
  <p class="lede">Una ciudad de mundo abierto como las de Spider-Man, inFamous, GTA o Watch Dogs: una isla de rascacielos con su parque central, una península con colinas, playa y puerto, y una orilla de casco antiguo e industria, unidas por puentes. <b>30 km²</b> en <b>diez barrios de 3 km²</b>, y cada barrio encerrado por una <b>barrera de la Defensa</b>.</p>
  <div class="facts">
    <div><b>30,00 km²</b><span>de ciudad jugable, sin contar el agua</span></div>
    <div><b>10 × 3,00</b><span>barrios de 3 km² exactos</span></div>
    <div><b>3</b><span>masas de tierra: la Isla, la Península y la Orilla Este</span></div>
    <div><b>4 + 1</b><span>puentes y un túnel bajo la ría</span></div>
    <div><b>10</b><span>barreras, cada una con su Ancla</span></div>
    <div><b>10</b><span>marcas, una por barrio ({n_new} nuevas)</span></div>
    <div><b>{n_secrets}</b><span>secretos con nombre, más 30 expedientes</span></div>
    <div><b>{n_bld:,}</b><span>edificios en los planos</span></div>
  </div>
  <div class="ask">
    <b>Qué necesito que decidas</b>
    <ol>
      <li><b>Quién es la Encarnación de la Defensa.</b> Propongo que sea Iker (las barreras que separan a Jon de Iker son Iker). La alternativa es una desconocida, la Guardiana.</li>
      <li><b>Las marcas nuevas:</b> Raíz, Sombra, Eco, Marea y Defensa. La Sangre se queda como la marca de Narbaiza, el jefe final.</li>
      <li><b>El nombre de la ciudad.</b> Ibaia es provisional.</li>
      <li><b>Orden fijo o con elección.</b> Ahora la ruta es lineal; se pueden intercambiar Midtown y el Parque Central.</li>
    </ol>
  </div>
  <nav class="toc" aria-label="Secciones">
    <a href="#referencias">Referencias</a><a href="#barreras">Barreras</a><a href="#plano">Plano general</a><a href="#sistemas">Mundo abierto</a>
    <a href="#ruta">Ruta</a><a href="#barrios">Barrios</a><a href="#vistas">Vistas</a><a href="#marcas">Marcas</a><a href="#volver">Volver</a><a href="#construir">Cómo se construye</a>
  </nav>
</header>

<figure>
  <img src="img/maq-ciudad.jpg" width="1600" height="900" alt="Vista aérea al atardecer: la isla de rascacielos en el centro, la península con el puerto a la izquierda, la orilla este a la derecha y la cúpula sobre el Centro">
  <figcaption>Maqueta de volúmenes generada con los planos de esta página: la Isla en el centro con la Cúpula sobre el Centro, la Península a la izquierda (puerto de colores y playa) y la Orilla Este al fondo a la derecha. Las líneas ámbar son las barreras.</figcaption>
</figure>

<section id="referencias">
  <h2>Qué tomamos de cada juego</h2>
  <p>Cuatro referencias principales y cinco más del mismo estilo. La ciudad entera sale de mezclar lo que hace funcionar sus mapas.</p>
  <div class="refgrid">{refs}</div>
</section>

<section id="barreras">
  <h2>Las barreras de la Defensa</h2>
  <div class="barrier">
    <div class="txt">
      <p>{esc(BARRIERS['what'])}</p>
      <p>{esc(BARRIERS['story'])}</p>
      <div class="steps3">
        <div><b>1 · La Encarnación</b><span>En cada barrio vive una Encarnación. Jon la encuentra y copia su marca.</span></div>
        <div><b>2 · El Ancla</b><span>La barrera se sostiene en un Ancla dentro del barrio; solo esa marca llega hasta ella.</span></div>
        <div><b>3 · La frontera</b><span>Al romper el Ancla cae la barrera hacia el barrio siguiente, y queda abierta para siempre.</span></div>
      </div>
      <div class="reveal"><b>A mitad de juego</b><span>{esc(BARRIERS['reveal'])}</span></div>
      <p class="small">{esc(BARRIERS['after'])}</p>
      <h4>Quién es la Defensa</h4>
      <div class="who">{who}</div>
    </div>
    <figure><img src="img/maq-midtown.jpg" width="1600" height="900" loading="lazy" alt="Rascacielos iluminados de Midtown detrás de los muros de hexágonos ámbar de las barreras, al atardecer"><figcaption>Midtown desde la ría, detrás de su barrera.</figcaption></figure>
  </div>
</section>

<section id="plano">
  <h2>Plano general</h2>
  <p class="muted">Cuadrícula de 1 km. Toca un barrio para ir a su ficha. Los hexágonos son las Anclas; los rombos numerados, las fronteras en orden; la línea dorada, la ruta de Jon.</p>
  <figure class="mapbox">
    <div class="toolbar">{tb}<span class="sp"></span><button class="zbtn" type="button" data-zoom="Plano general de Ibaia">Ampliar</button></div>
    <div class="svgwrap">{ov}</div>
    <ul class="legend">
      <li><span class="lg lg-bar"></span>Barrera de la Defensa</li><li><span class="lg lg-anc"></span>Ancla</li>
      <li><span class="lg lg-gate"></span>Frontera (color de la marca que la abre)</li><li><span class="lg lg-star"></span>Encarnación</li>
      <li><span class="lg lg-twr"></span>Torre de la PDC</li><li><span class="lg lg-met"></span>Metro</li>
      <li><span class="lg lg-sec"></span>Secreto</li><li><span class="lg lg-blk"></span>Área bloqueada (color de la marca que pide)</li>
      <li><span class="lg lg-hwy"></span>Autopista y puentes</li><li><span class="lg lg-elev"></span>Tren elevado</li><li><span class="lg lg-route"></span>Ruta principal</li>
    </ul>
  </figure>
</section>

<section id="sistemas">
  <h2>Sistemas de mundo abierto</h2>
  <div class="systems">{systems}</div>
</section>

<section id="ruta">
  <h2>La ruta de las marcas</h2>
  <p>Jon llega desde la sierra con la Energía. La ruta da la vuelta a la ciudad: la Orilla Este, la Isla de sur a norte, la Península y vuelta a la Isla hasta el Centro.</p>
  <nav class="strip" aria-label="Barrios en orden">{strip}</nav>
  <div class="tablewrap"><table>
    <thead><tr><th>#</th><th>Paso</th><th>Ancla</th><th>Llave</th><th>Cómo se rompe</th></tr></thead>
    <tbody>{rows}</tbody>
  </table></div>
</section>

<section id="barrios">
  <h2>Los diez barrios</h2>
  <p class="muted">Cada plano muestra calles, manzanas y edificios (más claros cuanto más altos), la barrera del barrio, su Ancla (hexágono), la Encarnación (estrella), las fronteras de entrada y salida (rombos), la torre de la PDC, el metro, los secretos numerados y las áreas bloqueadas. Usa «Ampliar» para ver el detalle.</p>
  {barrios}
</section>

<section id="vistas">
  <h2>Vistas de la maqueta</h2>
  <div class="gallery" style="grid-template-columns:repeat(2,minmax(0,1fr))">
    <figure><img src="img/maq-centro.jpg" width="1600" height="900" loading="lazy" alt="El Centro bajo la cúpula de hexágonos, con la Torre de la Defensa iluminada y La Roca delante en la bahía"><figcaption>El Centro bajo la Cúpula, visto desde la bahía, con La Roca delante y la Torre de la Defensa (520 m).</figcaption></figure>
    <figure><img src="img/maq-colinas.jpg" width="1600" height="900" loading="lazy" alt="La isla de rascacielos vista desde las colinas de la península, con el puerto de contenedores a la derecha y la cúpula al fondo"><figcaption>La Isla desde Las Colinas: Los Bloques, el Parque Central y, al fondo, la Torre bajo la Cúpula. A la derecha, el puerto.</figcaption></figure>
  </div>
</section>

<section id="marcas">
  <h2>Las marcas nuevas</h2>
  <p>Con la misma estructura que las del juego: disparo, movilidad (Q), tres habilidades (R, G, X) y una pasiva. Energía, Temperatura, Hilo, Gravedad y Alas no cambian.</p>
  <div class="marks">{newmarks}</div>
  <h4>Combos nuevos</h4>
  <div class="tablewrap"><table><thead><tr><th>Combo</th><th>Marcas</th><th>Cómo</th><th>Efecto</th></tr></thead><tbody>{combos}</tbody></table></div>
</section>

<section id="volver">
  <h2>Qué abre cada marca al volver</h2>
  <p>{n_blocked} áreas de barrios ya recorridos solo se abren con una marca posterior. Las de la Defensa quedan para después del final.</p>
  <div class="backs">{backs}</div>
</section>

<section id="bordes">
  <h2>Los bordes del mapa</h2>
  <p>Como en las ciudades de referencia, el mapa se cierra con agua y montaña: nunca se ve un borde vacío.</p>
  <ul class="plain">{limits}</ul>
</section>

<section id="construir">
  <h2>Cómo se construye</h2>
  <ul class="plain">
    <li><b>Escala real.</b> 1 unidad = 1 m. La Isla mide {kmf(g['y1'] - 300)} km de punta a punta: unos {round((g['y1'] - 300) / 9.5 / 60)} minutos a la carrera.</li>
    <li><b>Carga por celdas de 250 m</b> con tres niveles de detalle; la Torre de la Defensa y las barreras se ven siempre, como la torre de la Agencia en Crackdown.</li>
    <li><b>Generada desde estos planos.</b> Calles, manzanas, solares y alturas de esta página se exportan como datos; los edificios se montan con el kit de ciudad del Distrito Cero, con una paleta por barrio.</li>
    <li><b>Hecho a mano:</b> Anclas, Encarnaciones, hitos, secretos y áreas bloqueadas (15–20 piezas por barrio).</li>
    <li><b>Barreras:</b> un muro de luz por borde de barrio, con colisión, y un estado guardado (en pie o rota). La cúpula del Centro es una pieza aparte.</li>
  </ul>
  <h4>Fases</h4>
  <ol class="steps">
    <li><b>Maqueta jugable</b> de las tres masas de tierra con puentes, barreras y Anclas de prueba.</li>
    <li><b>Orilla Este</b> (Distrito Cero y La Fundición): Energía y Temperatura ya existen.</li>
    <li><b>La Isla norte</b> (Midtown, Parque Central y Los Bloques): Hilo existe; marcas nuevas Raíz y Sombra; revelación de la Defensa.</li>
    <li><b>La Península</b> (Colinas, Puerto y Costa): Gravedad existe; marcas nuevas Eco y Marea.</li>
    <li><b>La Isla sur</b> (Barrio Chino y el Centro): Alas existe; marca nueva Defensa; final del acto.</li>
  </ol>
  <p class="muted">Cada marca nueva es tanto trabajo como lo fue cada una de las cinco actuales.</p>
</section>

<footer>
  <span>Áreas calculadas sobre la geometría de los planos: cada barrio mide 3,00 km² de tierra y el conjunto, 30,00 km². Planos y maqueta salen de los mismos datos.</span>
  <span>ASCEND · propuesta de diseño, versión 2.</span>
</footer>
</div>

<dialog id="viewer" aria-label="Visor de planos">
  <div class="vbar"><span class="t"></span><button class="zbtn" type="button" data-z="out" aria-label="Alejar">−</button><button class="zbtn" type="button" data-z="in" aria-label="Acercar">+</button><button class="zbtn" type="button" data-z="close">Cerrar</button></div>
  <div class="vbody"></div>
</dialog>
<script>{JS}</script>
'''


if __name__ == '__main__':
    h = page()
    open(f'{OUT}/ciudad.html', 'w').write(h)
    print(len(h) // 1024, 'KB')
