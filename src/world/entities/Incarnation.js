import * as THREE from 'three';
import { CharacterModel } from '../../player/CharacterModel.js';
import { MarkVisual } from '../../player/MarkVisual.js';
import { MARKS } from '../../data/marks.js';
import { glowSprite } from '../../vfx/glowTexture.js';

/**
 * Encarnación de prueba (estación de adquisición). Personaje no hostil que
 * posee una marca ORIGINAL. Sirve como fuente válida de copia; tras la copia
 * conserva su marca y su poder (Regla IV), y lo sigue manifestando.
 */
export class Incarnation {
  constructor(ctx, { x, y = 0, z, yaw = 0, markId = 'energia' }) {
    this.ctx = ctx;
    this.markId = markId;
    this.def = MARKS[markId];
    /** Datos para las reglas de adquisición. */
    this.source = { kind: 'incarnation', markId, name: `Encarnación de la ${this.def.concept}` };
    this.position = { x, y, z };
    this.yaw = yaw;
    this.reach = 0; // 0..1: extiende el brazo durante el contacto
    this.channel = 0; // 0..1: intensidad durante la copia
    this._time = Math.random() * 10;
    this._arcTimer = 2;

    this.model = new CharacterModel({ variant: 'incarnation' });
    this.model.root.position.set(x, y, z);
    this.model.root.rotation.y = yaw;
    ctx.group.add(this.model.root);
    this.mark = new MarkVisual(this.model, this.def);

    // Aura y luz propias: su poder está siempre activo
    this.aura = glowSprite(new THREE.Color(this.def.color).multiplyScalar(1.2), 3.2, 0.35);
    this.aura.position.set(x, y + 1.1, z);
    ctx.group.add(this.aura);
    this.light = new THREE.PointLight(this.def.color, 6, 7, 2);
    this.light.position.set(x, y + 1.6, z);
    ctx.group.add(this.light);

    // No se le puede atravesar
    ctx.world.addBox({ x: x - 0.35, y, z: z - 0.35 }, { x: x + 0.35, y: y + 1.85, z: z + 0.35 }, { tag: 'npc' });
  }

  /** Posición de su muñeca derecha (donde está la marca), en el mundo. */
  wristPosition(out = new THREE.Vector3()) {
    this.model.root.updateMatrixWorld(true);
    return this.model.anchors.wristR.getWorldPosition(out);
  }

  /** Mira hacia un punto (durante el contacto). */
  faceTowards(p, dt) {
    const target = Math.atan2(p.x - this.position.x, p.z - this.position.z);
    let d = target - this.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.yaw += d * (1 - Math.exp(-dt * 6));
  }

  update(dt) {
    this._time += dt;
    const idle = 0.35 + Math.sin(this._time * 1.7) * 0.1;
    this.mark.setIntensity(Math.min(1, idle + this.channel * 0.65));
    this.aura.material.opacity = 0.3 + this.channel * 0.4 + Math.sin(this._time * 2.3) * 0.05;
    this.light.intensity = 5 + this.channel * 25;
    this.model.animate(dt, {
      speed: 0, grounded: true, sprinting: false, dodging: false, verticalSpeed: 0,
      aimWeight: this.reach, aimPitch: -0.35,
    });
    this.model.root.rotation.y = this.yaw;

    // Demostración periódica de su poder (arcos hacia los pilones de la estación)
    this._arcTimer -= dt;
    if (this._arcTimer <= 0 && this.ctx.pylons?.length && this.reach < 0.1) {
      this._arcTimer = 2.5 + Math.random() * 2;
      const pylon = this.ctx.pylons[Math.floor(Math.random() * this.ctx.pylons.length)];
      const from = this.wristPosition();
      this.ctx.vfx?.lightning(from, pylon, this.def.color, { width: 0.04, duration: 0.25, jitter: 0.35, branches: 1 });
    }
  }

  dispose() {
    this.mark.dispose();
  }
}
