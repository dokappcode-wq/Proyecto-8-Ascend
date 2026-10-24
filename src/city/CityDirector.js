import { StoryDirector, Script, StoryAbort } from '../story/StoryDirector.js';
import { POWER_ACTIONS } from '../story/storyData.js';
import { createCityState, missionAvailable, districtControl, MEDALS } from './CityState.js';

/** Etiqueta de los enemigos y accesorios de una misión (se retiran al terminarla o fallarla). */
export const MISSION_TAG = 'mision';

/** Distancia a la que se ven los marcadores de cada tipo de misión (m). */
const SHOW = { story: Infinity, side: 380, act: 260, event: 300 };
/** Radio para empezar una misión con E (m). */
const START_RADIUS = 4;

/**
 * CityDirector — la campaña de Ibaia (mundo abierto).
 *
 * Usa el motor del prólogo (diálogos, cinemáticas, sigilo, marcadores,
 * elecciones, saltar escenas) pero sin puntos de control lineales:
 *  - Las misiones se empiezan en su marcador con E (las de historia se ven
 *    siempre; las secundarias y actividades, al acercarse).
 *  - Cada misión es un guion asíncrono con sus propios puntos de control.
 *    Al fallar (caída, detección, tiempo…) no se vuelve a montar la ciudad:
 *    se retira lo que la misión creó y se repite desde su punto de control.
 *  - Las actividades son misiones repetibles con medalla; al fallarlas se
 *    terminan sin medalla.
 *  - Sucesos: pequeñas misiones que aparecen solas por la calle.
 *  - Estado en `save.data.city` (ver CityState.js).
 */
export class CityDirector extends StoryDirector {
  constructor(game) {
    super(game);
    if (!game.save.data.city) game.save.data.city = createCityState();
    this.fallY = -80;
    /** Misiones registradas por id. */
    this.registry = new Map();
    /** Barrios con campaña: id → { id, name, content, streets, places, safehouse, setup, events } */
    this.districts = new Map();
    /** Misión en curso: { def, step, inst } */
    this.mission = null;
    this._props = [];
    /** Accesorios fijos de los barrios (cabinas…), creados al cargar la ciudad. */
    this._world = [];
    /** Personajes que dan misiones, colocados en la calle. */
    this._givers = new Set();
    this._idleIts = [];
    this._idleT = 0;
    this._eventT = 60;
    this._obj = null;
    this._timer = null;
    this._objT = 0;
    this._control = new Map();
    this._hud = null;
  }

  /** Estado de la campaña (objeto guardado; se modifica en el sitio). */
  get state() {
    return this.game.save.data.city;
  }

  /** Puntos con nombre del barrio actual del guion (para las ayudas heredadas). */
  get points() {
    return {};
  }

  get map() {
    return this.game.mapManager.current?.story ?? null;
  }

  /** Registra un barrio y sus misiones. */
  register(district) {
    this.districts.set(district.id, district);
    for (const def of district.missions) {
      def.district = district.id;
      this.registry.set(def.id, def);
    }
  }

  /** Misiones que se pueden empezar ahora. */
  available() {
    const st = this.state;
    return [...this.registry.values()].filter((d) => d.kind !== 'event' && missionAvailable(st, d));
  }

  /** Control de la PDC de un barrio con campaña (0..100) o null. */
  control(id) {
    const d = this.districts.get(id);
    return d ? districtControl(this.state, id, d.content) : null;
  }

  // ------------------------------------------------------------------ Ciclo de vida
  /** Empieza (o reanuda) la campaña al cargar Ibaia. */
  begin() {
    const st = this.state;
    st.started = true;
    this.active = true;
    this.time = 0;
    this.mission = null;
    this.ui.setVisible(true);
    this._ensureHud();
    this._world = [];
    this._givers.clear();
    for (const d of this.districts.values()) d.setup?.(this.game, this);
    for (const [id] of this.districts) this._control.set(id, this.control(id));
    this._applyLiberation(false);
    this.game.save.save();
    // Misión a medias: se retoma en su punto de control
    if (st.active && this.registry.has(st.active.id)) {
      const def = this.registry.get(st.active.id);
      setTimeout(() => this.active && !this.mission && this.start(def, { step: st.active.step, resume: true }), 600);
    }
  }

  /** Sale de la campaña (otro mapa o menú). */
  stop() {
    if (!this.active) return;
    this.endSkip();
    this._abort();
    this.mission = null;
    this._clearIdle();
    this.active = false;
    this.ui.setVisible(false);
    this._hud?.classList.add('off');
    this.game.input.blocked.clear();
    this.game.ui.updateMarkers([], this.game.camera);
  }

  /** La ciudad usa el perfil normal (marcas del modo libre). */
  _applyProfile() {}

  /** Bloqueos de entrada: solo en cinemáticas y lo que pida la misión. */
  _applyInput() {
    const b = this.game.input.blocked;
    b.clear();
    if (this.controlsLocked) {
      for (const a of POWER_ACTIONS) b.add(a);
      b.add('melee');
    }
    for (const a of this.extraBlocked) b.add(a);
  }

  // ------------------------------------------------------------------ Misiones
  /**
   * Empieza una misión. `o`: { step, inst (sitio de actividad), resume, at (dónde sucede) }.
   */
  start(def, o = {}) {
    if (!this.active || this.mission || this._loading) return false;
    this._clearIdle();
    this.markers = [];
    const step = o.step ?? 0;
    this.mission = { def, step, inst: o.inst ?? 0, at: o.at ?? null, startedAt: this.time };
    if (def.kind === 'story' || def.kind === 'side') {
      this.state.active = { id: def.id, step };
      this.game.save.save();
    }
    this.game.events.emit('city:mission-start', { id: def.id, kind: def.kind, step });
    if (def.kind !== 'event') this.game.events.emit('story:sfx', { name: 'missionStart' });
    if (def.kind !== 'event') this.ui.fadeTo(0, 0);
    this._runMission(o.resume ? 'resume' : 'start');
    return true;
  }

  _runMission(how) {
    const m = this.mission;
    const token = { cancelled: false };
    this._token = token;
    const S = new CityScript(this, token, m);
    this.allowed = new Set(POWER_ACTIONS);
    this.running = (async () => {
      try {
        const res = await m.def.run(S, { step: m.step, inst: m.inst, at: m.at, retry: how !== 'start' });
        S.check();
        this._complete(m, res ?? {});
      } catch (e) {
        if (!(e instanceof StoryAbort)) {
          console.error(e);
          this.game.events.emit('city:error', { id: m.def.id, error: String(e) });
          this._abort();
          if (this.mission === m) this.mission = null;
        }
      }
    })();
  }

  /** Guarda el punto de control de la misión en curso. */
  reach(step) {
    const m = this.mission;
    if (!m) return;
    m.step = step;
    const g = this.game;
    this.state.snapshot = { health: Math.max(1, Math.round(g.playerCombat.health.value)), charge: Math.round(g.powers.energy.value) };
    if (this.state.active?.id === m.def.id) this.state.active.step = step;
    g.save.save();
    g.events.emit('city:checkpoint', { id: m.def.id, step });
  }

  _complete(m, res) {
    const g = this.game;
    const def = m.def;
    const st = this.state;
    this._cleanupBeat();
    this.mission = null;
    if (st.active?.id === def.id) st.active = null;
    let sub = '';
    if (def.kind === 'story' || def.kind === 'side') {
      st.done[def.id] = true;
      sub = def.kind === 'story' ? `Historia · ${def.n}/10` : 'Secundaria';
    } else if (def.kind === 'act') {
      const key = `${def.act}-${m.inst}`;
      const medal = res.medal ?? 0;
      st.acts[key] = Math.max(st.acts[key] ?? 0, medal);
      sub = `${MEDALS[medal]}${res.score ? ` · ${res.score}` : ''}`;
    } else if (def.kind === 'event') {
      if (res.ok !== false) st.events[def.district] = (st.events[def.district] ?? 0) + 1;
      sub = res.ok === false ? 'Se ha ido' : 'Suceso resuelto';
    }
    g.save.save();
    if (def.kind === 'act' && !(res.medal > 0)) g.ui.toast(def.title, res.reason ?? 'Sin medalla · inténtalo otra vez', 2600);
    else if (def.kind === 'event') g.ui.toast(def.title, sub, 2200);
    else this.ui.dayCard(def.kind === 'act' ? 'ACTIVIDAD COMPLETADA' : 'MISIÓN COMPLETADA', `${def.title} · ${sub}`, 2600);
    g.events.emit('city:mission-complete', { id: def.id, kind: def.kind, inst: m.inst, result: res });
    if (def.kind !== 'event') g.events.emit('story:sfx', { name: 'missionComplete' });
    this._refreshControl(true);
    this._idleT = 0;
  }

  /** Reintentar desde la pausa: las actividades vuelven a empezar; las misiones, desde su punto de control. */
  retry() {
    const m = this.mission;
    if (!m) return;
    if (m.def.kind === 'act') {
      this._abort();
      this.mission = null;
      this.start(m.def, { inst: m.inst });
    } else if (m.def.kind === 'event') this.abandon('');
    else this.reload('');
  }

  /** Termina la misión en curso sin completarla (abandonar, o actividad fallida). */
  abandon(reason = '') {
    const m = this.mission;
    if (!m) return;
    this._abort();
    this.mission = null;
    if (this.state.active?.id === m.def.id) this.state.active = null;
    this.game.save.save();
    if (reason) this.game.ui.toast(m.def.title, reason, 2400);
    this.game.events.emit('city:mission-abandon', { id: m.def.id, reason });
    this._idleT = 0;
  }

  /**
   * Misión fallida: fundido, se retira lo que creó y se repite desde su
   * punto de control (las actividades y sucesos se terminan sin más).
   */
  async reload(reason = '') {
    const m = this.mission;
    if (this._loading || !this.active || !m) return;
    const g = this.game;
    if (m.def.kind === 'act' || m.def.kind === 'event') {
      this._revive();
      this.abandon(reason ? `${reason} · actividad fallida` : 'Actividad fallida');
      return;
    }
    this._loading = true;
    this._abort();
    this.controlsLocked = true;
    g.input.clear();
    g.events.emit('city:fail', { id: m.def.id, reason, step: m.step });
    this.ui.fadeTo(1, 450, reason ? `${reason} · ${m.def.title}` : m.def.title);
    await sleep(reason ? 1200 : 600);
    if (!this.active || this.mission !== m) {
      this._loading = false;
      return;
    }
    this._revive();
    const snap = this.state.snapshot;
    g.playerCombat.setHealth(Math.max(40, snap.health ?? 100));
    g.powers.energy.value = Math.min(g.powers.energy.max, Math.max(40, snap.charge ?? 0));
    g.factions?.reputation?.reset?.(g.mapManager.current?.def.factions ?? {});
    g.enemies.forgetTarget();
    this.controlsLocked = false;
    this._runMission('retry');
    await sleep(250);
    this.ui.fadeTo(0, 600);
    this._loading = false;
  }

  _revive() {
    const pc = this.game.playerCombat;
    if (pc.dead) {
      pc.dead = false;
      pc.restore();
      this.game.player.model.root.rotation.x = 0;
      this.game.events.emit('player:respawned', { afterDeath: true });
    }
  }

  onPlayerDied() {
    if (this.mission) {
      this.reload('Has caído');
      return;
    }
    // Fuera de misión: de vuelta al piso franco (o a la llegada)
    this._respawnSafe();
  }

  async _respawnSafe() {
    if (this._loading) return;
    this._loading = true;
    this.ui.fadeTo(1, 400, 'Has caído');
    await sleep(1000);
    this._revive();
    const g = this.game;
    g.playerCombat.setHealth(g.playerCombat.health.max);
    const d = this.districts.get(this._districtId()) ?? [...this.districts.values()][0];
    const p = d?.safehouse?.(this) ?? g.mapManager.current?.spawn;
    if (p) g.player.spawnAt(p);
    g.enemies.forgetTarget();
    g.factions?.reputation?.reset?.(g.mapManager.current?.def.factions ?? {});
    await sleep(200);
    this.ui.fadeTo(0, 600);
    this._loading = false;
  }

  _districtId() {
    const adm = this.game.mapManager.current?.admin;
    const p = this.game.player.motor.position;
    return adm?.districtAt(p.x, p.z)?.id ?? null;
  }

  /** Deja todo lo temporal de la misión como estaba. */
  _cleanupBeat() {
    super._cleanupBeat();
    const g = this.game;
    g.enemies.clear(MISSION_TAG);
    for (const p of this._props) {
      p.dispose?.();
      p.removeFromParent?.();
      if (p.object3d) p.object3d.removeFromParent();
    }
    this._props = [];
    this._obj = null;
    this._timer = null;
    this._photo = null;
  }

  // ------------------------------------------------------------------ Frame
  update(dt) {
    if (!this.active) return;
    if (!this.mission && !this._loading && this.game.state === 'playing') this._idle(dt);
    // Los accesorios van al ritmo del guion (las pruebas lo aceleran)
    const sdt = dt * this.speed;
    for (const p of this._world) p.update?.(sdt);
    for (const p of this._props) p.update?.(sdt);
    super.update(dt);
    this._objT -= dt;
    if (this._objT <= 0) {
      this._objT = 0.2;
      this._renderObjective();
      this._renderHud();
    }
  }

  /** Objetivo con su temporizador (si lo hay). */
  _renderObjective() {
    if (!this._obj) return;
    const t = this._timer;
    const left = t ? Math.max(0, t.end - this.time) : null;
    const timer = left !== null ? `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}` : undefined;
    this.ui.objective({ mission: this._obj.mission, text: this._obj.text, extra: this._obj.extra, timer });
  }

  /** Sin misión: marcadores de lo disponible, empezar con E y sucesos. */
  _idle(dt) {
    this._idleT -= dt;
    if (this._idleT > 0) return;
    this._idleT = 0.5;
    const g = this.game;
    const p = g.player.motor.position;
    const list = [];
    for (const def of this.available()) {
      const spots = def.kind === 'act' ? (def.spots?.(this) ?? []) : [def.where?.(this)].filter(Boolean);
      spots.forEach((s, inst) => {
        if (!s) return;
        const d = Math.hypot(s.x - p.x, s.z - p.z);
        if (d > SHOW[def.kind]) return;
        const medal = def.kind === 'act' ? this.state.acts[`${def.act}-${inst}`] ?? 0 : 0;
        list.push({ def, inst, x: s.x, y: s.y ?? 0, z: s.z, d, medal });
      });
    }
    // Un solo marcador por actividad en pantalla: el sitio más cercano (más los muy cercanos)
    const shown = [];
    const seenAct = new Set();
    list.sort((a, b) => a.d - b.d);
    for (const m of list) {
      if (m.def.kind === 'act') {
        if (seenAct.has(m.def.act) && m.d > 60) continue;
        seenAct.add(m.def.act);
      }
      shown.push(m);
    }
    // De lejos solo se ve el rombo (la historia lleva siempre su nombre)
    this.markers = shown.map((m) => ({
      x: m.x, y: m.y + 2.6, z: m.z,
      label: m.def.kind === 'story' ? `★ ${m.def.title}` : m.d > 120 ? '' : m.def.kind === 'act' ? `${m.def.title}${m.medal ? ` · ${MEDALS[m.medal]}` : ''}` : m.def.title,
      kind: `city-${m.def.kind}`,
    }));
    // Quien da cada secundaria espera en su sitio
    this._placeGivers(shown);
    // Interacción para empezar (solo las cercanas)
    this._clearIdle();
    for (const m of shown) {
      if (m.d > 40) continue;
      const it = g.interactions.add({
        position: { x: m.x, y: m.y + 1, z: m.z },
        radius: START_RADIUS,
        label: `Empezar · ${m.def.title}`,
        onInteract: () => this.start(m.def, { inst: m.inst }),
      });
      this._idleIts.push(it);
    }
    // Misiones que empiezan solas al llegar (la primera de la historia)
    for (const def of this.available()) {
      if (!def.auto) continue;
      const s = def.where?.(this);
      if (!s || Math.hypot(s.x - p.x, s.z - p.z) < (def.autoRadius ?? 60)) {
        this.start(def);
        return;
      }
    }
    this._maybeEvent(0.5);
  }

  _placeGivers(shown) {
    const want = new Set();
    for (const m of shown) {
      if (m.def.kind !== 'side' || !m.def.giver || m.d > 150) continue;
      const d = this.districts.get(m.def.district);
      const c = d?.cast?.[m.def.giver];
      if (!c) continue;
      const id = `giver-${m.def.id}`;
      want.add(id);
      if (!this._givers.has(id) || this.npcs.get(id)?.hidden) {
        const npc = this.spawnNpc(id, { name: c.name, palette: c.palette, variant: c.variant ?? 'incarnation', scale: c.scale ?? 1, x: m.x, z: m.z, yaw: m.def.where?.(this)?.yaw ?? 0 });
        npc.setVisible(true);
        this._givers.add(id);
      }
    }
    for (const id of this._givers) {
      if (want.has(id)) continue;
      this.npcs.get(id)?.setVisible(false);
      this._givers.delete(id);
    }
  }

  _clearIdle() {
    for (const it of this._idleIts) this.game.interactions.remove(it);
    this._idleIts = [];
  }

  /** Sucesos: cada cierto tiempo, uno al azar del barrio en el que está Jon. */
  _maybeEvent(dt) {
    this._eventT -= dt;
    if (this._eventT > 0) return;
    this._eventT = 70 + Math.random() * 60;
    const id = this._districtId();
    const d = this.districts.get(id);
    if (!d?.events?.length) return;
    const ok = d.events.filter((e) => missionAvailable(this.state, { ...e, repeat: true }));
    if (!ok.length) return;
    const def = ok[Math.floor(Math.random() * ok.length)];
    const at = def.place?.(this);
    if (at) this.start(def, { at });
  }

  /** Forzar un suceso ahora (administración y pruebas). */
  triggerEvent(id) {
    const def = this.registry.get(id);
    if (!def || this.mission) return false;
    const at = def.place?.(this);
    return at ? this.start(def, { at }) : false;
  }

  // ------------------------------------------------------------------ Control de la PDC
  _refreshControl(announce) {
    for (const [id, d] of this.districts) {
      const before = this._control.get(id);
      const now = this.control(id);
      this._control.set(id, now);
      if (announce && before !== now) {
        this.game.events.emit('city:control', { id, from: before, to: now });
        if (now === 0 && before > 0) {
          this.ui.dayCard('BARRIO LIBERADO', `${d.name} ya no está bajo la PDC · metro abierto`, 3200);
          this.state.flags[`liberado:${id}`] = true;
          this.game.save.save();
        }
      }
    }
    this._applyLiberation(announce);
  }

  /** Los barrios liberados se quedan sin patrullas de la PDC. */
  _applyLiberation() {
    const pop = this.game.mapManager.current?.admin?.population;
    if (!pop) return;
    pop.liberated = new Set([...this._control].filter(([, v]) => v === 0).map(([k]) => k));
  }

  _ensureHud() {
    if (this._hud) {
      this._hud.classList.remove('off');
      return;
    }
    const el = document.createElement('div');
    el.id = 'city-control';
    el.className = 'city-control';
    document.getElementById('hud')?.appendChild(el);
    this._hud = el;
  }

  _renderHud() {
    const el = this._hud;
    if (!el) return;
    const id = this._districtId();
    const d = this.districts.get(id);
    if (!d || this.mission) {
      el.classList.add('off');
      return;
    }
    const c = this._control.get(id) ?? this.control(id);
    const key = `${id}:${c}`;
    el.classList.remove('off');
    if (el.dataset.key === key) return;
    el.dataset.key = key;
    el.innerHTML = c === 0
      ? `<b>${d.name}</b><span>Liberado</span>`
      : `<b>${d.name}</b><span>Control de la PDC ${c} %</span><div class="bar"><div style="width:${c}%"></div></div>`;
  }
}

/**
 * Ayudas del guion para una misión de la ciudad (además de las del prólogo:
 * say, talk, wait, until, near, interact, lock, shot, choice, npc…).
 */
export class CityScript extends Script {
  constructor(director, token, mission) {
    super(director, token);
    this.mission = mission;
    this.def = mission.def;
    this.district = director.districts.get(mission.def.district);
  }

  get streets() {
    return this.district.streets;
  }

  /** Punto con nombre del barrio (en la acera). */
  at(key) {
    return this.district.place(key);
  }

  objective(text, extra = [], o = {}) {
    const d = this.d;
    d._obj = text ? { mission: o.mission ?? this.def.title, text, extra } : null;
    if (!text) d.ui.objective(null);
    else d._renderObjective();
  }

  /** Cuenta atrás: si llega a cero, la misión falla con `reason`. Devuelve una función para pararla. */
  countdown(sec, reason = 'Se acabó el tiempo') {
    const d = this.d;
    const t = { end: d.time + sec };
    d._timer = t;
    const off = this.every(() => {
      if (d._timer !== t) return off();
      if (d.time >= t.end) {
        off();
        this.fail(reason);
      }
    });
    return () => {
      if (d._timer === t) d._timer = null;
      off();
    };
  }

  /** Segundos que le quedan a la cuenta atrás (o null). */
  get timeLeft() {
    const t = this.d._timer;
    return t ? Math.max(0, t.end - this.d.time) : null;
  }

  reach(step) {
    this.d.reach(step);
  }

  fail(reason) {
    this.d.reload(reason);
  }

  /** Enemigo de la misión: siempre hostil y se retira al terminar. */
  enemy(type, p, o = {}) {
    const e = this.g.enemies.spawn(type, { x: p.x, y: p.y ?? 0.2, z: p.z, yaw: p.yaw ?? 0, tag: MISSION_TAG, ...o });
    e.forceHostile = o.calm ? false : true;
    if (o.alert !== false && !o.dormant && !o.calm) e.alertTo(this.pos);
    return e;
  }

  /** Espera a que no quede ninguno vivo de la lista. */
  defeated(list) {
    return this.until(() => list.every((e) => !e.alive));
  }

  alive(list) {
    return list.filter((e) => e.alive).length;
  }

  /** Accesorio de la misión (Object3D o { object3d, dispose }) añadido al mapa. */
  prop(obj) {
    const root = obj.object3d ?? obj;
    this.g.mapManager.current.group.add(root);
    this.d._props.push(obj);
    return obj;
  }

  /** Marcadores en pantalla para la misión. */
  markers(list) {
    this.d.markers = list.map((m) => ({ x: m.x, y: (m.y ?? 0) + 2.4, z: m.z, label: m.label ?? '', kind: m.kind ?? 'target' }));
  }

  /** La Centralita habla por teléfono (sin bloquear). */
  phone(text, secs) {
    this.line('CENTRALITA', text, secs);
  }

  /** Jon llega al punto de control al reintentar (o al empezar, si `always`). */
  spawnIf(retry, p) {
    if (retry && p) this.place(p);
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
