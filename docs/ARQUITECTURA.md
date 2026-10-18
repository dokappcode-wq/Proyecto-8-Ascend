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
│   └── CharacterMotor.js       Controlador cinemático del personaje (sin Three.js)
├── player/
│   ├── PlayerController.js     Input → motor, orientación, animación, cámara
│   ├── CharacterModel.js       Modelo provisional + anclajes para marcas
│   ├── MarkVisual.js           Patrones luminosos de una marca sobre el modelo
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
├── combat/
│   ├── CombatSystem.js         Registro de entidades dañables, daño directo y de área
│   └── projectile.js           Simulación de proyectiles (sin Three.js)
├── powers/
│   ├── EnergyPool.js           Recurso de energía con regeneración
│   ├── Ability.js              Coste y tiempo de reutilización de una habilidad
│   └── energy/energyConfig.js  Parámetros de la familia Energía
├── systems/
│   ├── PowerSystem.js          Input → habilidades de la familia activa
│   ├── ProjectileSystem.js     Proyectiles: movimiento, impacto, daño, efectos
│   └── MarkSystem.js           Marcas poseídas e intensidad de sus patrones
├── vfx/
│   ├── VfxSystem.js            Impactos, anillos, estelas, destellos
│   ├── ParticleSystem.js       Partículas aditivas (una sola llamada de dibujo)
│   ├── LightPool.js            Luces puntuales reutilizables (sin recompilar shaders)
│   └── glowTexture.js          Halos
├── world/entities/             Dianas, maniquíes y objetos físicos
├── data/marks.js               Definiciones de marcas (datos configurables)
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
| MarkSystem | ✅ visual y posesión; adquisición en Etapa 4 | `systems/MarkSystem.js`, `player/MarkVisual.js`, `data/marks.js` |
| CombatSystem | ✅ daño y área (base) | `combat/CombatSystem.js`; la Etapa 3 añade cuerpo a cuerpo y enemigos |
| HealthSystem | Parcial: salud de maniquíes | Etapa 3: salud del jugador sobre la misma interfaz dañable |
| ParkourSystem | Etapa 5 | Consultará `CollisionWorld` (cajas con `maxY` para cornisas) y añadirá estados al `CharacterMotor` |
| EnemyAI / PDCEnemy / AcolyteEnemy | Etapa 3 | Reutilizarán `CharacterMotor`, `ProjectileSystem` y `CombatSystem` |
| PowerAcquisitionSystem | Etapa 4 | Reglas I–IV sobre `data/marks.js` (`original`), guardado en `profile.marks` |
| PowerProgressionSystem | Etapa 4 | `profile.skillProgress` por marca; parámetros en `energyConfig.js` |
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
