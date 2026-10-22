# tools/ciudad — diseño del mapa de la ciudad

Generadores del diseño de la ciudad (propuesta): geometría de 30 km² con diez barrios
de 3 km² exactos, trama urbana procedural por barrio, planos SVG, maqueta 3D y la
página de diseño. El resumen está en [`docs/CIUDAD.md`](../../docs/CIUDAD.md).

| Archivo | Qué hace |
|---|---|
| `geo.py` | Rectángulo 6 × 5 km, isla central y nueve sectores en anillo; resuelve las fronteras para que cada barrio mida 3,00 km² |
| `water.py` | La ría (con sus dos brazos), la bahía y el mar |
| `fabric.py` | Generadores de trama: cuadrícula con chaflán, Voronoi orgánico, naves, patios, solares, caminos, recinto abaluartado |
| `city.py` | Trama de cada barrio (una función por barrio) y puentes levadizos |
| `data.py` | Contenido: marcas, barrios, fronteras, Encarnaciones, secretos, áreas bloqueadas, PDC, teléfonos |
| `validate.py` | Comprueba que cada marcador cae dentro de su barrio y en tierra |
| `render.py`, `plans.py` | Dibujo SVG: plano general interactivo y un plano por barrio |
| `export3d.py`, `maq/index.html`, `maqshot.mjs` | Maqueta de volúmenes en three.js y sus vistas aéreas |
| `page.py` | Página HTML de diseño (planos en línea, imágenes en `page/img/`) |
| `doc.py` | Escribe `docs/CIUDAD.md` |

## Regenerar

Necesita Python 3 con `numpy` y `shapely`, y el Chromium de Playwright del proyecto.

```bash
cd tools/ciudad
python3 -m venv venv && venv/bin/pip install numpy shapely
mkdir -p out
venv/bin/python validate.py          # marcadores fuera de sitio
venv/bin/python plans.py             # out/overview.svg y out/plan-B*.svg
venv/bin/python export3d.py          # maq/city.json
# Vistas de la maqueta: servir la raíz del repo y capturar
(cd ../.. && python3 -m http.server 8765) &
node maqshot.mjs ciudad isla ria sur # out/maq-*.jpg
venv/bin/python page.py              # page/ciudad.html + page/img/
venv/bin/python doc.py               # docs/CIUDAD.md
```

`out/`, `page/` y `maq/city.json` son generados y no se versionan.
