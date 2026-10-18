# ASCEND — Prototipo jugable

> *Dos mundos. Un mismo destino.*

Videojuego 3D de acción y aventura en tercera persona. Estado actual:

- **Etapa 1 — Núcleo jugable** ✅: menú, dos mapas (Campo de Pruebas y Distrito
  Cero), controlador en tercera persona, cámara, físicas y colisiones.
- **Etapa 2 — Energía** ✅: marca de Energía visible en el modelo, sistema de
  energía, proyectil, dash, descarga concentrada, onda expansiva, efectos
  visuales y zona de pruebas de poderes.
- **Etapa 3 — Enemigos y combate** ✅: salud del jugador, daño por caída,
  golpe cuerpo a cuerpo, Agente PDC, Acólito de Energía, IA por estados y
  Zona D de combate con consola de reinicio.
- **Etapa 4 — Sistema de marcas** ✅: adquisición de la marca de Energía por
  contacto y voluntad en la estación de la Zona E, reglas canónicas, registro y
  persistencia, menú de marcas (Tab) y progresión con experiencia y mejoras.
- **Etapa 5 — Parkour** ✅: saltar vallas corriendo, subir a bordes sin
  saltar, agarre de cornisas (colgarse, desplazarse y trepar), escalada de
  muros y fachadas, salto hacia atrás desde la pared y cámara de escalada.
- **Etapa 6 — Distrito Cero** ✅: patrullas PDC y Acólitos en el barrio,
  reacción de hostilidad de la PDC (reputación), misión «Operación: Distrito
  Cero» (activación, marcadores, detección, objetivos y mensaje final) y
  aviso en los límites del mapa.
- **Mecánicas añadidas**: agacharse (C) y coberturas con asomarse al apuntar;
  golpe elemental con energía (puños eléctricos y embestida) y golpe normal
  sin energía.

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
| Esquivar (≈2 m) | Ctrl o Alt | ✅ |
| Agacharse / cubrirse junto a un muro (alterna) | C | ✅ |
| Proyectil energético | Clic izquierdo (mantener = ráfaga) | ✅ |
| Apuntar | Clic derecho | ✅ |
| Dash energético | Q | ✅ |
| Dash dirigido | Clic derecho (apuntar) + mantener Q, soltar para ir | ✅ |
| Recargar el cargador | R (pulsar una vez) | ✅ |
| Descarga concentrada | R (mantener para cargar, soltar para lanzar) | ✅ |
| Onda expansiva | G | ✅ |
| Caída en rayo | G en el aire (a más de 1.5 m del suelo) | ✅ |
| Pausa | Esc | ✅ |
| Menú de depuración | F2 o º | ✅ |
| Ocultar ayuda / datos técnicos | H / F3 | ✅ |
| Golpe (con energía: eléctrico y con embestida) | F | ✅ |
| Interactuar / mantener para la voluntad | E | ✅ |
| Menú de marcas y habilidades | Tab | ✅ |
| Escalar: agarrarse a un muro o cornisa | Saltar hacia él con W pulsado | ✅ |
| Trepar / bajar / lateral (en la pared) | W / S / A D | ✅ |
| Impulso hacia arriba en la pared | Espacio | ✅ |
| Salto hacia atrás desde la pared | S + Espacio | ✅ |
| Soltarse | C | ✅ |

La tecla **Alt** es alternativa a Ctrl para esquivar porque algunos navegadores
reservan combinaciones con Ctrl (p. ej. Ctrl+W cierra la pestaña); **C** pasa a
ser agacharse. El documento de diseño
no asignaba tecla a la onda expansiva; se ha elegido **G** (reasignable). Los
controles se definen como acciones en `src/core/Input.js`.

## Etapa 6 — Distrito Cero

**Población del barrio**: una patrulla PDC de dos agentes recorre la calle
norte y un Acólito de Energía vigila la azotea de B3. Al activar la misión
aparecen además la patrulla PDC objetivo (tres agentes, calle sur) y el
Acólito hostil (calle entre B3 y B4).

**Hostilidad de la PDC** (reputación básica):

| Nivel | Hostilidad | Qué hace la PDC |
| --- | --- | --- |
| Tranquila | 0–24 | Patrulla; aunque te vea, no te ataca |
| Vigilante | 25–59 | Se detiene a observarte («?» azul sobre el agente), sin disparar |
| Hostil | 60–100 | Te ataca al verte; al volverse hostil, todos los agentes en 70 m acuden a tu posición (aviso por radio) |

- Sube al **usar poderes a la vista** de un agente (+22, como mucho una vez
  por segundo), al **dañar** a un agente (+70) y al **neutralizarlo** (+100).
- Baja 4 puntos por segundo tras 12 s sin que ningún agente te vea; al volver
  a «Tranquila» los agentes pierden tu rastro.
- El HUD muestra el nivel («PDC · Tranquila/Vigilante/Hostil») bajo el panel
  de la misión. Los **Acólitos son siempre hostiles**.
- En el **Campo de Pruebas** la PDC de la Zona D es un simulacro: hostil desde
  el principio.
- Las facciones Encarnaciones, Acólitos y Ciudadanos ya existen en los datos
  (`src/factions/Reputation.js`), pero en el prototipo solo reacciona la PDC,
  como indica el documento de diseño.

**Misión «Operación: Distrito Cero»** (`src/data/missions.js`):

1. **Activación**: teléfono público de la plaza (marcador dorado). E acepta la
   misión y muestra el aviso.
2. **Marcadores de ubicación**: un rombo con distancia sobre cada grupo
   objetivo y un haz de luz vertical; fuera de pantalla se fijan al borde con
   una flecha.
3. **Detección**: el primer enemigo de la misión que te detecta lanza
   «¡Te han detectado!» y el panel lo indica.
4. **Combate y recuento**: «Neutraliza la patrulla PDC 0/3» y «Neutraliza al
   Acólito hostil 0/1», en cualquier orden.
5. **Finalización**: pantalla «Operación completada» con tiempo, mejor tiempo,
   objetivos, daño recibido, si te detectaron y +100 EXP; opciones *Seguir
   explorando*, *Repetir la misión* y *Volver al menú*. Se guarda en el
   perfil y el menú principal la marca con ✓ y el mejor tiempo.

Si te neutralizan durante la misión, reapareces en la plaza y la misión
continúa (los enemigos pierden tu rastro). Depuración (F2): reiniciar la
misión, volver hostil o calmar a la PDC, e ir al teléfono o a la patrulla.

**Límites**: barreras de hormigón y valla con muros invisibles (no escalables).
A menos de 5 m del borde aparece «Límite de Distrito Cero».

Código: `src/factions/Reputation.js` y `src/missions/Mission.js` (lógica pura,
con pruebas), `src/systems/FactionSystem.js` y `src/systems/MissionSystem.js`.

## Etapa 5 — Parkour

Todo el parkour es automático salvo el salto inicial: no hay teclas nuevas.

| Situación | Qué ocurre |
| --- | --- |
| Corres (≥ 3.5 m/s) contra una valla de hasta 1.35 m y ≤ 1.1 m de grosor | La **saltas por encima** sin perder velocidad |
| Caminas contra un borde de hasta 1.35 m | **Subes encima** sin saltar (si hay sitio; si el techo es bajo, agachado) |
| Saltas hacia un borde que queda al alcance de las manos | Te **agarras** y subes; si sueltas W, te quedas **colgado** |
| Colgado | A/D se desplaza por la cornisa (sin pasarse del extremo), W o Espacio sube, S baja a la pared si es trepable, C se suelta |
| Saltas hacia un muro alto | Te **enganchas a la pared**: W sube (4.2 m/s), S baja, A/D de lado, Espacio da un impulso de ≈2 m, S + Espacio salta hacia atrás |
| Llegas a lo alto trepando | Subes a la cima directamente; en fachadas con molduras estrechas pasas de una a otra y sigues trepando |

- Se puede escalar cualquier muro, edificio o caja estática. No se escalan los
  límites invisibles del mapa, los objetos móviles ni las fuentes de energía.
- Escalando no se usan poderes ni se esquiva (las manos están ocupadas).
- Subir a un borde no causa daño por caída: agarrarse a una cornisa durante una
  caída la detiene.
- **Cámara**: al escalar se aleja 1.3 m y se eleva para ver la pared y la
  cornisa; el seguimiento vertical es más suave al subir a un borde.
- **Animaciones**: trepar (brazos y piernas alternos según lo recorrido),
  colgar, subir a la cornisa empujando con los brazos y salto de valla.
- Los enemigos usan el mismo motor sin parkour.

**Campo de Pruebas — Zona B**: muros de 3/5/8 m, fachada de 12 m con cuatro
cornisas y un **circuito de parkour** (punto de depuración «Zona B — Circuito
de parkour»): tres vallas de 1 m, bloque de 1.3 m, torre de 3 m, muro de 6 m y
torre de 12 m con cornisas. **Zona A**: los peldaños de 0.5 m y las
plataformas de hasta 1.3 m ya se suben solos; la de 2 m, saltando.
**Distrito Cero**: todas las fachadas son escalables, además de las escaleras
de incendios y pasarelas.

Código: `src/physics/Parkour.js` (consultas geométricas puras: muro delante,
cima de la cornisa, sitio para quedarse de pie o colgado, aterrizaje tras la
valla) y los estados `wall`, `hang`, `mantle` y `vault` de
`src/physics/CharacterMotor.js`. Parámetros en `PARKOUR_CONFIG`.

## Etapa 2 — Energía

| Habilidad | Coste | Reutilización | Efecto |
| --- | --- | --- | --- |
| Proyectil | 2 | 0.2 s | 10 de daño, 60 m/s, alcance 45 m. **Cargador de 10**: al vaciarse recarga sola en 1.3 s; **R pulsada una vez** recarga a mano en cualquier momento (animación de manos cargando energía, aviso «Recargando» en la fila de munición) |
| Dash | 10 | 1 s | ~4 m en 0.17 s, anula la caída; 1 por salto en el aire |
| Dash dirigido | 18 | 1 s (compartido con el dash) | apuntando, mantener Q muestra una silueta del personaje en el destino (máx. 20 m); al soltar se desplaza allí, también hacia arriba (azoteas). Se detiene antes de un obstáculo |
| Descarga | 20 | 1.5 s | carga 0.35–1.4 s; 25–60 de daño + área de 2.5 m con retroceso |
| Onda | 25 | 5 s | radio 7.5 m, 30 de daño con atenuación y retroceso radial |
| Caída en rayo | 25 | 5 s (compartido con la onda) | G en el aire: cae en vertical como un rayo y explota al tocar suelo. Radio 6–11 m y daño 40–80 según la altura. El aterrizaje es inmune al daño por caída |

El cargador (`src/powers/Magazine.js`) es genérico: cualquier habilidad o arma
de proyectiles lo activa con `magazineSize` y `reloadTime` en su configuración
(los enemigos de la Etapa 3 lo reutilizarán).

Energía: 150 y **no se regenera sola** (ver «Recarga desde el entorno»). Todos
los valores están en `src/powers/energy/energyConfig.js`.

### Recarga desde el entorno

La energía se absorbe de objetos eléctricos cotidianos: **mantén E** junto a
uno (a menos de 3 m) y la energía fluye de él a tu mano (60/s). Cada fuente
tiene una reserva limitada: se apaga y parpadea al agotarse y se recupera
sola pasado un tiempo.

| Fuente | Reserva | Recuperación completa |
| --- | --- | --- |
| Farola | 50 | 18 s |
| Máquina expendedora | 70 | 22 s |
| Armario eléctrico | 90 | 25 s |

Están repartidas por ambos mapas (farolas de las calles, armarios en fachadas
y azoteas, máquinas en las plazas) para que nunca falte carga. Mientras
absorbes no puedes moverte ni usar poderes. Código:
`src/world/entities/EnergySource.js`, `src/powers/EnergyReserve.js`,
`src/systems/EnergyDrainSystem.js`.

### HUD

Abajo a la izquierda: arriba la **munición elemental** (un símbolo del
elemento por disparo del cargador; los gastados se atenúan), debajo la barra
de **carga elemental** y la de **vida**, ambas con forma de trazo de pincel.

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

## Etapa 4 — Sistema de marcas

**Al empezar no tienes la marca de Energía.** Se obtiene en la **Zona E** del
Campo de Pruebas (estación experimental):

1. Acércate a la Encarnación de la Energía de prueba.
2. **E** — contacto físico (la agarras del brazo).
3. **Mantén E** — voluntad (barra). Si sueltas antes, la conexión se pierde:
   el contacto solo no basta.
4. Copia: arcos entre las muñecas, aparece la marca en tu muñeca derecha, se
   registra y se guarda. La Encarnación **conserva** su marca y su poder.

La Encarnación tiene el aspecto de una persona corriente (chaqueta, sudadera,
vaqueros) sentada junto a un banco y una farola: oculta su poder, sin aura ni
luces. Solo su marca en la muñeca brilla débilmente, y se intensifica al
establecer contacto y durante la copia.

Reglas aplicadas (`src/powers/acquisition.js`): solo se copian Encarnaciones
originales (intentarlo con un Acólito se rechaza: su poder es prestado), hace
falta contacto y voluntad, no se copia dos veces la misma marca y la copia no
debilita a la fuente.

**Persistencia**: las marcas y la progresión se guardan solas (y con «Guardar
partida» en la pausa) y se conservan al cambiar de mapa, reiniciar o recargar.

**Menú de marcas (Tab)**: marca original del Destino, marcas copiadas con su
nivel y experiencia, y el árbol de habilidades. Las cuatro habilidades de
Energía son **fundamentales** (vienen con la marca); las mejoras cuestan puntos:

| Mejora | Coste | Requiere | Efecto |
| --- | --- | --- | --- |
| Cargador ampliado | 1 | — | +5 disparos |
| Recarga rápida | 1 | Cargador ampliado | recarga −35 % |
| Carga rápida | 1 | — | descarga completa en 0.9 s |
| Onda amplia | 2 | — | +2 m de radio y +10 de daño (onda y rayo) |
| Dash eficiente | 1 | — | dashes −5 de energía, dirigido +5 m |
| Absorción rápida | 2 | Recarga rápida y Dash eficiente | absorbes de las fuentes un 60 % más rápido |
| Sobrecarga | — | — | próximamente (no implementada) |

Experiencia: Agente PDC 40, Acólito 60, maniquí 5 (con la marca activa). Cada
100 EXP = 1 nivel = 1 punto, y cada nivel suma **+15 de energía máxima** (150 en
el nivel 1; lo ganado llega lleno). Datos en `src/data/progression.js`.

**Depuración (F2)**: reiniciar la adquisición (quita la marca y su progreso),
conceder Energía como atajo, +60 EXP y +1 punto.

Los guardados de etapas anteriores se migran: se retira la Energía concedida
por depuración, así que hay que copiarla en la Zona E.

## Agacharse, coberturas y golpe elemental

- **C** alterna agacharse (cuerpo más bajo, más lento; caben bajo obstáculos
  de 1.4 m). Si al agacharte hay un muro a menos de 1 m, te **pones a
  cubierto**: te pegas a él, te deslizas a lo largo sin pasar del borde y
  alejarte (o C de nuevo) sale de la cobertura.
- **A cubierto los enemigos no te ven ni te alcanzan** por encima de una
  barrera baja: su visión y su puntería usan tu altura real.
- **Al apuntar te asomas**: en coberturas bajas te levantas y disparas por
  encima; en muros altos te desplazas al borde más cercano. Al soltar vuelves
  a cubrirte. El HUD indica «Agachado», «A cubierto» o «Asomado».
- **Golpe (F) elemental** mientras tengas energía (5 por golpe): puños
  eléctricos, 32 de daño, más retroceso y aturde. Si hay un enemigo a menos de
  7.5 m delante, te **lanzas hacia él** y le golpeas. **Sin energía** el golpe
  es normal: 20 de daño, sin efecto eléctrico ni embestida.

## Etapa 3 — Enemigos y combate

**Jugador**: 100 de salud (barra bajo la de energía), se regenera 8/s tras 5 s
sin recibir daño. Viñeta roja e indicador de la dirección del impacto. Daño por
caída a partir de ≈ 8 m (la caída en rayo y el dash dirigido son inmunes). Al
quedar a 0: pantalla «Neutralizado» y reaparición en el inicio del mapa a los
3 s con 2 s de invulnerabilidad; los enemigos pierden el rastro.

**Golpe (F)**: ver «Golpe elemental» más arriba. Alcance 2.1 m en un arco
frontal. Afecta a enemigos, maniquíes y objetos físicos.

**Enemigos** (`src/ai/enemyTypes.js`):

| | Agente PDC | Acólito de Energía |
| --- | --- | --- |
| Salud | 80 | 110 |
| Arma | Fusil: 6 de daño, 90 m/s, cargador 12, recarga 2 s | Esferas de energía: 12 de daño, 32 m/s, cargador 4, recarga 2.2 s |
| Distancia preferida | 9–18 m | 8–15 m (se desplaza lateralmente más rápido) |
| Visión | 28 m, cono de 110° | 26 m, cono de 120° |

**IA por estados** (`src/ai/EnemyBrain.js`): patrulla (recorre puntos y mira
alrededor al detenerse) → alerta al ver al jugador u oír disparos/impactos
cercanos → ataque (mantiene la distancia: se acerca, retrocede o se desplaza
lateralmente y dispara con su cargador) → persecución si te pierde de vista
(busca una posición con línea de visión y, si no, va a tu última posición
conocida; después busca unos segundos y vuelve a patrullar) → recuperación
tras un impacto fuerte → neutralizado (cae y desaparece a los 6 s). Visión con
cono y línea de visión real: las coberturas y muros te ocultan.

**Facciones**: los poderes del jugador no le dañan; los enemigos no se dañan
entre sí.

**Zona D — Combate** (Campo de Pruebas): recinto con coberturas, un Agente PDC y
un Acólito. La consola de la entrada (E) reinicia el encuentro.

**Depuración (F2)**: restaurar salud, invulnerable, generar enemigos (un PDC y
un Acólito delante del jugador, en cualquier mapa) y eliminar enemigos.

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
  cornisas, y el circuito de parkour (Etapa 5).
- Zonas C–F: delimitadas y señalizadas con la etapa en la que recibirán contenido.

**Distrito Cero**: barrio al atardecer con 8 edificios principales y 2 anexos,
calles, callejones, plaza central con fuente, farolas, coches, contenedores y
límites físicos. **Todas las azoteas son accesibles** sin escalada:
escaleras de incendios (B1, B5, B6), pasarelas entre azoteas y cadenas de
contenedores y cajas (A1, A2).

## Qué se ha probado realmente (Etapas 1 a 6)

- `npm test` — 60 tests unitarios: físicas (gravedad, velocidades, salto, muros,
  túnel a alta velocidad, escalones, rampas, techos, *coyote time*,
  reaparición, esquiva corta, dash, caída en picado, desplazamiento dirigido,
  IA por estados, facciones, impactos en personajes, salud,
  multiplicador de velocidad, raycast), guardado,
  energía (gasto, regeneración, modo infinito), cargador y recarga, habilidades (coste y
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
    allí y la distancia se limita a 20 m; el proyectil dispara 10 veces, recarga
    con animación (sin disparar mientras tanto) y vuelve a 10/10.
  - Etapa 3: la consola (E) genera el encuentro; la IA pasa por patrulla →
    alerta → ataque; los enemigos disparan y el jugador pierde salud; los
    proyectiles neutralizan a un enemigo; el golpe (F) hace daño; una caída
    normal de 14 m quita salud y la caída en rayo desde 12 m no; al quedar a 0
    aparece «Neutralizado» y se reaparece con salud completa; generar y
    eliminar enemigos desde F2.
  - Etapa 4: sin marca no hay poderes; un Acólito se rechaza como fuente; E
    establece contacto; soltar la voluntad antes de tiempo no copia; mantener
    E copia la marca y da poderes; la Encarnación conserva su poder; no se
    copia dos veces; un maniquí da experiencia; Tab muestra las marcas;
    desbloquear «Cargador ampliado» da 15 disparos; todo se conserva al
    recargar la página.
  - Añadidos: golpe elemental 32 y normal 20 sin energía; embestida hasta el
    enemigo; a cubierto tras una barrera el enemigo no te ve y al apuntar te
    asomas y te ve; al soltar vuelves a cubrirte.
  - Recarga del entorno: la energía no se regenera sola; junto a un armario
    eléctrico aparece «Mantén E: absorber energía», absorber recarga la
    energía y vacía la reserva de la fuente; el HUD muestra un símbolo por
    disparo; la Encarnación no tiene luces ni aura.
  - Parkour: el bot salta las vallas corriendo y sube al bloque de 1.3 m,
    sube a la torre de 3 m y al muro de 6 m, escala la torre de 12 m por sus
    cornisas y la fachada de B6 en el Distrito Cero; con el teclado, W +
    Espacio engancha al muro de 5 m y sube a la cima; colgado de una cornisa,
    A/D desplaza, no se usan poderes y C suelta.
  - Distrito Cero: el barrio tiene su patrulla y su Acólito; la PDC empieza
    tranquila y no ataca aunque te vea; usar poderes delante la vuelve
    vigilante (observa sin disparar); atacar a un agente la vuelve hostil y
    atacan; el teléfono activa la misión y aparecen 3 agentes y 1 Acólito;
    el HUD muestra objetivos, recuento y marcadores con distancia; la
    detección se avisa; neutralizar la patrulla completa su objetivo pero la
    misión sigue hasta el Acólito; mensaje final, guardado y ✓ en el menú;
    aviso de límite; en el Campo la PDC es hostil desde el principio.
  - Sin errores en consola. Capturas en `tests/e2e/output/`.
  - La batería tarda ~25 min con render por software; `E2E_STOP=campo`
    la detiene tras la sección del Campo de Pruebas para iterar más rápido.

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
- Navegación enemiga sencilla (sin malla de navegación): van en línea recta,
  saltan obstáculos bajos y rodean al atascarse; en zonas muy cerradas pueden
  quedarse bloqueados. Los enemigos no escalan ni usan las escaleras de
  incendios.
- La reputación de la PDC no se guarda entre sesiones (se reinicia al cargar
  el mapa); solo reacciona la PDC.
- La rotación de los objetos físicos es solo visual (su colisión es una caja
  alineada); la Sobrecarga y el árbol de mejoras llegan con la progresión.
- *Salir* no puede cerrar una pestaña del navegador; muestra una pantalla de despedida.

## Estructura

Ver [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md).
