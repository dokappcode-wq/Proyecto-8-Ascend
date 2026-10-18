# ASCEND — Prototipo jugable

> *Dos mundos. Un mismo destino.*

Videojuego 3D de acción y aventura en tercera persona. Estado actual:

- **Etapa 1 — Núcleo jugable** ✅: menú, dos mapas (Campo de Pruebas y Distrito
  Cero), controlador en tercera persona, cámara, físicas y colisiones.
- **Etapa 2 — Energía** ✅: marca de Energía visible en el modelo, sistema de
  energía, proyectil, dash, descarga concentrada, onda expansiva, efectos
  visuales y zona de pruebas de poderes.

## Motor y por qué

El entorno de desarrollo es un contenedor Linux sin Unreal Engine ni Unity
(no hay editor ni licencia instalables aquí). Siguiendo el documento de diseño,
el prototipo se ha construido con **Three.js** (WebGL) y **Vite**, y se ejecuta en
cualquier navegador de escritorio. No se fingen capacidades: las físicas del
personaje son un motor cinemático propio (`src/physics/`), probado con tests
automáticos.

## Ejecutar

Requisitos: Node.js 20+ y Git.

```bash
git clone -b claude/compassionate-curie-r9twfr https://github.com/dokappcode-wq/Proyecto-8-Ascend.git
cd Proyecto-8-Ascend
npm install
npm run dev        # servidor de desarrollo → http://localhost:5173
npm run build      # build estático en dist/ (rutas relativas)
npm run preview    # sirve dist/
npm test           # tests unitarios (físicas, guardado)
npm run test:e2e   # prueba end-to-end con Playwright + Chromium
```

Para `test:e2e` en tu equipo, instala antes una vez el navegador de pruebas:
`npx playwright install chromium`.

## Controles

| Acción | Tecla | Estado |
| --- | --- | --- |
| Moverse | W A S D (o flechas) | ✅ |
| Cámara | Ratón (clic en la pantalla para capturarlo) | ✅ |
| Saltar | Espacio | ✅ |
| Sprint | Shift | ✅ |
| Esquivar (≈2 m) | Ctrl o C | ✅ |
| Proyectil energético | Clic izquierdo (mantener = ráfaga) | ✅ |
| Apuntar | Clic derecho | ✅ |
| Dash energético | Q | ✅ |
| Dash dirigido | Clic derecho (apuntar) + mantener Q, soltar para ir | ✅ |
| Descarga concentrada | R (mantener para cargar, soltar para lanzar) | ✅ |
| Onda expansiva | G | ✅ |
| Caída en rayo | G en el aire (a más de 1.5 m del suelo) | ✅ |
| Pausa | Esc | ✅ |
| Menú de depuración | F2 o º | ✅ |
| Ocultar ayuda / datos técnicos | H / F3 | ✅ |
| Cuerpo a cuerpo | F | Etapa 3 |
| Interactuar, menú de poderes | E, Tab | Etapa 4 |

La tecla **C** es alternativa a Ctrl porque algunos navegadores reservan
combinaciones con Ctrl (p. ej. Ctrl+W cierra la pestaña). El documento de diseño
no asignaba tecla a la onda expansiva; se ha elegido **G** (reasignable). Los
controles se definen como acciones en `src/core/Input.js`.

## Etapa 2 — Energía

| Habilidad | Coste | Reutilización | Efecto |
| --- | --- | --- | --- |
| Proyectil | 4 | 0.2 s | 10 de daño, 60 m/s, alcance 45 m |
| Dash | 15 | 1 s | ~4 m en 0.17 s, anula la caída; 1 por salto en el aire |
| Dash dirigido | 25 | 1 s (compartido con el dash) | apuntando, mantener Q muestra una silueta del personaje en el destino (máx. 20 m); al soltar se desplaza allí, también hacia arriba (azoteas). Se detiene antes de un obstáculo |
| Descarga | 30 | 1.5 s | carga 0.35–1.4 s; 25–60 de daño + área de 2.5 m con retroceso |
| Onda | 35 | 5 s | radio 7.5 m, 30 de daño con atenuación y retroceso radial |
| Caída en rayo | 35 | 5 s (compartido con la onda) | G en el aire: cae en vertical como un rayo y explota al tocar suelo. Radio 6–11 m y daño 40–80 según la altura. El aterrizaje es inmune al daño por caída |

Energía: 100, se regenera 16/s tras 0.8 s sin gastar. Todos los valores están
en `src/powers/energy/energyConfig.js`.

**Marca de Energía**: símbolo azul en la muñeca derecha (la del Destino sigue en
la izquierda). Al usar poderes aparecen patrones de circuito luminosos que se
extienden por antebrazo, brazo, hombro y pecho según la intensidad, y se
apagan progresivamente. El sistema (`MarkVisual`) se construye a partir de los
datos de la marca, por lo que admite nuevas marcas sin tocar el modelo.

**Adquisición**: la copia por contacto y voluntad es la Etapa 4. Mientras tanto,
la marca de Energía está **concedida desde el menú de depuración** (activada
por defecto) y puede desactivarse para comprobar que sin ella no hay poderes.

**Campo de Pruebas**
- Zona C — Poderes: 5 dianas a distintas alturas, 3 maniquíes con 100 de salud
  (caen al neutralizarlos y se recuperan a los 4 s), cajas y barriles físicos y
  una prueba de alcance con dianas a 10–50 m.
- Zona F — Efectos visuales: nave oscura con maniquíes y diana para revisar
  marcas, estelas, partículas y luces.

**Menú de depuración (F2)**: restaurar energía, energía infinita, reiniciar
habilidades, activar/desactivar la marca de Energía, marcas al máximo,
reiniciar dianas y objetos, reiniciar mapa, teletransporte a cada zona y
volver al menú. (Salud del jugador y enemigos: Etapa 3.)

**Ajustes**: nueva opción de resplandor (bloom).

## Qué incluye la Etapa 1

**Menú principal** con Campo de Pruebas, Distrito Cero, Ajustes (sensibilidad,
FOV, invertir Y, sombras, FPS; se guardan en el navegador) y Salir.
**Pausa** con Continuar, Reiniciar mapa, Ajustes y Volver al menú.

**Personaje**: modelo provisional por primitivas con animación procedural
(caminar, correr, aire, esquiva, aterrizaje), mochila tecnológica y la **marca
original del Destino** (dorada) visible en la muñeca izquierda.

**Movimiento**: caminar (5.2 m/s), sprint (9.5 m/s), salto (~1.7 m), control
aéreo, *coyote time* y *buffer* de salto, esquiva con enfriamiento, subida
automática de escalones (≤ 0.45 m), rampas, escaleras, techos, muros con
deslizamiento y reaparición al caer del mapa.

**Cámara**: tercera persona sobre el hombro, ratón con bloqueo de puntero,
colisión con la geometría y ligero aumento de FOV al esprintar.

**Campo de Pruebas**
- Zona A — Movimiento: rampas de 15° y 30°, escalera, peldaños altos (requieren
  salto), plataformas de 0.5/1/1.5/2 m, obstáculos de 0.4/0.8/1.2 m, saltos de
  longitud de 2 a 7 m y un pasillo con esquinas para colisiones.
- Zona B — Recorridos: ruta ascendente por saltos hasta 8.4 m, plataformas
  separadas, torre con escalera en zigzag, muros de 3/5/8 m y una fachada con
  cornisas (preparados para la escalada de la Etapa 5).
- Zonas C–F: delimitadas y señalizadas con la etapa en la que recibirán contenido.

**Distrito Cero**: barrio al atardecer con 8 edificios principales y 2 anexos,
calles, callejones, plaza central con fuente, farolas, coches, contenedores y
límites físicos. **Todas las azoteas son accesibles** sin escalada:
escaleras de incendios (B1, B5, B6), pasarelas entre azoteas y cadenas de
contenedores y cajas (A1, A2).

## Qué se ha probado realmente (Etapas 1 y 2)

- `npm test` — 34 tests unitarios: físicas (gravedad, velocidades, salto, muros,
  túnel a alta velocidad, escalones, rampas, techos, *coyote time*,
  reaparición, esquiva corta, dash, caída en picado, desplazamiento dirigido,
  multiplicador de velocidad, raycast), guardado,
  energía (gasto, regeneración, modo infinito), habilidades (coste y
  reutilización), daño directo y de área, y proyectiles (impacto en muros finos,
  alcance, límites invisibles).
- `npm run test:e2e` — en Chromium (render por software), con teclado y ratón:
  - Etapa 1: menú, ambos mapas, movimiento, sprint, salto, esquiva, pausa,
    reinicio, ajustes persistentes y rutas completas (las 10 azoteas del
    Distrito Cero y los recorridos del Campo de Pruebas).
  - Etapa 2: el proyectil daña a un maniquí y consume energía, aparecen
    indicadores de daño, la descarga cargada hace 60 de daño y muestra el anillo
    de carga, la onda desplaza los objetos físicos y enciende los patrones de la
    marca (que luego se apagan), el dash desplaza y consume energía, el alcance
    es correcto (40 m impacta, 50 m no), sin la marca no hay poderes, el menú de
    depuración funciona y los proyectiles funcionan también en Distrito Cero.
  - Ajustes posteriores: la esquiva normal recorre ≈2 m; G en el aire cae en
    vertical, explota, daña a los maniquíes y el aterrizaje es inmune; apuntar
    + mantener Q muestra la silueta en el punto señalado, al soltar se desplaza
    allí y la distancia se limita a 20 m.
  - Sin errores en consola. Capturas en `tests/e2e/output/`.

**No probado**: rendimiento en GPU real (las pruebas usan SwiftShader; el bloom
añade coste, se puede desactivar en Ajustes) ni la sensación de control con
ratón físico. Conviene una sesión de juego manual.

## Limitaciones conocidas

- Modelos, animaciones y texturas son provisionales y procedurales.
- Sin sonido todavía (Etapa 7).
- Las pasarelas no tienen barandilla: se puede caer de ellas.
- No hay límite de pendiente: cualquier rampa es transitable.
- La cámara puede quedar dentro de la parte inferior de una pasarela si se
  mira desde muy abajo.
- Sin sonido en los poderes (Etapa 7).
- La rotación de los objetos físicos es solo visual (su colisión es una caja
  alineada); la Sobrecarga y el árbol de mejoras llegan con la progresión.
- *Salir* no puede cerrar una pestaña del navegador; muestra una pantalla de despedida.

## Estructura

Ver [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md).
