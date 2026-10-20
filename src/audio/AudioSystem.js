import { spatialize } from './spatial.js';

/**
 * AudioSystem — sonido sintetizado en tiempo real con Web Audio (sin
 * archivos). Tres buses (efectos, ambiente, interfaz) bajo un volumen
 * general; los efectos en el mundo se atenúan y se panoramizan respecto a la
 * cámara. El contexto se crea con la primera interacción del usuario
 * (política de reproducción automática de los navegadores).
 *
 * Los sonidos se disparan desde eventos del EventBus (`attach`), de modo que
 * ningún sistema de juego depende del audio.
 */
export class AudioSystem {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
    this.available = typeof window !== 'undefined' && !!(window.AudioContext || window.webkitAudioContext);
    this.listener = { x: 0, y: 0, z: 0, yaw: 0 };
    /** Sonidos reproducidos por nombre (diagnóstico y pruebas). */
    this.stats = {};
    this._loops = new Map();
    this._last = {};
    this._ambience = null;
    this._paused = false;
  }

  /** Crea o reanuda el contexto (llamar desde un gesto del usuario). */
  unlock() {
    if (!this.available) return;
    if (!this.ctx) this._init();
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  get running() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  _init() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = (this.ctx = new Ctx());
    this.master = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);
    this.bus = { sfx: ctx.createGain(), amb: ctx.createGain(), ui: ctx.createGain() };
    for (const b of Object.values(this.bus)) b.connect(this.master);
    // Ruido blanco y marrón precalculados (2 s)
    const n = ctx.sampleRate * 2;
    this.white = ctx.createBuffer(1, n, ctx.sampleRate);
    this.brown = ctx.createBuffer(1, n, ctx.sampleRate);
    const w = this.white.getChannelData(0);
    const br = this.brown.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) {
      w[i] = Math.random() * 2 - 1;
      last = (last + 0.02 * w[i]) / 1.02;
      br[i] = last * 3.5;
    }
    this.applyVolumes();
    if (this._pendingAmbience) this.setAmbience(this._pendingAmbience);
  }

  applyVolumes() {
    if (!this.ctx) return;
    const s = this.settings;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.volumeMaster ?? 0.8, t, 0.05);
    this.bus.sfx.gain.setTargetAtTime(s.volumeSfx ?? 1, t, 0.05);
    this.bus.ui.gain.setTargetAtTime(s.volumeSfx ?? 1, t, 0.05);
    this.bus.amb.gain.setTargetAtTime(this._paused ? 0 : (s.volumeAmbience ?? 0.5), t, 0.2);
  }

  setPaused(p) {
    this._paused = p;
    if (p) for (const k of [...this._loops.keys()]) this.stopLoop(k);
    this.applyVolumes();
  }

  /** Posición y orientación del oyente (cámara). */
  setListener(pos, yaw) {
    this.listener.x = pos.x;
    this.listener.y = pos.y;
    this.listener.z = pos.z;
    this.listener.yaw = yaw;
  }

  /**
   * Reproduce un efecto.
   * @param {string} name receta de SFX
   * @param {object} [o] { pos (en el mundo), volume, bus: 'sfx'|'ui', throttle (s) }
   */
  play(name, o = {}) {
    const recipe = SFX[name];
    if (!recipe || !this.running) return false;
    const now = this.ctx.currentTime;
    if (o.throttle && now - (this._last[name] ?? -1) < o.throttle) return false;
    this._last[name] = now;
    let gain = o.volume ?? 1;
    let pan = 0;
    if (o.pos) {
      const s = spatialize(this.listener, o.pos);
      if (s.gain < 0.01) return false;
      gain *= s.gain;
      pan = s.pan;
    }
    const out = this.ctx.createGain();
    out.gain.value = gain;
    let node = out;
    if (pan !== 0 && this.ctx.createStereoPanner) {
      const p = this.ctx.createStereoPanner();
      p.pan.value = pan;
      out.connect(p);
      node = p;
    }
    node.connect(this.bus[o.bus ?? 'sfx']);
    recipe(this, out, now, o);
    this.stats[name] = (this.stats[name] ?? 0) + 1;
    return true;
  }

  /** Sonido continuo (carga, absorción). `value` 0..1 modula el tono. */
  loop(name, value = 0) {
    if (!this.running) return;
    let l = this._loops.get(name);
    if (!l) {
      const make = LOOPS[name];
      if (!make) return;
      const out = this.ctx.createGain();
      out.gain.value = 0;
      out.gain.setTargetAtTime(1, this.ctx.currentTime, 0.04);
      out.connect(this.bus.sfx);
      l = { out, ...make(this, out) };
      this._loops.set(name, l);
      this.stats[name] = (this.stats[name] ?? 0) + 1;
    }
    l.set?.(value);
  }

  stopLoop(name) {
    const l = this._loops.get(name);
    if (!l) return;
    this._loops.delete(name);
    const t = this.ctx.currentTime;
    l.out.gain.setTargetAtTime(0, t, 0.05);
    for (const s of l.sources) s.stop(t + 0.3);
  }

  /** Ambiente del mapa: 'city' | 'field' | null. */
  setAmbience(kind) {
    if (!this.ctx) {
      this._pendingAmbience = kind;
      return;
    }
    if (this._ambience?.kind === kind) return;
    const t = this.ctx.currentTime;
    if (this._ambience) {
      const old = this._ambience;
      old.out.gain.setTargetAtTime(0, t, 0.3);
      for (const s of old.sources) s.stop(t + 1.5);
    }
    this._ambience = null;
    if (!kind || !AMBIENCE[kind]) return;
    const out = this.ctx.createGain();
    out.gain.value = 0;
    out.gain.setTargetAtTime(1, t, 0.8);
    out.connect(this.bus.amb);
    this._ambience = { kind, out, ...AMBIENCE[kind](this, out) };
    this.stats[`amb:${kind}`] = (this.stats[`amb:${kind}`] ?? 0) + 1;
  }

  // ---------------------------------------------------------------- Eventos
  attach(game) {
    const g = game;
    const ev = g.events;
    const unlock = () => this.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    document.addEventListener('click', (e) => {
      if (e.target.closest?.('.menu-btn')) this.play('ui', { bus: 'ui' });
    });
    const at = (p, dy = 1) => (p ? { x: p.x, y: p.y + dy, z: p.z } : undefined);
    const me = () => at(g.player.motor.position);

    ev.on('player:step', (e) => this.play('step', { pos: me(), volume: e.speed > 6 ? 1 : 0.7 }));
    ev.on('player:jumped', () => this.play('jump', { pos: me() }));
    ev.on('player:landed', (e) => {
      if (e.speed > 3) this.play('land', { pos: me(), volume: Math.min(1, e.speed / 18), intensity: Math.min(1, e.speed / 20) });
    });
    ev.on('player:dodged', () => this.play('dodge', { pos: me() }));
    ev.on('player:parkour', (e) => {
      const map = { wall: 'grab', hang: 'grab', mantle: 'mantle', vault: 'vault', leap: 'jump', walljump: 'dodge' };
      if (map[e.kind]) this.play(map[e.kind], { pos: me() });
    });
    ev.on('player:melee', (e) => this.play(e.chain ? 'chain' : e.elemental ? 'punchZap' : 'punch', { pos: me() }));
    ev.on('thread:release', () => this.play('airjump', { pos: me(), volume: 0.7 }));
    ev.on('player:lunge', () => this.play('dash', { pos: me(), volume: 0.6 }));
    ev.on('power:used', (e) => {
      const map = {
        proyectil: 'zap', dash: 'dash', 'dash-dirigido': 'dash', descarga: 'discharge', onda: 'wave', rayo: 'dash',
        disparo: 'gshot', rocas: 'stone', atraer: 'pull', empujar: 'push', granada: 'throw',
        hilos: 'whip', balanceo: 'thwip', atar: 'bind', lanzar: 'launch', 'atraer-hilo': 'thwip',
        hielo: 'ice', fuego: 'fire', patinar: 'skate', muro: 'iceWall', estela: 'flame', tormenta: 'thunder',
        plumas: 'feather', vuelo: 'flap', espada: 'swordForm', lluvia: 'flutter', escudo: 'flutter',
      };
      if (map[e.id]) this.play(map[e.id], { pos: me() });
    });
    ev.on('power:impact', (e) => {
      if (e.id === 'rayo') this.play('wave', { pos: me(), volume: 1 });
      if (e.id === 'granada') this.play('bubble', { pos: e.center });
    });
    ev.on('player:airjump', () => this.play('airjump', { pos: me() }));
    ev.on('player:glide-start', () => this.loop('glide'));
    ev.on('player:glide-end', () => this.stopLoop('glide'));
    ev.on('passive:gravity', () => this.play('stasis', { bus: 'ui' }));
    ev.on('passive:temperature', (e) => this.play('sizzle', { pos: at(e.target?.position), volume: 0.7 }));
    ev.on('temperature:bolt', (e) => this.play('crack', { pos: e.point, throttle: 0.1 }));
    ev.on('temperature:ice-run', () => this.play('flame', { pos: me(), volume: 0.8 }));
    ev.on('enemy:aiming', (e) => this.play('laser', { pos: at(e.enemy?.position, 1.6), volume: 1 }));
    ev.on('enemy:blocked', (e) => this.play('clank', { pos: e.point, throttle: 0.1 }));
    ev.on('combo', (e) => this.play('combo', { pos: at(e.target?.position), volume: 1 }));
    ev.on('wings:shield-broken', () => this.play('flutter', { pos: me(), volume: 1 }));
    ev.on('wings:shield-hit', () => this.play('hit', { pos: me() }));
    ev.on('passive:energy', (e) => this.play('punchZap', { pos: at(e.target?.position), volume: 0.7 }));
    ev.on('mark:switched', () => this.play('switch', { bus: 'ui' }));
    ev.on('power:failed', () => this.play('fail', { bus: 'ui', throttle: 0.25 }));
    ev.on('power:reloading', () => this.play('reload', { pos: me() }));
    ev.on('projectile:hit', (e) => this.play(e.faction === 'player' ? 'impact' : 'ricochet', { pos: e.point, throttle: 0.03 }));
    ev.on('enemy:fired', (e) => this.play(e.kind === 'orb' ? 'orb' : 'gun', { pos: e.pos }));
    ev.on('player:damaged', () => this.play('hurt', { throttle: 0.15 }));
    ev.on('player:died', () => this.play('down', { volume: 1 }));
    ev.on('enemy:neutralized', (e) => this.play('down', { pos: at(e.enemy?.position), volume: 0.8 }));
    ev.on('combat:damage', (d) => {
      if (d.faction === 'player' && d.target !== g.playerCombat) this.play('hit', { pos: d.point, throttle: 0.05 });
    });
    ev.on('energy:drain-start', () => this.loop('drain'));
    ev.on('energy:drain-stop', () => this.stopLoop('drain'));
    ev.on('mark:acquired', () => this.play('acquired', { bus: 'ui' }));
    ev.on('mission:started', () => this.play('missionStart', { bus: 'ui' }));
    ev.on('mission:detected', () => this.play('detected', { bus: 'ui' }));
    ev.on('mission:completed', () => this.play('missionComplete', { bus: 'ui' }));
    ev.on('faction:changed', (c) => {
      if (c.to === 'hostile') this.play('radio', { bus: 'ui' });
    });
    ev.on('map:loaded', ({ id }) => this.setAmbience(id === 'distrito' ? 'city' : 'field'));
    ev.on('map:unloaded', () => {
      this.setAmbience(null);
      for (const k of [...this._loops.keys()]) this.stopLoop(k);
    });
  }

  /** Por frame: oyente y sonidos continuos que dependen del estado. */
  update(game) {
    if (!this.ctx) return;
    const cam = game.camera;
    this.setListener(cam.position, game.cameraController.yaw);
    const pw = game.powers;
    if (pw.isCharging) this.loop('charge', pw.chargeRatio);
    else this.stopLoop('charge');
    // Temperatura: roce del patinaje y propulsión de fuego
    const tp = game.temperature;
    const m = game.player.motor;
    if (tp?.skating && (m.grounded || m.isWallRiding) && m.horizontalSpeed > 1.5) this.loop('skate', Math.min(1, m.horizontalSpeed / 15));
    else this.stopLoop('skate');
    if (tp?.iceRunning) this.loop('jet');
    else this.stopLoop('jet');
    // Alas: aleteo mientras vuela
    if (game.wings?.flying && !m.grounded) this.loop('wingbeat', Math.min(1, Math.hypot(m.velocity.x, m.velocity.y, m.velocity.z) / 20));
    else this.stopLoop('wingbeat');
  }
}

// ------------------------------------------------------------------ Utilidades
function env(param, t, attack, peak, decay) {
  param.setValueAtTime(0.0001, t);
  param.linearRampToValueAtTime(peak, t + attack);
  param.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

function noise(au, out, t, dur, { type = 'lowpass', freq = 1000, freq2 = null, q = 0.8, peak = 0.3, attack = 0.003, buffer = 'white' } = {}) {
  const ctx = au.ctx;
  const src = ctx.createBufferSource();
  src.buffer = au[buffer];
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(freq, t);
  if (freq2) f.frequency.exponentialRampToValueAtTime(freq2, t + dur);
  const gn = ctx.createGain();
  env(gn.gain, t, attack, peak, dur);
  src.connect(f).connect(gn).connect(out);
  src.start(t, Math.random() * 1.5);
  src.stop(t + attack + dur + 0.05);
}

function tone(au, out, t, dur, { type = 'sine', freq = 440, freq2 = null, peak = 0.2, attack = 0.004, lp = null } = {}) {
  const ctx = au.ctx;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (freq2) o.frequency.exponentialRampToValueAtTime(freq2, t + dur);
  const gn = ctx.createGain();
  env(gn.gain, t, attack, peak, dur);
  let n = o;
  if (lp) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = lp;
    o.connect(f);
    n = f;
  }
  n.connect(gn).connect(out);
  o.start(t);
  o.stop(t + attack + dur + 0.05);
}

const rnd = (a, b) => a + Math.random() * (b - a);

/** Recetas: (audio, salida, tiempo, opciones). */
const SFX = {
  step: (a, o, t) => noise(a, o, t, 0.07, { freq: rnd(500, 800), peak: 0.22 }),
  jump: (a, o, t) => noise(a, o, t, 0.14, { type: 'bandpass', freq: 400, freq2: 1300, q: 1.2, peak: 0.16 }),
  land: (a, o, t, x) => {
    tone(a, o, t, 0.18, { freq: 120, freq2: 40, peak: 0.5 * (0.4 + (x.intensity ?? 0.5)) });
    noise(a, o, t, 0.14, { freq: 350, peak: 0.3 });
  },
  dodge: (a, o, t) => noise(a, o, t, 0.2, { type: 'bandpass', freq: 2200, freq2: 450, q: 1.5, peak: 0.28 }),
  grab: (a, o, t) => noise(a, o, t, 0.05, { freq: 1600, peak: 0.3 }),
  mantle: (a, o, t) => {
    noise(a, o, t, 0.05, { freq: 1400, peak: 0.22 });
    noise(a, o, t + 0.12, 0.12, { type: 'bandpass', freq: 500, freq2: 900, peak: 0.12 });
  },
  vault: (a, o, t) => noise(a, o, t, 0.22, { type: 'bandpass', freq: 700, freq2: 1800, q: 1.1, peak: 0.2 }),
  punch: (a, o, t) => {
    tone(a, o, t, 0.12, { freq: 170, freq2: 55, peak: 0.5 });
    noise(a, o, t, 0.06, { freq: 900, peak: 0.25 });
  },
  punchZap: (a, o, t) => {
    SFX.punch(a, o, t);
    tone(a, o, t, 0.12, { type: 'sawtooth', freq: 2200, freq2: 500, peak: 0.12, lp: 5000 });
    noise(a, o, t, 0.08, { type: 'highpass', freq: 3500, peak: 0.14 });
  },
  zap: (a, o, t) => {
    tone(a, o, t, 0.13, { type: 'sawtooth', freq: rnd(1500, 1800), freq2: 320, peak: 0.13, lp: 6000 });
    noise(a, o, t, 0.05, { type: 'highpass', freq: 3000, peak: 0.1 });
  },
  impact: (a, o, t) => {
    noise(a, o, t, 0.09, { type: 'bandpass', freq: 1500, q: 1, peak: 0.3 });
    tone(a, o, t, 0.1, { freq: 150, freq2: 60, peak: 0.25 });
  },
  ricochet: (a, o, t) => noise(a, o, t, 0.06, { type: 'bandpass', freq: 2500, q: 2, peak: 0.18 }),
  hit: (a, o, t) => noise(a, o, t, 0.07, { type: 'bandpass', freq: 900, q: 1.2, peak: 0.3 }),
  dash: (a, o, t) => {
    noise(a, o, t, 0.22, { type: 'bandpass', freq: 600, freq2: 3200, q: 1.3, peak: 0.3 });
    tone(a, o, t, 0.12, { type: 'sawtooth', freq: 2000, freq2: 700, peak: 0.07, lp: 5000 });
  },
  discharge: (a, o, t) => {
    tone(a, o, t, 0.38, { type: 'sawtooth', freq: 950, freq2: 110, peak: 0.3, lp: 4000 });
    noise(a, o, t, 0.35, { freq: 2400, freq2: 300, peak: 0.4 });
    tone(a, o, t, 0.45, { freq: 75, freq2: 40, peak: 0.5 });
  },
  wave: (a, o, t) => {
    tone(a, o, t, 0.65, { freq: 95, freq2: 28, peak: 0.8 });
    noise(a, o, t, 0.75, { freq: 3200, freq2: 180, peak: 0.55, buffer: 'brown' });
    noise(a, o, t, 0.2, { type: 'highpass', freq: 2500, peak: 0.15 });
  },
  reload: (a, o, t) => {
    tone(a, o, t, 0.34, { type: 'sawtooth', freq: 180, freq2: 950, peak: 0.07, lp: 2600 });
    tone(a, o, t + 0.36, 0.03, { type: 'square', freq: 1900, peak: 0.07 });
  },
  fail: (a, o, t) => tone(a, o, t, 0.08, { type: 'square', freq: 170, peak: 0.08, lp: 900 }),
  hurt: (a, o, t) => {
    tone(a, o, t, 0.22, { type: 'triangle', freq: 230, freq2: 85, peak: 0.3 });
    noise(a, o, t, 0.12, { freq: 600, peak: 0.25 });
  },
  down: (a, o, t) => {
    tone(a, o, t, 0.5, { type: 'triangle', freq: 320, freq2: 70, peak: 0.22 });
    noise(a, o, t + 0.25, 0.2, { freq: 400, peak: 0.25 });
  },
  gun: (a, o, t) => {
    noise(a, o, t, 0.1, { type: 'highpass', freq: 700, peak: 0.55, attack: 0.001 });
    tone(a, o, t, 0.05, { type: 'square', freq: 110, freq2: 60, peak: 0.25 });
  },
  orb: (a, o, t) => {
    tone(a, o, t, 0.32, { type: 'triangle', freq: 300, freq2: 760, peak: 0.2 });
    tone(a, o, t, 0.25, { type: 'sine', freq: 620, freq2: 1100, peak: 0.08 });
  },
  ui: (a, o, t) => tone(a, o, t, 0.05, { freq: 880, peak: 0.1 }),
  // --- Gravedad: sonidos graves y ondulantes ---
  gshot: (a, o, t) => {
    tone(a, o, t, 0.3, { type: 'sine', freq: 180, freq2: 60, peak: 0.4 });
    tone(a, o, t, 0.2, { type: 'triangle', freq: 520, freq2: 160, peak: 0.12 });
  },
  stone: (a, o, t) => {
    noise(a, o, t, 0.35, { freq: 260, freq2: 120, peak: 0.5, buffer: 'brown' });
    noise(a, o, t + 0.05, 0.08, { type: 'bandpass', freq: 1800, q: 2, peak: 0.2 });
    tone(a, o, t, 0.3, { freq: 70, freq2: 45, peak: 0.35 });
  },
  pull: (a, o, t) => {
    noise(a, o, t, 0.3, { type: 'bandpass', freq: 2500, freq2: 300, q: 1.4, peak: 0.25 });
    tone(a, o, t, 0.3, { type: 'sine', freq: 90, freq2: 200, peak: 0.3 });
  },
  push: (a, o, t) => {
    tone(a, o, t, 0.4, { freq: 110, freq2: 35, peak: 0.6 });
    noise(a, o, t, 0.35, { freq: 1200, freq2: 150, peak: 0.45, buffer: 'brown' });
  },
  throw: (a, o, t) => noise(a, o, t, 0.18, { type: 'bandpass', freq: 600, freq2: 1500, q: 1.2, peak: 0.2 }),
  bubble: (a, o, t) => {
    tone(a, o, t, 0.9, { freq: 60, freq2: 120, peak: 0.45, attack: 0.05 });
    tone(a, o, t, 0.8, { type: 'triangle', freq: 300, freq2: 600, peak: 0.08, attack: 0.1 });
  },
  airjump: (a, o, t) => noise(a, o, t, 0.16, { type: 'bandpass', freq: 300, freq2: 900, q: 1.4, peak: 0.22 }),
  stasis: (a, o, t) => {
    for (const f of [110, 165, 220]) tone(a, o, t, 1.4, { freq: f, freq2: f * 0.7, peak: 0.1, attack: 0.15 });
  },
  // --- Hilo: chasquidos secos y tensión de cuerda ---
  whip: (a, o, t) => {
    noise(a, o, t, 0.05, { type: 'highpass', freq: 2500, peak: 0.35, attack: 0.001 });
    tone(a, o, t, 0.12, { type: 'triangle', freq: 900, freq2: 300, peak: 0.12 });
  },
  thwip: (a, o, t) => {
    noise(a, o, t, 0.12, { type: 'bandpass', freq: 3000, freq2: 1200, q: 3, peak: 0.25 });
    tone(a, o, t + 0.02, 0.15, { type: 'triangle', freq: 420, freq2: 640, peak: 0.08 });
  },
  bind: (a, o, t) => {
    for (let i = 0; i < 3; i++) noise(a, o, t + i * 0.07, 0.06, { type: 'bandpass', freq: 2600 - i * 400, q: 3, peak: 0.2 });
    tone(a, o, t, 0.3, { type: 'triangle', freq: 300, freq2: 220, peak: 0.08 });
  },
  launch: (a, o, t) => {
    noise(a, o, t, 0.08, { type: 'highpass', freq: 2000, peak: 0.3 });
    noise(a, o, t + 0.05, 0.3, { type: 'bandpass', freq: 400, freq2: 1600, q: 1, peak: 0.2 });
  },
  chain: (a, o, t) => {
    noise(a, o, t, 0.25, { type: 'bandpass', freq: 500, freq2: 1800, q: 1.2, peak: 0.3 });
    tone(a, o, t + 0.12, 0.12, { freq: 160, freq2: 60, peak: 0.4 });
  },
  // Temperatura
  ice: (a, o, t) => {
    tone(a, o, t, 0.16, { type: 'triangle', freq: 2400, freq2: 1500, peak: 0.08 });
    noise(a, o, t, 0.06, { type: 'highpass', freq: 5000, peak: 0.2, attack: 0.001 });
  },
  fire: (a, o, t) => noise(a, o, t, 0.2, { type: 'lowpass', freq: 1400, freq2: 500, peak: 0.3, attack: 0.01 }),
  skate: (a, o, t) => noise(a, o, t, 0.25, { type: 'bandpass', freq: 5000, freq2: 2500, q: 2, peak: 0.16 }),
  iceWall: (a, o, t) => {
    for (let i = 0; i < 4; i++) noise(a, o, t + i * 0.04, 0.08, { type: 'highpass', freq: 3500 - i * 500, peak: 0.22 });
    tone(a, o, t, 0.3, { freq: 140, freq2: 70, peak: 0.3 });
  },
  flame: (a, o, t) => noise(a, o, t, 0.6, { type: 'lowpass', freq: 400, freq2: 1600, peak: 0.35, attack: 0.05 }),
  thunder: (a, o, t) => {
    noise(a, o, t, 1.2, { type: 'lowpass', freq: 300, freq2: 90, peak: 0.45, attack: 0.08, buffer: 'brown' });
    noise(a, o, t + 0.05, 0.1, { type: 'highpass', freq: 2500, peak: 0.25 });
  },
  crack: (a, o, t) => noise(a, o, t, 0.12, { type: 'highpass', freq: 1800, peak: 0.3, attack: 0.001 }),
  // Enemigos
  laser: (a, o, t) => tone(a, o, t, 1.2, { type: 'sine', freq: 1500, freq2: 2400, peak: 0.07 }),
  clank: (a, o, t) => {
    tone(a, o, t, 0.12, { type: 'square', freq: 820, freq2: 610, peak: 0.08, lp: 3000 });
    noise(a, o, t, 0.05, { type: 'highpass', freq: 3000, peak: 0.2 });
  },
  // Combos entre marcas
  combo: (a, o, t) => {
    tone(a, o, t, 0.18, { type: 'triangle', freq: 523, peak: 0.12 });
    tone(a, o, t + 0.08, 0.18, { type: 'triangle', freq: 784, peak: 0.12 });
    tone(a, o, t + 0.16, 0.3, { type: 'triangle', freq: 1046, peak: 0.12 });
    noise(a, o, t, 0.4, { type: 'lowpass', freq: 600, freq2: 120, peak: 0.35, buffer: 'brown' });
  },
  // Alas
  feather: (a, o, t) => noise(a, o, t, 0.08, { type: 'bandpass', freq: 3200, freq2: 1800, q: 2, peak: 0.14 }),
  flap: (a, o, t) => {
    for (let i = 0; i < 2; i++) noise(a, o, t + i * 0.14, 0.12, { type: 'lowpass', freq: 900, freq2: 300, peak: 0.35 });
  },
  swordForm: (a, o, t) => {
    noise(a, o, t, 0.3, { type: 'bandpass', freq: 2400, freq2: 4000, q: 2, peak: 0.16 });
    tone(a, o, t + 0.05, 0.25, { type: 'triangle', freq: 660, freq2: 990, peak: 0.07 });
  },
  flutter: (a, o, t) => {
    for (let i = 0; i < 5; i++) noise(a, o, t + i * 0.05, 0.06, { type: 'bandpass', freq: 1400 + i * 300, q: 1.5, peak: 0.16 });
  },
  sizzle: (a, o, t) => noise(a, o, t, 0.35, { type: 'highpass', freq: 4500, peak: 0.14, attack: 0.02 }),
  switch: (a, o, t) => {
    tone(a, o, t, 0.08, { type: 'triangle', freq: 440, peak: 0.1 });
    tone(a, o, t + 0.08, 0.12, { type: 'triangle', freq: 660, peak: 0.1 });
  },
  detected: (a, o, t) => {
    tone(a, o, t, 0.1, { type: 'square', freq: 660, peak: 0.08, lp: 3000 });
    tone(a, o, t + 0.13, 0.12, { type: 'square', freq: 880, peak: 0.08, lp: 3000 });
  },
  radio: (a, o, t) => {
    noise(a, o, t, 0.25, { type: 'bandpass', freq: 1800, q: 3, peak: 0.12 });
    tone(a, o, t + 0.05, 0.06, { type: 'square', freq: 1250, peak: 0.06 });
    tone(a, o, t + 0.16, 0.06, { type: 'square', freq: 1250, peak: 0.06 });
  },
  missionStart: (a, o, t) => {
    tone(a, o, t, 0.16, { type: 'triangle', freq: 523, peak: 0.14 });
    tone(a, o, t + 0.16, 0.25, { type: 'triangle', freq: 659, peak: 0.14 });
  },
  missionComplete: (a, o, t) => {
    [523, 659, 784, 1046].forEach((f, i) => tone(a, o, t + i * 0.12, i === 3 ? 0.6 : 0.16, { type: 'triangle', freq: f, peak: 0.15 }));
  },
  acquired: (a, o, t) => {
    for (const f of [523, 659, 784, 1046]) tone(a, o, t, 1.2, { freq: f, peak: 0.07, attack: 0.25 });
    noise(a, o, t, 0.8, { type: 'highpass', freq: 5000, peak: 0.05, attack: 0.2 });
  },
};

/** Sonidos continuos: devuelven { sources, set(v) }. */
const LOOPS = {
  charge: (a, out) => {
    const ctx = a.ctx;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 1400;
    const g = ctx.createGain();
    g.gain.value = 0.07;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 18;
    const lg = ctx.createGain();
    lg.gain.value = 0.03;
    lfo.connect(lg).connect(g.gain);
    o.connect(f).connect(g).connect(out);
    o.start();
    lfo.start();
    return {
      sources: [o, lfo],
      set: (v) => {
        o.frequency.setTargetAtTime(110 + v * 520, ctx.currentTime, 0.05);
        lfo.frequency.setTargetAtTime(12 + v * 26, ctx.currentTime, 0.05);
      },
    };
  },
  drain: (a, out) => {
    const ctx = a.ctx;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = 95;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 600;
    const g = ctx.createGain();
    g.gain.value = 0.09;
    o.connect(f).connect(g).connect(out);
    const n = ctx.createBufferSource();
    n.buffer = a.white;
    n.loop = true;
    const nf = ctx.createBiquadFilter();
    nf.type = 'highpass';
    nf.frequency.value = 4000;
    const ng = ctx.createGain();
    ng.gain.value = 0.035;
    n.connect(nf).connect(ng).connect(out);
    o.start();
    n.start();
    return { sources: [o, n] };
  },
};

LOOPS.glide = (a, out) => {
  const ctx = a.ctx;
  const n = ctx.createBufferSource();
  n.buffer = a.white;
  n.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 700;
  f.Q.value = 0.6;
  const g = ctx.createGain();
  g.gain.value = 0.08;
  n.connect(f).connect(g).connect(out);
  n.start();
  return { sources: [n] };
};

/** Patinaje: roce agudo del hielo; más fuerte cuanto más rápido. */
LOOPS.skate = (a, out) => {
  const ctx = a.ctx;
  const n = ctx.createBufferSource();
  n.buffer = a.white;
  n.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 3800;
  f.Q.value = 1.4;
  const g = ctx.createGain();
  g.gain.value = 0.02;
  n.connect(f).connect(g).connect(out);
  n.start();
  return {
    sources: [n],
    set: (v) => g.gain.setTargetAtTime(0.02 + v * 0.05, ctx.currentTime, 0.08),
  };
};

/** Vuelo: batir de alas (ruido grave modulado). */
LOOPS.wingbeat = (a, out) => {
  const ctx = a.ctx;
  const n = ctx.createBufferSource();
  n.buffer = a.white;
  n.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 500;
  const g = ctx.createGain();
  g.gain.value = 0.05;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 2.2;
  const lg = ctx.createGain();
  lg.gain.value = 0.05;
  lfo.connect(lg).connect(g.gain);
  n.connect(f).connect(g).connect(out);
  n.start();
  lfo.start();
  return {
    sources: [n, lfo],
    set: (v) => f.frequency.setTargetAtTime(400 + v * 700, ctx.currentTime, 0.1),
  };
};

/** Carrera de hielo: rugido de la llama de propulsión. */
LOOPS.jet = (a, out) => {
  const ctx = a.ctx;
  const n = ctx.createBufferSource();
  n.buffer = a.white;
  n.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 900;
  const g = ctx.createGain();
  g.gain.value = 0.12;
  n.connect(f).connect(g).connect(out);
  n.start();
  return { sources: [n] };
};

/** Ambiente de cada mapa. */
const AMBIENCE = {
  // Ciudad: rumor grave del tráfico lejano y zumbido eléctrico suave
  city: (a, out) => {
    const ctx = a.ctx;
    const n = ctx.createBufferSource();
    n.buffer = a.brown;
    n.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 380;
    const g = ctx.createGain();
    g.gain.value = 0.35;
    n.connect(f).connect(g).connect(out);
    const hum = ctx.createOscillator();
    hum.frequency.value = 60;
    const hg = ctx.createGain();
    hg.gain.value = 0.015;
    hum.connect(hg).connect(out);
    n.start();
    hum.start();
    return { sources: [n, hum] };
  },
  // Campo de pruebas: viento que sube y baja
  field: (a, out) => {
    const ctx = a.ctx;
    const n = ctx.createBufferSource();
    n.buffer = a.white;
    n.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 450;
    f.Q.value = 0.7;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.09;
    const lg = ctx.createGain();
    lg.gain.value = 220;
    lfo.connect(lg).connect(f.frequency);
    const g = ctx.createGain();
    g.gain.value = 0.12;
    n.connect(f).connect(g).connect(out);
    n.start();
    lfo.start();
    return { sources: [n, lfo] };
  },
};
