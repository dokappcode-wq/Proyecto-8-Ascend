"""Escribe docs/CIUDAD.md (resumen del diseño) a partir de data.py y la geometría."""
from city import build
from data import B, MARKS, ORDER, NEW_MARKS, NEW_COMBOS, LIMITS, CITY

c, P, wat, out, br = build()


def km2(a):
    return f'{a / 1e6:.2f}'.replace('.', ',')


lines = []
w = lines.append
w(f'# Ciudad de {CITY["name"]} ({CITY["nameNote"]})')
w('')
w('Diseño del mapa de la ciudad del acto I (propuesta, sin implementar). La página con los planos')
w('interactivos y la maqueta 3D está publicada como artefacto: https://claude.ai/artifact/AHyJhScHBNGRTrHeyjeSMK')
w('')
w('- **30,00 km²** (6 × 5 km), con la ría, la isla central y la costa oeste.')
w('- **10 barrios de 3,00 km² exactos** (áreas calculadas sobre la geometría; incluyen su parte de agua).')
w('- **Una marca por barrio**: la Encarnación de cada barrio da la marca que abre la frontera del siguiente.')
w('- Se recorre en espiral desde la colina del final del prólogo hasta la Ciudadela (la isla), donde está Iker.')
w('')
w('## Reglas')
w('')
w('- **El Cierre**: la PDC selló la ciudad en diez sectores; cada frontera tiene un obstáculo para gente corriente que solo vence una marca concreta.')
w('- Una frontera abierta queda abierta en los dos sentidos (atajo).')
w('- **Áreas bloqueadas**: zonas de barrios anteriores que piden una marca posterior (incentivo para volver).')
w('- Dos teléfonos públicos por barrio (viaje rápido; la Centralita, voz de la resistencia) y un piso franco.')
w('- La Torre del Control (180 m) se ve desde toda la ciudad; los cinco puentes levadizos de la isla siguen levantados hasta el final.')
w('')
w('## Barrios y fronteras')
w('')
w('| # | Barrio | Marca | Encarnación | Tierra / agua (km²) | PDC | Salida (frontera) |')
w('|---|---|---|---|---|---|---|')
for i, bid in enumerate(ORDER):
    d = B[bid]
    m = MARKS[d['mark']]
    inc = d['incarnation']
    enc = f'{inc["name"]} ({inc["role"]})' if inc else '— (la Energía ya se tiene)'
    land = out[bid]['land'].area
    water = P[bid].area - land
    ex = f'{d["exit"]["name"]} → {B[d["exit"]["to"]]["name"]}' if d['exit'] else 'Final: bajan los puentes de la isla'
    new = ' (nueva)' if m['state'] == 'nueva' else ''
    w(f'| {i + 1} | {d["name"]} | {m["name"]}{new} | {enc} | {km2(land)} / {km2(water)} | {d["pdc"]}/5 | {ex} |')
w('')
for i, bid in enumerate(ORDER):
    d = B[bid]
    w(f'### {i + 1}. {d["name"]} — {MARKS[d["mark"]]["name"]}')
    w('')
    w(d['tagline'])
    w('')
    if d['exit']:
        w(f'- **Frontera de salida — {d["exit"]["name"]}**: {d["exit"]["text"]}')
    w(f'- **Encarnación**: {d["incarnationText"]}')
    w('- **Zonas**: ' + '; '.join(z[0] for z in d['zones']) + '.')
    w('- **Secretos**: ' + '; '.join(s[0] for s in d['secrets']) + '.')
    if d['blocked']:
        w('- **Áreas bloqueadas**: ' + '; '.join(f'{n} ({MARKS[r]["name"]})' for n, at, r, t in d['blocked']) + '.')
    w(f'- **Fuentes de carga**: {d["sources"]}')
    w('')
w('## Marcas nuevas')
w('')
w('| Marca | Encarnación | Disparo | Q | R | G | X | Pasiva | Llave |')
w('|---|---|---|---|---|---|---|---|---|')
for mid, nm in NEW_MARKS.items():
    w(f'| {MARKS[mid]["name"]} | {nm["who"]} | {nm["fire"]} | {nm["q"]} | {nm["r"]} | {nm["g"]} | {nm["x"]} | {nm["passive"]} | {nm["key"]} |')
w('')
w('Combos nuevos: ' + '; '.join(f'**{a}** ({b}): {e}' for a, b, cc, e in NEW_COMBOS) + '.')
w('')
w('## Bordes del mapa')
w('')
for a, t in LIMITS:
    w(f'- **{a}**: {t}')
w('')
w('## Cómo se construiría')
w('')
w('- 1 unidad = 1 m. Celdas de 250 m (480) con carga por distancia: detalle completo hasta ~600 m, manzanas simplificadas hasta 1,5 km y silueta por barrio más allá.')
w('- Manzanas y solares exportados desde estos planos; edificios con el kit de ciudad del Distrito Cero. Hitos, fronteras, Encarnaciones y secretos, a mano.')
w('- Fases: maqueta jugable con las nueve fronteras → Distrito Cero y Casco Viejo → Lonja, Astilleros y Altos Hornos (Marea) → Jardines, Ópera y Viaducto (Raíz, Eco, Sombra) → Barrio Alto y Ciudadela (Sangre).')
w('')
w('## Decisiones abiertas')
w('')
w('1. Nombre de la ciudad (Ibaia es provisional).')
w('2. Si Narbaiza se puede copiar (la Sangre como décima marca).')
w('3. Orden fijo en espiral o elegir el orden de Los Jardines y La Ópera.')
w('4. Las cinco marcas nuevas y los nombres de las Encarnaciones.')
w('')
w('## Regenerar los planos')
w('')
w('Las fuentes están en `tools/ciudad/` (ver su README): la geometría, el contenido (`data.py`), los planos SVG, la maqueta 3D y la página.')
w('')
open('../../docs/CIUDAD.md', 'w').write('\n'.join(lines))
print('docs/CIUDAD.md', len('\n'.join(lines)), 'bytes')
