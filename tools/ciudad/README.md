# tools/ciudad — diseño del mapa de la ciudad (v2)

Generadores del diseño de la ciudad (propuesta): tres masas de tierra (la Isla,
la Península y la Orilla Este) con diez barrios de 3,00 km² exactos, red viaria
por jerarquía, parcelación en solares, edificios con altura, las barreras de la
Defensa, los planos SVG, la maqueta 3D y la página de diseño. El resumen está en
[`docs/CIUDAD.md`](../../docs/CIUDAD.md).

| Archivo | Qué hace |
|---|---|
| `geo.py` | Geografía (isla, ría, río, península, orilla este, La Roca) y reparto en barrios de 3,00 km² |
| `fabric.py` | Calles (cuadrícula, casco antiguo irregular, curvas de nivel), manzanas, solares y edificios |
| `city.py` | Trama de cada barrio, autopistas, avenidas fronterizas, puentes y tren elevado |
| `data.py` | Contenido: referencias, barreras, marcas, barrios, Anclas, Encarnaciones, secretos, áreas bloqueadas |
| `validate.py` | Comprueba que cada marcador cae dentro de su barrio |
| `render.py`, `plans.py` | Plano general interactivo y un plano por barrio (SVG, estilo mapa de juego) |
| `export3d.py`, `maq/index.html`, `maqshot.mjs` | Maqueta 3D (three.js) con barreras y sus vistas |
| `page.py`, `base.css`, `base.js` | Página HTML de diseño |
| `doc.py` | Escribe `docs/CIUDAD.md` |

## Regenerar

Necesita Python 3 con `numpy` y `shapely`, y el Chromium de Playwright del proyecto.

```bash
cd tools/ciudad
python3 -m venv venv && venv/bin/pip install numpy shapely
mkdir -p out
venv/bin/python validate.py          # marcadores fuera de su barrio
venv/bin/python plans.py             # out/overview.svg y out/plan-*.svg
venv/bin/python export3d.py          # maq/city.json y maq/extra.json
(cd ../.. && python3 -m http.server 8765) &
node maqshot.mjs ciudad centro midtown colinas   # out/maq-*.jpg
venv/bin/python page.py              # page/ciudad.html + page/img/
venv/bin/python doc.py               # docs/CIUDAD.md
```

`out/`, `page/` y `maq/*.json` son generados y no se versionan.
