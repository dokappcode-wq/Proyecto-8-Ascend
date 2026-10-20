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
import { GravityPowerSystem } from '../systems/GravityPowerSystem.js';
import { ThreadPowerSystem } from '../systems/ThreadPowerSystem.js';
import { TemperaturePowerSystem } from '../systems/TemperaturePowerSystem.js';
import { WingsPowerSystem, plumageAbsorb } from '../systems/WingsPowerSystem.js';
import { wheelPick, clampWheel } from '../ui/markWheel.js';
import { ComboSystem } from '../systems/ComboSystem.js';
import { MARKS } from '../data/marks.js';
import { EnemySystem } from '../systems/EnemySystem.js';
import { PlayerCombat } from '../systems/PlayerCombat.js';
import { InteractionSystem } from '../systems/InteractionSystem.js';
import { PowerAcquisitionSystem } from '../systems/PowerAcquisitionSystem.js';
import { EnergyDrainSystem } from '../systems/EnergyDrainSystem.js';
import { FactionSystem } from '../systems/FactionSystem.js';
import { MissionSystem } from '../systems/MissionSystem.js';
import { AudioSystem } from '../audio/AudioSystem.js';
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
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2) * (this.save.settings.renderScale ?? 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = this.save.settings.shadows;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

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
    this.gravity = new GravityPowerSystem(this);
    this.thread = new ThreadPowerSystem(this);
    this.temperature = new TemperaturePowerSystem(this);
    this.wings = new WingsPowerSystem(this);
    this.combos = new ComboSystem(this);
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
    this.factions = new FactionSystem(this);
    this.missions = new MissionSystem(this);
    this.audio = new AudioSystem(this.save.settings);
    this.audio.attach(this);
    this.progression = new Progression(this.save.data.profile);
    /** Aleatoriedad del juego (las pruebas pueden sustituirla). */
    this.rng = Math.random;
    this._time = 0;
    this._gravityPassiveAt = -Infinity;
    this._applyModifiers();

    this._clock = new THREE.Timer();
    this._clock.connect(document);
    this._fps = 60;
    this._pausedAt = 0;

    this._wireEvents();
    window.addEventListener('resize', () => this._resize());
    this._resize();
    this.ui.show('menu');
    this.renderer.setAnimationLoop(() => this._frame());
  }

  /** Familia de poderes de la marca activa (Energía o Gravedad). */
  get activePowers() {
    return this.powersFor(this.marks.activeFamily);
  }

  /** Familia de poderes de un elemento. */
  powersFor(element) {
    if (element === 'gravedad') return this.gravity;
    if (element === 'hilo') return this.thread;
    if (element === 'temperatura') return this.temperature;
    if (element === 'alas') return this.wings;
    return this.powers;
  }

  /** Todas las familias de poderes. */
  get families() {
    return [this.powers, this.gravity, this.thread, this.temperature, this.wings];
  }

  _applyModifiers() {
    this.powers.applyModifiers(this.progression.modifiers('energia'));
    this.gravity.applyModifiers(this.progression.modifiers('gravedad'));
    this.thread.applyModifiers(this.progression.modifiers('hilo'));
    this.temperature.applyModifiers(this.progression.modifiers('temperatura'));
    this.wings.applyModifiers(this.progression.modifiers('alas'));
  }

  /** Ajustes que dependen de la marca activa: saltos de Gravedad, HUD. */
  _onMarkChanged() {
    const fam = this.marks.activeFamily;
    // Saltos especiales de la marca activa (Gravedad: triple y planeo; Hilo: salto alto)
    this.player.motor.jumpAbilities = fam === 'gravedad' ? this.gravity.cfg.jumps : fam === 'hilo' ? this.thread.cfg.jumps : null;
    this.player.model.setReload(null);
    this.ui.setPowerAvailable(this.activePowers.available, this.marks.activeDef);
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
      this.gravity.resetAbilities();
      this.gravity.energy.refill();
      this.thread.resetAbilities();
      this.thread.energy.refill();
      this.temperature.resetAbilities();
      this.temperature.energy.refill();
      this.wings.resetAbilities();
      this.wings.energy.refill();
      this.marks.reset();
      if (map.sun) map.sun.castShadow = this.save.settings.shadows;
      this.ui.hideAll();
      this.ui.setHudVisible(true);
      this.ui.setMapName(def.name, def.description);
      this.ui.setWaypoints(def.waypoints ?? []);
      this._onMarkChanged();
      this.ui.showDeath(false);
      if (id === 'campo' && !this.marks.activeFamily) {
        setTimeout(() => this.ui.toast('Sin poderes todavía', 'Ve a la Zona E para copiar la marca de la Energía', 4000), 3000);
      }
      this.state = 'playing';
      this.audio.setPaused(false);
      this.save.data.lastMap = id;
      this.save.save();
      this._clock.update();
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
    this.audio.setPaused(true);
    this.ui.show(screen);
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.audio.setPaused(false);
    this.ui.hideAll();
    this.input.clear();
    this._clock.update();
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
    // Polvo al aterrizar fuerte, saltar una valla o subir a una cornisa
    const dust = (count, speed) => {
      const p = this.player.motor.position;
      this.vfx.particles.burst({ x: p.x, y: p.y + 0.1, z: p.z }, { count, speed, color: new THREE.Color(0x9a948a), size: 0.16, life: 0.55, drag: 4 });
    };
    this.events.on('player:landed', (e) => {
      if (e.speed > 9) dust(Math.min(26, 6 + e.speed), 2 + e.speed * 0.12);
    });
    this.events.on('player:parkour', (e) => {
      if (e.kind === 'vault' || e.kind === 'mantle') dust(6, 1.5);
    });
    this.events.on('enemy:neutralized', (e) => {
      this.ui.toast(`${e.enemy.type.name} neutralizado`, '', 1400);
      this._awardXp(e.type);
    });
    this.events.on('combat:damage', (d) => {
      if (d.killed && d.target?.maxHealth && d.faction === 'player') this._awardXp('dummy');
    });
    this.events.on('marks:changed', () => this._applyModifiers());
    this.events.on('power:failed', (d) => {
      this.ui.abilityFailed(d.id);
      // Sin regeneración pasiva: recuerda cómo recargar (como mucho cada 8 s)
      const now = performance.now();
      if (this.activePowers.energy.value < 30 && now - (this._lowEnergyHint ?? -1e9) > 8000) {
        this._lowEnergyHint = now;
        const where = {
          gravedad: 'Absórbela de escombros o bloques de hormigón (mantén E)',
          hilo: 'Absórbela de tendederos o rollos de tela (mantén E)',
          temperatura: 'Absórbela de arcones congeladores o bidones con fuego (mantén E)',
          alas: 'Las plumas vuelven solas; más rápido junto a palomares o montones de cojines (mantén E)',
        }[this.marks.activeFamily] ?? 'Absórbela de farolas, armarios eléctricos o máquinas expendedoras (mantén E)';
        this.ui.toast('Sin carga', where, 3200);
      }
    });
    this.events.on('marks:changed', () => this._onMarkChanged());
    this.events.on('mark:switched', ({ active }) => this.ui.toast(MARKS[active].name, 'Marca activa · V para cambiar', 1400));
    // Pasiva de la Energía: 5 % de probabilidad de detener (aturdir) al enemigo golpeado
    const energyKinds = new Set(['bolt', 'discharge', 'splash', 'wave', 'rayo', 'melee-energia']);
    this.events.on('combat:damage', (d) => {
      const t = d.target;
      if (d.faction !== 'player' || !energyKinds.has(d.kind) || !t?.stun || !t.alive || !this.marks.owns('energia')) return;
      if (this.rng() >= 0.05) return;
      t.stun(1.5);
      const c = t.center;
      this.vfx.lightning({ x: c.x, y: c.y + 1.2, z: c.z }, c, MARKS.energia.color, { width: 0.05, duration: 0.3, jitter: 0.3, branches: 3 });
      this.ui.damageNumber({ x: c.x, y: c.y + 0.6, z: c.z }, 'Detenido', false, 'passive');
      this.events.emit('passive:energy', { target: t });
    });
    // Pasiva de la Temperatura: los golpes físicos queman (1 por tic hasta 10, sin acumularse)
    this.events.on('combat:damage', (d) => {
      const t = d.target;
      if (d.faction !== 'player' || !/^melee/.test(d.kind) || !t?.burn || !t.alive || !this.marks.owns('temperatura')) return;
      if (!t.burn(this.temperature.cfg.burn)) return;
      this.ui.damageNumber({ x: t.center.x, y: t.center.y + 0.6, z: t.center.z }, 'Quemado', false, 'passive');
      this.events.emit('passive:temperature', { target: t });
    });
    // Escudo del Blindado: avisa de que el golpe se ha parado (como mucho cada 0.4 s)
    this.events.on('enemy:blocked', (e) => {
      if (this._time - (this._blockedMsg ?? -1) < 0.4) return;
      this._blockedMsg = this._time;
      const c = e.point;
      this.ui.damageNumber({ x: c.x, y: c.y + 0.5, z: c.z }, 'Bloqueado', false, 'passive');
    });
    // Pasiva de las Alas: las plumas absorben parte del daño recibido
    this.playerCombat.damageFilters.push((amount, info) => {
      if (!this.marks.owns('alas') || amount <= 0) return amount;
      const w = this.wings;
      const r = plumageAbsorb(amount, w.energy.value, w.cfg.passive);
      if (r.feathers <= 0) return amount;
      w.energy.value = Math.max(0, w.energy.value - r.feathers);
      w.energy._sinceSpend = 0;
      if (r.feathers >= 1) {
        const p = this.player.motor.position;
        this.vfx.particles.burst({ x: p.x, y: p.y + 1.3, z: p.z }, { count: Math.min(12, 2 + Math.round(r.feathers)), speed: 2.5, color: new THREE.Color('#fff0f6'), size: 0.1, life: 0.6, drag: 2, gravity: 2 });
      }
      this.events.emit('passive:wings', { absorbed: r.feathers, kind: info.kind });
      return r.taken;
    });
    // Pasiva de la Gravedad: al bajar del 5 % de vida, las balas enemigas flotan 4 s
    this.events.on('player:damaged', (d) => {
      const pc = this.playerCombat;
      const cfg = this.gravity.cfg.passive;
      if (!this.marks.owns('gravedad') || !pc.alive || d.health > pc.health.max * cfg.threshold) return;
      if (this._time < this._gravityPassiveAt + cfg.cooldown) return;
      this._gravityPassiveAt = this._time;
      this.projectiles.stasis(cfg.duration);
      const p = this.player.motor.position;
      this.vfx.ring({ x: p.x, y: p.y + 0.05, z: p.z }, 6, MARKS.gravedad.color, 0.6);
      this.vfx.lights.flash({ x: p.x, y: p.y + 1, z: p.z }, MARKS.gravedad.color, 40, 12, 0.5);
      this.marks.pulse(1, 0.5);
      this.ui.toast('Estasis', 'Las balas enemigas se quedan flotando', 2000);
      this.events.emit('passive:gravity', { duration: cfg.duration });
    });
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
      this._applyModifiers();
      this.ui.toast(`Nivel ${s.level} de ${MARKS[mark].concept}`, `Carga máxima ${this.powersFor(mark).energy.max} · Punto de mejora disponible · Tab`, 3000);
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
    return { mission: this.missions.mission ? { name: this.missions.mission.def.name, state: this.missions.mission.state } : null, pdc: this.factions.enabled ? this.factions.pdcLevel.name : null, grantEnergy: d.grantEnergy, grantGravity: d.grantGravity, grantThread: d.grantThread, grantTemperature: d.grantTemperature, grantWings: d.grantWings, gravityAcquired: this.marks.acquired('gravedad'), active: this.marks.activeFamily, acquired: this.marks.acquired('energia'), infiniteEnergy: d.infiniteEnergy, maxMarks: d.maxMarks, invulnerable: d.invulnerable, enemies: this.enemies.alive.length };
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
        this.gravity.energy.refill();
        this.thread.energy.refill();
        this.temperature.energy.refill();
        this.wings.energy.refill();
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
      case 'dbg-mark-gravity':
        this.marks.setDebugGrant('gravedad', !this.save.data.debug.grantGravity);
        this.gravity.resetAbilities();
        break;
      case 'dbg-reset-gravity':
        this.acquisition.cancel();
        this.marks.revoke('gravedad');
        this.progression.reset('gravedad');
        this.save.save();
        this._applyModifiers();
        this.ui.toast('Adquisición reiniciada', 'Se ha quitado la marca de la Gravedad y su progreso', 1800);
        break;
      case 'dbg-mark-thread':
        this.marks.setDebugGrant('hilo', !this.save.data.debug.grantThread);
        this.thread.resetAbilities();
        break;
      case 'dbg-reset-thread':
        this.acquisition.cancel();
        this.marks.revoke('hilo');
        this.progression.reset('hilo');
        this.save.save();
        this._applyModifiers();
        this.ui.toast('Adquisición reiniciada', 'Se ha quitado la marca del Hilo y su progreso', 1800);
        break;
      case 'dbg-mark-temperature':
        this.marks.setDebugGrant('temperatura', !this.save.data.debug.grantTemperature);
        this.temperature.resetAbilities();
        break;
      case 'dbg-reset-temperature':
        this.acquisition.cancel();
        this.marks.revoke('temperatura');
        this.progression.reset('temperatura');
        this.save.save();
        this._applyModifiers();
        this.ui.toast('Adquisición reiniciada', 'Se ha quitado la marca de la Temperatura y su progreso', 1800);
        break;
      case 'dbg-mark-wings':
        this.marks.setDebugGrant('alas', !this.save.data.debug.grantWings);
        this.wings.resetAbilities();
        break;
      case 'dbg-reset-wings':
        this.acquisition.cancel();
        this.marks.revoke('alas');
        this.progression.reset('alas');
        this.save.save();
        this._applyModifiers();
        this.ui.toast('Adquisición reiniciada', 'Se ha quitado la marca de las Alas y su progreso', 1800);
        break;
      case 'set-mark':
        this.marks.setActive(data.mark);
        this.ui.renderMarks(this._marksState());
        return;
      case 'dbg-reset-acquisition':
        this.acquisition.cancel();
        this.marks.revoke('energia');
        this.progression.reset('energia');
        this.save.save();
        this._applyModifiers();
        this.powers.resetAbilities();
        this.ui.toast('Adquisición reiniciada', 'Se ha quitado la marca de la Energía y su progreso', 1800);
        break;
      case 'dbg-points': {
        const mark = this.marks.activeFamily ?? 'energia';
        this.progression.state(mark).points += 1;
        this.save.save();
        this.ui.toast('+1 punto de mejora', MARKS[mark].concept, 1200);
        break;
      }
      case 'dbg-xp':
        this._awardXp('acolyte');
        break;
      case 'unlock-node': {
        const r = this.progression.unlock(data.mark, data.node);
        if (r.ok) {
          this.save.save();
          this._applyModifiers();
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
        this.gravity.resetAbilities();
        this.thread.resetAbilities();
        this.temperature.resetAbilities();
        this.wings.resetAbilities();
        this.ui.toast('Habilidades reiniciadas', '', 1200);
        break;
      case 'dbg-scenario':
        // Sin borrar interacciones ni fuentes de energía (son del mapa)
        this.enemies.clear();
        this.projectiles.clear();
        this.vfx.clear();
        this.ui.clearFloaters();
        this.missions.reset();
        this.factions.reputation.reset(this.mapManager.current?.def.factions ?? {});
        this.mapManager.resetEntities();
        this.ui.toast('Escenario reiniciado', '', 1200);
        break;
      case 'dbg-mission-reset':
        this.missions.reset();
        this.ui.toast('Misión reiniciada', 'Vuelve al teléfono público para empezarla', 1600);
        break;
      case 'dbg-pdc-hostile': {
        const r = this.factions.reputation;
        if (r.isHostile('pdc')) r.reset(this.mapManager.current?.def.factions ?? {});
        else this.factions._apply(r.report('pdc:killed'));
        break;
      }
      case 'mission-continue':
        this.resume();
        return;
      case 'mission-retry':
        this.missions.reset();
        this.missions.start();
        this.resume();
        return;
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
    this.audio.settings = s;
    this.audio.applyVolumes();
    if (this._renderScale !== s.renderScale) this._resize();
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
    // Resolución de render (Ajustes): escala sobre la densidad de la pantalla
    this._renderScale = this.save.settings.renderScale ?? 1;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2) * this._renderScale);
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.vfx.setViewportHeight(h * this.renderer.getPixelRatio());
  }

  /**
   * V: pulsación corta = siguiente marca; mantener = rueda de marcas (el ratón
   * elige el sector y al soltar se activa). Devuelve el paso de tiempo de juego.
   */
  _updateMarkWheel(dt) {
    const input = this.input;
    const can = !this.playerCombat.dead && !this.acquisition.active && !this.drain.active;
    if (input.wasPressed('switchMark') && can) {
      // Una pulsación anterior aún sin resolver (fotogramas lentos) cuenta como cambio
      if (this._wheel && !this._wheel.open) this.marks.cycle();
      this._wheel = { t: 0, open: false, v: { x: 0, y: 0 }, pick: -1 };
    }
    const w = this._wheel;
    if (!w) return dt;
    const owned = this.marks.ownedCopies;
    if (input.isDown('switchMark') && can) {
      w.t += dt;
      if (!w.open && w.t >= 0.22 && owned.length > 1) {
        w.open = true;
        this.player.lookLocked = true;
        this.ui.showMarkWheel(owned.map((id) => MARKS[id]), this.marks.activeFamily);
      }
      if (w.open) {
        w.v.x += input.mouseDX;
        w.v.y += input.mouseDY;
        clampWheel(w.v);
        w.pick = wheelPick(w.v.x, w.v.y, owned.length);
        this.ui.highlightMarkWheel(w.pick);
        return dt * 0.3;
      }
      return dt;
    }
    // Suelta V
    if (w.open) {
      // Sin señalar ninguna, cuenta como pulsación (siguiente marca)
      if (w.pick >= 0) this.marks.setActive(owned[w.pick]);
      else if (can) this.marks.cycle();
      this.ui.hideMarkWheel();
      this.player.lookLocked = false;
    } else if (can) {
      this.marks.cycle();
    }
    this._wheel = null;
    return dt;
  }

  _frame() {
    this._clock.update();
    const realDt = Math.min(this._clock.getDelta(), 0.1);
    if (realDt > 0) this._fps += (1 / realDt - this._fps) * 0.05;
    // Con la rueda de marcas abierta, el tiempo va más lento
    const dt = this.state === 'playing' ? this._updateMarkWheel(realDt) : realDt;
    if (this.state === 'playing') this._time += dt;

    if (this.state === 'playing') {
      if (this.input.wasPressed('debug')) this.ui.toggleDebug();
      this.player.disabled = this.playerCombat.dead || this.acquisition.active || !!this.drain.active;
      this.player.update(dt);
      this.playerCombat.update(dt);
      this.powers.update(dt);
      this.gravity.update(dt);
      this.thread.update(dt);
      this.temperature.update(dt);
      this.wings.update(dt);
      this.interactions.update(dt);
      this.acquisition.update(dt);
      this.drain.update(dt);
      this.enemies.update(dt);
      this.factions.update(dt);
      this.missions.update(dt);
      this.projectiles.update(dt);
      this.mapManager.update(dt);
      this.mapManager.cull(this.camera.position);
      for (const s of this.systems) s.update?.(dt, this);
      this.marks.update(dt);
      this.vfx.update(dt);
      const sun = this.mapManager.current?.sun;
      if (sun) followSun(sun, this.player.position);
      this._updateHud(dt);
      this._checkBounds();
      this.audio.update(this);
    }

    if (this.state === 'playing' || this.state === 'paused') {
      if (this.save.settings.bloom) this.composer.render(dt);
      else this.renderer.render(this.scene, this.camera);
    } else {
      this.renderer.clear();
    }
    this.input.endFrame();
  }

  /** Aviso al acercarse al límite del mapa (los muros invisibles impiden salir). */
  _checkBounds() {
    const b = this.mapManager.current?.def.bounds;
    const p = this.player.motor.position;
    const margin = 5;
    const near = !!b && (p.x < b.minX + margin || p.x > b.maxX - margin || p.z < b.minZ + margin || p.z > b.maxZ - margin);
    this.ui.setBoundsWarning(near ? `Límite de ${this.mapManager.current.def.name}` : null);
  }

  _updateHud(dt) {
    const m = this.player.motor;
    const p = m.position;
    const v = m.velocity;
    const pw = this.activePowers;
    this.ui.updateHud({
      dt,
      camera: this.camera,
      dodgeCooldown: m.dodgeCooldownRemaining,
      dodgeCooldownMax: m.cfg.dodgeCooldown + m.cfg.dodgeDuration,
      dodging: m.isDodging,
      health: { value: this.playerCombat.health.value, max: this.playerCombat.health.max, god: this.playerCombat.health.godMode, invuln: this.playerCombat.health.invulnerable > 0 },
      meleeCooldown: this.playerCombat._meleeCd / 0.55,
      stance: this.player.stance,
      faction: this.factions.enabled ? { name: 'PDC', level: this.factions.pdcLevel, hostility: this.factions.reputation.hostility.pdc } : null,
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
        magazine: pw.magazine && { ammo: pw.magazine.ammo, size: pw.magazine.size, reloading: pw.magazine.reloading, progress: pw.magazine.reloadProgress, iconStep: pw.magazine.iconStep ?? 1 },
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
