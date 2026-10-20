import * as THREE from 'three';
import { COMBOS, detectCombo, chainTargets } from '../powers/combos.js';

/**
 * ComboSystem — combos entre marcas. Escucha los daños del jugador y, si el
 * golpe y el estado del enemigo encajan con una regla de `powers/combos.js`,
 * aplica el efecto. Cada enemigo tiene un breve tiempo de espera entre combos.
 */
export class ComboSystem {
  constructor(game) {
    this.game = game;
    this.cooldown = 1;
    this._last = new WeakMap();
    /** Combos conseguidos (por id), para el HUD de depuración y las pruebas. */
    this.counts = {};
    game.events.on('combat:damage', (d) => this._onDamage(d));
  }

  _onDamage(d) {
    const t = d.target;
    if (d.faction !== 'player' || !t || t === this.game.playerCombat || !t.float) return;
    const id = detectCombo(d.kind, { floating: !!t.floating, bound: !!t.bound, burning: !!t.burning });
    if (!id) return;
    const now = this.game._time;
    if (now - (this._last.get(t) ?? -Infinity) < this.cooldown && id !== 'plumas') return;
    this._last.set(t, now);
    this[`_${id}`](t, d);
    this.counts[id] = (this.counts[id] ?? 0) + 1;
    const c = COMBOS[id];
    // La lluvia da muchos golpes: el aviso solo una vez por segundo
    if (id !== 'plumas' || now - (this._plumasMsg ?? -Infinity) > 1) {
      this._plumasMsg = id === 'plumas' ? now : this._plumasMsg;
      this.game.ui.combo(c.name, c.desc);
      this.game.events.emit('combo', { id, target: t });
    }
  }

  _combustion(t) {
    const g = this.game;
    const c = COMBOS.combustion;
    const p = t.center;
    t._endFloat?.();
    g.combat.radial(p, c.radius, c.damage, { knockback: c.knockback, lift: 0.5, kind: 'combo-combustion', faction: 'player', source: g.playerCombat });
    g.vfx.particles.burst(p, { count: 40, speed: 7, color: new THREE.Color('#ff8a2a'), size: 0.2, life: 0.6, drag: 2 });
    g.vfx.particles.burst(p, { count: 20, speed: 4, color: new THREE.Color('#a24dff'), size: 0.14, life: 0.5, drag: 2 });
    g.vfx.ring(p, c.radius, '#ff8a2a', 0.45);
    g.vfx.lights.flash(p, '#ff8a2a', 60, 14, 0.4);
    g.cameraController.shake(0.35);
  }

  _cadena(t) {
    const g = this.game;
    const c = COMBOS.cadena;
    const from = t.center;
    const others = [...g.combat.targets].filter((a) => a !== t && a !== g.playerCombat && a.alive && a.float);
    const centers = new Map(others.map((a) => [a.center, a]));
    let prev = from;
    for (const pc of chainTargets(from, [...centers.keys()], c.range, c.jumps)) {
      const a = centers.get(pc);
      g.vfx.lightning(prev, pc, '#9fd0ff', { width: 0.07, duration: 0.35, jitter: 0.4, branches: 2 });
      g.combat.applyDamage(a, c.damage, { point: pc, kind: 'combo-cadena', faction: 'player', source: g.playerCombat });
      a.stun?.(c.stun);
      prev = pc;
    }
    g.combat.applyDamage(t, c.damage, { point: from, kind: 'combo-cadena', faction: 'player', source: g.playerCombat });
    g.vfx.lights.flash(from, '#9fd0ff', 40, 10, 0.3);
  }

  _plumas(t, d) {
    const g = this.game;
    g.combat.applyDamage(t, Math.max(1, Math.round(d.amount * COMBOS.plumas.extraMul)), { point: t.center, kind: 'combo-plumas', faction: 'player', source: g.playerCombat });
    const p = t.center;
    g.vfx.particles.burst(p, { count: 6, speed: 2.5, color: new THREE.Color('#ff8a2a'), size: 0.14, life: 0.4, drag: 2 });
  }

  _escarcha(t) {
    const g = this.game;
    const c = COMBOS.escarcha;
    g.combat.applyDamage(t, c.damage, { point: t.center, kind: 'combo-escarcha', faction: 'player', source: g.playerCombat });
    t.freeze?.(c.freeze);
    g.vfx.particles.burst(t.center, { count: 30, speed: 3, color: new THREE.Color('#d8fffb'), size: 0.14, life: 0.7, drag: 2 });
    g.vfx.lights.flash(t.center, '#2ee6d6', 30, 8, 0.3);
  }
}
