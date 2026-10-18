import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { EventBus } from './EventBus.js';
import { Input } from './Input.js';
import { SaveSystem } from './SaveSystem.js';
import { CollisionWorld } from '../physics/CollisionWorld.js';
import { CameraController } from '../camera/CameraController.js';
import { PlayerController } from '../player/PlayerController.js';
import { MapManager } from '../world/MapManager.js';
import { followSun } from '../world/environment.js';
import { UIManager } from '../ui/UIManager.js';
import { CombatSystem } from '../combat/CombatSystem.js';
import { VfxSystem } from '../vfx/VfxSystem.js';
import { MarkSystem } from '../systems/MarkSystem.js';
import { ProjectileSystem } from '../systems/ProjectileSystem.js';
import { PowerSystem } from '../systems/PowerSystem.js';
import { EnemySystem } from '../systems/EnemySystem.js';
import { PlayerCombat } from '../systems/PlayerCombat.js';
import { InteractionSystem } from '../systems/InteractionSystem.js';
import { PowerAcquisitionSystem } from '../systems/PowerAcquisitionSystem.js';
import { EnergyDrainSystem } from '../systems/EnergyDrainSystem.js';
import { Progression } from '../powers/Progression.js';
import { PROGRESSION } from '../data/progression.js';

/**
 * GameManager — estado general del juego y bucle principal.
 *
 * Estados: 'menu' → 'playing' ⇄ 'paused' → 'menu'.
 * Orden de actualización por frame:
 *   jugador → poderes → proyectiles → entidades del mapa → marcas → VFX → HUD
 * Sistemas adicionales se registran con `addSystem` y reciben `update(dt, game)`.
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

    // Postproceso: bloom para que poderes y marcas brillen.
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.75, 0.45, 0.82);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());

    // --- Sistemas compartidos por todos los mapas ---
    this.world = new CollisionWorld();
    this.input = new Input(canvas, this.save.data.bindings);
    this.cameraController = new CameraController(this.camera, this.world, this.save.settings);
    this.player = new PlayerController({ input: this.input, camera: this.cameraController, world: this.world, events: this.events });
    this.scene.add(this.player.object3d);
    this.player.object3d.visible = false;

    this.combat = new CombatSystem(this.events);
    this.vfx = new VfxSystem(this.scene);
    this.marks = new MarkSystem({ save: this.save, model: this.player.model, events: this.events });
    this.projectiles = new ProjectileSystem({ scene: this.scene, world: this.world, combat: this.combat, vfx: this.vfx, events: this.events });
    this.powers = new PowerSystem(this);
    this.enemies = new EnemySystem({ scene: this.scene, world: this.world, combat: this.combat, projectiles: this.projectiles, vfx: this.vfx, events: this.events });
    this.playerCombat = new PlayerCombat(this);
    this.enemies.player = this.playerCombat;

    this.mapManager = new MapManager({ scene: this.scene, world: this.world, events: this.events });
    for (const m of maps) this.mapManager.register(m);

    this.ui = new UIManager({
      save: this.save,
      input: this.input,
      onAction: (a, data) => this._onUiAction(a, data),
      onSettingsChanged: (s) => this._applySettings(s),
    });

    this.interactions = new InteractionSystem(this);
    this.acquisition = new PowerAcquisitionSystem(this);
    this.drain = new EnergyDrainSystem(this);
    this.progression = new Progression(this.save.data.profile);
    this.powers.applyModifiers(this.progression.modifiers('energia'));

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
      this._clearTransient();
      this.playerCombat.dead = false;
      this.playerCombat.restore();
      this.player.model.root.rotation.x = 0;
      this.acquisition.cancel();
      const map = this.mapManager.load(id, { combat: this.combat, enemies: this.enemies, interactions: this.interactions, acquisition: this.acquisition, vfx: this.vfx, energySources: this.drain });
      this.playerCombat.attach();
      this.player.object3d.visible = true;
      this.player.spawn(map.spawn);
      this.powers.resetAbilities();
      this.powers.energy.refill();
      this.marks.reset();
      if (map.sun) map.sun.castShadow = this.save.settings.shadows;
      this.ui.hideAll();
      this.ui.setHudVisible(true);
      this.ui.setMapName(def.name, def.description);
      this.ui.setWaypoints(def.waypoints ?? []);
      this.ui.setPowerAvailable(this.powers.available, this.marks.activeDef);
      this.ui.showDeath(false);
      if (id === 'campo' && !this.marks.activeFamily) {
        setTimeout(() => this.ui.toast('Sin poderes todavía', 'Ve a la Zona E para copiar la marca de la Energía', 4000), 3000);
      }
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
      this._clearTransient();
      this.mapManager.unload();
      this.player.object3d.visible = false;
      this.ui.setHudVisible(false);
      this.state = 'menu';
      this.ui.show('menu');
    });
  }

  _clearTransient() {
    this.drain.clear();
    this.enemies.clear();
    this.interactions.clear();
    this.projectiles.clear();
    this.vfx.clear();
    this.ui.clearFloaters();
  }

  pause(screen = 'pause') {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this._pausedAt = performance.now();
    this.input.clear();
    this.input.exitPointerLock();
    this.ui.show(screen);
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
      if (this.input.bindings.powerMenu.includes(e.code)) {
        e.preventDefault();
        if (this.state === 'playing' && !this.acquisition.active) this._openMarks();
        else if (this.state === 'paused' && this.ui.currentScreen === 'marks') this.resume();
        return;
      }
      if (this.input.bindings.debugMenu.includes(e.code)) {
        e.preventDefault();
        if (this.state === 'playing') this._openDebug();
        else if (this.state === 'paused' && this.ui.currentScreen === 'debug') this.resume();
        return;
      }
      if (this.state !== 'playing') return;
      if (e.code === 'KeyH') this.ui.toggleHint();
    });
    this.canvas.addEventListener('click', () => {
      if (this.state === 'playing') this.input.requestPointerLock();
    });
    this.events.on('player:respawned', (e) => {
      if (e?.afterDeath) this.ui.showDeath(false);
      else this.ui.toast('Reaparición', 'Has caído fuera del mapa', 1600);
    });
    this.events.on('combat:damage', (d) => {
      if (d.target === this.playerCombat) return; // el daño al jugador se muestra con la viñeta
      this.ui.damageNumber(d.point, d.amount, d.killed, d.kind);
    });
    this.events.on('player:damaged', (d) => this.ui.playerDamaged(d, this.camera, this.player.motor.position));
    this.events.on('player:died', () => this.ui.showDeath(true));
    this.events.on('enemy:neutralized', (e) => {
      this.ui.toast(`${e.enemy.type.name} neutralizado`, '', 1400);
      this._awardXp(e.type);
    });
    this.events.on('combat:damage', (d) => {
      if (d.killed && d.target?.maxHealth && d.faction === 'player') this._awardXp('dummy');
    });
    this.events.on('marks:changed', () => this.powers.applyModifiers(this.progression.modifiers('energia')));
    this.events.on('power:failed', (d) => {
      this.ui.abilityFailed(d.id);
      // Sin regeneración pasiva: recuerda cómo recargar (como mucho cada 8 s)
      const now = performance.now();
      if (this.powers.energy.value < 30 && now - (this._lowEnergyHint ?? -1e9) > 8000) {
        this._lowEnergyHint = now;
        this.ui.toast('Sin energía', 'Absórbela de farolas, armarios eléctricos o máquinas expendedoras (mantén E)', 3200);
      }
    });
    this.events.on('marks:changed', () => this.ui.setPowerAvailable(this.powers.available, this.marks.activeDef));
  }

  /** Experiencia para la familia de poderes activa (solo si se posee la marca). */
  _awardXp(source) {
    const mark = this.marks.activeFamily;
    if (!mark) return;
    const amount = PROGRESSION[mark]?.xpRewards?.[source] ?? 0;
    if (!amount) return;
    const levels = this.progression.addXp(mark, amount);
    this.save.save();
    this.ui.xpGain(amount, mark);
    if (levels > 0) {
      const s = this.progression.state(mark);
      this.powers.applyModifiers(this.progression.modifiers(mark));
      this.ui.toast(`Nivel ${s.level} de Energía`, `Energía máxima ${this.powers.energy.max} · Punto de mejora disponible · Tab`, 3000);
      this.events.emit('progression:level', { mark, level: s.level });
    }
  }

  _openMarks() {
    this.ui.renderMarks(this._marksState());
    this.pause('marks');
  }

  _marksState() {
    return { profile: this.save.data.profile, progression: this.progression, marks: this.marks };
  }

  _openDebug() {
    this.ui.renderDebug(this._debugState());
    this.pause('debug');
  }

  _debugState() {
    const d = this.save.data.debug;
    return { grantEnergy: d.grantEnergy, acquired: this.marks.acquired('energia'), infiniteEnergy: d.infiniteEnergy, maxMarks: d.maxMarks, invulnerable: d.invulnerable, enemies: this.enemies.alive.length };
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
      case 'save-game':
        this.ui.toast(this.save.save() ? 'Partida guardada' : 'No se pudo guardar', 'Marcas, progreso y ajustes (también se guardan solos)', 1800);
        break;
      case 'menu':
        this.returnToMenu();
        break;
      case 'quit':
        // Las páginas web no pueden cerrar pestañas abiertas por el usuario.
        window.close();
        this.ui.show('quit');
        break;
      // --- Menú de depuración ---
      case 'dbg-health':
        this.playerCombat.restore();
        this.ui.toast('Salud restaurada', '', 1200);
        break;
      case 'dbg-invulnerable':
        this.save.data.debug.invulnerable = !this.save.data.debug.invulnerable;
        this.save.save();
        break;
      case 'dbg-spawn':
        this.spawnTestEnemies();
        break;
      case 'dbg-clear-enemies':
        this.enemies.clear();
        this.ui.toast('Enemigos eliminados', '', 1200);
        break;
      case 'dbg-energy':
        this.powers.energy.refill();
        this.ui.toast('Energía restaurada', '', 1200);
        break;
      case 'dbg-infinite':
        this.save.data.debug.infiniteEnergy = !this.save.data.debug.infiniteEnergy;
        this.save.save();
        break;
      case 'dbg-mark':
        this.marks.setDebugGrant('energia', !this.save.data.debug.grantEnergy);
        this.powers.resetAbilities();
        break;
      case 'dbg-reset-acquisition':
        this.acquisition.cancel();
        this.marks.revoke('energia');
        this.progression.reset('energia');
        this.save.save();
        this.powers.applyModifiers(this.progression.modifiers('energia'));
        this.powers.resetAbilities();
        this.ui.toast('Adquisición reiniciada', 'Se ha quitado la marca de la Energía y su progreso', 1800);
        break;
      case 'dbg-points':
        this.progression.state('energia').points += 1;
        this.save.save();
        this.ui.toast('+1 punto de mejora', 'Energía', 1200);
        break;
      case 'dbg-xp':
        this._awardXp('acolyte');
        break;
      case 'unlock-node': {
        const r = this.progression.unlock(data.mark, data.node);
        if (r.ok) {
          this.save.save();
          this.powers.applyModifiers(this.progression.modifiers(data.mark));
          this.events.emit('progression:unlocked', { mark: data.mark, node: data.node });
        }
        this.ui.renderMarks(this._marksState());
        return;
      }
      case 'dbg-maxmarks':
        this.save.data.debug.maxMarks = !this.save.data.debug.maxMarks;
        this.save.save();
        break;
      case 'dbg-abilities':
        this.powers.resetAbilities();
        this.ui.toast('Habilidades reiniciadas', '', 1200);
        break;
      case 'dbg-scenario':
        this._clearTransient();
        this.mapManager.resetEntities();
        this.ui.toast('Escenario reiniciado', '', 1200);
        break;
      case 'dbg-teleport': {
        const wp = (this.mapManager.current?.def.waypoints ?? []).find((w) => w.id === data.wp);
        if (wp) this.player.spawnAt(wp);
        this.resume();
        return;
      }
      default:
        break;
    }
    if (action.startsWith('dbg-') && this.ui.currentScreen === 'debug') this.ui.renderDebug(this._debugState());
  }

  /** Genera un Agente PDC y un Acólito unos metros por delante del jugador (depuración). */
  spawnTestEnemies() {
    const p = this.player.motor.position;
    const f = this.player.facingVector();
    const right = { x: f.z, z: -f.x };
    const spawned = [];
    for (const [type, side] of [['pdc', -3], ['acolyte', 3]]) {
      const x = p.x + f.x * 14 + right.x * side;
      const z = p.z + f.z * 14 + right.z * side;
      const gy = this.world.groundHeight(x, z, 0.4, p.y + 6);
      const y = Number.isFinite(gy) ? gy + 0.05 : p.y + 0.2;
      spawned.push(this.enemies.spawn(type, { x, y, z, yaw: Math.atan2(-f.x, -f.z), tag: 'debug', patrol: [{ x, z }, { x: x + right.x * 4, z: z + right.z * 4 }] }));
    }
    this.ui.toast('Enemigos generados', 'Agente PDC y Acólito de Energía', 1400);
    return spawned;
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
    this.composer.setSize(w, h);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.vfx.setViewportHeight(h * this.renderer.getPixelRatio());
  }

  _frame() {
    const dt = Math.min(this._clock.getDelta(), 0.1);
    if (dt > 0) this._fps += (1 / dt - this._fps) * 0.05;

    if (this.state === 'playing') {
      if (this.input.wasPressed('debug')) this.ui.toggleDebug();
      this.player.disabled = this.playerCombat.dead || this.acquisition.active || !!this.drain.active;
      this.player.update(dt);
      this.playerCombat.update(dt);
      this.powers.update(dt);
      this.interactions.update(dt);
      this.acquisition.update(dt);
      this.drain.update(dt);
      this.enemies.update(dt);
      this.projectiles.update(dt);
      this.mapManager.update(dt);
      for (const s of this.systems) s.update?.(dt, this);
      this.marks.update(dt);
      this.vfx.update(dt);
      const sun = this.mapManager.current?.sun;
      if (sun) followSun(sun, this.player.position);
      this._updateHud(dt);
    }

    if (this.state === 'playing' || this.state === 'paused') {
      if (this.save.settings.bloom) this.composer.render(dt);
      else this.renderer.render(this.scene, this.camera);
    } else {
      this.renderer.clear();
    }
    this.input.endFrame();
  }

  _updateHud(dt) {
    const m = this.player.motor;
    const p = m.position;
    const v = m.velocity;
    const pw = this.powers;
    this.ui.updateHud({
      dt,
      camera: this.camera,
      dodgeCooldown: m.dodgeCooldownRemaining,
      dodgeCooldownMax: m.cfg.dodgeCooldown + m.cfg.dodgeDuration,
      dodging: m.isDodging,
      health: { value: this.playerCombat.health.value, max: this.playerCombat.health.max, god: this.playerCombat.health.godMode, invuln: this.playerCombat.health.invulnerable > 0 },
      meleeCooldown: this.playerCombat._meleeCd / 0.55,
      stance: this.player.stance,
      meleeElemental: this.playerCombat.canElemental(),
      sprinting: this.player.sprinting && m.horizontalSpeed > 6,
      pointerLocked: this.input.pointerLocked,
      fps: this._fps,
      power: {
        available: pw.available,
        energy: pw.energy.value,
        energyMax: pw.energy.max,
        infinite: pw.energy.infinite,
        aiming: this.player.aiming,
        charge: pw.isCharging ? pw.chargeRatio : null,
        abilities: Object.fromEntries(Object.entries(pw.abilities).map(([k, a]) => [k, {
          cooldown: a.cooldownRatio, affordable: pw.energy.canSpend(a.def.cost),
        }])),
        dashing: m.isDashing || m.isTraveling,
        targeting: pw.isTargeting,
        magazine: pw.magazine && { ammo: pw.magazine.ammo, size: pw.magazine.size, reloading: pw.magazine.reloading, progress: pw.magazine.reloadProgress },
        diving: pw.isDiving,
      },
      debugText: this.ui.debugVisible
        ? [
            `pos   ${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}`,
            `vel   ${v.x.toFixed(2)}, ${v.y.toFixed(2)}, ${v.z.toFixed(2)}`,
            `vel h ${m.horizontalSpeed.toFixed(2)} m/s`,
            `suelo ${m.grounded ? 'sí' : 'no'}`,
            `energ ${pw.energy.value.toFixed(1)} / ${pw.energy.max}`,
            `marca ${this.marks.activeFamily ?? '—'} · intensidad ${this.marks.level.toFixed(2)}`,
            `proy. ${this.projectiles.list.length} · partículas ${this.vfx.particles.count}`,
            `salud ${this.playerCombat.health.value.toFixed(0)} / ${this.playerCombat.health.max}`,
            ...this.enemies.list.map((e) => `enem. ${e.type.name}: ${e.stateName} · ${Math.round(e.health.value)} PS`),
            `col.  ${this.world.boxes.length} cajas · ${this.world.ramps.length} rampas`,
            `draw  ${this.renderer.info.render.calls} llamadas · ${this.renderer.info.render.triangles} tri`,
          ].join('\n')
        : null,
    });
  }
}
