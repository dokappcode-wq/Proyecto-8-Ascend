import { PROGRESSION } from '../data/progression.js';

/**
 * Progression — experiencia, niveles, puntos y mejoras por marca.
 * Trabaja sobre `profile.skillProgress` del guardado (persistente).
 * Sin Three.js.
 */

const DEFAULT_MODS = Object.freeze({
  magazineBonus: 0, reloadMul: 1, fullCharge: null, waveRadiusAdd: 0, waveDamageAdd: 0,
  dashCostSub: 0, targetedRangeAdd: 0, drainMul: 1, energyMaxAdd: 0,
  // Gravedad
  stoneBonus: 0, pullDamageAdd: 0, pullStunAdd: 0, pushDamageAdd: 0, pushKnockbackAdd: 0, bubbleRadiusAdd: 0, bubbleTimeAdd: 0,
  // Hilo
  swingRangeAdd: 0, bindTimeAdd: 0, fistSpeedMul: 1, chainDamageAdd: 0,
});

export class Progression {
  /** @param {object} profile objeto `profile` del guardado */
  constructor(profile, trees = PROGRESSION) {
    this.profile = profile;
    this.trees = trees;
    if (!profile.skillProgress) profile.skillProgress = {};
  }

  tree(markId) {
    return this.trees[markId] ?? null;
  }

  /** Estado de progreso de una marca (lo crea si no existe). */
  state(markId) {
    const sp = this.profile.skillProgress;
    if (!sp[markId]) sp[markId] = { xp: 0, level: 1, points: 0, unlocked: [] };
    return sp[markId];
  }

  reset(markId) {
    delete this.profile.skillProgress[markId];
  }

  /** Suma experiencia. Devuelve los niveles ganados (cada nivel da 1 punto). */
  addXp(markId, amount) {
    const t = this.tree(markId);
    if (!t || amount <= 0) return 0;
    const s = this.state(markId);
    s.xp += amount;
    let gained = 0;
    while (s.xp >= t.xpPerLevel) {
      s.xp -= t.xpPerLevel;
      s.level++;
      s.points++;
      gained++;
    }
    return gained;
  }

  node(markId, nodeId) {
    return this.tree(markId)?.nodes.find((n) => n.id === nodeId) ?? null;
  }

  isUnlocked(markId, nodeId) {
    const n = this.node(markId, nodeId);
    if (!n) return false;
    return n.type === 'base' || this.state(markId).unlocked.includes(nodeId);
  }

  /** @returns {{ ok: boolean, reason?: string }} */
  canUnlock(markId, nodeId) {
    const n = this.node(markId, nodeId);
    if (!n) return { ok: false, reason: 'unknown' };
    if (n.type === 'base') return { ok: false, reason: 'base' };
    if (n.type === 'future') return { ok: false, reason: 'future' };
    if (this.isUnlocked(markId, nodeId)) return { ok: false, reason: 'unlocked' };
    const missing = (n.requires ?? []).filter((r) => !this.isUnlocked(markId, r));
    if (missing.length) return { ok: false, reason: 'requires', missing };
    if (this.state(markId).points < (n.cost ?? 1)) return { ok: false, reason: 'points' };
    return { ok: true };
  }

  unlock(markId, nodeId) {
    const r = this.canUnlock(markId, nodeId);
    if (!r.ok) return r;
    const s = this.state(markId);
    s.points -= this.node(markId, nodeId).cost ?? 1;
    s.unlocked.push(nodeId);
    return { ok: true };
  }

  /** Modificadores combinados de las mejoras desbloqueadas. */
  modifiers(markId) {
    const m = { ...DEFAULT_MODS };
    const t = this.tree(markId);
    if (!t) return m;
    // Cada nivel amplía la reserva de energía de la marca
    m.energyMaxAdd = (this.state(markId).level - 1) * (t.energyPerLevel ?? 0);
    for (const n of t.nodes) {
      if (n.type !== 'upgrade' || !this.isUnlocked(markId, n.id) || !n.effects) continue;
      for (const [k, v] of Object.entries(n.effects)) {
        if (k.endsWith('Mul')) m[k] *= v;
        else if (k === 'fullCharge') m[k] = m[k] === null ? v : Math.min(m[k], v);
        else m[k] += v;
      }
    }
    return m;
  }
}
