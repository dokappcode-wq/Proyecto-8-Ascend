# Arquitectura técnica de ASCEND

```
src/
├── main.js                     Arranque: crea GameManager y registra los mapas
├── core/
│   ├── GameManager.js          Estados (menú/juego/pausa), bucle, registro de sistemas
│   ├── EventBus.js             Eventos entre sistemas desacoplados
│   ├── Input.js                Teclado/ratón con acciones reasignables
│   └── SaveSystem.js           Guardado versionado (ajustes, controles, perfil)
├── physics/
│   ├── CollisionWorld.js       Cajas y rampas estáticas, consultas y raycast (sin Three.js)
│   ├── CharacterMotor.js       Controlador cinemático del personaje (sin Three.js)
│   └── Parkour.js              Consultas de escalada, cornisas y obstáculos (sin Three.js)
├── player/
│   ├── PlayerController.js     Input → motor, orientación, animación, cámara
│   ├── CharacterModel.js       Modelo provisional + anclajes para marcas
│   ├── MarkVisual.js           Patrones luminosos de una marca sobre el modelo
│   ├── Cover.js                Detección de coberturas, bordes y punto para asomarse
│   └── markTextures.js         Símbolos de marcas generados por canvas
├── camera/CameraController.js  Cámara en tercera persona con colisión
├── world/
│   ├── MapManager.js           Registro, carga y descarga de mapas
│   ├── LevelBuilder.js         Malla + colisionador a la vez (bloques, rampas, escaleras…)
│   ├── environment.js          Cielo y sol con sombras
│   ├── textures.js             Texturas procedurales
│   └── maps/
│       ├── TrainingGround.js   Mapa 1 — Campo de Pruebas
│       └── DistrictZero.js     Mapa 2 — Distrito Cero
├── ai/
│   ├── EnemyBrain.js           Máquina de estados de la IA (sin Three.js)
│   ├── Enemy.js                Cuerpo, percepción, navegación y arma de un enemigo
│   └── enemyTypes.js           Datos del Agente PDC y del Acólito de Energía
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
│   ├── VfxSystem.js            Impactos, anillos, estelas, destellos
│   ├── ParticleSystem.js       Partículas aditivas (una sola llamada de dibujo)
│   ├── LightPool.js            Luces puntuales reutilizables (sin recompilar shaders)
│   └── glowTexture.js          Halos
├── world/entities/             Dianas, maniquíes, objetos físicos, fuentes de energía y Encarnación de prueba
├── data/marks.js               Definiciones de marcas (datos configurables)
├── data/progression.js         Árboles de habilidades por marca
└── ui/
    ├── UIManager.js            Menús, HUD, ajustes y transiciones
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
| FactionReputationSystem | Etapa 6 (hostilidad PDC) | Escuchará `combat:damage` por `EventBus` |
| MissionSystem | Etapa 6 | Sistema registrado + HUD de objetivo |

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
