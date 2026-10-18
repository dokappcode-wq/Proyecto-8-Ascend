import * as THREE from 'three';

/**
 * EnergyDrainSystem — absorción de energía de fuentes cotidianas.
 *
 * Junto a una fuente (farola, armario eléctrico, máquina expendedora) y con
 * la marca de Energía, mantener E absorbe su energía: el protagonista se
 * detiene, extiende la mano y un flujo de partículas y arcos va de la fuente
 * a su mano. Se detiene al soltar E, al llenar la carga o al agotar la fuente.
 */
export class EnergyDrainSystem {
  constructor(game) {
    this.game = game;
    this.sources = [];
    this.active = null;
    this._hand = new THREE.Vector3();
    this._arc = 0;
  }

  /** Registra una fuente del mapa (crea su interacción con E). */
  register(source) {
    const g = this.game;
    this.sources.push(source);
    g.interactions.add({
      getPosition: () => source.position,
      radius: g.powers.cfg.drain.range,
      enabled: () => g.powers.available && !this.active && !g.acquisition.active,
      label: () => {
        if (source.reserve.empty) return `${source.name} — agotada, se está recuperando`;
        if (g.powers.energy.full) return `${source.name} — tu carga está completa`;
        return `Mantén E: absorber energía (${source.name})`;
      },
      onInteract: () => this.start(source),
    });
    return source;
  }

  clear() {
    this.stop();
    this.sources.length = 0;
  }

  start(source) {
    const g = this.game;
    if (this.active || source.reserve.empty || g.powers.energy.full || !g.powers.available) return;
    this.active = source;
    g.player.lookTarget = source.drainPoint;
    g.events.emit('energy:drain-start', { source: source.kind });
  }

  stop() {
    if (!this.active) return;
    const g = this.game;
    g.player.lookTarget = null;
    g.ui.setPrompt(null);
    g.events.emit('energy:drain-stop', { source: this.active.kind, energy: g.powers.energy.value });
    this.active = null;
  }

  update(dt) {
    const src = this.active;
    if (!src) return;
    const g = this.game;
    const e = g.powers.energy;
    const p = g.player.motor.position;
    const dist = Math.hypot(src.position.x - p.x, src.position.z - p.z);
    if (!g.input.isDown('interact') || dist > g.powers.cfg.drain.range + 0.6 || e.full || src.reserve.empty || !g.powers.available || g.playerCombat.dead) {
      this.stop();
      return;
    }
    const want = Math.min(g.powers.cfg.drain.rate * dt, e.max - e.value);
    e.add(src.reserve.drain(want));
    g.ui.setPrompt('Absorbiendo energía', e.value / e.max);

    // Efectos: flujo de partículas de la fuente a la mano y arcos ocasionales
    g.player.updateModelMatrices();
    const hand = g.player.handWorldPosition(this._hand);
    const from = src.drainPoint;
    const color = new THREE.Color(g.powers.color);
    for (let i = 0; i < 3; i++) {
      const life = 0.25 + Math.random() * 0.1;
      const jx = (Math.random() - 0.5) * 0.3;
      const jy = (Math.random() - 0.5) * 0.3;
      const jz = (Math.random() - 0.5) * 0.3;
      g.vfx.particles.emit({
        x: from.x + jx, y: from.y + jy, z: from.z + jz,
        vx: (hand.x - from.x - jx) / life, vy: (hand.y - from.y - jy) / life, vz: (hand.z - from.z - jz) / life,
        color, size: 0.08, life, drag: 0,
      });
    }
    this._arc -= dt;
    if (this._arc <= 0) {
      this._arc = 0.12 + Math.random() * 0.12;
      g.vfx.lightning(from, hand, g.powers.color, { width: 0.025, duration: 0.12, jitter: 0.2, branches: 0 });
    }
    g.marks.sustain(0.45);
  }
}
