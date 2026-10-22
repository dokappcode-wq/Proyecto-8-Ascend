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
- **Etapa 7 — Pulido** ✅: sonido sintetizado (efectos 3D, ambiente por mapa,
  volúmenes), rendimiento (geometría estática fusionada, resolución de render),
  barandillas en las pasarelas, polvo al aterrizar, prueba de estrés del motor
  y limpieza de avisos.
- **Marca de la Gravedad** ✅: segunda marca copiable (púrpura) con rocas
  flotantes, disparo que hace flotar, atraer, empujar, granada de
  antigravedad, saltos altos/triples con planeo y pasiva de estasis; cambio de
  marca con V; pasiva de la Energía (5 % de detener).
- **Marca del Hilo** ✅: tercera marca (blanca): balanceo con hilo, puño de
  hilo, golpe de cadena, atar, lanzar, atraerse y salto alto.
- **Marca de la Temperatura** ✅: cuarta marca (degradado turquesa → naranja):
  patinaje sin fricción (también por paredes, en U), carrera de hielo por el
  aire con Shift, disparos alternos de hielo y fuego, muro de hielo, estela de
  fuego, tormenta de fuego frío y quemadura en los golpes.
- **Marca de las Alas** ✅: quinta marca (rosa): 100 plumas que son munición y
  carga y se regeneran; vuelo (más rápido cuantas más plumas), espada de
  plumas que crece, lluvia de plumas y escudo de plumas.
- **Combos, enemigos especiales y pulido** ✅: cuatro combos entre marcas,
  tres enemigos nuevos de la PDC (Blindado, Francotirador y Dron) con su zona
  de pruebas, rueda de marcas, poses de patinaje y vuelo y pasiva de las Alas.
- **Etapa 8 — Modo historia (Prólogo)** ✅: los cinco capítulos del guion
  (M01–M05) jugables de principio a fin en tres mapas nuevos (pueblo costero
  de noche con la base de la PDC, el mismo pueblo de día y el valle con el
  puente destruido), 29 puntos de control, sigilo, cinemáticas con
  subtítulos, elección moral y menú final. La marca de la Energía se consigue
  ahora en la historia (sustituye a la estación de la Zona E).
- **Gráficos y animación** ✅: personajes detallados (ropa, peinados, caras
  que parpadean) con animación procedural nueva (pies que se apoyan, cabeza
  que sigue la cámara, inclinación y aterrizaje con muelle), suavizado de
  bordes, gradación de color, cielo con nubes, estrellas y luna que se refleja
  en los materiales, texturas con relieve, agua animada, montañas nevadas,
  vegetación, chispas, humo y ondas de choque, y menú con fondo 3D animado.
- **Mapas rehechos** ✅: el pueblo costero (noche y día) con su base de la
  PDC, el bosque con el gran cañón y el Distrito Cero, construidos con el kit
  de escenarios de la propuesta aprobada, con terreno con relieve y sin
  huecos de mapa a la vista (el mundo continúa más allá de los límites).
- **Rendimiento, enemigos y base** ✅: el juego dibuja mucho menos (densidad
  de píxeles a 1×, resolución dinámica automática, nivel de detalle en pinos y
  terreno, menos luces reales); ningún enemigo aparece de la nada (están en el
  mapa o salen de un camión, una puerta o un soporte de drones); los enemigos
  del puente son más fáciles; y la base de la PDC tiene puertas con sentido y
  guardias que rodean los obstáculos, se relevan en el cuartel y acuden a la
  alarma.
- **Mecánicas añadidas**: agacharse (C) y coberturas con asomarse al apuntar;
  golpe elemental con energía (puños eléctricos y embestida) y golpe normal
  sin energía.

## Historia · Prólogo

**Cómo se juega**: menú principal → **Historia · Prólogo** (o **Continuar
historia** si hay una partida empezada; **Nueva partida** la reinicia). Se
guarda solo al llegar a cada punto de control (CP01…CP29); al morir, caer o
ser descubierto se vuelve al último. En la pausa, *Reiniciar desde el punto de
control*. **Saltar cinemáticas**: mantén **Espacio** (o **Intro**) medio segundo
—el aviso abajo a la derecha muestra el progreso— o elige *Saltar escena* en la
pausa. La escena se simula deprisa con la pantalla en negro y sin sonido hasta
que recuperas el control: el resultado es el mismo que viéndola entera
(posiciones, banderas, guardado). El salto se detiene en las elecciones (MATAR /
PERDONAR) y en los cambios de mapa.

**Cambio de la Zona E**: la marca de la Energía ya no se copia en la Zona E del
Campo de Pruebas; en su lugar hay un terminal dorado que abre el Prólogo, y al
completarlo la Energía pasa al perfil del modo libre. Las Encarnaciones de
Gravedad, Hilo, Temperatura y Alas siguen en la Zona E (aún no tienen
capítulo). Para practicar la adquisición de la Energía como antes: F2 →
*Zona E clásica*.

Jon empieza **sin marcas**; la historia usa su propio perfil de marcas (no
toca el del modo libre) y los poderes básicos, sin mejoras. Las habilidades se
desbloquean según el guion: ninguna hasta el bosque, después el disparo, la
descarga (R) y la onda (G) durante los drones, y el dash (Q) en el puente.

| Misión | Mapa | Qué pasa | Puntos |
| --- | --- | --- | --- |
| **M01 · La última noche** | Pueblo de noche (lluvia, focos) | Reunión en los tejados con Iker y tutorial de parkour; acantilado; **sigilo** en el patio de la base (conos de visión, focos, agacharse, piedras para distraer, cambio de guardia); conducto; almacén y pasarela; cámara con las **cinco cartas** (cuatro sin identificar y la dorada); la carta concede el **Destino** (sin ataque); alarma, compuertas, huida contrarreloj por el balcón, el andamio y las azoteas; **tirolina** a la playa y desmayo | CP01–CP08 |
| **M02 · La plaza** | Pueblo de día | Despertar (primer plano de la marca dorada), exploración, la PDC interroga a los vecinos; **Narbaiza** tortura a Martín con **Sangre**; Jon interviene ([F]) y queda a **1 PV** exactos; discusión con Iker en el callejón (la salud vuelve poco a poco) | CP09–CP10 |
| **M03 · Cinco días** | Pueblo de día | Tarjetas DÍA 1…5; una tarea por día (reparar el puerto, rumores, la foto familiar, las patrullas desde el mirador) y el encargo de la abuela; charlas opcionales con la abuela y dos vecinos | CP11 (cada día) |
| **M04 · La tormenta** | Pueblo de día | Mercado (comprar pan, patatas y pescado); la tercera compra desata la **tormenta**; la esfera eléctrica cae sobre la casa; la calle se corta y hay que ir por los tejados; la pérdida; la Encarnación («Normie»); **copia de la Energía** por contacto y voluntad (soltar cancela; la fuente conserva su poder); **MATAR / PERDONAR** (se guarda `KILL` o `SPARE` al instante; escenas distintas); esposas; autobús de presos | CP12–CP17 |
| **M05 · El despertar** | Bosque y gran cañón | El convoy es atacado en el viaducto, el autobús vuelca y un destello de Energía se lleva a Jon; despertar en el bosque; arroyo con piedras para saltar; **barricada** de tablones que se rompe a golpes; cuesta; la **roca con vetas azules** solo se rompe disparando; recarga en un **generador**; barranco con pilares, pared de escalada marcada (cueva tras la cascada) y meseta; **tres drones** de uno en uno (proyectil, R, G) en el tramo oeste del puente; el **hueco de 9 m** (dash asistido hacia un círculo de aterrizaje), bajada por el **tramo caído** hasta la **pila partida** y escalada por las vigas del **tramo descolgado**; **2 agentes + 1 dron**; **agente reforzado** y luego **2 agentes**; la niebla se abre en la colina y aparece la ciudad sobre su llanura; Jon sale de plano con un dash y se abre el menú (`TutorialComplete`) | CP18–CP29 |

**Sigilo**: cada guardia proyecta su cono en el suelo (blanco → amarillo →
rojo según lo que te ha visto) y el indicador de arriba muestra el máximo.
Agachado (C) te ven un 55 % más despacio y a menos distancia; tras un muro o
una caja no te ven; de cerca te oyen si vas de pie; dentro de la luz de un foco
te ven el doble de rápido. [F] lanza una piedra al punto que miras y el guardia
más cercano va a investigar. En M01 no hay combate.

**No se inventa canon** (puntos pendientes del guion): las otras cuatro cartas
no se asignan a ninguna marca, no se muestra quién ataca el convoy, el destino
de Iker queda abierto (desaparece tras el vuelco), y no se explica por qué
Narbaiza quiere a Jon vivo ni qué consecuencias tiene la elección (solo se
guarda). Las únicas frases añadidas son comentarios breves de vecinos en el
montaje de los cinco días (rumores y patrullas, como pide el guion).

**Depuración (F2)**: con la historia en marcha aparece *Historia · punto de
control* con los 29 puntos para saltar a cualquiera (las banderas se ajustan a
ese punto).

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
npm test           # tests unitarios (físicas, terreno, guardado, historia…)
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
| Cambiar de marca copiada | V (pulsar: la siguiente; mantener: rueda de marcas) | ✅ |
| Gravedad: granada | X o clic central | ✅ |
| Historia · sigilo: lanzar una piedra para distraer | F | ✅ |
| Historia · elegir (MATAR / PERDONAR) | 1 / 2 o clic | ✅ |
| Historia · saltar una cinemática | Mantener Espacio o Intro (o *Saltar escena* en la pausa) | ✅ |

La tecla **Alt** es alternativa a Ctrl para esquivar porque algunos navegadores
reservan combinaciones con Ctrl (p. ej. Ctrl+W cierra la pestaña); **C** pasa a
ser agacharse. El documento de diseño
no asignaba tecla a la onda expansiva; se ha elegido **G** (reasignable). Los
controles se definen como acciones en `src/core/Input.js`.

## Marca de la Gravedad

**Cómo conseguirla**: en la Zona E del Campo de Pruebas, junto al terminal
del Prólogo, hay una Encarnación (abrigo gris, pelo
canoso, junto a un muro de obra con escombros). Contacto (E) y voluntad
(mantener E), igual que con la Energía. Al copiarla pasa a ser la marca activa.

**Cambiar de marca**: V alterna entre las marcas copiadas; absorber una fuente
de un elemento también activa su marca. Tab muestra las dos marcas, su pasiva,
su nivel y su árbol, con el botón «Usar esta marca». La marca activa se
guarda. Cada marca tiene su propia carga, nivel, experiencia y mejoras.

**Recarga**: no se regenera; se absorbe (mantener E) de **escombros** y
**bloques de hormigón**, repartidos por los dos mapas (plaza, calles,
callejones y azoteas del Distrito; inicio y zonas del Campo).

| Tecla | Habilidad | Coste | Efecto |
| --- | --- | --- | --- |
| Clic izq. | Disparo gravitatorio | 5 | **Un disparo por cargador** (recarga 0.9 s), 18 de daño; el enemigo (u objeto) alcanzado **flota 3 s** a 1.8 m del suelo, indefenso |
| Q | Elevar rocas | 10 | En el suelo, una roca sale de la tierra y te levanta 2 m. En el aire, aparece otra bajo tus pies y te sostiene. **Hasta 3 seguidas** (se reinicia al pisar suelo firme); duran 12 s y luego se desmoronan. Son sólidas: sirven para subir a azoteas o como puesto de tiro y cobertura |
| R | Atraer | 15 | Al enemigo más cercano a la mira (30 m): 14 de daño y **aturde 1 s**. Si flota, lo trae por el aire hasta tenerlo a distancia de golpe; si no, lo arrastra 7 m hacia ti |
| G | Empujar | 18 | Cono de 110° y 10 m delante: 20 de daño y fuerte retroceso; los que flotan salen despedidos; también lanza objetos |
| X / clic central | Granada de gravedad | 30 | Bola de energía con trayectoria parabólica; al tocar algo (o a los 2.5 s) crea una **burbuja de antigravedad** de 5.5 m durante 5 s: todo lo que queda dentro flota |
| Espacio | Saltos de Gravedad | — | **Mantener** al saltar: salto más alto (≈3.2 m frente a 1.7 m). **Hasta 3 saltos** seguidos (uno desde el suelo y dos en el aire). **Mantener cayendo**: planeas (caída a 2.2 m/s y avance a 8.5 m/s) |
| F | Golpe | 5 | Con carga, golpe elemental púrpura (como el de Energía) |

**Pasivas** (funcionan con la marca poseída, esté activa o no):
- **Gravedad — Estasis**: al bajar al **5 % de vida**, durante **4 s** las
  balas y orbes enemigos se quedan flotando donde estén y luego se deshacen.
  Una vez cada 30 s.
- **Energía — Cortocircuito**: cada golpe de Energía (proyectil, descarga,
  onda, rayo o golpe eléctrico) tiene un **5 %** de probabilidad de
  **detener** al enemigo 1.5 s (aparece «Detenido»).

**Mejoras de Gravedad** (Tab): Cuarta roca, Atracción férrea (+10 de daño y
+0.5 s de aturdimiento), Empuje violento (+10 de daño y más retroceso),
Burbuja amplia (+1.5 m y +2 s) y Colapso (próximamente). Cada nivel suma +15
de carga máxima, como en Energía.

**Enemigos**: pueden **flotar** (sin moverse ni disparar, se mecen en el aire)
y quedar **aturdidos** (chispas sobre la cabeza). Si mueren flotando, caen.

Código: `src/systems/GravityPowerSystem.js` (habilidades),
`src/powers/gravity/` (parámetros y rocas), estados nuevos en `src/ai/Enemy.js`
(`float`, `stun`, `pullTo`), saltos en `src/physics/CharacterMotor.js`
(`jumpAbilities`), estasis en `src/systems/ProjectileSystem.js` y marca activa
en `src/systems/MarkSystem.js`.

## Marca del Hilo

**Cómo conseguirla**: tercera Encarnación de la Zona E (chaqueta clara, junto a
un tendedero). Contacto y voluntad, como las demás. V recorre las tres marcas.

**Recarga**: **tendederos** y **rollos de tela** (plaza, calles y azoteas del
Distrito; inicio y zonas del Campo).

| Tecla | Habilidad | Coste | Efecto |
| --- | --- | --- | --- |
| Clic izq. | Hilos | 2 | El puño se convierte en hilo y golpea a distancia (24 m, 14 de daño). **Sin balas**, pero no puedes volver a golpear hasta que el puño ha vuelto |
| Q (mantener) | Balanceo | 4 | Lanza un hilo a la estructura más próxima por encima y por delante (30 m) y te balanceas: la cuerda se mantiene tensa, WASD empuja el péndulo, al soltar Q (o saltar) sales despedido con la velocidad que llevabas. Desde el suelo, el hilo tira de ti y despegas |
| R | Atar | 15 | Ata al enemigo de la mira y lo **inmoviliza 4 s** (hilos alrededor del cuerpo) |
| G | Lanzar | 15 | Lanza al enemigo de la mira **por los aires** (≈5 m); al caer se hace daño |
| X / clic central | Atraer | 10 | Te lleva **hasta el enemigo** (a distancia de golpe) o, si señalas una pared o superficie, **hasta ella** |
| F | Cadena | 5 | Con carga, la cuerda gruesa como cadena: **barrido de 160°** y 4.6 m, 26 de daño a todos los que alcanza |

**Pasiva — Impulso**: con el Hilo activo, **mantener el salto** da un salto de
≈4.5 m, suficiente para empezar a balancearse.

**Mejoras**: Hilo largo (+8 m), Nudo firme (+2 s atado), Puño rápido (40 % más
rápido), Cadena pesada (+10 de daño y alcance) y Telaraña (próximamente).

**Enemigos**: pueden quedar **atados** (inmóviles) y reciben **daño al caer**
desde altura.

Código: `src/systems/ThreadPowerSystem.js`, `src/powers/thread/`, balanceo en
`src/physics/CharacterMotor.js` (`startSwing`/`endSwing`, cuerda con
corrección limitada para no atravesar muros finos) y selección del enemigo de
la mira compartida en `src/powers/targeting.js`.

## Marca de la Temperatura

**Cómo conseguirla**: cuarta Encarnación de la Zona E (anorak verde azulado,
entre un arcón congelador y un bidón con fuego). V recorre las cuatro marcas.

**Recarga**: **arcones congeladores** y **bidones con fuego** (inicio, zonas
del Campo; callejones, tiendas y una azotea del Distrito).

| Tecla | Habilidad | Coste | Efecto |
| --- | --- | --- | --- |
| Clic izq. | Hielo y fuego | 2 | **10 balas**; alterna un disparo de **hielo con la mano derecha** y uno de **fuego con la izquierda**, los dos con el mismo daño (10). Al vaciarse recarga sola (1.3 s) |
| Q (alterna) | Patinar | 4 + 3/s | **Suelo sin fricción**: aceleras hasta 13 m/s (más cuesta abajo o con impulso), cuesta frenar y girar. Si patinas **contra una pared**, subes por ella con la velocidad que llevabas y caes trazando una **U** (sin fricción no te sostienes); Espacio salta desde la pared |
| Shift (patinando) | Carrera de hielo | 14/s | **Fuego hacia atrás** que te empuja (17 m/s) y una **plataforma de hielo bajo los pies** hacia donde apuntas (hasta ±35°): «andas por el aire». Al soltar quedas de pie sobre el hielo; las placas se funden a los 7 s |
| R | Muro de hielo | 18 | Un muro de 4.8 × 2.6 m delante que **para balas y cuerpos** durante 10 s y luego se derrite |
| G | Estela de fuego | 18 | Una raya de fuego de 11 m delante (sigue el suelo) que quema a quien la pisa (9/s, 5 s) |
| X / clic central | Fuego frío | 30 | Una **nube encima de ti** descarga una tormenta (6.5 m de radio, 8 s): lluvia helada, rayos turquesa y naranja y 7/s de daño a los de debajo |

**Pasiva — Quemadura**: tus **golpes físicos queman**: 1 de daño cada medio
segundo hasta 10. No se acumula: golpear a un enemigo que ya arde no reinicia
ni suma la quemadura.

**Mejoras**: Cargador térmico (+4 balas), Muro grueso (+2 m, +5 s), Brasas
(estela +50 % y +2 s), Ventisca (tormenta +2 m, +3 s) y Cero absoluto
(próximamente).

Código: `src/systems/TemperaturePowerSystem.js`, `src/powers/temperature/`
(configuración y `BurnStatus`), patinaje, pared en U y carrera de hielo en
`src/physics/CharacterMotor.js` (`skate`, `_wallRide`, `iceRun`).

## Marca de las Alas

**Cómo conseguirla**: quinta Encarnación de la Zona E (cazadora rosa palo,
junto a un palomar). V recorre las cinco marcas.

**Plumas**: las Alas te dan **100 plumas** (15 más por nivel) que son a la vez
la **munición** y la carga de las habilidades. Se ven en tus alas: cuantas
menos te quedan, más despeinadas. **Se regeneran solas** (5 por segundo tras
1.5 s sin gastar) y más rápido absorbiendo de **palomares** y **montones de
cojines**. En el HUD, cada símbolo de pluma son 10.

| Tecla | Habilidad | Plumas | Efecto |
| --- | --- | --- | --- |
| Clic izq. | Plumas | 1 por disparo | Disparas tus plumas (6 de daño, cadencia alta); sin plumas no puedes disparar |
| Q (alterna) | Vuelo | 0 | **Modo vuelo**: W/S siguen hacia donde miras (también arriba y abajo), **Espacio** sube y **C** baja. La velocidad depende de las plumas: de 6 m/s sin plumas a 20 m/s con todas |
| R (mantener: más grande) | Espada de plumas | 20 (+10 por tamaño) | Una espada de 20 plumas en la mano: **+20 % de ataque físico** y más alcance durante 30 s. Mantén R (o vuelve a pulsarla) para hacerla más grande: cada tamaño cuesta 10 plumas más y da +10 % (hasta 50 plumas y +50 %) |
| G | Lluvia de plumas | 50 | Sobre la zona que señalas (4.5 m de radio): **desde el aire** las plumas caen desde tu posición; **desde el suelo** suben y luego caen. Cada pluma que cae cerca de un enemigo le hace 4 de daño |
| X / clic central | Escudo de plumas | 10 | Un muro de plumas delante que **aguanta un ataque** (la primera bala que lo toca) y se deshace |

**Pasiva — Plumaje**: tus plumas absorben el **20 % del daño** que recibes
(1 pluma por punto absorbido), mientras te queden.

**Mejoras**: Muda rápida (+50 % de regeneración), Alas fuertes (+5 m/s de
vuelo), Filo de pluma (+10 % con la espada), Escudo doble (aguanta un ataque
más) y Vendaval (próximamente).

Código: `src/systems/WingsPowerSystem.js`, `src/powers/wings/`, alas y espada
en `src/player/WingsVisual.js` (InstancedMesh: una llamada de dibujo por ala)
y vuelo en `src/physics/CharacterMotor.js` (`fly`).

## Rueda de marcas

**Pulsa V** para pasar a la siguiente marca, como antes. **Mantén V** y se
abre una rueda con todas tus marcas copiadas; el tiempo va más despacio
(30 %) y la cámara deja de girar: mueve el ratón hacia una marca y **suelta V**
para activarla. Si sueltas sin señalar ninguna, pasa a la siguiente, como
una pulsación.

## Combos entre marcas

Un ataque de una marca sobre un enemigo afectado por otra provoca un combo
(aviso dorado en pantalla y sonido propio). Cada enemigo tiene 1 s de espera
entre combos.

| Combo | Cómo | Efecto |
| --- | --- | --- |
| **Combustión** | Fuego (disparo de fuego o estela) sobre un enemigo que **flota** (Gravedad) | Explota: 30 de daño en 3.5 m y los lanza; deja de flotar |
| **Descarga en cadena** | Tormenta o Energía (proyectil, descarga, rayo, golpe eléctrico) sobre un enemigo **atado** (Hilo) | La descarga salta a los 3 enemigos más cercanos (9 m): 15 de daño y 1.2 s de aturdimiento a cada uno |
| **Plumas ardientes** | Lluvia de plumas sobre un enemigo que **arde** | Cada pluma que le cae hace el doble de daño |
| **Escarcha** | Disparo de hielo sobre un enemigo que **flota o está atado** | Se congela 3 s (capa de hielo, inmóvil) y recibe 15 de daño |

Pisar la estela de fuego ahora también **prende** al enemigo (quemadura), así
que la estela prepara las Plumas ardientes.

Código: reglas puras en `src/powers/combos.js` y efectos en
`src/systems/ComboSystem.js`.

## Enemigos especiales de la PDC

| Enemigo | Salud | Cómo es | Cómo vencerlo |
| --- | --- | --- | --- |
| **Blindado** | 150 | Lento, con escudo antidisturbios y escopeta (5 perdigones, corto alcance). Se acerca a 3–7 m | **De frente solo recibe el 10 %** del daño («Bloqueado»). Rodéalo, atácalo desde arriba (tormenta, lluvia, estela, quemadura) o quítale el apoyo: flotando, en el aire, atado, aturdido o congelado no se cubre |
| **Francotirador** | 60 | Quieto en alto, ve a 65 m. **Apunta 1.3 s con un láser rojo** (con pitido) antes de disparar 28 de daño; el último 0.3 s el punto queda fijo | Sal del láser o rompe la línea de visión mientras apunta; sube hasta él |
| **Dron** | 45 | Vuela a 4.5 m del suelo y dispara ráfagas | **Los golpes cuerpo a cuerpo solo le hacen un 25 %**. Dispárale, o átalo, aturdélo o congélalo: deja de volar y cae |

**Dónde**: en la nueva **Zona G — Enemigos especiales** del Campo (sudoeste;
punto de viaje «G»): un Blindado, dos drones y un francotirador en una torre.
El encuentro empieza al pisar la zona (salen del barracón del fondo y el
francotirador sube a su torre) y se reinicia en el panel de la entrada. En el Distrito Cero hay un Blindado en la calle este, un dron sobre
la calle oeste y un francotirador en la azotea de B5.

Código: datos y regla de daño (`enemyDamage`) en `src/ai/enemyTypes.js`,
comportamiento en `src/ai/Enemy.js` y el dron en `src/ai/DroneModel.js`.

## Gráficos y animación

**Personajes**: todos (Jon, la PDC, los Acólitos, las Encarnaciones y los
personajes de la historia) se construyen con piezas redondeadas fusionadas
por material: chaqueta con cuello y capucha, mochila con luz, botas con suela,
manos con dedos, cara con cejas, nariz y ojos que parpadean, y peinados y
barbas distintos por personaje (Iker, la abuela, Martín, Narbaiza…). La PDC
lleva casco abierto con visor (rojo el reforzado); el Acólito, capucha.

**Animación procedural**: zancada con los pies que se apoyan en el suelo (el
tobillo compensa), pelvis y pecho que contrarrotan, inclinación al girar y al
acelerar, la cabeza sigue hacia donde mira la cámara, aterrizaje con muelle,
respiración, parpadeo y una mirada ocasional a los lados en reposo. Todas las
articulaciones se suavizan al final para que los cambios de pose no salten.

**Render**: suavizado de bordes MSAA ×4, oclusión ambiental opcional (GTAO),
bloom, mapeo de tonos ACES y una gradación de color por mapa (contraste,
saturación, tono de sombras y de luces, viñeta y grano suave). El cielo
(degradado, sol con halo, nubes que se mueven, estrellas que titilan y luna)
genera un mapa de entorno: los materiales reflejan el cielo de cada mapa.
Sombras suavizadas.

**Escenarios**: texturas procedurales con relieve (mapa normal) — mampostería,
tejas, adoquín, roca fracturada, hierba, madera, chapa, asfalto, arena,
hormigón —, ventanas con marco y cristal en el pueblo (encendidas de noche),
mar y río con olas animadas que reflejan el cielo, montañas con crestas y
nieve (una sola malla por cordillera), pinos de varias capas, arbustos y rocas
instanciados, árboles del Distrito con copas de varias piezas y la ciudad
lejana del bosque con ventanas del mismo tamaño en todas las torres.

**Efectos**: impactos con chispas que rebotan de la superficie, onda de choque
y una bocanada de humo; polvo a ras de suelo al aterrizar, saltar vallas y en
las ondas expansivas; rayos con resplandor en sus extremos; estela del dash
como silueta fantasma de borde luminoso; los drones caen echando chispas y
humo. Todo en tres sistemas de partículas de una llamada de dibujo cada uno.

**Menú**: fondo 3D animado (Jon en una azotea al anochecer frente a la ciudad
encendida, motas de energía, baliza de la antena y cámara que se mece), con
entrada escalonada del título y los botones y paneles que aparecen con
suavidad.

**Iluminación (sin momentos a oscuras)**: se midió el brillo de los 29 puntos
de control de la historia y en cuatro (el acantilado, el almacén y la cámara
de contención de la base y la alarma) más del 90 % de la imagen era negro.
Causas y arreglos:
- La gradación de color oscurecía las sombras (el virado restaba en vez de
  teñir): ahora tiñe sin cambiar la luminancia, el contraste gira alrededor de
  un gris medio-bajo y cada mapa puede levantar el negro (`lift`).
- La base de la PDC no tenía luz dentro: fluorescentes en el almacén, la
  cámara de contención (azulada) y el pasillo alto.
- La noche del pueblo: más luz de luna y de cielo, niebla menos densa y una
  **luz de relleno** que acompaña a la cámara (direccional, hacia donde se
  mira) para que lo cercano nunca se pierda. La tormenta baja menos la luz y
  enciende el mismo relleno.
- La lluvia ya no cae dentro de los edificios ni bajo los voladizos (se corta a
  la altura del tejado).

Brillo medio (0–255) antes → después: CP02 2.9 → 34, CP04 3.3 → 46, CP05 3.9 →
54, CP06 7 → 63, CP07 10 → 65, tormenta (CP13–CP15) 22–24 → 39–45.

**Ajustes nuevos**: *Suavizado de bordes (MSAA)* (activado), *Reflejos del
cielo* (activado) y *Oclusión ambiental (GTAO, exigente)* (desactivada). Con
el bloom y la resolución de render permiten bajar el coste en equipos
modestos: en render por software (sin GPU) los reflejos del cielo son lo más
costoso por píxel (quitarlos duplica los FPS) y después el MSAA.

## Rediseño de mapas

Los mapas se rehicieron siguiendo la propuesta visual aprobada (capturas de
prototipos hechos con el motor), con las piezas del kit de escenarios
(`src/world/kit/`). Se mantienen todas las coordenadas del guion, las rutas
del sigilo, la misión del Distrito y las rutas de azoteas que comprueban las
pruebas.

- **Pueblo costero** (noche y día): casas de pescadores con tejados planos
  para la ruta de M01 y a dos aguas en el resto, iglesia, faro sobre la
  escollera, muelle con barcas, puestos con toldo, tendederos y farolas; la
  playa es una pendiente de arena y alrededor hay colinas con pinos hasta el
  horizonte.
- **Base de la PDC** (meseta del pueblo de noche): muro con torres de
  vigilancia, puesto de control, valla metálica con el hueco de la M01, patio
  de contenedores con grúa pórtico, edificio brutalista con franjas de luz
  azul, helipuerto con helicóptero, garaje, depósitos, camiones y charcos de
  luz bajo los focos (las zonas oscuras siguen siendo las del sigilo).
- **Bosque**: un recorrido con relieve real — arroyo, barricada, cuesta, roca
  con vetas, barranco con pilares, cascada con una cueva detrás, pared de
  escalada marcada en blanco, torre de caza en la meseta y mirador.
- **Gran cañón**: puente de celosía roja a 13 m sobre un cañón de estratos;
  tramo oeste entero (drones), un único hueco de 9 m (dash), tramo caído que
  se baja corriendo, pila partida con generador, tramo descolgado que se
  trepa por sus vigas, tramo este con los bloqueos de la PDC y la colina. Al
  subir a ella la niebla se abre y se ve la ciudad sobre su llanura, con las
  luces de las calles: la tierra lejana baja hasta la llanura sin lomas que
  la tapen y la ciudad está velada por la bruma (`softFog`), sin recortarse
  contra ella ni verse flotando desde el bosque.
- **Distrito Cero**: de noche bajo la lluvia, edificios de ladrillo y hormigón
  con planta baja comercial (escaparates, toldos, rótulos y banderolas de
  neón), escaleras de incendios trepables en las fachadas traseras, depósitos
  de agua, salidas de humo y vallas publicitarias en las azoteas, un
  monorraíl elevado sobre la calle norte (sus pilares se trepan hasta la
  viga), dos puestos de la PDC con barreras y torres de escaneo, un camión de
  la PDC, un callejón de neón con farolillos y un puesto de fideos, y cinco
  bloques nuevos que cierran las esquinas. Fuera del barrio la ciudad sigue
  en todas direcciones: manzanas cercanas con niebla y rascacielos lejanos.
- **Sin huecos de mapa**: cada mapa tiene suelo hasta el horizonte (terreno
  lejano sin colisión, llanura bajo la ciudad, suelo urbano y, en el Campo de
  Pruebas, una explanada de hormigón) y lo que rodea la zona jugable continúa
  a la misma altura en el borde.

El motor gana **terreno con relieve**: cuestas que se suben andando, laderas
empinadas que frenan como un muro, cuevas bajo el terreno y cámara que no lo
atraviesa (`CollisionWorld.addHeightfield`, con pruebas unitarias). Los haces
de los focos de la base tienen un sombreado volumétrico suave (más densos en
el eje, transparentes en los bordes) y su charco de luz no tiene borde duro.

**Rendimiento de los mapas nuevos**: la geometría estática se fusiona por
material **y por celda de 96 m**, así que lo que queda fuera de la vista no
se dibuja; los pinos lejanos usan un modelo simplificado sin sombras; el
terreno lejano usa un material barato; los focos de la base y las farolas
pintan un charco de luz en el suelo en vez de llevar una luz real, y todos los
charcos de un mapa son una sola malla (`lightPools`); las barcas y el
helicóptero son estáticos; las manzanas y los rascacielos alrededor del
Distrito son instancias (una llamada de dibujo cada grupo) con material
Lambert, ordenadas de cerca a lejos para pintar menos píxeles ocultos. En la
prueba con render por software el Distrito nuevo va a ~2.5 FPS (el anterior,
~2.3); la vista del cañón desde el puente, con casi un millón de triángulos
(terreno detallado, 3 600 pinos, agua y decorado), baja a ~1 FPS, algo que
solo afecta al render por software de las pruebas (en una GPU es una carga
normal).

## Rendimiento

El juego iba lento sobre todo por lo que dibujaba la tarjeta gráfica:

- **Densidad de píxeles**: como mucho 1 píxel de render por píxel de la
  pantalla. En pantallas de alta densidad (portátiles con 2×) antes se dibujaba
  4 veces más; con el MSAA activado apenas se nota la diferencia.
- **Calidad automática** (Ajustes, activada por defecto): mide los FPS y, si
  bajan de ~45, reduce la resolución de render por escalones de 10 % hasta el
  60 %; si aun así va por debajo de 30, quita el MSAA. Cuando sobra margen lo
  devuelve todo poco a poco (`src/core/AutoQuality.js`, con pruebas).
- **Pinos con nivel de detalle**: solo los que están a menos de 55 m de la
  cámara usan la copa detallada (ahora de 120 triángulos en vez de 280) y
  proyectan sombra; el resto usa la copa simplificada y los que la niebla ya
  oculta no se dibujan.
- **Terreno en baldosas**: el terreno se divide en baldosas de 32 × 32 celdas
  que se descartan fuera de cámara y, lejos, se dibujan con la mitad o la
  cuarta parte de vértices (con faldones que tapan las rendijas).
- **Menos luces reales**: cada luz puntual encarece todos los píxeles
  iluminados. Las luces fijas de los efectos bajan de 6 a 3; en la base, de 7
  a 3 (dos interiores y la de la alarma); se quita una luz que no se usaba en
  la casa de Jon, y las farolas de la plaza del Distrito pintan su charco de
  luz en vez de iluminar.

En el bosque, los triángulos que se dibujan bajan de ~1.7 millones a
~0.4–0.55 millones según la vista.

## Enemigos que no aparecen de la nada

Los enemigos ya están en el mapa o llegan por un sitio visible:

- **Puente**: los tres drones esperan **posados en una estación de drones**
  del tramo oeste y despegan de uno en uno. Los agentes del primer bloqueo ya
  están en su puesto (tranquilos) mientras Jon trepa por el tramo descolgado;
  si se les ataca antes, el combate empieza sin diálogo. El **agente reforzado
  salta de la caja de un camión** y los refuerzos bajan de los dos camiones.
- **Misión del Distrito**: la patrulla **baja por detrás del camión de la
  PDC** aparcado en la calle norte, de uno en uno, y el Acólito **sale del
  callejón** entre A2 y B3.
- **Campo de Pruebas**: en la Zona G los enemigos **salen del barracón del
  fondo** y el francotirador sube a su torre por la escalera; en la Zona D
  están en el recinto desde el principio y, al reiniciar en la consola,
  **entran por la puerta del muro norte**.

`Enemy` admite dos estados sin IA: *en reposo* (`dormant`, quieto en su sitio
hasta `wake()`) y *entrada* (`entrance`: recorre un camino desde su escondite,
con una espera opcional oculto dentro). Un golpe interrumpe cualquiera de los
dos y el enemigo reacciona.

**Dificultad del puente**: los enemigos de los bloqueos tienen el 65 % de la
vida (el reforzado, el 55 %), hacen la mitad de daño, disparan con más
tiempo entre balas, apuntan peor y reaccionan más tarde (`scaleType`, por
enemigo; el tipo base no cambia).

## Base de la PDC: puertas y guardias

- **Puertas**: la entrada principal es una doble puerta de cristal (cerrada
  con llave) con una **persiana de seguridad que baja con la alarma**; el
  anexo y la caseta de la tirolina tienen puerta de servicio con luz y
  escalera de mano a la azotea; el garaje (el cuartel) tiene puerta de
  personal; las torres de vigilancia, escalera; la garita, su puerta por
  dentro.
- **Guardias que no atraviesan nada**: una rejilla de navegación de la meseta
  (`src/ai/NavGrid.js`, A* con pruebas) marca lo que ocupa el cuerpo de un
  guardia; sus rutas, las investigaciones de ruidos, el relevo y la alarma
  siguen caminos que rodean paredes, cajas, camiones y vallas.
- **Más vigilancia**: además del patio, la fachada, el conducto y el almacén,
  hay guardias en la puerta norte, el helipuerto y el garaje (lejos de la
  ruta del sigilo).
- **Cambio de guardia**: los dos guardias del conducto se van andando por el
  lado oeste del edificio hasta el cuartel, **entran** y, un rato después,
  salen y vuelven a su puesto.
- **Alarma**: los guardias ya no desaparecen: **corren a la entrada
  principal** cerrada (creen que el intruso sigue dentro), el de la puerta
  norte no la abandona y los del helipuerto y el garaje vigilan la pasarela
  del anexo mientras Jon huye por las azoteas.

## Diseño de la ciudad (propuesta)

La ciudad del acto I (nombre provisional: Ibaia) está **diseñada, no
implementada**, al estilo de las ciudades de Spider-Man, inFamous Second Son,
GTA y Watch Dogs: una isla de rascacielos con parque central, una península
con colinas, puerto y playa, y una orilla este de casco antiguo e industria,
unidas por puentes. Son 30 km² en diez barrios de 3 km², y cada barrio queda
encerrado por una **barrera de la Defensa** que se rompe desde dentro, en su
Ancla, con la marca de ese barrio. A mitad de juego se descubre que las
barreras son una Encarnación. Resumen en [`docs/CIUDAD.md`](docs/CIUDAD.md);
los generadores de planos y maqueta, en [`tools/ciudad/`](tools/ciudad/README.md).

## Etapa 7 — Pulido

**Sonido** (`src/audio/`): todo se sintetiza en tiempo real con Web Audio, sin
archivos. Se activa con el primer clic o tecla (política de los navegadores).

| Grupo | Sonidos |
| --- | --- |
| Movimiento | pasos (sincronizados con la animación), salto, aterrizaje según la velocidad, esquiva, agarre, subida a cornisas, salto de vallas |
| Poderes | proyectil, impacto, dash, descarga (con zumbido que sube mientras se carga), onda, caída en rayo, recarga, «sin energía», absorción de una fuente (continuo) |
| Combate | golpe normal y eléctrico, disparos de la PDC, orbes del Acólito, impactos, daño recibido, neutralización |
| Misión y facciones | aceptar misión, detección, misión completada, aviso de radio al volverse hostil la PDC, marca adquirida |
| Ambiente | ciudad (rumor de tráfico y zumbido eléctrico) en el Distrito; viento en el Campo de Pruebas |
| Interfaz | clic en los botones de los menús |

Los efectos en el mundo se atenúan con la distancia (inaudibles a más de
60 m) y se panoramizan según la orientación de la cámara. En pausa el
ambiente se silencia. **Ajustes**: volumen general, efectos y ambiente.

**Rendimiento**:
- Al cargar un mapa, toda la geometría estática se fusiona en una malla por
  material (`src/world/mergeStatic.js`): Distrito Cero pasa de ~800 a ~300
  llamadas de dibujo (el resto son personajes animados y objetos interactivos)
  y el Campo de Pruebas de ~440 a ~300. En la prueba con render por software,
  el Distrito pasó de 0.5 a 2.3 FPS (×4.6); en una GPU real el margen es mucho
  mayor.
- Los rascacielos del horizonte son instancias de una sola malla.
- **Ajustes → Resolución de render** (50–100 %) para equipos modestos.
- La lógica del juego cuesta ~1 ms por frame (medido).

**Colisiones y errores**:
- Barandillas de 1 m en las 7 pasarelas del Distrito: ya no se cae uno de lado
  (saltando sí se pueden superar). No se escalan ni bloquean la cámara.
- Prueba de estrés del motor (`tests/unit/fuzz.test.js`): 36 000 pasos con
  entradas aleatorias (movimiento, salto, esquiva, dash, desplazamiento
  dirigido, picado, agacharse, escalada, balanceo, patinaje, carrera de
  hielo, vuelo, frames lentos) en 12 mundos
  aleatorios, comprobando que la posición es finita, que no se atraviesa
  ninguna caja y que no se sale de los límites. Se ejecutó también con 200
  mundos (600 000 pasos) sin fallos.
- Eliminados los avisos de Three.js en consola (`THREE.Clock` → `THREE.Timer`,
  sombras PCF).
- «Reiniciar escenario» (F2) ya no borra las fuentes de energía ni las
  interacciones.

**Efectos y animación**: polvo al aterrizar fuerte, al saltar vallas y al
subir a cornisas; pasos sincronizados con el ciclo de la animación.

## Etapa 6 — Distrito Cero

**Población del barrio**: una patrulla PDC de dos agentes recorre la calle
norte y un Acólito de Energía vigila la azotea de B3. Al activar la misión
llegan además la patrulla PDC objetivo (tres agentes que bajan del camión de
la calle norte hacia la calle sur) y el Acólito hostil (sale del callejón
entre A2 y B3 hacia la calle entre B3 y B4).

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

**Al empezar no tienes la marca de Energía.** Desde la Etapa 8 se obtiene
jugando el **Prólogo** (Historia); al completarlo pasa al modo libre. La
estación original de la **Zona E** sigue disponible con F2 → *Zona E clásica*
(así es como la prueban los tests del modo libre):

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
por depuración, así que hay que conseguirla en el Prólogo (o en la Zona E clásica).

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

**Distrito Cero**: barrio de noche bajo la lluvia con 8 edificios principales,
2 anexos y 5 bloques en las esquinas, calles, callejones (uno de neón), plaza
central con fuente, farolas, coches, contenedores, monorraíl, puestos de la
PDC y límites físicos. **Todas las azoteas son accesibles** sin escalada:
escaleras (B1, B5, B6), pasarelas entre azoteas y cadenas de contenedores y
cajas (A1, A2); además, escaleras de incendios trepables en las fachadas
traseras y los pilares del monorraíl.

## Qué se ha probado realmente (Etapas 1 a 8)

- `npm test` — 60 tests unitarios: físicas (gravedad, velocidades, salto, muros,
  túnel a alta velocidad, escalones, rampas, techos, *coyote time*,
  reaparición, esquiva corta, dash, caída en picado, desplazamiento dirigido,
  IA por estados, facciones, impactos en personajes, salud,
  multiplicador de velocidad, raycast), guardado,
  energía (gasto, regeneración, modo infinito), cargador y recarga, habilidades (coste y
  reutilización), daño directo y de área, y proyectiles (impacto en muros finos,
  alcance, límites invisibles). Con las marcas, combos y la historia son 134, y 141 con los gráficos
  (`graphics.test.js`: chispas, humo, gradación —incluido que el virado no
  oscurece—, lluvia que no cae bajo techo, montañas y fusión de piezas del
  personaje) y 146 con el terreno con relieve (`terrain.test.js`: altura por
  triángulos, subir una cuesta de 25°, pared empinada que frena, cueva bajo la
  ladera y rayo de la cámara);
  `story.test.js` comprueba los 29 puntos de control y su tramo de guion, las
  banderas de cada punto, qué poderes se permiten en cada tramo, el estado
  (las banderas no retroceden, la elección solo admite KILL/SPARE, completar),
  el guardado de la historia, el cálculo del sigilo y, **con el motor real**,
  que el hueco de 9 m del puente no se cruza con un salto con carrera y sí con
  salto + dash en el aire (aterrizando en la rampa del tramo caído), y el
  dash asistido.
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
  - Pulido: el audio está activo; hay ambiente de ciudad y de campo; suenan
    pasos, saltos, aterrizajes, disparos, impactos, agarres, misión, radio y
    absorción; la geometría estática se fusiona y el Campo queda por debajo de
    400 llamadas de dibujo; las barandillas impiden caerse de una pasarela;
    volumen y resolución de render se guardan.
  - Gravedad: se copia de su Encarnación y queda activa con las dos marcas;
    el HUD muestra sus habilidades; V cambia de marca; Q levanta y encadena 3
    rocas; el disparo hace flotar; atraer trae al enemigo flotando a 1.6 m y le
    aturde; empujar lo aleja; la granada crea la burbuja y lo deja flotando;
    mantener el salto llega a ≈3.2 m, se planea y hay 3 saltos; la estasis se
    activa al 5 % de vida; la pasiva de Energía detiene al enemigo; los
    escombros recargan la Gravedad y la activan.
  - Hilo: se copia y quedan tres marcas; V las recorre; el puño de hilo golpea
    y espera a volver; atar inmoviliza; atraerse lleva hasta el enemigo y
    hasta una pared; la cadena alcanza a dos enemigos; lanzar sube al enemigo
    ≈5 m; mantener Q balancea y soltar suelta; el salto alto llega a ≈4.5 m;
    los rollos de tela recargan el Hilo.
  - Temperatura: se copia y quedan cuatro marcas; V las recorre; el HUD
    muestra 10 balas alternando hielo y fuego; los disparos alternan mano y
    hacen el mismo daño; el golpe quema 10 en total aunque se repita; la
    estela y la tormenta dañan; el muro corta la línea de tiro; patinando
    contra el muro de 8 m se sube y se cae en U; Shift patinando sube por el
    aire sobre placas de hielo y al soltar se queda de pie encima; el arcón
    congelador recarga la Temperatura.
  - Alas: se copian y quedan cinco marcas; V las recorre; el HUD muestra
    100/100 con 10 símbolos y las alas se ven en la espalda; 30 disparos
    gastan 30 plumas, aciertan y las alas muestran menos plumas; las plumas
    se regeneran; la espada cuesta 20, sube el golpe un 20 % y manteniendo R
    crece hasta 50 plumas con más daño; la lluvia gasta 50 y daña desde el
    suelo y desde el aire; el vuelo sube mirando arriba y con 10 plumas va a
    menos del 60 % de la velocidad; el escudo cuesta 10, para la primera bala
    y deja pasar la segunda; los cojines recuperan plumas.
  - Pulido: hay pose propia de patinaje y de vuelo (el cuerpo se inclina);
    mantener V abre la rueda con cinco marcas, el ratón señala una y al
    soltar se activa; la pasiva Plumaje absorbe 6 de 30 de daño con 6 plumas.
  - Combos: Combustión, Escarcha, Descarga en cadena y Plumas ardientes se
    provocan con los poderes reales y muestran el aviso.
  - Enemigos especiales: la Zona G empieza vacía y al entrar llegan desde el
    barracón el Blindado, dos drones y el francotirador; el francotirador apunta con el
    láser ≈1.3 s antes de disparar; los drones vuelan a ≈4.5 m; el escudo
    para el 90 % de frente pero no por detrás ni flotando; el dron recibe un
    25 % de los golpes y, atado, cae; el Distrito tiene sus tres unidades
    especiales.
  - Zona E: sin la opción clásica no está la Encarnación de la Energía (sí las
    otras cuatro); junto al terminal dorado aparece «Jugar el Prólogo» y E lo
    abre; volver al menú recupera el perfil de marcas del modo libre.
  - **Historia** (`tests/e2e/story.mjs`, diálogos a 8×): nueva partida en el
    pueblo de noche sin marcas ni poderes; diálogo completo de la reunión y
    CP01 guardado tras ella; en el despertar de CP09 aparece «Mantén Espacio
    para saltar», la pausa ofrece *Saltar escena* y mantener Espacio salta la
    cinemática dejando el mismo estado que verla (frase final, objetivo, Jon
    fuera de la cama, sonido y pantalla restaurados); en M01 no hay enemigos ni poderes y F lanza
    piedras; de pie delante de un guardia salta «Te han descubierto» y se
    recarga CP03 con Jon en el escondite; el cambio de guardia abre el
    conducto; CP04 y CP05; E en la carta dorada concede el Destino sin
    ningún poder ofensivo; alarma, compuertas, huida por la azotea, CP08,
    tirolina, desmayo y paso al pueblo de día; Narbaiza deja a Jon a **1 PV
    exactos** y CP10 se guarda con 1 PV; tarjetas de día y continuar en el
    día guardado; las tres compras desatan la tormenta, cae la esfera, la
    calle se bloquea y la casa queda en ruinas; soltar E antes de tiempo
    cancela la copia y mantenerlo copia la Energía sin quitársela a la
    Encarnación; la Energía sigue bloqueada hasta el bosque; PERDONAR y MATAR
    (ambas ramas) tienen frases distintas, se guardan al instante y acaban en
    CP17 y el autobús (ataque, vuelco, destello, CP18); el escombro no se
    rompe a golpes y sí a disparos; el generador recarga; los 3 drones
    esperan posados en su estación y despegan de uno en uno; R y G se
    desbloquean tras ellos y Q en el puente;
    caer al cañón recarga CP23; **un salto real con teclado + dash cruza el
    hueco de 9 m** y aterriza en el tramo caído; la pila partida guarda
    CP24 con el primer bloqueo ya en su puesto; 2 agentes + 1 dron; el
    reforzado sale de un camión (y es más débil) y luego 2 agentes; CP28;
    la colina, la ciudad, el dash final y el menú principal con
    `TutorialComplete`, la Energía en el perfil libre y «Prólogo completado».
  - Gráficos: la cadena de postproceso (render, oclusión, bloom, salida,
    gradación) está montada; el MSAA (0 ↔ 4 muestras) y los reflejos del
    cielo se encienden y apagan desde los ajustes; un impacto genera chispas y
    humo que se disipan; el pueblo tiene agua animada, montañas nevadas y
    materiales con relieve; el menú tiene su fondo 3D animado y, al volver
    de un mapa, el juego vuelve a dibujar su propia escena.
  - Sin errores en consola. Capturas en `tests/e2e/output/`.
  - La batería empieza con los ajustes de un equipo modesto (sin MSAA ni
    reflejos del cielo, resolución de render al 75 %): con el render por
    software va a ~4–6 FPS y muchas comprobaciones miden en tiempo real (por
    debajo de 10 FPS el juego se ralentiza: paso máximo de 0.1 s). La
    sección de gráficos enciende la calidad alta un momento para comprobarla.
  - La batería tarda ~30 min con render por software (la historia, unos 3–5); `E2E_STOP=campo`
    la detiene tras la sección del Campo de Pruebas para iterar más rápido.

**No probado** en la historia: recorrer el prólogo entero a mano (la prueba
teletransporta a Jon entre los disparadores de cada tramo y mata a los
enemigos por código salvo el escombro), su duración real y el equilibrio del
sigilo con un jugador. **No probado** en general: rendimiento en GPU real (las pruebas usan SwiftShader; el bloom
añade coste, se puede desactivar en Ajustes), la sensación de control con
ratón físico ni cómo suena con altavoces reales (las pruebas comprueban que
cada sonido se genera, no su calidad). Conviene una sesión de juego manual.

## Limitaciones conocidas

- Modelos, animaciones y texturas son procedurales (sin recursos externos):
  no hay esqueletos con animaciones capturadas, ni expresiones faciales, ni
  ropa con física. El pelo es una forma rígida.
- El sonido es sintético (no hay grabaciones ni música).
- Las rampas de cajas no tienen límite de pendiente (cualquiera es
  transitable); el terreno con relieve sí (≈50°).
- La cámara puede quedar dentro de la parte inferior de una pasarela si se
  mira desde muy abajo.
- Navegación enemiga sencilla (sin malla de navegación): van en línea recta,
  saltan obstáculos bajos y rodean al atascarse; en zonas muy cerradas pueden
  quedarse bloqueados. Los enemigos no escalan ni usan las escaleras de
  incendios.
- La reputación de la PDC no se guarda entre sesiones (se reinicia al cargar
  el mapa); solo reacciona la PDC.
- La rotación de los objetos físicos es solo visual (su colisión es una caja
  alineada); la Sobrecarga y el árbol de mejoras llegan con la progresión.
- *Salir* no puede cerrar una pestaña del navegador; muestra una pantalla de despedida.
- **Prólogo**: dura bastante menos que los 80–105 min del guion (las escenas
  están condensadas y los recorridos son cortos); las cinemáticas usan los
  modelos y poses provisionales (sin animaciones faciales ni de manos: las
  esposas son una pose, Narbaiza no tiene animación propia); Iker no puede ser
  detectado en el sigilo (sus movimientos están guionizados para no pasar por
  zonas vigiladas); la huida de M01 tiene un temporizador de 150 s; los
  personajes del guion no tienen colisión (atraviesan cajas si el jugador se
  interpone). No hay música ni voces.

## Estructura

Ver [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md).
