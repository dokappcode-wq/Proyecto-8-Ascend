import * as THREE from 'three';
import { EventBus } from './EventBus.js';
import { Input } from './Input.js';
import { SaveSystem } from './SaveSystem.js';
import { CollisionWorld } from '../physics/CollisionWorld.js';
import { CameraController } from '../camera/CameraController.js';
import { PlayerController } from '../player/PlayerController.js';
import { MapManager } from '../world/MapManager.js';
import { followSun } from '../world/environment.js';
import { UIManager } from '../ui/UIManager.js';

/**
 * GameManager — estado general del juego y bucle principal.
 *
 * Estados: 'menu' → 'playing' ⇄ 'paused' → 'menu'.
 * Los sistemas futuros (PowerSystem, CombatSystem, EnemyAI, MissionSystem…)
 * se registran con `addSystem` y reciben `update(dt, game)` mientras se juega.
 */
export class GameManager {
  constructor({ canvas, maps }) {
    this.canvas = canvas;
    this.state = 'menu';
    this.events = new EventBus();
    this.save = new SaveSystem();
    this.systems = [];

    // --- Render ---
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = this.save.settings.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05080d);
    this.camera = new THREE.PerspectiveCamera(this.save.settings.fov, 1, 0.1, 1200);

    // --- Sistemas compartidos por todos los mapas ---
    this.world = new CollisionWorld();
    this.input = new Input(canvas, this.save.data.bindings);
    this.cameraController = new CameraController(this.camera, this.world, this.save.settings);
    this.player = new PlayerController({ input: this.input, camera: this.cameraController, world: this.world, events: this.events });
    this.scene.add(this.player.object3d);
    this.player.object3d.visible = false;

    this.mapManager = new MapManager({ scene: this.scene, world: this.world, events: this.events });
    for (const m of maps) this.mapManager.register(m);

    this.ui = new UIManager({
      save: this.save,
      input: this.input,
      onAction: (a, data) => this._onUiAction(a, data),
      onSettingsChanged: (s) => this._applySettings(s),
    });

    this._clock = new THREE.Clock();
    this._fps = 60;
    this._pausedAt = 0;

    this._wireEvents();
    window.addEventListener('resize', () => this._resize());
    this._resize();
    this.ui.show('menu');
    this.renderer.setAnimationLoop(() => this._frame());
  }

  addSystem(system) {
    this.systems.push(system);
    system.attach?.(this);
  }

  // ------------------------------------------------------------------
  async startMap(id) {
    const def = this.mapManager.maps.get(id);
    if (!def) return;
    this.input.clear();
    await this.ui.fade(`Cargando ${def.name}…`, () => {
      const map = this.mapManager.load(id);
      this.player.object3d.visible = true;
      this.player.spawn(map.spawn);
      if (map.sun) map.sun.castShadow = this.save.settings.shadows;
      this.ui.hideAll();
      this.ui.setHudVisible(true);
      this.ui.setMapName(def.name, def.description);
      this.state = 'playing';
      this.save.data.lastMap = id;
      this.save.save();
      this._clock.getDelta();
    });
    this.ui.toast(def.name, def.description);
    this.input.requestPointerLock();
  }

  restartMap() {
    const id = this.mapManager.current?.def.id;
    if (id) this.startMap(id);
  }

  async returnToMenu() {
    this.input.exitPointerLock();
    await this.ui.fade('', () => {
      this.mapManager.unload();
      this.player.object3d.visible = false;
      this.ui.setHudVisible(false);
      this.state = 'menu';
      this.ui.show('menu');
    });
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this._pausedAt = performance.now();
    this.input.clear();
    this.input.exitPointerLock();
    this.ui.show('pause');
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.ui.hideAll();
    this.input.clear();
    this._clock.getDelta();
    this.input.requestPointerLock();
  }

  // ------------------------------------------------------------------
  _wireEvents() {
    document.addEventListener('pointerlockchange', () => {
      // El navegador libera el puntero con Esc: se interpreta como pausa.
      if (!document.pointerLockElement && this.state === 'playing') this.pause();
    });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') {
        if (this.state === 'playing') this.pause();
        else if (this.state === 'paused') {
          if (this.ui.currentScreen === 'settings') this.ui.closeSettings();
          // Evita reanudar con la misma pulsación que liberó el puntero.
          else if (performance.now() - this._pausedAt > 250) this.resume();
        } else if (this.state === 'menu' && this.ui.currentScreen !== 'menu') this.ui.show('menu');
        return;
      }
      if (this.state !== 'playing') return;
      if (e.code === 'KeyH') this.ui.toggleHint();
    });
    this.canvas.addEventListener('click', () => {
      if (this.state === 'playing') this.input.requestPointerLock();
    });
    this.events.on('player:respawned', () => this.ui.toast('Reaparición', 'Has caído fuera del mapa', 1600));
  }

  _onUiAction(action, data) {
    switch (action) {
      case 'play':
        this.startMap(data.map);
        break;
      case 'resume':
        this.resume();
        break;
      case 'restart':
        this.restartMap();
        break;
      case 'menu':
        this.returnToMenu();
        break;
      case 'quit':
        // Las páginas web no pueden cerrar pestañas abiertas por el usuario.
        window.close();
        this.ui.show('quit');
        break;
      default:
        break;
    }
  }

  _applySettings(s) {
    this.cameraController.settings = s;
    if (this.renderer.shadowMap.enabled !== s.shadows) {
      this.renderer.shadowMap.enabled = s.shadows;
      const sun = this.mapManager.current?.sun;
      if (sun) sun.castShadow = s.shadows;
      this.scene.traverse((o) => {
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => (m.needsUpdate = true));
      });
    }
  }

  _resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  _frame() {
    const dt = Math.min(this._clock.getDelta(), 0.1);
    if (dt > 0) this._fps += (1 / dt - this._fps) * 0.05;

    if (this.state === 'playing') {
      if (this.input.wasPressed('debug')) this.ui.toggleDebug();
      this.player.update(dt);
      for (const s of this.systems) s.update?.(dt, this);
      const sun = this.mapManager.current?.sun;
      if (sun) followSun(sun, this.player.position);
      this._updateHud();
    }

    if (this.state === 'playing' || this.state === 'paused') {
      this.renderer.render(this.scene, this.camera);
    } else {
      this.renderer.clear();
    }
    this.input.endFrame();
  }

  _updateHud() {
    const m = this.player.motor;
    const p = m.position;
    const v = m.velocity;
    this.ui.updateHud({
      dodgeCooldown: m.dodgeCooldownRemaining,
      dodgeCooldownMax: m.cfg.dodgeCooldown + m.cfg.dodgeDuration,
      dodging: m.isDodging,
      sprinting: this.player.sprinting && m.horizontalSpeed > 6,
      pointerLocked: this.input.pointerLocked,
      fps: this._fps,
      debugText: this.ui.debugVisible
        ? [
            `pos   ${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}`,
            `vel   ${v.x.toFixed(2)}, ${v.y.toFixed(2)}, ${v.z.toFixed(2)}`,
            `vel h ${m.horizontalSpeed.toFixed(2)} m/s`,
            `suelo ${m.grounded ? 'sí' : 'no'}`,
            `col.  ${this.world.boxes.length} cajas · ${this.world.ramps.length} rampas`,
            `draw  ${this.renderer.info.render.calls} llamadas · ${this.renderer.info.render.triangles} tri`,
          ].join('\n')
        : null,
    });
  }
}
