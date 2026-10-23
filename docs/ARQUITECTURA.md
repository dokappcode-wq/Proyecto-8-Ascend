# Arquitectura técnica de ASCEND

```
src/
├── main.js                     Arranque: crea GameManager y registra los mapas
├── core/
│   ├── GameManager.js          Estados (menú/juego/pausa), bucle, registro de sistemas
│   ├── EventBus.js             Eventos entre sistemas desacoplados
│   ├── Input.js                Teclado/ratón con acciones reasignables
│   ├── AutoQuality.js          Resolución dinámica según los FPS (sin Three.js)
│   └── SaveSystem.js           Guardado versionado (ajustes, controles, perfil)
├── physics/
│   ├── CollisionWorld.js       Cajas, rampas, terreno con relieve y conjuntos de cajas orientadas; consultas y raycast (sin Three.js)
│   ├── ObbSet.js               Miles de cajas orientadas estáticas con rejilla espacial y grupos activables (sin Three.js)
│   ├── CharacterMotor.js       Controlador cinemático del personaje (sin Three.js)
│   └── Parkour.js              Consultas de escalada, cornisas y obstáculos, con muros en cualquier dirección (sin Three.js)
├── player/
│   ├── PlayerController.js     Input → motor, orientación, animación, cámara
│   ├── CharacterModel.js       Personaje procedural detallado, animación y anclajes para marcas
│   ├── bodyParts.js            Piezas del cuerpo fusionadas por material (colores por vértice)
│   ├── MarkVisual.js           Patrones luminosos de una marca sobre el modelo
│   ├── Cover.js                Detección de coberturas, bordes y punto para asomarse
│   └── markTextures.js         Símbolos de marcas generados por canvas
├── camera/CameraController.js  Cámara en tercera persona con colisión
├── world/
│   ├── MapManager.js           Registro, carga y descarga de mapas
│   ├── LevelBuilder.js         Malla + colisionador a la vez (bloques, rampas, escaleras…)
│   ├── environment.js          Cielo (nubes, estrellas, luna), mapa de entorno, sol, montañas, ciudad lejana y niebla suave
│   ├── textures.js             Texturas procedurales con mapa normal (relieve)
│   ├── water.js                Agua animada (dos capas de olas, reflejo del cielo)
│   ├── mergeStatic.js          Fusión de la geometría estática por material y celda de 96 m
│   ├── kit/                    Piezas de escenario reutilizables
│   │   ├── common.js           Mallas estáticas, tejado a dos aguas transitable, rocas, marcas de escalada
│   │   ├── terrain.js          Terreno con relieve: malla, mezcla hierba/tierra/roca y colisión
│   │   ├── village.js          Casas de pescadores, faro, barcas, muelle, iglesia
│   │   ├── wild.js             Hoguera, piedras de arroyo, pilares de roca, cascada, torre de caza, tienda
│   │   ├── bridge.js           Tramos de celosía (rectos, inclinados o colgando) y pilas
│   │   ├── base.js             PDC: muro, torres, contenedores, focos, charcos de luz, camiones, helicóptero, piel brutalista
│   │   └── city.js             Plantas bajas con escaparates y neón, escaleras de incendios, depósitos, monorraíl, coches
│   └── maps/
│       ├── TrainingGround.js   Mapa 1 — Campo de Pruebas
│       ├── DistrictZero.js     Mapa 2 — Distrito Cero
│       ├── Village.js          Historia — pueblo costero de noche (base PDC) y de día
│       ├── Forest.js           Historia — valle, viaducto, bosque, puente destruido y colina
│       ├── Ibaia.js            Ibaia, la ciudad (30 km²): carga, luz, agua, sierra, fuentes, vida de la ciudad
│       └── ibaia/
│           ├── cityData.js     Datos generados por tools/ciudad/export_game.py (no se edita a mano)
│           ├── decode.js       Lectura de los datos, máscara de agua, barrios y colisión de la ciudad (sin Three.js)
│           ├── meshes.js       Edificios con ventanas en el shader, suelo, árboles, farolas, puentes y tren por celdas
│           ├── barriers.js     Barreras de la Defensa: muros de hexágonos de 300 m, cúpula y animación de bajada
│           ├── landmarks.js    Torre de la Defensa, Anclas, depósitos, chimeneas, grúas, noria, faro…
│           ├── pdcPlan.js      La PDC y los Acólitos: grupos por puesto/patrulla y qué se crea según la distancia (sin Three.js)
│           ├── pdcPosts.js     Puestos de la PDC girados con la calle (vallas, garita, escáner, camión, foco) y hogueras
│           └── population.js   Población por distancia, neutralizados, refuerzos del camión, drones y toque de queda
├── story/                      Modo historia (prólogo)
│   ├── storyData.js            Fases, misiones y los 29 puntos de control (sin Three.js)
│   ├── StoryState.js           Estado persistente: punto, banderas, misión (sin Three.js)
│   ├── stealthMath.js          Cálculo de la detección del sigilo (sin Three.js)
│   ├── StoryDirector.js        Ejecuta el guion por tramos, guarda, recarga, sigilo, UI
│   ├── prologue.js             El guion M01–M05: un tramo por punto de control
│   ├── StoryUI.js              Subtítulos, objetivos, tutoriales, detección, elección
│   ├── actors.js               Personajes (Npc), guardias de sigilo y focos
│   └── props.js                Compuertas, tirolina, escombro, lluvia, cartas, autobús…
├── ai/
│   ├── EnemyBrain.js           Máquina de estados de la IA (sin Three.js)
│   ├── Enemy.js                Cuerpo, percepción, navegación, arma, reposo y entradas en escena
│   ├── NavGrid.js              Rejilla de navegación y A* para los guardias (sin Three.js)
│   └── enemyTypes.js           Datos de los enemigos y ajuste de dificultad (scaleType)
├── combat/
│   ├── CombatSystem.js         Dañables, actores, facciones, daño directo y de área
│   ├── Health.js               Salud con regeneración e invulnerabilidad
│   ├── geometry.js             Rayo contra cilindro vertical (impacto en personajes)
│   └── projectile.js           Simulación de proyectiles (sin Three.js)
├── powers/
│   ├── acquisition.js          Reglas de adquisición de marcas (sin Three.js)
│   ├── Progression.js          Experiencia, niveles, puntos y mejoras por marca
│   ├── Magazine.js             Cargador genérico
│   ├── EnergyPool.js           Recurso de energía (sin regeneración en Energía)
│   ├── EnergyReserve.js        Reserva de una fuente del entorno (se agota y se recupera)
│   ├── Ability.js              Coste y tiempo de reutilización de una habilidad
│   └── energy/energyConfig.js  Parámetros de la familia Energía
├── systems/
│   ├── PowerSystem.js          Input → habilidades de la familia activa
│   ├── ProjectileSystem.js     Proyectiles: movimiento, impacto, daño, efectos
│   ├── EnemySystem.js          Alta/baja de enemigos, ruido, separación de personajes
│   ├── PlayerCombat.js         Salud del jugador, caídas, golpe, muerte y reaparición
│   ├── InteractionSystem.js    Interacción con E (consolas, Encarnaciones, fuentes)
│   ├── EnergyDrainSystem.js    Absorción de energía de farolas, armarios y máquinas
│   └── PowerAcquisitionSystem.js  Contacto → voluntad → copia de marcas
│   ├── MarkSystem.js           Marcas poseídas e intensidad de sus patrones
├── vfx/
│   ├── VfxSystem.js            Impactos, chispas, humo, polvo, anillos, rayos, estelas, destellos
│   ├── ParticleSystem.js       Partículas aditivas o de humo (una sola llamada de dibujo)
│   ├── SparkSystem.js          Chispas estiradas según su velocidad (una llamada de dibujo)
│   ├── LightPool.js            Luces puntuales reutilizables (sin recompilar shaders)
│   ├── gradePass.js            Gradación de color final (contraste, tonos, viñeta, grano)
│   └── glowTexture.js          Halos y aro de onda de choque
├── world/entities/             Dianas, maniquíes, objetos físicos, fuentes de energía y Encarnación de prueba
├── factions/Reputation.js      Hostilidad por facción y reglas (sin Three.js)
├── missions/Mission.js         Estado de una misión y sus objetivos (sin Three.js)
├── data/missions.js            Misión de prueba del Distrito Cero
├── data/marks.js               Definiciones de marcas (datos configurables)
├── data/progression.js         Árboles de habilidades por marca
└── ui/
    ├── UIManager.js            Menús, HUD, ajustes y transiciones
    ├── MenuScene.js            Fondo 3D animado del menú principal
    ├── cityMap.js              Plano de Ibaia del menú de administración (barreras, Anclas, jugador, clic para ir)
    └── styles.css
```

## Principios

- **Un solo controlador para todos los mapas.** `MapManager` solo sustituye la
  geometría y el `CollisionWorld`; jugador, cámara, input y sistemas persisten.
- **Lo que se ve es lo que colisiona.** Cada elemento del mapa se crea con
  `LevelBuilder`, que genera la malla y su colisionador con las mismas medidas.
- **Física independiente del render.** `physics/` no importa Three.js, por lo
  que se prueba con `node --test` y se reutiliza en el bot de las pruebas e2e.
- **Sistemas desacoplados.** Los sistemas se comunican por `EventBus`
  (`player:jumped`, `player:landed`, `player:dodged`, `player:respawned`,
  `map:loaded`, `map:unloaded`, `combat:damage`, `projectile:hit`,
  `power:used`, `power:failed`, `marks:changed`) y se registran con
  `GameManager.addSystem()`, que les llama con `update(dt, game)` mientras se juega.
- **Entidades de mapa.** `build(ctx)` recibe `ctx.addEntity()`; las entidades
  (dianas, maniquíes, objetos físicos) se actualizan cada frame, se reinician
  desde depuración y se liberan al descargar el mapa. Las dañables se
  registran en `CombatSystem` y enlazan su colisionador con `owner`, de modo
  que un proyectil sabe a quién ha impactado.

## Correspondencia con los sistemas del documento de diseño

| Sistema | Estado | Ubicación / punto de extensión |
| --- | --- | --- |
| GameManager | ✅ Etapa 1 | `core/GameManager.js` |
| MapManager | ✅ Etapa 1, entidades en Etapa 2 | `world/MapManager.js` |
| PlayerController | ✅ Etapa 1, apuntado en Etapa 2 | `player/PlayerController.js` |
| CameraController | ✅ Etapa 1, apuntado y sacudida en Etapa 2 | `camera/CameraController.js` |
| UIManager | ✅ menús, HUD de energía, depuración | `ui/UIManager.js` |
| SaveSystem | ✅ ajustes y depuración; perfil reservado | `core/SaveSystem.js` → `profile.marks`, `profile.skillProgress` |
| PowerSystem | ✅ Etapa 2 (Energía) | `systems/PowerSystem.js` |
| MarkSystem | ✅ Etapa 4 | `systems/MarkSystem.js`, `player/MarkVisual.js`, `data/marks.js` |
| CombatSystem | ✅ daño, área, actores y facciones | `combat/CombatSystem.js`; golpe en `systems/PlayerCombat.js` |
| HealthSystem | ✅ Etapa 3 | `combat/Health.js`, `systems/PlayerCombat.js` |
| ParkourSystem | ✅ Etapa 5 | `physics/Parkour.js` + estados de `physics/CharacterMotor.js`; animación en `CharacterModel`, cámara en `CameraController.setParkour` |
| EnemyAI / PDCEnemy / AcolyteEnemy | ✅ Etapa 3 | `ai/EnemyBrain.js`, `ai/Enemy.js`, `ai/enemyTypes.js`, `systems/EnemySystem.js` |
| PowerAcquisitionSystem | ✅ Etapa 4 | `systems/PowerAcquisitionSystem.js`, `powers/acquisition.js` |
| PowerProgressionSystem | ✅ Etapa 4 | `powers/Progression.js`, `data/progression.js`; `PowerSystem.applyModifiers` |
| FactionReputationSystem | ✅ Etapa 6 (hostilidad PDC) | `factions/Reputation.js`, `systems/FactionSystem.js` |
| MissionSystem | ✅ Etapa 6 | `missions/Mission.js`, `data/missions.js`, `systems/MissionSystem.js` |

Los sistemas pendientes **no existen todavía en el código** (salvo los datos y
puntos de anclaje indicados); se añadirán en su etapa, sin interfaces falsas.

## Física del personaje

- Cuerpo: cilindro vertical (radio 0.38 m, altura 1.8 m).
- Movimiento horizontal con sub-pasos (≤ medio radio por paso) para no
  atravesar muros; el colisionador empuja el círculo fuera de cada caja o
  rampa que no pueda superarse como escalón.
- Suelo: superficie más alta bajo el círculo cuya cima no supere
  pies + escalón (0.45 m). Al bajar rampas o escaleras se mantiene el contacto.
- Rampas: cuñas con altura lineal a lo largo de un eje; las escaleras usan una
  rampa invisible como colisión para que subir y bajar sea fluido.
- Terreno con relieve (`addHeightfield`): rejilla de alturas; cada celda son
  dos triángulos con la misma diagonal que la malla visible (`kit/terrain.js`),
  así que los pies coinciden con lo que se ve. Cuenta como suelo como una rampa;
  lo más empinado que `MAX_SLOPE` (50°) no se sube a escalones: el círculo se
  empuja cuesta abajo y frena como un muro. Si la ladera queda muy por encima
  de la cabeza se ignora (cuevas bajo el terreno, con suelo y techo de cajas).
  El rayo de la cámara también choca con él (avance a media celda y bisección).

## Poderes (Etapa 2)

- `PowerSystem.update` se ejecuta después del jugador: lee el input, consulta
  `MarkSystem.activeFamily` y activa habilidades (`Ability.commit` comprueba
  energía y reutilización).
- Apuntado: un rayo desde el centro de la cámara (empezando a la altura del
  personaje para no chocar con lo que hay detrás) da el punto objetivo; el
  proyectil sale de la mano derecha hacia ese punto.
- Proyectiles: cada frame se lanza un rayo del tramo recorrido contra el
  `CollisionWorld` (ignorando los límites invisibles); si el colisionador
  tiene `owner` registrado en `CombatSystem`, recibe el daño.
- Marcas: `MarkSystem.pulse()` (ataques) y `sustain()` (carga) fijan la
  intensidad; `MarkVisual` enciende las regiones del cuerpo por umbrales.

## Combate (Etapa 3)

- **Actores**: jugador y enemigos no tienen colisionador en el mundo (se
  mueven); se registran con `CombatSystem.registerActor` y exponen
  `capsule()`. Los proyectiles comprueban el tramo recorrido contra el mundo y
  contra los cilindros de los actores, y gana el impacto más cercano.
- **Facciones**: cada fuente de daño indica su facción (`faction`); nunca daña
  a la suya. El tirador (`owner`) nunca se impacta a sí mismo.
- **IA**: `EnemyBrain` decide (estado + intención) a partir de percepciones;
  `Enemy` percibe (cono de visión + rayos de línea de visión cada 0.15 s,
  ruido repartido por `EnemySystem`) y ejecuta la intención con el mismo
  `CharacterMotor` que el jugador (pasos fijos, colisiones, escalones). El
  arma usa `Magazine` y `ProjectileSystem`.
- **Orden por frame**: jugador → combate del jugador → poderes →
  interacciones → adquisición → absorción → enemigos → proyectiles → entidades → marcas → VFX → HUD.

## Marcas (Etapa 4)

- **Posesión**: `profile.marks` (guardado). `MarkSystem.acquire()` la añade y
  guarda; `owns()` también acepta el atajo de depuración.
- **Adquisición**: `PowerAcquisitionSystem` gestiona contacto → voluntad →
  copia y consulta `evaluateAcquisition` (reglas puras y probadas). Las
  fuentes se registran con `registerSource(entity)` (una Encarnación expone
  `source = { kind: 'incarnation', markId }`); los Acólitos se registran
  automáticamente como fuentes no válidas.
- **Progresión**: `Progression` trabaja sobre `profile.skillProgress`; sus
  `modifiers()` se aplican con `PowerSystem.applyModifiers()`, que reconstruye
  la configuración efectiva a partir de `energyConfig.js`.
- **Coberturas**: `player/Cover.js` detecta muros con rayos a la altura de un
  personaje agachado; el `CharacterMotor` reduce su altura al agacharse y el
  `PlayerCombat.capsule()` la expone, de modo que la visión y la puntería de
  los enemigos respetan la cobertura sin código específico.

## Recarga desde el entorno

- `EnergyPool` ya no se regenera en la familia Energía (`regenPerSecond: 0`);
  `add()` suma energía con tope.
- Cada `EnergySource` (farola, armario eléctrico, máquina expendedora) tiene
  una `EnergyReserve` y se registra con `services.energySources.register()`
  desde el mapa. `EnergyDrainSystem` la expone a `InteractionSystem` como
  interacción mantenida: mientras E siga pulsada y el jugador esté en rango,
  transfiere `drain.rate` por segundo de la reserva a la energía, orienta al
  personaje hacia la fuente y emite `energy:drain-start` / `energy:drain-stop`.
- La mejora «Absorción rápida» multiplica `drain.rate` (`drainMul`).

## Parkour (Etapa 5)

- **Sin sistema aparte en el bucle**: el parkour son estados del
  `CharacterMotor` (`wall`, `hang`, `mantle`, `vault`), activados con
  `parkour: true` (solo el jugador). Así se ejecuta en los mismos pasos fijos
  que el resto del movimiento y se prueba con `node --test`.
- **Detección** (`physics/Parkour.js`): rayos horizontales contra el
  `CollisionWorld` dan el muro y su normal; un rayo vertical desde encima de
  la pared da la cima de la cornisa (si empieza dentro de un sólido, el muro
  sigue y no hay cornisa); `bodyFits` comprueba que el cilindro cabe en el
  destino (de pie, agachado o colgado). Los salientes (molduras) se detectan
  porque quedan más cerca que el muro.
- **Entrada**: en la pared, la intención de movimiento se proyecta sobre la
  normal (hacia la pared = subir) y la tangente (lateral), de modo que funciona
  con la cámara en cualquier ángulo. C (`drop`) suelta; Espacio da un impulso
  o, alejándose de la pared, un salto hacia atrás.
- **Subidas** (`mantle`/`vault`): trayectoria animada a un destino ya
  validado (primero sube, luego avanza; la valla, en arco). Terminan con
  `landingImmune`, sin daño por caída.
- `player:parkour` (`{ kind }`) se emite al engancharse, colgarse, subir,
  saltar una valla, dar un impulso o saltar desde la pared.

## Distrito Cero (Etapa 6)

- **Reputación**: `Reputation` guarda la hostilidad (0–100) por facción y
  aplica reglas por acción (`REPUTATION_RULES`). `FactionSystem` escucha
  `combat:damage` y `power:used`, comprueba si algún agente ve al jugador
  (`EnemySystem.seenBy`) y expone `enemies.attitude(faction)` →
  `'hostile' | 'watchful' | 'calm'`. Cada `Enemy` calcula siempre si ve al
  jugador (`seesPlayer`), pero solo se lo pasa a su `EnemyBrain` si su
  facción es hostil; vigilante → se detiene y le mira. Así el cerebro de la IA
  no cambia. Cada mapa fija la hostilidad base en su definición (`factions`).
- **Misiones**: `Mission` (inactiva → activa → completada) cuenta enemigos
  neutralizados por etiqueta (`enemy:neutralized` incluye `tag`).
  `MissionSystem` crea el teléfono (malla + colisión en el grupo del mapa, se
  libera con él), registra la interacción, genera los enemigos al activar,
  detecta la primera alerta, actualiza HUD y marcadores (proyección a
  pantalla en `UIManager.updateMarkers`) y guarda el resultado en
  `profile.missions`. Eventos: `mission:started`, `mission:detected`,
  `mission:completed`, `faction:changed`.
- **Límites**: `def.bounds` del mapa; `GameManager._checkBounds` muestra el
  aviso. Los muros invisibles (`tag: 'bounds'`) no se pueden escalar.

## Pulido (Etapa 7)

- **Audio**: `AudioSystem.attach(game)` se suscribe a eventos existentes
  (`player:*`, `power:*`, `enemy:fired`, `projectile:hit`, `mission:*`,
  `faction:changed`, `map:*`); ningún sistema de juego llama al audio. Cada
  efecto es una receta (osciladores + ruido filtrado con envolventes) y pasa
  por ganancia → panorama (`spatial.js`) → bus (efectos/interfaz/ambiente) →
  general → compresor. Bucles: carga de la descarga y absorción. Ambiente por
  mapa. `stats` cuenta los sonidos generados (diagnóstico y pruebas).
- **Fusión de geometría**: `LevelBuilder` marca sus mallas con
  `userData.levelStatic`; `MapManager.load` llama a `mergeStatic(group)` tras
  `build`. Las mallas con varios materiales se separan por grupo. Las
  entidades (dianas, fuentes, Encarnación…) no se fusionan porque cambian.
- **Barandillas**: `LevelBuilder.bridge({ rails })` añade colisión por tramos
  de 1 m con `climbable: false` y `cameraBlocking: false`.

## Varias marcas (Gravedad)

- **Marca activa**: `MarkSystem.activeFamily` devuelve la marca elegida
  (`profile.activeMark`) si se posee, o la primera copiada. `setActive` y
  `cycle` (V) la cambian y emiten `marks:changed` y `mark:switched`.
- **Familias de poderes**: `PowerSystem` (Energía) y `GravityPowerSystem`
  comparten interfaz (`available`, `energy`, `abilities`, `magazine`, `color`,
  `applyModifiers`, `resetAbilities`). `GameManager.activePowers` da la de la
  marca activa (HUD, golpe) y `powersFor(elemento)` la de un elemento
  (absorción). Cada una se actualiza siempre, pero solo la activa lee el input.
- **Fuentes**: `EnergySource` lleva `element`; `EnergyDrainSystem` recarga la
  familia de ese elemento y activa su marca.
- **Estados de enemigo**: `Enemy.float`, `stun` y `pullTo` sustituyen la
  percepción, la IA y el disparo mientras duran (`_updateControlled`). El
  arrastre por el suelo usa `CharacterMotor.startTravel` (con colisiones).
- **Saltos de Gravedad**: `CharacterMotor.jumpAbilities` (null en Energía)
  añade saltos en el aire, menos gravedad al mantener el salto mientras sube y
  planeo al mantenerlo cayendo. El jugador pasa `jumpHeld` en la entrada.
- **Pasivas**: en `GameManager` (escuchan `combat:damage` y `player:damaged`);
  la de Gravedad llama a `ProjectileSystem.stasis(segundos)`.

## Hilo

- `ThreadPowerSystem` sigue la interfaz común; su «cargador» es un objeto que
  indica si el puño está listo o volviendo (el HUD lo muestra igual).
- **Balanceo**: estado `_swing` del `CharacterMotor`. Con el hilo, la entrada
  empuja el péndulo en lugar de frenar hacia una velocidad objetivo; tras
  integrar (con colisiones) se aplica la cuerda: se elimina la velocidad que
  la estira y se corrige la posición como mucho 0.2 m por paso (si no, una
  cuerda tensa podía meter el cuerpo a través de un muro fino: lo encontró la
  prueba de estrés). Tocar el suelo, un impulso, un desplazamiento o el picado
  sueltan el hilo.
  **Impulso del péndulo** (`_pumpSwing`): la entrada horizontal se proyecta
  en el plano perpendicular a la cuerda (en 3D), así que empujar hacia el
  anclaje no da energía y empujar en el sentido del arco sí; contra el
  movimiento frena un 40 %. **Recoger** (`reel`, S mientras se balancea):
  la longitud de la cuerda baja `reel` m/s hasta `minLen`. **Soltar**
  (`endSwing(boost, horizontal)`): impulso vertical y, con `horizontal`, un
  empujón en la dirección que se llevaba. **Apuntar** (`ThreadPowerSystem._aimAnchor`):
  primero el rayo de la cámara al centro de la pantalla; si no hay nada
  arriba al alcance, la búsqueda por ángulos de siempre.
- `powers/targeting.js` (`enemyAtCrosshair`) lo comparten Gravedad e Hilo.
- `Enemy.bind` (aturdido + anillos de hilo) y daño por caída de los enemigos.

## Temperatura

- `TemperaturePowerSystem` sigue la interfaz común. El disparo alterna la mano
  (`handWorldPosition(out, 'R' | 'L')`): hielo a la derecha, fuego a la izquierda.
- **Patinaje** (`CharacterMotor.skate`): en el suelo cambia la aceleración y la
  frenada por las del patinaje (casi sin fricción) y deja pasar de la velocidad
  punta lo que ya se lleva. Si al integrar el cuerpo choca de frente con una
  pared escalable a más de `wallMinSpeed`, `_tryWallRide` convierte la
  velocidad que iba contra la pared en subida y conserva la tangencial; en
  `_updateWallRide` la gravedad está reducida y el cuerpo se pega a la pared:
  sube, frena y cae (la U). Termina en el suelo, sin pared o por tiempo. El
  parkour no se activa patinando.
- **Carrera de hielo** (`CharacterMotor.iceRun`): velocidad fija en la
  dirección de la cámara (inclinación limitada), sin gravedad. El sistema crea
  placas de hielo (cajas reales) bajo los pies; cada una se activa cuando el
  cuerpo ya no la atraviesa (durante la carrera, solo cuando ha quedado atrás)
  y al terminar se deja una bajo los pies para quedarse de pie.
- **Muro de hielo**: varios colisionadores cuadrados a lo largo de una línea
  (las cajas son AABB, así que un muro girado se aproxima con tramos) y una
  sola malla girada; no se coloca un tramo donde hay alguien.
- **Estela y tormenta**: daño por tics de 0.5 s a los objetivos dentro de la
  raya (distancia a la polilínea) o del cilindro bajo la nube.
- **Quemadura** (`powers/temperature/BurnStatus.js`, puro): `Enemy.burn` la
  enciende desde la pasiva en `GameManager` (golpes `melee*`); el enemigo la
  avanza en su `update` y se apaga al morir.
- **LOD de entidades**: `MapManager.cull(ojo)` oculta las entidades con
  `lodRoot` más lejos de `lodDistance` (las Encarnaciones, 60 m): cada una
  son ~25 piezas con sombra y el Campo superaba las 400 llamadas de dibujo.
  Las fuentes sin luz propia también (70 m; las que tienen luz no, porque
  cambiar el número de luces recompila los materiales) y sus piezas pequeñas
  no proyectan sombra. Tras cargar un mapa el LOD espera 3 fotogramas para que
  todo se dibuje una vez y sus materiales se compilen durante la carga.
- **Punto de mira**: `PowerSystem.aimPoint` se detiene en el primer actor que
  no es del jugador (antes solo en el escenario): los disparos desde una mano
  alejada de la cámara (la izquierda de la Temperatura) convergían detrás del
  enemigo y lo rozaban.

## Combos, enemigos especiales y pulido

- **Combos**: `powers/combos.js` decide, a partir del tipo de daño y del
  estado del objetivo (flota, atado, arde), si hay combo (`detectCombo`). El
  `ComboSystem` escucha `combat:damage`, aplica el efecto y lleva una espera
  por enemigo (WeakMap). Los daños de combo son `combo-*` y no encadenan otro.
  `Enemy.freeze` (Escarcha) es un aturdimiento con capa de hielo.
- **Enemigos especiales**: siguen siendo `Enemy` con datos distintos en
  `enemyTypes.js`:
  - `shield` → `enemyDamage` reduce el daño que llega por delante (arco y
    multiplicador), salvo daños desde arriba/suelo y si está `vulnerable`
    (flota, aturdido o sin apoyo).
  - `meleeMul` → el dron recibe menos de los golpes.
  - `stationary` → el francotirador no se mueve.
  - `weapon.aimTime/lockTime` → apunta con un láser (una malla) y fija el
    punto al final.
  - `weapon.pellets` → escopeta.
  - `flying` → el dron usa el modo vuelo del `CharacterMotor` (`fly`, el mismo
    del jugador con Alas) y una altura objetivo sobre el suelo. Al quedar
    controlado (`_updateControlled`) se quita `fly` y cae con la física normal.
  - `model: 'drone'` usa `DroneModel` (misma interfaz que `CharacterModel`), y
    `height`/`radius` cambian el cuerpo físico, el centro y la cápsula.
  - `gear` añade el escudo o el rifle al modelo de la PDC.
- **Zona G**: entidad del mapa con `update` que lanza el encuentro al pisar la
  zona y `reset` para el menú de depuración.
- **Rueda de marcas**: `ui/markWheel.js` (puro: sector por dirección del ratón
  acumulado). `GameManager._updateMarkWheel` distingue pulsación y
  mantenimiento de V, bloquea la cámara (`player.lookLocked`) y devuelve el
  paso de tiempo de juego (×0.3 con la rueda abierta).
- **Pasivas que reducen daño**: `PlayerCombat.damageFilters` (Plumaje).
- **Poses**: `skating` y `flying` en `CharacterModel.animate`; el vuelo
  inclina la cadera (`hips.rotation.x`).

## Alas

- `WingsPowerSystem`: las plumas son la `EnergyPool` (con regeneración, la
  única familia que la tiene) y su «cargador» es una vista de ella con
  `iconStep: 10` para que el HUD dibuje 10 símbolos y no 100.
- **Vuelo** (`CharacterMotor.fly`): sin gravedad, la velocidad tiende a la
  dirección pedida por la velocidad punta (`flightSpeed`, según las plumas).
  `PlayerController` pasa `flyY` (inclinación de la cámara + Espacio/C) y usa
  la pose de planeo. El sistema rehace `motor.fly` cada fotograma, así que un
  teletransporte no corta el vuelo.
- **Espada**: `meleeWeapon` es un gancho genérico de `PlayerCombat`
  (multiplicador de daño, alcance extra, tipo de golpe y efecto del barrido)
  que cualquier familia puede exponer.
- **Escudo**: colisionador `shield`; `ProjectileSystem` incluye el
  colisionador en `projectile:hit` y el sistema descuenta los ataques. Al
  romperse se desactiva en el acto (otra bala del mismo paso pasa).
- **Lluvia**: cada pluma es una instancia con trayectoria balística que llega a
  su punto de la zona en un tiempo fijo; al caer daña a quien está cerca.
- `WingsVisual`: un InstancedMesh por ala (`count` = plumas que quedan) y otro
  para la espada; plegadas en reposo, abiertas y batiendo al volar.

## Modo historia (Etapa 8)

**Flujo.** `GameManager.startStory(fresh)` → `StoryDirector.prepare()` (perfil
de marcas propio de la historia: `MarkSystem.useStoryProfile`) →
`StoryDirector.enter(cp)`: monta el mapa del punto de control con
`GameManager._loadMap` (el mismo que usa `startMap`), coloca a Jon en el punto
`at` que devuelve el mapa (`build()` → `story.points`), restaura salud y
carga del guardado y arranca el tramo (`beat`) de ese punto.

**Tramos.** `prologue.js` exporta `BEATS`: una función `async (S, { cp,
entered })` por punto de control. El director los encadena: cuando un tramo
termina, guarda el siguiente punto (`reach`) y, si cambia de mapa, lo monta con
un fundido. Las ayudas `S` (clase `Script`) esperan siempre en **tiempo de
juego** (`until`, `wait`, `say`, `interact`, `walkTo`, `choice`…) y lanzan
`StoryAbort` si el tramo se cancela: así una detección, una caída o volver al
menú cortan el guion en cualquier punto sin dejar promesas colgadas.

**Recargar** un punto de control vuelve a montar el mapa entero: las
patrullas, compuertas, escombros y enemigos vuelven a su estado inicial sin
código de reinicio específico. Cada tramo deja el mundo como lo necesita al
empezar (casa en ruinas desde CP15, tormenta CP13–CP17, alarma desde CP06…),
así que funciona igual llegando desde el anterior que cargándolo directamente.

**Guardado.** `save.data.story` (`StoryState`): punto, `flags` (`HasDestinyMark`,
`HasEnergyMark`, `ActiveMark`, `TutorialComplete`, `EnergyEncounterChoice`),
`mission` (día, compras, documentos, progreso dentro del tramo) y `snapshot`
(salud y carga). Solo se escribe al llegar a un punto de control (y la
elección moral, en el momento). Las banderas nunca retroceden.

**Saltar cinemáticas.** Mientras `controlsLocked` (y sin elección abierta ni
carga), mantener Espacio o Intro `SKIP_HOLD` s en tiempo real llama a
`StoryDirector.skip()`: pantalla negra (`StoryUI.skipping`), audio en silencio
(`AudioSystem.setMuted`) y `GameManager._skipStep` simula a pasos fijos de 1/30 s
sin dibujar (hasta ~14 ms de CPU por frame) mientras `skipShouldContinue()`.
Como las esperas del guion son promesas, cada vez que una se cumple
(`director.resolved`) se cede el frame para que el guion avance. Termina al
recuperar el control, al abrir una elección, al recargar o al pausar. Las
tarjetas de día (tiempo real) no se esperan al saltar.

**Iluminación de los mapas oscuros.** `def.fillLight` añade a la escena una
`DirectionalLight` que sigue a la cámara y apunta hacia donde mira (relleno sin
manchas; su intensidad la cambia el guion en la tormenta). `Rain.coverAt` corta
la lluvia a la altura de lo que haya encima (consulta `groundHeight` por celdas
de 1 m, cacheada).

**Control.** `controlsLocked` desactiva al jugador (cinemáticas);
`Input.blocked` bloquea por acción los poderes que el guion aún no ha enseñado
(`allowedPowers` + `S.allow`). `PlayerController.autopilot` mueve a Jon solo
(carrera hacia Narbaiza, colina final). `CameraController.setShot` fija planos
y travellings. El dash asistido (`StoryDirector.assistDash`) orienta el dash en
el aire hacia el círculo de aterrizaje cuando Jon está junto a un hueco.

**Sigilo.** Puro cálculo en `stealthMath.js` (`detectionRate`, `stepMeter`);
el director lo aplica a cada `StealthGuard` (posición, mirada, alcance, cono)
con rayos de línea de visión que ignoran vallas y farolas
(`cameraBlocking: false`) y suma la luz de los `Searchlight`.

**Personajes.** `Npc` (actors.js) usa el mismo `CharacterModel` que el
jugador, con poses (de rodillas, tumbado, esposado, colgado…), rutas con saltos
en arco y marcas visuales (la Sangre de Narbaiza). Se crean en el grupo del
mapa y se liberan con él. La Encarnación de la Energía es la `Incarnation` del
Campo con otra ropa, registrada en `PowerAcquisitionSystem`, así que la copia
sigue exactamente las reglas canónicas (contacto + voluntad; la fuente
conserva su marca).

## Rendimiento

- **Densidad de píxeles** (`GameManager._pixelRatio`): `min(devicePixelRatio, 1)`
  × resolución de render × factor de la calidad automática.
- **Calidad automática** (`core/AutoQuality.js`, pura): ventanas de 1.5 s; por
  debajo de 45 FPS baja la escala un 10 % (mínimo 60 %) y, en el mínimo y por
  debajo de 30, quita el MSAA; por encima de 57 FPS durante tres ventanas
  devuelve primero el MSAA y luego la escala. Espera 4 s tras cada cambio (el
  cambio de tamaño de los búferes cuesta). Solo mide mientras se juega.
- **Nivel de detalle** (`MapManager.cull` llama a `entidad.lod(ojo)`): los
  bosques (`pineForest`) reparten cada pino entre una malla instanciada
  detallada (cerca, con sombra) y otra simplificada (sin sombra), y descartan
  los que la niebla oculta, cuando la cámara se mueve 4 m; el terreno elige
  por baldosa entre tres índices (cada 1, 2 o 4 vértices) que comparten los
  mismos atributos, con faldones a dos caras en los bordes.
- **Luces**: la reserva de luces de los efectos (`LightPool`) tiene 3; los
  mapas usan charcos de luz pintados (`lightPools`) en lugar de luces reales.

## Enemigos: reposo, entradas y dificultad

- `Enemy` con `dormant` no percibe ni actúa (sin física: se apoya en el suelo
  al crearse) hasta `wake(entrada?)`. Con `entrance: { path, speed, delay }`
  recorre el camino por tramos rectos (cinemático, sin colisión), oculto
  durante `delay`, y al llegar empieza a patrullar. `takeDamage`, flotar o
  aturdir interrumpen ambos estados (`_interruptScript`).
- `scaleType(tipo, mods)` (enemyTypes.js, pura) devuelve el tipo con la vida,
  el daño, la cadencia, la dispersión y la reacción ajustadas; el `id` no
  cambia (las pruebas y el guion lo siguen reconociendo).
- Misiones: cada aparición puede llevar `from` (camino desde su escondite) y
  `delay`.

## Guardias del sigilo y navegación

- `ai/NavGrid.js` (pura): rejilla de celdas de 0.75 m sobre un suelo plano;
  una celda está bloqueada si una caja activa (`enabled`) o una rampa ocupa la
  franja del cuerpo (0.35–1.7 m) ampliada por el radio. A* en 8 direcciones
  sin cortar esquinas, destino ajustado a la celda libre más cercana y camino
  enderezado con pruebas de visibilidad sobre la rejilla.
- `StealthGuard` con `nav`: la ruta se expande con los caminos entre puntos
  (puntos intermedios sin espera); `investigate`, `leave(puntos, espera, { hide })`
  (relevo: entra en el edificio y vuelve), `respond(puesto, mirar)` (alarma,
  corriendo) y `post` (ya en su puesto al recargar). Sin camino posible se
  queda donde está: nunca atraviesa paredes. Mientras está oculto o
  respondiendo a la alarma no cuenta para la detección.

## Kit de escenarios

Los mapas se construyen con piezas de `world/kit/` que crean la
malla y la colisión a la vez (vía `LevelBuilder` o `world.addBox/addRamp`) y
marcan lo estático para `mergeStatic`. El terreno (`terrain`) es una sola malla
por zona con un material propio: mezcla hierba, tierra y roca según el
atributo `splat` (senda, orillas, pendiente) y proyecta la roca de forma
triplanar en las laderas para que los estratos no se estiren. Los tramos de
puente (`trussSpan`) se construyen en coordenadas locales y se colocan rectos,
inclinados o colgando de una bisagra; su colisión se añade aparte
(`spanColliders`, rampas y cajas escalonadas trepables).

Los mapas rehechos conservan la geometría jugable que usan el guion y las
pruebas (coordenadas de los puntos de control, rutas del sigilo, huellas y
alturas de los edificios del Distrito, escaleras, pasarelas): el kit se
superpone como decorado o sustituye piezas por otras de la misma colisión.

- **Sin huecos de mapa**: cada mapa rodea su zona jugable con suelo hasta el
  horizonte. El pueblo y el bosque usan un `terrain` lejano sin colisión
  (`simple`, sin sombras) que en el borde continúa a la misma altura que el
  terreno jugable; en el bosque baja hacia el este hasta la llanura de la
  ciudad (−20 m) sin lomas en el cono que se ve desde la colina. El Distrito
  tiene un plano de suelo urbano de 2.4 km, manzanas cercanas y rascacielos
  lejanos (`cityTowers`: instancias con material Lambert, ordenadas de cerca a
  lejos); el Campo de Pruebas, una explanada de hormigón.
- **Niebla suave** (`softFog(material, k)`): sustituye el `fog_fragment` del
  material por la misma niebla exponencial con la densidad multiplicada por
  `k`. Lo muy lejano (ciudad, su aguja, sus luces) queda velado por la bruma
  en vez de recortarse contra ella; en la colina la historia baja la
  densidad de la niebla (`clearFog`) y la ciudad aparece entera.
- **Charcos de luz** (`lightPools`): discos aditivos con el color en los
  vértices, todos los de un mapa en una malla. Sustituyen a las luces reales
  de focos y farolas (las luces puntuales y focos son lo más caro por píxel).
- **Fusión por celdas** (`mergeStatic`): la clave de fusión es material +
  sombras + celda de 96 m (las piezas de más de 1.5 celdas van a un grupo
  global), de modo que las celdas fuera del encuadre se descartan por
  *frustum culling*.
- **Pinos** (`pineForest`): los cercanos con sombras; los lejanos (`far`) con
  un modelo de tres conos de seis lados y sin sombras.
- **Obstáculos de la historia** (`story/props.js`): `Barricade` (tablones que
  se rompen con cualquier daño; los postes quedan) y `VeinBoulder` (roca con
  vetas que solo rompe la Energía, `ENERGY_KINDS`); ambos con `hint`,
  `clear` (rotos sin efectos al recargar un punto posterior) y `reset`.
- **Lluvia** (`Rain`): con `follow` sigue a la cámara que la dibuja
  (`onBeforeRender`); en la historia la coloca el director.

## Gráficos y animación

**Cadena de render** (`GameManager`): `RenderPass` sobre un destino HalfFloat
con MSAA ×4 (Ajustes → *Suavizado de bordes*) → `GTAOPass` opcional
(*Oclusión ambiental*, apagada por defecto: es cara) → `UnrealBloomPass` →
`OutputPass` (ACES) → `ShaderPass(GradeShader)`. La gradación (`vfx/gradePass.js`)
se aplica tras el mapeo de tonos: contraste, saturación, tono de sombras y de
luces, viñeta y grano; cada mapa la ajusta con `def.grade` y su intensidad de
reflejos con `def.envIntensity`. Al cargar un mapa, `_updateEnvironment` genera un
**mapa de entorno** PMREM a partir de su cielo (`skyEnvironment`) para que los
materiales reflejen el cielo del mapa (Ajustes → *Reflejos del cielo*; es lo
más costoso por píxel en render por software, por eso las pruebas e2e lo
apagan junto con el MSAA). Sombras PCF con `shadow.radius`.

**Cielo** (`createSky`): degradado, sol con halo, nubes de ruido fractal
proyectadas sobre un plano alto que se desplazan con el viento, estrellas que
titilan y luna. **Montañas** (`createMountains`): conos con crestas
desplazadas, sombreado plano y color por cara (falda, roca, nieve en las caras
altas poco inclinadas), todas fusionadas en una malla. **Ciudad lejana**
(`createCity`): torres instanciadas cuyas ventanas se proyectan en metros en
el shader (plantas del mismo tamaño en todas las torres).

**Materiales** (`world/textures.js`): cada textura procedural (hormigón,
mampostería, tejas, adoquín, roca fracturada, hierba, madera, chapa, arena,
asfalto, acera) registra un mapa normal calculado de su luminancia (Sobel) en
un `WeakMap` por `texture.source` (las copias con `clone()` lo comparten).
`applyNormalMaps` (en `MapManager.js`) se lo pone a cada material estándar con la misma
repetición que su `map`. Agua (`water.js`): `MeshPhysicalMaterial` con dos
mapas normales de olas desplazándose en direcciones distintas (normal y capa
transparente). Vegetación: pinos de cinco capas dentadas, arbustos y rocas
instanciados con color por instancia.

**Personajes** (`CharacterModel` + `bodyParts.js`): el cuerpo se construye con
primitivas (cajas redondeadas, esferas, cilindros, toros) en `PartSet`, que las
fusiona por tipo de material (mate, satinado, metálico) con el color por
vértice: pocas mallas por hueso. Los materiales son propios de cada modelo
(el destello de daño tiñe su emisivo). Peinados (`hairStyle`), barba, caras
con ojos que parpadean, ropa por variante (protagonista, PDC con casco y
visor, Acólito con capucha, Encarnación).

**Animación procedural** (`CharacterModel.animate`): fase de la zancada (un
paso cada π, que también dispara los pasos del sonido), pies que se apoyan con
el tobillo, contrarrotación de pelvis y pecho, inclinación en las curvas y con
la aceleración, cabeza que mira hacia donde apunta la cámara (`lookYaw`,
`lookPitch`), aterrizaje con muelle, respiración, parpadeo y un suavizado
final de todas las articulaciones para evitar saltos entre poses.

**Efectos** (`vfx/`): tres sistemas de una llamada de dibujo cada uno —
partículas aditivas (energía), partículas de humo con mezcla normal y bordes
irregulares (`ParticleSystem({ smoke: true })`: crecen y se desvanecen) y
chispas (`SparkSystem`: segmentos estirados según su velocidad, cabeza en
HDR para el bloom). `impact` combina destello, chispas, motas, onda de choque
de frente a la cámara y una bocanada de humo; `dust` abre polvo a ras de suelo
(aterrizajes, ondas expansivas); los rayos tienen resplandor en sus extremos;
la estela del dash es una silueta con borde luminoso (fresnel).

**Menú** (`ui/MenuScene.js`): escena propia (≈ 34 llamadas de dibujo, sin
sombras) que `GameManager._renderMenu` dibuja con el mismo compositor
cambiando la escena y la cámara del `RenderPass` (y apagando el GTAO, ligado a
la escena del juego) mientras el estado es `menu`: Jon en una azotea al
anochecer frente a la ciudad, motas de energía, baliza intermitente y cámara
que se mece. El HTML del menú entra con una animación escalonada (se omite con
`prefers-reduced-motion`).

## Ibaia, la ciudad

**Datos.** `tools/ciudad/export_game.py` (Python con shapely, el mismo
generador del diseño v2) escribe `world/maps/ibaia/cityData.js`: un objeto
`CITY` (barrios con su contorno, el anillo de su barrera, el Ancla, zonas con
un punto de calle libre para viajar, puentes con el perfil de su tablero,
tren elevado, hitos y aparición) y `BIN`, binarios en base64 (≈1.2 MB en
total): edificios como cajas orientadas cuantizadas (los que no son
rectángulos se parten en varias cajas hasta cubrir su huella), polígonos de
aceras, parques, playas, plazas y estanques en medios metros, árboles,
farolas y marcas viales, una máscara tierra/agua de 4 m (por tramos) y el
relieve de la sierra cada 50 m. Coordenadas del juego: X = x − 4500,
Z = y − 3500 (el norte es −Z). `decode.js` lo lee sin Three.js.

**Colisión.** `ObbSet` guarda las cajas en arrays tipados (centro, eje, semiejes,
base y cima que puede ir en rampa de `y0` a `y1`) y las indexa en una rejilla
de 48 m. `CollisionWorld` le pasa `groundHeight`, `ceilingHeight`,
`resolveHorizontal` y `raycastHit` (el rayo recorre la rejilla celda a celda;
contra cada caja, recorte con sus seis planos). Los impactos devuelven un
colisionador con la misma forma que una caja (`kind: 'box'`, `minX…maxZ`,
`maxY`, `tag`, `climbable`) más `obb: true`; `enabled` depende de su grupo, y
`setGroup` apaga o enciende un grupo entero (la barrera de un barrio) sin
reconstruir la rejilla. Las barreras no bloquean la cámara (`cameraBlocking:
false`). La ciudad tiene además una caja de suelo en y = 0 (también bajo el
agua) y el relieve de la sierra como `Heightfield`; caer al agua lo detecta la
máscara (`CityLife`), que devuelve a la última orilla pisada.

**Escalada en muros girados.** `Parkour.faceCoord` devuelve el plano de la
cara (n·(x, z) = front) también para cajas orientadas, y `onFace(p, n, front,
desplazamiento)` sustituye a las fórmulas por ejes: colgarse, subir a una
cornisa, saltar un obstáculo y pegarse a la pared funcionan en cualquier
dirección (en una caja alineada dan el mismo resultado de antes).

**Dibujo.** Todo lo repetido va por celdas de 400 m (`chunkGroup`): cada
celda tiene una malla con sus edificios (cuatro fachadas y azotea por caja,
atributos `facade` = metros a lo largo de la fachada y altura, y `bstyle` =
estilo de ventanas y semilla) y mallas instanciadas de árboles, farolas (poste,
brazo, luz y charco de luz aditivo) y marcas viales. `CityLod` oculta las
celdas a más de 3.9 km (la niebla ya las ha borrado). `buildingMaterial`
añade al `MeshStandardMaterial` la rejilla de ventanas por estilo (muro
cortina, oficinas, ladrillo, casas, naves; escaparates en la planta baja),
algunas encendidas (cálidas o frías, emisivas) y, a lo lejos, su tono medio
(según `fwidth`) para que no haga moaré. La semilla se redondea en el shader:
interpolada llega con un error mínimo que el hash convertiría en ruido. El
suelo son polígonos triangulados con `ShapeUtils` a alturas escalonadas
(calzada −6 cm, aceras +6 cm con bordillo, parques +8 cm con desplazamiento
de polígono), muelles solo donde la tierra da al agua, la sierra como una
rejilla con color por altura y pendiente, y el mar como un plano de 26 km.
Puentes, tren elevado e hitos son mallas estáticas que `mergeStatic` fusiona.

**Barreras.** `DefenseBarriers` crea una cinta vertical por barrio (UV en
metros recorridos y altura) con un `ShaderMaterial` aditivo: hexágonos
procedurales cuyo borde se funde en un velo a lo lejos, celdas que
parpadean, bandas que suben, brillo a ras de suelo y menos intensidad desde
arriba o lejos. `uLevel` hunde el muro (los fragmentos bajo el suelo se
descartan); la cúpula del Centro escala su altura. Al bajar una barrera su
grupo de colisión se apaga en el acto; al subirla se enciende al empezar.
`Anchors` pone un cristal y un haz sobre lo que haya en cada Ancla (azotea,
chimenea o calle) y se apaga con su barrera.

**Administración (F4).** El mapa devuelve, además de `spawn` y `sun`,
`waypoints` (barrios, Anclas y la autovía, calculados al construir) y
`admin`, su API: `barriers`, `anchors`, `setBarrier(id, bajada)`,
`setAll(bajadas)`, `districtAt`, `landAt` y `landing(x, z)` (punto de llegada
sobre lo más alto que haya). `MapManager.current` los guarda;
`GameManager._openAdmin` pausa y pide a `UIManager.renderAdmin` la lista de
barreras, los destinos y el plano (`ui/cityMap.js`: la base se dibuja una vez
por carga; encima, barreras, Anclas y jugador). Las acciones `adm-*` bajan o
suben barreras (el estado se guarda en `save.data.debug.cityBarriers` y se
aplica al cargar el mapa) y `_travel` lleva al destino con un fundido corto.

**Cámara y sol.** Un mapa puede pedir `view: { near, far }` (Ibaia: 0.25 y
9000 m; el resto vuelve a 0.1 y 1200). `followSun` coloca el sol a
`sun.userData.distance` (700 m en la ciudad) para que los rascacielos
proyecten sombra.

**La PDC y los Acólitos.** `export_game.py` coloca, con el nivel PDC de cada
barrio, su torre de vigilancia y controles en las entradas de puentes y
metro (en la calle más cercana, con su dirección y ancho), patrullas en
tramos rectos de calle cuya franja de 2.2 m no toca ningún edificio
(repartidas a ≥ 230 m), drones sobre avenidas, francotiradores en azoteas de
14–45 m cerca de puestos y zonas, y los campamentos de Acólitos del diseño:
`CITY.pdc`. `pdcPlan.buildGroups` lo convierte en grupos con sus unidades
(tipo, posición, orientación, ruta, `dormant`) según el tipo de puesto y el
nivel; `plan(grupos, x, z, { time, busy })` (puro) decide qué grupos crear
(< 300 m, los más cercanos primero, tope de 32 unidades, sin los
neutralizados hasta `deadUntil`) y cuáles retirar (> 380 m y sin pelear).
`CityPopulation` (entidad del mapa) aplica el plan cada 0.5 s con
`EnemySystem.spawn/remove` (etiqueta `ibaia:<grupo>`), apunta los
neutralizados (`enemy:neutralized`) y, con `faction:changed` a hostil, saca
dos refuerzos del camión del puesto activo más cercano (`entrance` desde la
puerta trasera; al bajar, `alertTo`) y despierta los drones posados en las
torres cercanas. En barrios de nivel ≥ 4, mientras la PDC ve al jugador,
`Reputation.report('pdc:curfew')` cada segundo (toque de queda). Los puestos
(`pdcPosts.js`) son cajas giradas en el marco de la calle (u a lo largo, v a
lo ancho) con su colisión en un segundo `ObbSet`; la pieza que chocaría con
un edificio se omite. El mapa declara `factions: { pdc: 0 }` y
`reputation: true` (HUD de la PDC), y `admin.setEnemies` y la reputación se
controlan desde la administración (`adm-enemies`, `adm-pdc-calm`,
`adm-pdc-hostile`).

