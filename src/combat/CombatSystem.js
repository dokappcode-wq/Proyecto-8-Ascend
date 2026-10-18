/**
 * CombatSystem — registro de entidades dañables y aplicación de daño.
 *
 * Una entidad dañable implementa:
 *   center: {x,y,z}           centro aproximado (para efectos de área)
 *   radius: number            radio aproximado
 *   alive: boolean
 *   takeDamage(amount, info)  devuelve el daño realmente aplicado
 *   applyImpulse?(x, y, z)    opcional: retroceso
 *   faction?: 'player' | 'enemy' | 'neutral'   (por defecto 'neutral')
 *
 * Los "actores" (jugador y enemigos) se mueven, así que no usan un
 * colisionador del mundo: además implementan `capsule()` → { x, y, z, r, h }
 * (pies, radio y altura) y los proyectiles los comprueban con un cilindro.
 *
 * Facciones: el daño de una fuente nunca afecta a su propia facción (los
 * poderes del jugador no le dañan; los enemigos no se dañan entre sí).
 */

/** Atenuación lineal del daño de área: 1 en el centro, `min` en el borde. */
export function radialFalloff(distance, radius, min = 0.35) {
  if (distance >= radius) return 0;
  const t = Math.max(0, distance) / radius;
  return 1 - (1 - min) * t;
}

import { rayVerticalCylinder } from './geometry.js';

export class CombatSystem {
  constructor(events) {
    this.events = events;
    this.targets = new Set();
    this.actors = new Set();
  }

  /** Registra un actor (dañable y con `capsule()`). */
  registerActor(actor) {
    this.targets.add(actor);
    this.actors.add(actor);
    return () => this.unregister(actor);
  }

  /** Primer actor vivo atravesado por el rayo (excluye la facción indicada y `ignore`). */
  raycastActors(o, d, maxT, { excludeFaction = null, ignore = null } = {}) {
    let best = null;
    for (const a of this.actors) {
      if (!a.alive || a === ignore || (excludeFaction && a.faction === excludeFaction)) continue;
      const c = a.capsule();
      const t = rayVerticalCylinder(o, d, c, c.r, c.h, best ? best.t : maxT);
      if (t !== null && (!best || t < best.t)) best = { t, actor: a };
    }
    return best;
  }

  register(entity) {
    this.targets.add(entity);
    return () => this.targets.delete(entity);
  }

  unregister(entity) {
    this.targets.delete(entity);
    this.actors.delete(entity);
  }

  clear() {
    this.targets.clear();
    this.actors.clear();
  }

  /** ¿Puede una fuente de la facción `from` dañar a `target`? */
  static canHarm(from, target) {
    if (!from) return true;
    return (target.faction ?? 'neutral') !== from;
  }

  /**
   * @param {object} target entidad dañable
   * @param {number} amount
   * @param {object} info { point, dir: {x,y,z}, source, kind, knockback, faction }
   */
  applyDamage(target, amount, info = {}) {
    if (!target || !target.alive || amount <= 0) return 0;
    if (!CombatSystem.canHarm(info.faction, target)) return 0;
    const dealt = target.takeDamage(amount, info);
    if (info.knockback && info.dir && target.applyImpulse) {
      target.applyImpulse(info.dir.x * info.knockback, info.dir.y * info.knockback, info.dir.z * info.knockback);
    }
    if (dealt > 0) {
      this.events?.emit('combat:damage', {
        target, amount: dealt, point: info.point ?? target.center, kind: info.kind ?? 'generic', killed: !target.alive,
        faction: info.faction ?? null, source: info.source ?? null, dir: info.dir ?? null,
      });
    }
    return dealt;
  }

  /**
   * Daño de área con atenuación y retroceso radial.
   * @returns {Array<{target, dealt}>}
   */
  radial(center, radius, damage, { knockback = 0, lift = 0.35, kind = 'area', source = null, exclude = null, faction = 'player' } = {}) {
    const results = [];
    for (const t of [...this.targets]) {
      if (!t.alive || t === exclude || !CombatSystem.canHarm(faction, t)) continue;
      const c = t.center;
      const dx = c.x - center.x;
      const dy = c.y - center.y;
      const dz = c.z - center.z;
      const dist = Math.max(0, Math.hypot(dx, dy, dz) - (t.radius ?? 0));
      const f = radialFalloff(dist, radius);
      if (f <= 0) continue;
      const hl = Math.hypot(dx, dz) || 1;
      const dir = { x: (dx / hl) * (1 - lift), y: lift, z: (dz / hl) * (1 - lift) };
      const dl = Math.hypot(dir.x, dir.y, dir.z);
      dir.x /= dl;
      dir.y /= dl;
      dir.z /= dl;
      const dealt = this.applyDamage(t, Math.round(damage * f), { point: c, dir, knockback: knockback * f, kind, source, faction });
      results.push({ target: t, dealt });
    }
    return results;
  }
}
