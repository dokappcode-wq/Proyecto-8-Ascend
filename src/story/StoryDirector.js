import * as THREE from 'three';
import { StoryState, createStoryState } from './StoryState.js';
import { StoryUI } from './StoryUI.js';
import { checkpoint, nextCheckpoint, allowedPowers, POWER_ACTIONS, STORY_MISSIONS } from './storyData.js';
import { detectionRate, stepMeter, STEALTH } from './stealthMath.js';
import { Npc } from './actors.js';
import { Progression } from '../powers/Progression.js';
import { BEATS } from './prologue.js';

/** Señal interna: el tramo en curso se ha cancelado (recarga, menú…). */
export class StoryAbort extends Error {
  constructor() {
    super('story-abort');
  }
}

/** Segundos que se muestra un subtítulo según su longitud. */
/** Segundos que hay que mantener Espacio o Intro para saltar una cinemática. */
export const SKIP_HOLD = 0.6;

export function lineTime(text) {
  return Math.min(6, 1.3 + String(text).length * 0.055);
}

/**
 * StoryDirector — el modo historia (prólogo).
 *
 * - Guarda el estado en `save.data.story` y solo al llegar a un punto de control.
 * - Ejecuta el guion por tramos (`prologue.js`): cada punto de control arranca
 *   un tramo asíncrono que se puede cancelar (detección, caída, muerte, menú).
 * - Recargar un punto de control vuelve a montar el mapa entero: así todo
 *   (patrullas, compuertas, escombros…) vuelve a su estado inicial.
 * - Gestiona el sigilo de M01, los bloqueos de controles y poderes de cada
 *   tramo, los marcadores y la interfaz propia (subtítulos, objetivos…).
 */
export class StoryDirector {
  constructor(game) {
    this.game = game;
    this.ui = new StoryUI();
    this.ui.setVisible(false);
    if (!game.save.data.story) game.save.data.story = createStoryState();
    this._state = null;
    this.active = false;
    /** Sin control del personaje (cinemáticas). */
    this.controlsLocked = false;
    /** Pantalla de elección abierta: liberar el puntero no pausa. */
    this.modal = false;
    /** Tiempo de juego del modo historia (se detiene en pausa). */
    this.time = 0;
    /** Velocidad del tiempo del guion (diálogos y esperas); las pruebas lo suben. */
    this.speed = 1;
    /**
     * Saltando una cinemática: GameManager simula la escena deprisa, sin
     * dibujarla, hasta que se recupera el control (el resultado es el mismo
     * que viéndola entera).
     */
    this.skipping = false;
    /** Momento (ms) en que se empezó a mantener la tecla de saltar, o 0. */
    this._skipHold = 0;
    this._skipStart = 0;
    /** Esperas del guion cumplidas en el último update (el salto cede el paso al guion). */
    this.resolved = 0;
    /** Acciones de poder permitidas en el tramo actual. */
    this.allowed = new Set();
    /** Otras acciones bloqueadas por el tramo. */
    this.extraBlocked = new Set();
    this.npcs = new Map();
    this.markers = [];
    this.stealth = null;
    /** Dash asistido (puente): { gaps: [{from,to,y}], marker } o null. */
    this.dashAssist = null;
    this.current = null;
    this.fallY = -6;
    this._waiters = [];
    this._updates = [];
    this._interactions = [];
    this._token = null;
    this._loading = false;
    this._sub = null;
    /** Progresión propia del prólogo: la historia se juega con los poderes básicos. */
    this.progression = new Progression({ skillProgress: {} });
    game.events.on('map:unloaded', () => {
      this.npcs.clear();
      this.stealth = null;
    });
    game.events.on('mark:acquired', ({ markId }) => {
      if (!this.active || markId !== 'energia') return;
      this.state.flags.HasEnergyMark = true;
      this.state.flags.ActiveMark = 'energia';
      this.game.save.save();
    });
  }

  /** Estado persistente (envuelve `save.data.story`). */
  get state() {
    const data = this.game.save.data.story;
    if (!this._state || this._state.data !== data) this._state = new StoryState(data);
    return this._state;
  }

  /** Datos del mapa actual para el guion (puntos, accesorios…). */
  get map() {
    return this.game.mapManager.current?.story ?? null;
  }

  get points() {
    return this.map?.points ?? {};
  }

  /** ¿Hay partida del prólogo para continuar? */
  get canContinue() {
    const d = this.game.save.data.story;
    return !!d?.started && !d.completed;
  }

  // ------------------------------------------------------------------ Ciclo de vida
  /** Prepara una partida (nueva o continuar). Devuelve el punto de control de entrada. */
  prepare(fresh) {
    const st = this.state;
    if (fresh || !st.data.started || st.data.completed) {
      st.reset();
      this.game.save.save();
    }
    this.active = true;
    this.time = 0;
    this.ui.setVisible(true);
    // La historia enseña los controles con tutoriales: el panel general (H) se oculta
    this._hintWasHidden = this.game.ui.hud.hint.classList.contains('hidden');
    this.game.ui.hud.hint.classList.add('hidden');
    this._applyProfile();
    this.game._applyModifiers();
    return checkpoint(st.checkpoint);
  }

  /**
   * Carga el mapa del punto de control, coloca a Jon con la salud y la carga
   * guardadas y arranca el guion desde ahí. Se llama dentro de un fundido.
   */
  enter(id) {
    this._abort();
    const g = this.game;
    const cp = checkpoint(id);
    this.current = cp;
    g._loadMap(cp.map);
    this._applyProfile();
    const p = this.points[cp.at];
    if (p) g.player.spawn(p);
    const snap = this.state.data.snapshot;
    g.playerCombat.setHealth(Math.max(1, snap.health ?? 100));
    // Al recargar con Energía nunca se empieza sin carga (siempre hay con qué disparar o saltar)
    const minCharge = this.state.flags.HasEnergyMark ? 30 : 0;
    g.powers.energy.value = Math.min(g.powers.energy.max, Math.max(minCharge, snap.charge ?? 0));
    this.controlsLocked = false;
    this._run(id, true);
  }

  /** Sale del modo historia (volver al menú). */
  stop() {
    this.endSkip();
    this._abort();
    this.active = false;
    this.ui.setVisible(false);
    if (this._hintWasHidden === false) this.game.ui.hud.hint.classList.remove('hidden');
    this.game.marks.useStoryProfile(null);
    this.game.input.blocked.clear();
    this.game.ui.updateMarkers([], this.game.camera);
  }

  /**
   * Vuelve al último punto de control (detección, caída, muerte o desde la
   * pausa). Fundido a negro con el motivo y el mapa se monta de nuevo.
   */
  async reload(reason = '') {
    if (this._loading || !this.active) return;
    this._loading = true;
    const g = this.game;
    this._abort();
    this.controlsLocked = true;
    g.input.clear();
    this.game.events.emit('story:reload', { reason, checkpoint: this.state.checkpoint });
    this.ui.fadeTo(1, 450, reason);
    await sleep(reason ? 1100 : 600);
    if (!this.active) {
      this._loading = false;
      return;
    }
    this.enter(this.state.checkpoint);
    await sleep(250);
    this.ui.fadeTo(0, 600);
    this._loading = false;
  }

  /** La partida del jugador ha terminado en combate (PlayerCombat). */
  onPlayerDied() {
    this.reload('Has caído');
  }

  /** Salta a un punto de control (menú de depuración). */
  async jumpTo(id) {
    if (!this.active) return;
    this.state.jump(id);
    this.game.save.save();
    this._loading = true;
    this._abort();
    this.ui.fadeTo(1, 300, checkpoint(id).title);
    await sleep(350);
    this.enter(id);
    await sleep(200);
    this.ui.fadeTo(0, 500);
    this._loading = false;
  }

  /** Guarda el punto de control con la salud y la carga actuales. */
  reach(id) {
    const g = this.game;
    this.state.reach(id, { health: Math.max(1, Math.round(g.playerCombat.health.value)), charge: Math.round(g.powers.energy.value) });
    g.save.save();
    const cp = checkpoint(id);
    this.current = cp;
    this.allowed = new Set(allowedPowers(id));
    g.events.emit('story:checkpoint', { id, title: cp.title });
  }

  /** Marcas que posee Jon según el guion (perfil propio del modo historia). */
  _applyProfile() {
    const st = this.state;
    const m = this.game.marks;
    if (m.storyProfile) {
      m.storyProfile.marks = st.marks;
      m.storyProfile.activeMark = st.flags.ActiveMark;
      m.refresh();
    } else {
      m.useStoryProfile({ marks: st.marks, activeMark: st.flags.ActiveMark, skillProgress: {}, missions: {} });
    }
  }

  /** Concede la marca del Destino (la carta dorada). */
  grantDestiny() {
    this.state.flags.HasDestinyMark = true;
    this.game.save.save();
    this._applyProfile();
  }

  // ------------------------------------------------------------------ Ejecución del guion
  _run(id, entered) {
    const token = { cancelled: false };
    this._token = token;
    const S = new Script(this, token);
    this.allowed = new Set(allowedPowers(id));
    this.running = (async () => {
      let cur = id;
      let fresh = entered;
      try {
        while (cur) {
          const cp = checkpoint(cur);
          this.current = cp;
          const beat = BEATS[cp.beat];
          if (!beat) throw new Error(`Tramo sin guion: ${cp.beat}`);
          const next = await beat(S, { cp, entered: fresh });
          fresh = false;
          S.check();
          if (next === null) break;
          const nx = next ?? nextCheckpoint(cur)?.id;
          if (!nx) break;
          const ncp = checkpoint(nx);
          if (ncp.map !== this.game.mapManager.current?.def.id) await S.loadMap(ncp.map, ncp.at);
          this._cleanupBeat();
          this.reach(nx);
          cur = nx;
        }
      } catch (e) {
        if (!(e instanceof StoryAbort)) {
          console.error(e);
          this.game.events.emit('story:error', { error: String(e) });
        }
      }
    })();
  }

  _abort() {
    if (this._token) this._token.cancelled = true;
    this._token = null;
    const ws = this._waiters;
    this._waiters = [];
    for (const w of ws) w.reject(new StoryAbort());
    this._cleanupBeat();
  }

  /** Deja todo lo temporal del tramo como estaba (cámara, controles, avisos…). */
  _cleanupBeat() {
    const g = this.game;
    g.cameraController.setShot(null);
    g.player.autopilot = null;
    g.player.lookTarget = null;
    g.player.lookLocked = false;
    this.controlsLocked = false;
    this.modal = false;
    this.ui.cancelChoice();
    this.ui.subtitle(null);
    this.ui.tutorial(null);
    this.ui.letterbox(false);
    this.ui.detection(null);
    this.ui.objective(null);
    this.markers = [];
    this.stealth = null;
    this.dashAssist = null;
    this.extraBlocked.clear();
    for (const it of this._interactions) g.interactions.remove(it);
    this._interactions = [];
    this._updates = [];
    this._sub = null;
    if (g.acquisition.active) g.acquisition.cancel();
    // Los personajes vuelven a aparecer cuando el siguiente tramo los coloca
    for (const n of this.npcs.values()) {
      n.stop();
      n.setVisible(false);
      n.markIntensity = 0;
    }
    const root = g.player.model.root;
    root.rotation.order = 'XYZ';
    root.rotation.x = 0;
  }

  /** Promesa que se cumple cuando `test()` es verdadero (se comprueba cada frame). */
  _wait(test, token) {
    return new Promise((resolve, reject) => {
      if (token.cancelled) return reject(new StoryAbort());
      this._waiters.push({ test, resolve, reject, token });
    });
  }

  // ------------------------------------------------------------------ Frame
  update(dt) {
    if (!this.active) return;
    this.time += dt * this.speed;
    const g = this.game;
    // Mantener Espacio o Intro salta la cinemática (en tiempo real: con pocos
    // FPS el tiempo de juego va más lento y la pulsación no debe alargarse)
    if (!this.skipping) {
      const inp = g.input;
      const holding = this.canSkip && (inp._down.has('Space') || inp._down.has('Enter') || inp._down.has('NumpadEnter'));
      const now = performance.now();
      if (!holding) this._skipHold = 0;
      else if (!this._skipHold) this._skipHold = now;
      const progress = this._skipHold ? (now - this._skipHold) / 1000 / SKIP_HOLD : 0;
      this.ui.skipHint(this.canSkip, progress);
      if (progress >= 1) this.skip();
    }
    this.resolved = 0;
    const ws = this._waiters;
    for (let i = ws.length - 1; i >= 0; i--) {
      const w = ws[i];
      if (w.token.cancelled) {
        ws.splice(i, 1);
        w.reject(new StoryAbort());
        continue;
      }
      let ok = false;
      try {
        ok = w.test();
      } catch (e) {
        ws.splice(i, 1);
        w.reject(e);
        continue;
      }
      if (ok) {
        ws.splice(i, 1);
        w.resolve(ok);
        this.resolved++;
      }
    }
    for (const f of [...this._updates]) f(dt);
    if (this._sub && this.time >= this._sub.until) {
      this.ui.subtitle(null);
      this._sub = null;
    }
    this._applyInput();
    this._updateStealth(dt);
    if (!this._loading && g.player.motor.position.y < this.fallY && !g.playerCombat.dead) this.reload('Has caído');
    // La lluvia sigue a la cámara
    const rain = this.map?.rain;
    if (rain) {
      rain.center.x = g.camera.position.x;
      rain.center.y = g.camera.position.y - 12;
      rain.center.z = g.camera.position.z;
    }
    g.ui.updateMarkers(this.markers, g.camera, g.player.motor.position);
  }

  /** Hay una cinemática que se puede saltar (sin elección abierta ni carga en curso). */
  get canSkip() {
    return this.active && this.controlsLocked && !this.modal && !this._loading && !this.skipping;
  }

  /** Empieza a saltar la cinemática actual (pantalla en negro y sin sonido). */
  skip() {
    if (!this.canSkip) return false;
    this.skipping = true;
    this._skipHold = 0;
    this._skipStart = this.time;
    this.ui.skipHint(false, 0);
    this.ui.skipping(true);
    this.game.audio.setMuted?.(true);
    this.game.events.emit('story:skip', { checkpoint: this.current?.id });
    return true;
  }

  /** Termina el salto: se recupera el control (o hay que elegir, o cambia el mapa). */
  endSkip() {
    if (!this.skipping) return;
    this.skipping = false;
    this.ui.skipping(false);
    this.ui.subtitle(null);
    this._sub = null;
    this.game.audio.setMuted?.(false);
    this.game.input.clear();
    this.game.events.emit('story:skip-end', { checkpoint: this.current?.id });
  }

  /** ¿Debe seguir el salto? (si no, se termina). Lo consulta GameManager en cada paso. */
  skipShouldContinue() {
    return this.active && this.controlsLocked && !this.modal && !this._loading && this.time - this._skipStart < 900;
  }

  /** Acciones bloqueadas: poderes no enseñados todavía y, en cinemáticas, todos. */
  _applyInput() {
    const b = this.game.input.blocked;
    b.clear();
    for (const a of POWER_ACTIONS) if (this.controlsLocked || !this.allowed.has(a)) b.add(a);
    for (const a of this.extraBlocked) b.add(a);
    if (this.controlsLocked) b.add('melee');
  }

  // ------------------------------------------------------------------ Sigilo
  /**
   * Activa el sigilo: guardias con cono de visión y focos. Agachado (C) se
   * le ve menos y más tarde; el foco multiplica la detección. Si cualquier
   * medidor llega a 1, «Te han descubierto» y se recarga el punto de control.
   */
  setStealth(cfg) {
    this.stealth = cfg ? { guards: cfg.guards ?? [], lights: cfg.lights ?? [], lightMeter: 0, lit: false } : null;
    if (!cfg) this.ui.detection(null);
  }

  /** Línea de visión entre dos puntos (las vallas y farolas no tapan). */
  _los(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dz = b.z - a.z;
    const d = Math.hypot(dx, dy, dz);
    if (d < 0.01) return true;
    const hit = this.game.world.raycastHit(a, { x: dx / d, y: dy / d, z: dz / d }, d - 0.3, { cameraOnly: true, ignoreTags: ['bounds'] });
    return !hit;
  }

  _updateStealth(dt) {
    const st = this.stealth;
    if (!st) return;
    const g = this.game;
    if (this.controlsLocked || this._loading) {
      this.ui.detection(null);
      return;
    }
    const p = g.player.motor.position;
    const crouched = g.player.crouched || !!g.player.cover;
    const chest = { x: p.x, y: p.y + (crouched ? 0.75 : 1.3), z: p.z };
    let lit = false;
    for (const l of st.lights) {
      if (!l.active) continue;
      if (Math.hypot(l.spot.x - p.x, l.spot.z - p.z) < l.radius && Math.abs(p.y - l.groundY) < 3 && this._los(l.origin, chest)) lit = true;
    }
    st.lit = lit;
    let max = 0;
    for (const gd of st.guards) {
      if (!gd.active) continue;
      const e = gd.eye;
      const dx = p.x - e.x;
      const dz = p.z - e.z;
      const dist = Math.hypot(dx, dz);
      let rate = 0;
      if (dist < gd.range * 1.3 + 2 && Math.abs(p.y - gd.position.y) < 4) {
        let ang = Math.atan2(dx, dz) - gd.yaw;
        ang = Math.atan2(Math.sin(ang), Math.cos(ang));
        const could = (Math.abs(ang) <= gd.fov && dist <= gd.range * 1.3) || dist <= STEALTH.hearRange;
        const los = could ? this._los(e, chest) : false;
        rate = detectionRate({ dist, angle: ang, range: gd.range, fov: gd.fov, los, crouched, lit });
        // Oír exige estar en el mismo espacio (sin muro de por medio)
        if (!los && dist <= STEALTH.hearRange) rate = 0;
      }
      gd.meter = stepMeter(gd.meter, rate, dt);
      max = Math.max(max, gd.meter);
    }
    // El operador del foco también da la alarma si se queda en la luz
    st.lightMeter = stepMeter(st.lightMeter, lit ? (crouched ? 0.45 : 0.85) : 0, dt);
    max = Math.max(max, st.lightMeter);
    this.ui.detection(max);
    if (max >= 1) {
      g.events.emit('story:detected', {});
      this.reload('Te han descubierto');
    }
  }

  // ------------------------------------------------------------------ Ayudas
  /** Personaje del guion (se crea en el mapa actual y se libera con él). */
  spawnNpc(id, o) {
    const cur = this.game.mapManager.current;
    const old = this.npcs.get(id);
    if (old) {
      old.place({ x: o.x, y: o.y ?? old._ground(o.x, o.z, 50), z: o.z }, o.yaw ?? old.yaw);
      old.setVisible(true);
      old.setPose('stand');
      old.lookAt(null);
      old.markIntensity = 0;
      return old;
    }
    const ctx = { group: cur.group, world: this.game.world, vfx: this.game.vfx };
    const npc = new Npc(ctx, { id, ...o });
    if (o.y === undefined) npc.place({ x: o.x, y: npc._ground(o.x, o.z, 50), z: o.z });
    cur.entities.push(npc);
    this.npcs.set(id, npc);
    return npc;
  }

  /** Dirección del dash asistida hacia el marcador del hueco más cercano. */
  assistDash(dir) {
    const a = this.dashAssist;
    if (!a) return dir;
    const p = this.game.player.motor.position;
    for (const gp of a.gaps) {
      if (p.x < gp.from - 7 || p.x > gp.to - 0.5) continue;
      if (dir.x <= 0.2) continue; // solo si va hacia delante (este)
      const tx = gp.to + 2.6 - p.x;
      const tz = 0 - p.z;
      const l = Math.hypot(tx, tz) || 1;
      return new THREE.Vector3(tx / l, 0, tz / l);
    }
    return dir;
  }
}

/**
 * Ayudas del guion para un tramo. Todo lo que espera comprueba si el tramo
 * se ha cancelado (y entonces lanza StoryAbort para cortar el guion).
 */
export class Script {
  constructor(director, token) {
    this.d = director;
    this.g = director.game;
    this.token = token;
  }

  get points() {
    return this.d.points;
  }

  get map() {
    return this.d.map;
  }

  get state() {
    return this.d.state;
  }

  get player() {
    return this.g.player;
  }

  get pos() {
    return this.g.player.motor.position;
  }

  check() {
    if (this.token.cancelled) throw new StoryAbort();
  }

  until(test) {
    return this.d._wait(test, this.token);
  }

  wait(sec) {
    const end = this.d.time + sec;
    return this.until(() => this.d.time >= end);
  }

  /** Espera a una promesa sin perder la cancelación. */
  await(promise) {
    let done = false;
    let value;
    promise.then((v) => {
      done = true;
      value = v;
    });
    return this.until(() => done).then(() => value);
  }

  /** Línea de diálogo (espera a que se lea). */
  async say(speaker, text, secs = lineTime(text)) {
    this.check();
    this.d._sub = null;
    this.d.ui.subtitle(speaker, text);
    this.g.events.emit('story:line', { speaker, text });
    await this.wait(secs);
    this.d.ui.subtitle(null);
  }

  /** Línea de diálogo sin esperar (durante el juego). */
  line(speaker, text, secs = lineTime(text)) {
    this.check();
    this.d.ui.subtitle(speaker, text);
    this.d._sub = { until: this.d.time + secs };
    this.g.events.emit('story:line', { speaker, text });
  }

  async talk(lines) {
    for (const [speaker, text, secs] of lines) await this.say(speaker, text, secs);
  }

  objective(text, extra = []) {
    const cp = this.d.current;
    this.d.ui.objective(text ? { mission: STORY_MISSIONS[cp?.mission] ?? '', text, extra } : null);
  }

  markers(list) {
    this.d.markers = list.map((m) => ({ x: m.x, y: (m.y ?? 0) + 2.4, z: m.z, label: m.label ?? '', kind: m.kind ?? 'giver' }));
  }

  tutorial(title, text = '') {
    this.d.ui.tutorial(title, text);
    if (title) this.g.events.emit('story:tutorial', { title });
  }

  lock(v = true) {
    this.d.controlsLocked = v;
    if (v) {
      this.g.player.autopilot = null;
      this.g.player.aiming = false;
    }
  }

  letterbox(v) {
    this.d.ui.letterbox(v);
  }

  /** Poderes permitidos a partir de ahora (además de los del punto de control). */
  allow(...actions) {
    for (const a of actions) this.d.allowed.add(a);
  }

  block(...actions) {
    for (const a of actions) this.d.extraBlocked.add(a);
  }

  unblock(...actions) {
    for (const a of actions) this.d.extraBlocked.delete(a);
  }

  shot(from, to = null, dur = 0) {
    this.g.cameraController.setShot(from, to, dur);
  }

  release() {
    this.g.cameraController.setShot(null);
    this.g.player.lookLocked = false;
  }

  async fade(alpha, ms = 600, text = '') {
    this.check();
    this.d.ui.fadeTo(alpha, ms, text);
    await this.wait(ms / 1000 + 0.05);
  }

  async dayCard(title, sub = '', ms = 2200) {
    // Al saltar la escena la tarjeta no se espera (el tiempo es real, no de juego)
    if (this.d.skipping) return;
    await this.await(this.d.ui.dayCard(title, sub, ms));
  }

  /** Pantalla de elección: se libera el puntero para poder hacer clic (sin pausar). */
  async choice(title, options) {
    this.d.modal = true;
    this.g.input.exitPointerLock();
    this.g.events.emit('story:choice', { title, options: options.map((o) => o.label) });
    const i = await this.await(this.d.ui.choice(title, options));
    this.d.modal = false;
    this.g.input.requestPointerLock();
    return i;
  }

  /** Efecto de sonido del guion. */
  sfx(name, pos = null) {
    this.g.events.emit('story:sfx', { name, pos });
  }

  /** Sonido continuo del guion (alarma, lluvia, tormenta). */
  loop(name, on) {
    this.g.events.emit('story:loop', { name, on });
  }

  reach(id) {
    this.d.reach(id);
  }

  npc(id, o) {
    return this.d.spawnNpc(id, o);
  }

  /** Cada frame mientras dure el tramo (devuelve una función para quitarlo). */
  every(fn) {
    this.d._updates.push(fn);
    return () => {
      this.d._updates = this.d._updates.filter((f) => f !== fn);
    };
  }

  /** Punto de interacción (E). Se cumple al pulsar E cerca. */
  async interact(p, label, radius = 2.2) {
    let done = false;
    const it = this.g.interactions.add({ position: { x: p.x, y: (p.y ?? 0) + 1, z: p.z }, radius, label, onInteract: () => (done = true) });
    this.d._interactions.push(it);
    try {
      await this.until(() => done);
    } finally {
      this.g.interactions.remove(it);
      this.d._interactions = this.d._interactions.filter((x) => x !== it);
    }
  }

  /** Quita el fundido a negro si lo hay (al empezar cada tramo). */
  async fadeIn(ms = 700) {
    if (Number(this.d.ui.fadeEl.style.opacity || 0) > 0.01) await this.fade(0, ms);
  }

  /** ¿Está Jon a menos de `r` metros (en horizontal) de `p`? */
  isNear(p, r = 2, dy = 3) {
    const q = this.pos;
    return Math.hypot(q.x - p.x, q.z - p.z) <= r && Math.abs(q.y - (p.y ?? q.y)) <= dy;
  }

  near(p, r = 2, dy = 3) {
    return this.until(() => this.isNear(p, r, dy));
  }

  /** Jon camina (o corre) solo hasta un punto (cinemáticas). */
  async walkTo(p, { sprint = false, radius = 0.35 } = {}) {
    const ap = { x: p.x, z: p.z, sprint, radius, done: false };
    this.g.player.autopilot = ap;
    try {
      await this.until(() => ap.done);
    } finally {
      if (this.g.player.autopilot === ap) this.g.player.autopilot = null;
    }
  }

  /** Coloca a Jon (sin animación). */
  place(p) {
    this.g.player.spawnAt(p);
  }

  /** Cambia de mapa a mitad del guion (fundido a negro). */
  async loadMap(id, at, text = '') {
    const g = this.g;
    await this.fade(1, 500, text);
    const health = g.playerCombat.health.value;
    const charge = g.powers.energy.value;
    g._loadMap(id);
    this.d._applyProfile();
    g.playerCombat.setHealth(Math.max(1, health));
    g.powers.energy.value = Math.min(g.powers.energy.max, charge);
    const p = this.points[at];
    if (p) g.player.spawn(p);
    this.check();
  }

  /** Carga de Energía de Jon. */
  setCharge(v) {
    this.g.powers.energy.value = Math.min(this.g.powers.energy.max, v);
  }

  setStealth(cfg) {
    this.d.setStealth(cfg);
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
