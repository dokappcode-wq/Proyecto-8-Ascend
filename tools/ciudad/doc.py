"""Escribe docs/CIUDAD.md (resumen del diseño v2) a partir de data.py y la geometría."""
import city
from data import B, MARKS, ORDER, NEW_MARKS, NEW_COMBOS, LIMITS, CITY, REFS, BARRIERS, SYSTEMS

g = city.build()


def km2(a):
    return f'{a / 1e6:.2f}'.replace('.', ',')


L = []
w = L.append
w(f'# Ciudad de {CITY["name"]} ({CITY["nameNote"]}) — diseño v2')
w('')
w('Diseño del mapa de la ciudad del acto I (jugable en el juego como «Ibaia · La ciudad»), al estilo de las ciudades de mundo')
w('abierto (Spider-Man, inFamous Second Son, GTA, Watch Dogs y cinco más). La página con el plano interactivo,')
w('los planos de cada barrio y la maqueta 3D está publicada como artefacto: https://claude.ai/artifact/AHyJhScHBNGRTrHeyjeSMK')
w('')
w('- **30,00 km²** de ciudad jugable en **diez barrios de 3,00 km²** (áreas calculadas sobre la geometría, sin el agua).')
w('- **Tres masas de tierra** unidas por puentes: la Isla (rascacielos, como Manhattan), la Península (colinas, puerto y playa) y la Orilla Este (casco antiguo e industria).')
w('- **Una marca por barrio** y **una barrera de la Defensa por barrio**: cada barrera se rompe desde dentro, en su Ancla, con la marca de ese barrio.')
w('')
w('## Referencias')
w('')
for n, c, xs in REFS:
    w(f'- **{n}** ({c}): ' + ' '.join(xs))
w('')
w('## Las barreras de la Defensa')
w('')
for k in ('what', 'story', 'anchors', 'reveal', 'after'):
    w(f'- {BARRIERS[k]}')
for a, t in BARRIERS['who']:
    w(f'- **{a}**: {t}')
w('')
w('## Barrios (en el orden de la ruta)')
w('')
w('| # | Barrio | Zona | Marca | Encarnación | Ancla | PDC |')
w('|---|---|---|---|---|---|---|')
for i, k in enumerate(ORDER):
    d = B[k]
    m = MARKS[d['mark']]
    inc = d['incarnation']
    enc = f'{inc["name"]} ({inc["role"]})' if inc else '— (la Energía ya se tiene)'
    new = ' (nueva)' if m['state'] == 'nueva' else ''
    w(f'| {i + 1} | {d["name"]} ({km2(g["D"][k]["poly"].area)} km²) | {d["area"]} | {m["name"]}{new} | {enc} | {d["anchor"]["name"]} | {d["pdc"]}/5 |')
w('')
for i, k in enumerate(ORDER):
    d = B[k]
    w(f'### {i + 1}. {d["name"]} — {MARKS[d["mark"]]["name"]}')
    w('')
    w(d['tagline'] + f' Inspirado en: {d["refs"]}')
    w('')
    w(f'- **Ancla — {d["anchor"]["name"]}**: {d["anchor"]["text"]}')
    w(f'- **Encarnación**: {d["incarnationText"]}')
    w('- **Zonas**: ' + '; '.join(n for n, at in d['zones']) + '.')
    w('- **Secretos**: ' + '; '.join(n for n, at, t in d['secrets']) + '.')
    if d['blocked']:
        w('- **Áreas bloqueadas**: ' + '; '.join(f'{n} ({MARKS[r]["name"]})' for n, at, r in d['blocked']) + '.')
    w('')
w('## Marcas nuevas')
w('')
w('| Marca | Encarnación | Disparo | Q | R | G | X | Pasiva |')
w('|---|---|---|---|---|---|---|---|')
for mid, nm in NEW_MARKS.items():
    w(f'| {MARKS[mid]["name"]} | {nm["who"]} | {nm["fire"]} | {nm["q"]} | {nm["r"]} | {nm["g"]} | {nm["x"]} | {nm["passive"]} |')
w('')
w('Combos nuevos: ' + '; '.join(f'**{a}** ({b}): {e}' for a, b, c, e in NEW_COMBOS) + '.')
w('')
w('## Sistemas de mundo abierto')
w('')
for a, t in SYSTEMS:
    w(f'- **{a}**: {t}')
w('')
w('## Bordes del mapa')
w('')
for a, t in LIMITS:
    w(f'- **{a}**: {t}')
w('')
w('## Decisiones abiertas')
w('')
w('1. Quién es la Encarnación de la Defensa (propuesta: Iker).')
w('2. Las marcas nuevas: Raíz, Sombra, Eco, Marea y Defensa (la Sangre queda para Narbaiza).')
w('3. El nombre de la ciudad (Ibaia es provisional).')
w('4. Orden fijo o con elección (Midtown y el Parque Central intercambiables).')
w('')
w('## Regenerar')
w('')
w('Las fuentes están en `tools/ciudad/` (ver su README).')
w('')
open('../../docs/CIUDAD.md', 'w').write('\n'.join(L))
print('docs/CIUDAD.md', len('\n'.join(L)))
