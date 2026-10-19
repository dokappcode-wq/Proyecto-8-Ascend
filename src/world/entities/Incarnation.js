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
const PALETTES = {
  // Gravedad: abrigo gris violáceo, pelo canoso
  gravedad: { skin: 0xc79478, jacket: 0x4f4558, hoodie: 0x2f2f35, pants: 0x4a4036, boots: 0x2e2622, hair: 0x9a9590 },
  // Hilo: chaqueta clara de punto, pantalón beis
  hilo: { skin: 0xb98266, jacket: 0xd9d4c8, hoodie: 0x6b6f7a, pants: 0x8f826b, boots: 0x3a3330, hair: 0x1f1a17 },
  // Temperatura: anorak de invierno sobre camiseta naranja
  temperatura: { skin: 0xd2a07e, jacket: 0x2d6f73, hoodie: 0xc8642a, pants: 0x3c4148, boots: 0x2a2624, hair: 0x6e3b22 },
  // Alas: cazadora rosa palo y sudadera blanca
  alas: { skin: 0x8d5a3f, jacket: 0xd68aa6, hoodie: 0xf2eef0, pants: 0x4a4a58, boots: 0x2c2628, hair: 0xe8d8b0 },
};

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

    // Cada Encarnación viste distinto (siempre ropa corriente)
    this.model = new CharacterModel({ variant: 'incarnation', palette: PALETTES[markId] ?? null });
    this.model.root.position.set(x, y, z);
    this.model.root.rotation.y = yaw;
    ctx.group.add(this.model.root);
    // Lejos de la cámara se oculta (MapManager.cull)
    this.lodRoot = this.model.root;
    this.lodDistance = 60;
    this.mark = new MarkVisual(this.model, this.def);
    this.mark.setWristVisibility(0.18); // casi oculta

    // No se le puede atravesar
    ctx.world.addBox({ x: x - 0.35, y, z: z - 0.35 }, { x: x + 0.35, y: y + 1.85, z: z + 0.35 }, { tag: 'npc' });
  }

  /** Conserva su marca y su poder después de la copia. */
  get hasPower() {
    return this.mark.parts.length > 0;
  }

  /** Posición de la muñeca donde lleva la marca, en el mundo. */
  wristPosition(out = new THREE.Vector3()) {
    this.model.root.updateMatrixWorld(true);
    return this.model.anchors[`wrist${this.mark.side}`].getWorldPosition(out);
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
    if (!this.model.root.visible) return;
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
