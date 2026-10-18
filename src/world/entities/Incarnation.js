import * as THREE from 'three';
import { CharacterModel } from '../../player/CharacterModel.js';
import { MarkVisual } from '../../player/MarkVisual.js';
import { MARKS } from '../../data/marks.js';

/**
 * Encarnación de prueba (estación de adquisición). Persona corriente, no
 * hostil, que posee una marca ORIGINAL e intenta ocultar su poder: no hay
 * aura ni efectos a su alrededor y su marca apenas se ve en la muñeca.
 * Solo al establecerse la conexión la marca se ilumina un momento.
 * Tras la copia conserva su marca y su poder (Regla IV).
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

    this.model = new CharacterModel({ variant: 'incarnation' });
    this.model.root.position.set(x, y, z);
    this.model.root.rotation.y = yaw;
    ctx.group.add(this.model.root);
    this.mark = new MarkVisual(this.model, this.def);
    this.mark.setWristVisibility(0.18); // casi oculta

    // No se le puede atravesar
    ctx.world.addBox({ x: x - 0.35, y, z: z - 0.35 }, { x: x + 0.35, y: y + 1.85, z: z + 0.35 }, { tag: 'npc' });
  }

  /** Conserva su marca y su poder después de la copia. */
  get hasPower() {
    return this.mark.parts.length > 0;
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
    // En reposo no muestra su poder; durante la conexión se le escapa un poco
    this.mark.setWristVisibility(0.18 + this.reach * 0.4 + this.channel * 0.42);
    this.mark.setIntensity(this.channel * 0.7);
    this.model.animate(dt, {
      speed: 0, grounded: true, sprinting: false, dodging: false, verticalSpeed: 0,
      aimWeight: this.reach, aimPitch: -0.35,
    });
    this.model.root.rotation.y = this.yaw;
  }

  dispose() {
    this.mark.dispose();
  }
}
