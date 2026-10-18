import * as THREE from 'three';

/**
 * LightPool — número fijo de luces puntuales reutilizables.
 * Mantener constante el número de luces evita recompilar shaders cada vez
 * que aparece o desaparece un efecto.
 */
export class LightPool {
  constructor(scene, size = 6) {
    this.slots = [];
    for (let i = 0; i < size; i++) {
      const light = new THREE.PointLight(0xffffff, 0, 10, 2);
      light.castShadow = false;
      scene.add(light);
      this.slots.push({ light, owner: null, flash: 0, flashDur: 0, peak: 0 });
    }
  }

  /** Reserva una luz para un efecto que la mueve él mismo. Devuelve null si no hay. */
  acquire(owner) {
    const s = this.slots.find((x) => !x.owner && x.flash <= 0) ?? this.slots.find((x) => !x.owner);
    if (!s) return null;
    s.owner = owner;
    s.flash = 0;
    return s.light;
  }

  release(light) {
    const s = this.slots.find((x) => x.light === light);
    if (!s) return;
    s.owner = null;
    s.light.intensity = 0;
  }

  /** Destello breve que se apaga solo. */
  flash(pos, color, intensity = 30, distance = 10, duration = 0.25) {
    const s = this.slots.find((x) => !x.owner && x.flash <= 0) ?? this.slots.filter((x) => !x.owner).sort((a, b) => a.flash - b.flash)[0];
    if (!s) return;
    s.light.position.set(pos.x, pos.y, pos.z);
    s.light.color.set(color);
    s.light.distance = distance;
    s.flash = s.flashDur = duration;
    s.peak = intensity;
    s.light.intensity = intensity;
  }

  update(dt) {
    for (const s of this.slots) {
      if (s.owner || s.flash <= 0) continue;
      s.flash = Math.max(0, s.flash - dt);
      const t = s.flash / s.flashDur;
      s.light.intensity = s.peak * t * t;
    }
  }

  clear() {
    for (const s of this.slots) {
      s.owner = null;
      s.flash = 0;
      s.light.intensity = 0;
    }
  }
}
