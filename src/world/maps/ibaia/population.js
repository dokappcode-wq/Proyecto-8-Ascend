import { POP, buildGroups, plan, truckDoor, at, postFrame } from './pdcPlan.js';
import { districtAt } from './decode.js';

/**
 * La PDC y los Acólitos de Ibaia en el juego.
 *
 * Cada grupo (pdcPlan.buildGroups) está siempre en su sitio; sus enemigos se
 * crean al acercarse el jugador y se retiran al alejarse (si no están
 * peleando). Además:
 *  - Alarma: cuando la PDC se vuelve hostil, del camión del puesto más
 *    cercano bajan dos refuerzos y despegan los drones posados en las torres.
 *  - Toque de queda: en los barrios de nivel PDC ≥ 4 (Los Bloques, el Barrio
 *    Chino y el Centro) basta con que te vean para que la PDC se inquiete.
 *  - Los neutralizados no vuelven hasta pasados POP.respawn segundos.
 */
export class CityPopulation {
  constructor(ctx, CITY, { enabled = true } = {}) {
    this.ctx = ctx;
    this.city = CITY;
    this.groups = buildGroups(CITY);
    this.byId = new Map(this.groups.map((g) => [g.id, g]));
    this.enabled = enabled;
    this.time = 0;
    this._check = 0;
    this._curfewCd = 0;
    this._curfewToast = 0;
    this._reinforceCd = new Map();
    /** Enemigo → { group, index } (para saber a quién se ha neutralizado). */
    this._owner = new Map();
    /** Refuerzos que, al bajar del camión, van a por el jugador: { e, at } */
    this._pending = [];
    this.neutralized = 0;
    /** Barrios liberados (la campaña los fija): no aparece la PDC. */
    this.liberated = new Set();
    this._offs = [
      ctx.events.on('enemy:neutralized', ({ enemy }) => this._onDown(enemy)),
      ctx.events.on('enemy:removed', ({ enemy }) => this._onRemoved(enemy)),
      ctx.events.on('faction:changed', (c) => {
        if (c.faction === 'pdc' && c.to === 'hostile') this._alarm();
      }),
    ];
  }

  /** Grupos con enemigos creados ahora mismo. */
  get active() {
    return this.groups.filter((g) => g.active);
  }

  /** Enemigos de la ciudad que existen ahora (vivos). */
  get units() {
    return [...this._owner.keys()].filter((e) => e.alive);
  }

  _tag(g) {
    return `ibaia:${g.id}`;
  }

  _spawnGroup(g) {
    const E = this.ctx.enemies;
    g.active = true;
    g.enemies = [];
    g.units.forEach((u, index) => {
      if (u.deadUntil > this.time) return;
      const e = E.spawn(u.type, { x: u.x, y: u.y ?? 0.2, z: u.z, yaw: u.yaw ?? 0, patrol: u.patrol, dormant: !!u.dormant, tag: this._tag(g) });
      this._owner.set(e, { g, index });
      g.enemies.push(e);
    });
    g.liveCount = g.enemies.length;
  }

  _despawnGroup(g) {
    g.active = false;
    const E = this.ctx.enemies;
    for (const e of g.enemies ?? []) if (E.list.includes(e)) E.remove(e);
    g.enemies = [];
    g.liveCount = 0;
  }

  _onDown(enemy) {
    const o = this._owner.get(enemy);
    if (!o) return;
    const u = o.g.units[o.index];
    if (u) u.deadUntil = this.time + POP.respawn;
    o.g.liveCount = Math.max(0, (o.g.liveCount ?? 1) - 1);
    this.neutralized++;
  }

  _onRemoved(enemy) {
    this._owner.delete(enemy);
  }

  /** ¿Algún enemigo del grupo está peleando o buscando al jugador? */
  _busy(g) {
    return (g.enemies ?? []).some((e) => e.alive && (e.brain.state !== 'patrol' || e.scripted && !e.dormant));
  }

  setEnabled(on) {
    this.enabled = on;
    if (!on) for (const g of this.groups) if (g.active) this._despawnGroup(g);
    this._check = 0;
  }

  /** Vuelve a poner a todos en su puesto (menú de depuración: reiniciar escenario). */
  reset() {
    for (const g of this.groups) {
      if (g.active) this._despawnGroup(g);
      for (const u of g.units) u.deadUntil = 0;
    }
    this.neutralized = 0;
    this._pending.length = 0;
    this._reinforceCd.clear();
    this._check = 0;
  }

  /**
   * Alarma: refuerzos desde el camión del puesto activo más cercano (dos
   * agentes que bajan por la puerta trasera y acuden) y drones que despegan.
   */
  _alarm() {
    const player = this.ctx.player;
    if (!this.enabled || !player) return;
    const p = player.motor.position;
    let best = null;
    for (const g of this.groups) {
      if (!g.active || !g.truck) continue;
      const d = Math.hypot(g.x - p.x, g.z - p.z);
      if (d < 260 && (this._reinforceCd.get(g.id) ?? -1e9) < this.time && (!best || d < best.d)) best = { g, d };
    }
    if (best) {
      const g = best.g;
      this._reinforceCd.set(g.id, this.time + 60);
      const door = truckDoor(g.post);
      const f = postFrame(g.post);
      const out = at(g.post, 6, -(f.half - 3));
      const type = g.lvl >= 3 ? 'reforzado' : 'pdc';
      for (let i = 0; i < 2; i++) {
        const e = this.ctx.enemies.spawn(type, {
          x: door.x, y: 0.2, z: door.z, yaw: 0, tag: `${this._tag(g)}:refuerzo`,
          entrance: { path: [door, { x: out.x + f.vx * (i * 1.6 - 0.8), z: out.z + f.vz * (i * 1.6 - 0.8) }], delay: 0.6 + i * 0.7 },
        });
        this._owner.set(e, { g, index: -1 });
        g.enemies.push(e);
        // Al terminar de bajar, van a por el jugador
        this._pending.push({ e, at: this.time + 2.6 + i * 0.7 });
      }
      this.ctx.ui?.toast('Refuerzos de la PDC', `Bajan del camión: ${g.name}`, 2400);
      this.ctx.events.emit('city:reinforcements', { id: g.id });
    }
    // Drones posados en las torres cercanas
    for (const g of this.groups) {
      if (!g.active || Math.hypot(g.x - p.x, g.z - p.z) > 320) continue;
      for (const e of g.enemies) {
        if (e.alive && e.dormant) {
          e.wake();
          e.alertTo(p);
        }
      }
    }
  }

  update(dt) {
    this.time += dt;
    const player = this.ctx.player;
    if (!player) return;
    const p = player.motor.position;
    this._curfewCd = Math.max(0, this._curfewCd - dt);
    for (const r of [...this._pending]) {
      if (r.at > this.time) continue;
      this._pending.splice(this._pending.indexOf(r), 1);
      if (r.e.alive) r.e.alertTo(p);
    }
    this._check -= dt;
    if (this._check <= 0) {
      this._check = 0.5;
      if (this.enabled) {
        // Barrios liberados por la campaña: sin PDC (los Acólitos siguen)
        const lib = this.liberated;
        const groups = lib?.size ? this.groups.filter((g) => g.active || !(lib.has(g.d) && g.kind !== 'acolytes')) : this.groups;
        const { activate, deactivate } = plan(groups, p.x, p.z, { time: this.time, busy: (id) => this._busy(this.byId.get(id)) });
        for (const id of deactivate) this._despawnGroup(this.byId.get(id));
        for (const id of activate) this._spawnGroup(this.byId.get(id));
      }
      // Toque de queda en los barrios de nivel alto
      const d = districtAt(this.city, p.x, p.z);
      const f = this.ctx.factions;
      if (this.enabled && d && d.pdc >= 4 && f && this._curfewCd === 0 && this.ctx.enemies.seenBy('pdc')) {
        this._curfewCd = 1;
        f._apply(f.reputation.report('pdc:curfew'));
        if (this.time - this._curfewToast > 30 && !f.reputation.isHostile('pdc')) {
          this._curfewToast = this.time;
          this.ctx.ui?.toast('Toque de queda', `${d.name}: la PDC identifica a todo el que ve`, 2400);
        }
      }
    }
  }

  dispose() {
    for (const off of this._offs) off?.();
  }
}
