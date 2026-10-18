# ASCEND — Prototipo jugable

> *Dos mundos. Un mismo destino.*

Videojuego 3D de acción y aventura en tercera persona. Este repositorio contiene el
**prototipo de la Etapa 1 (núcleo jugable)**: menú principal, dos mapas
independientes (Campo de Pruebas y Distrito Cero) y un único controlador de
personaje, cámara y físicas compartido por ambos.

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
| Esquivar | Ctrl o C | ✅ |
| Pausa | Esc | ✅ |
| Ocultar ayuda / depuración | H / F3 | ✅ |
| Ataque, apuntar, Q, R | Clic izq., clic der., Q, R | Etapa 2 |
| Cuerpo a cuerpo | F | Etapa 3 |
| Interactuar, menú de poderes | E, Tab | Etapa 4 |

La tecla **C** es alternativa a Ctrl porque algunos navegadores reservan
combinaciones con Ctrl (p. ej. Ctrl+W cierra la pestaña). Los controles se
definen como acciones reasignables en `src/core/Input.js`.

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

## Qué se ha probado realmente

- `npm test` — 18 tests unitarios: gravedad, velocidades, altura de salto, muros,
  túnel a alta velocidad, escalones, rampas (subir y bajar sin despegarse),
  laterales de rampa, techos, *coyote time*, reaparición, enfriamiento de la
  esquiva, raycast y sistema de guardado.
- `npm run test:e2e` — en Chromium (render por software): carga del menú,
  entrada en ambos mapas, movimiento con teclado real (W, Shift, Espacio, Ctrl),
  pausa, volver al menú, reiniciar mapa, persistencia de ajustes tras recargar,
  ausencia de errores en consola y **recorridos completos** con un bot que conduce
  el mismo motor del juego: las 10 azoteas del Distrito Cero, rampas, escalera,
  peldaños altos, ruta ascendente, torre y salto de 6 m del Campo de Pruebas.
  Las capturas se guardan en `tests/e2e/output/`.

**No probado**: rendimiento en GPU real (las pruebas usan SwiftShader) ni la
sensación de control con ratón físico; conviene una sesión de juego manual.

## Limitaciones conocidas

- Modelos, animaciones y texturas son provisionales y procedurales.
- Sin sonido todavía (Etapa 7).
- Las pasarelas no tienen barandilla: se puede caer de ellas.
- No hay límite de pendiente: cualquier rampa es transitable.
- La cámara puede quedar dentro de la parte inferior de una pasarela si se
  mira desde muy abajo.
- *Salir* no puede cerrar una pestaña del navegador; muestra una pantalla de despedida.

## Estructura

Ver [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md).
