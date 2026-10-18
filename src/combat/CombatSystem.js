/**
 * CombatSystem — registro de entidades dañables y aplicación de daño.
 *
 * Una entidad dañable implementa:
 *   center: {x,y,z}           centro aproximado (para efectos de área)
 *   radius: number            radio aproximado
 *   alive: boolean
 *   takeDamage(amount, info)  devuelve el daño realmente aplicado
 *   applyImpulse?(x, y, z)    opcional: retroceso
 *
 * Etapa 2: dianas, maniquíes y objetos físicos. Etapa 3 añadirá enemigos y
 * la salud del jugador sobre esta misma interfaz.
 */

/** Atenuación lineal del daño de área: 1 en el centro, `min` en el borde. */
export function radialFalloff(distance, radius, min = 0.35) {
  if (distance >= radius) return 0;
  const t = Math.max(0, distance) / radius;
  return 1 - (1 - min) * t;
}

export class CombatSystem {
  constructor(events) {
    this.events = events;
    this.targets = new Set();
  }

  register(entity) {
    this.targets.add(entity);
    return () => this.targets.delete(entity);
  }

  unregister(entity) {
    this.targets.delete(entity);
  }

  clear() {
    this.targets.clear();
  }

  /**
   * @param {object} target entidad dañable
   * @param {number} amount
   * @param {object} info { point, dir: {x,y,z}, source, kind, knockback }
   */
  applyDamage(target, amount, info = {}) {
    if (!target || !target.alive || amount <= 0) return 0;
    const dealt = target.takeDamage(amount, info);
    if (info.knockback && info.dir && target.applyImpulse) {
      target.applyImpulse(info.dir.x * info.knockback, info.dir.y * info.knockback, info.dir.z * info.knockback);
    }
    if (dealt > 0) {
      this.events?.emit('combat:damage', {
        target, amount: dealt, point: info.point ?? target.center, kind: info.kind ?? 'generic', killed: !target.alive,
      });
    }
    return dealt;
  }

  /**
   * Daño de área con atenuación y retroceso radial.
   * @returns {Array<{target, dealt}>}
   */
  radial(center, radius, damage, { knockback = 0, lift = 0.35, kind = 'area', source = null, exclude = null } = {}) {
    const results = [];
    for (const t of [...this.targets]) {
      if (!t.alive || t === exclude) continue;
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
      const dealt = this.applyDamage(t, Math.round(damage * f), { point: c, dir, knockback: knockback * f, kind, source });
      results.push({ target: t, dealt });
    }
    return results;
  }
}
