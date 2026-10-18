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
  `map:loaded`, `map:unloaded`) y se registran con `GameManager.addSystem()`,
  que les llama con `update(dt, game)` mientras se juega.

## Correspondencia con los sistemas del documento de diseño

| Sistema | Estado | Ubicación / punto de extensión |
| --- | --- | --- |
| GameManager | ✅ Etapa 1 | `core/GameManager.js` |
| MapManager | ✅ Etapa 1 | `world/MapManager.js` |
| PlayerController | ✅ Etapa 1 | `player/PlayerController.js` |
| CameraController | ✅ Etapa 1 | `camera/CameraController.js` |
| UIManager | ✅ Etapa 1 (menús, HUD básico) | `ui/UIManager.js` |
| SaveSystem | ✅ Etapa 1 (ajustes); perfil reservado | `core/SaveSystem.js` → `profile.marks`, `profile.skillProgress` |
| ParkourSystem | Etapa 5 | Consultará `CollisionWorld` (cajas con `maxY` para cornisas) y añadirá estados al `CharacterMotor` |
| PowerSystem | Etapa 2 | Sistema registrado con `addSystem`; acciones `attack`, `aim`, `special`, `charged` ya definidas en `Input` |
| MarkSystem (visual) | Etapa 2 | `CharacterModel.anchors` (muñecas, antebrazos, brazos, hombros, pecho) + `data/marks.js` (`color`, `glowColor`, `bodyPattern`) |
| CombatSystem / HealthSystem | Etapa 3 | `CollisionWorld.raycast` sirve para proyectiles e impactos |
| EnemyAI / PDCEnemy / AcolyteEnemy | Etapa 3 | Reutilizarán `CharacterMotor` como cuerpo físico de los enemigos |
| PowerAcquisitionSystem | Etapa 4 | Reglas I–IV sobre `data/marks.js` (`original`), guardado en `profile.marks` |
| PowerProgressionSystem | Etapa 4 | `profile.skillProgress` por marca |
| FactionReputationSystem | Etapa 6 (hostilidad PDC) | Escuchará eventos de combate por `EventBus` |
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
