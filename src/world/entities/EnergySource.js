import * as THREE from 'three';
import { EnergyReserve } from '../../powers/EnergyReserve.js';

/**
 * Fuente de energía cotidiana: farola, armario eléctrico o máquina
 * expendedora. El protagonista la absorbe (mantener E) para recargar su
 * energía elemental. Al agotarse se apaga y se recupera sola con el tiempo.
 *
 * Mira hacia +Z en su espacio local (la cara "frontal" queda en +Z).
 */
export const SOURCE_KINDS = {
  // Energía: cosas eléctricas
  lamp: { name: 'Farola', element: 'energia', capacity: 50, rechargeTime: 18 },
  cabinet: { name: 'Armario eléctrico', element: 'energia', capacity: 90, rechargeTime: 25 },
  vending: { name: 'Máquina expendedora', element: 'energia', capacity: 70, rechargeTime: 22 },
  // Gravedad: cosas pesadas
  rubble: { name: 'Escombros', element: 'gravedad', capacity: 80, rechargeTime: 24 },
  concrete: { name: 'Bloque de hormigón', element: 'gravedad', capacity: 60, rechargeTime: 20 },
};
const KINDS = SOURCE_KINDS;

export class EnergySource {
  /**
   * @param {object} ctx contexto del mapa (group, world)
   * @param {object} o { kind, x, y=0, z, yaw=0, light=false (solo farolas) }
   */
  constructor(ctx, { kind = 'cabinet', x, y = 0, z, yaw = 0, light = false }) {
    this.ctx = ctx;
    this.kind = kind;
    const k = KINDS[kind];
    this.name = k.name;
    /** Elemento que recarga ('energia' | 'gravedad'). */
    this.element = k.element;
    this.reserve = new EnergyReserve({ capacity: k.capacity, rechargeTime: k.rechargeTime });
    this.root = new THREE.Group();
    this.root.position.set(x, y, z);
    this.root.rotation.y = yaw;
    ctx.group.add(this.root);
    this.glowMats = []; // { mat, base } — su brillo baja al agotarse
    this.light = null;
    this._time = Math.random() * 10;
    this._build(kind, light);
    this.root.updateMatrixWorld(true);
    // Punto desde el que sale la energía (en el mundo)
    this.drainPoint = this._drainLocal.clone().applyMatrix4(this.root.matrixWorld);
    this.position = { x, y, z };
    this._addCollider(x, y, z, yaw);
  }

  _build(kind, withLight) {
    const metal = new THREE.MeshStandardMaterial({ color: 0x6b737d, metalness: 0.55, roughness: 0.5 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2a2f36, metalness: 0.4, roughness: 0.6 });
    const add = (geo, mat, px, py, pz) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(px, py, pz);
      m.castShadow = true;
      m.receiveShadow = true;
      this.root.add(m);
      return m;
    };
    const glow = (color, intensity) => {
      const mat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: color, emissiveIntensity: intensity });
      this.glowMats.push({ mat, base: intensity });
      return mat;
    };
    if (kind === 'lamp') {
      add(new THREE.CylinderGeometry(0.07, 0.1, 5, 6), metal, 0, 2.5, 0);
      add(new THREE.BoxGeometry(0.5, 0.18, 0.5), glow(0xffc27a, 2.2), 0, 5.05, 0);
      this._drainLocal = new THREE.Vector3(0, 4.95, 0);
      this._size = { w: 0.24, d: 0.24, h: 5 };
      if (withLight) {
        this.light = new THREE.PointLight(0xffc27a, 18, 16, 1.6);
        this.light.position.set(0, 4.7, 0);
        this.root.add(this.light);
      }
    } else if (kind === 'rubble') {
      // Montón de escombros de obra con vetas que vibran por la gravedad
      const rock = new THREE.MeshStandardMaterial({ color: 0x7a7470, roughness: 0.95, flatShading: true });
      const vein = glow(0xa24dff, 1.6);
      const pieces = [[0, 0.35, 0, 0.55], [0.55, 0.25, 0.2, 0.38], [-0.5, 0.22, -0.15, 0.36], [0.1, 0.75, -0.1, 0.32], [-0.2, 0.2, 0.5, 0.3], [0.35, 0.2, -0.5, 0.28]];
      for (const [px, py, pz, r] of pieces) {
        const m = add(new THREE.DodecahedronGeometry(r, 0), rock, px, py, pz);
        m.rotation.set(px * 3, pz * 5, py * 4);
      }
      add(new THREE.OctahedronGeometry(0.12, 0), vein, 0.05, 0.98, -0.05);
      add(new THREE.BoxGeometry(0.9, 0.03, 0.05), vein, 0, 0.42, 0.52);
      this._drainLocal = new THREE.Vector3(0, 0.8, 0.2);
      this._size = { w: 1.5, d: 1.4, h: 0.95 };
    } else if (kind === 'concrete') {
      // Bloque de hormigón de obra (barrera) con una grieta luminosa
      const conc = new THREE.MeshStandardMaterial({ color: 0xa8a39a, roughness: 0.9 });
      add(new THREE.BoxGeometry(1.8, 0.85, 0.6), conc, 0, 0.425, 0);
      add(new THREE.BoxGeometry(1.8, 0.2, 0.8), conc, 0, 0.1, 0);
      add(new THREE.BoxGeometry(0.7, 0.04, 0.02), glow(0xa24dff, 1.6), 0.1, 0.55, 0.305);
      add(new THREE.BoxGeometry(0.04, 0.3, 0.02), glow(0xa24dff, 1.6), -0.25, 0.42, 0.305);
      this._drainLocal = new THREE.Vector3(0, 0.6, 0.35);
      this._size = { w: 1.8, d: 0.8, h: 0.85 };
    } else if (kind === 'vending') {
      add(new THREE.BoxGeometry(1.0, 1.9, 0.8), new THREE.MeshStandardMaterial({ color: 0x9a2d2d, roughness: 0.5, metalness: 0.2 }), 0, 0.95, 0);
      add(new THREE.PlaneGeometry(0.62, 1.1), glow(0xbfe3ff, 1.4), -0.12, 1.15, 0.401);
      add(new THREE.BoxGeometry(0.18, 0.5, 0.05), dark, 0.33, 1.1, 0.41);
      this._drainLocal = new THREE.Vector3(-0.1, 1.2, 0.45);
      this._size = { w: 1.0, d: 0.8, h: 1.9 };
    } else {
      // Armario eléctrico de calle con piloto y señal de peligro
      add(new THREE.BoxGeometry(0.9, 1.4, 0.45), metal, 0, 0.7, 0);
      add(new THREE.BoxGeometry(0.92, 0.06, 0.47), dark, 0, 1.43, 0);
      add(new THREE.PlaneGeometry(0.12, 0.05), glow(0x5fd38a, 2), 0.3, 1.25, 0.226);
      const sign = add(new THREE.CircleGeometry(0.1, 3), new THREE.MeshStandardMaterial({ color: 0xf2c45a, emissive: 0x3a2a00 }), 0, 0.95, 0.227);
      sign.rotation.z = Math.PI / 2;
      this._drainLocal = new THREE.Vector3(0, 0.9, 0.3);
      this._size = { w: 0.9, d: 0.45, h: 1.45 };
    }
  }

  _addCollider(x, y, z, yaw) {
    const { w, d, h } = this._size;
    // Caja alineada: si está girada 90°, se intercambian ancho y fondo
    const rot = Math.abs(Math.sin(yaw)) > 0.7;
    const hw = (rot ? d : w) / 2;
    const hd = (rot ? w : d) / 2;
    this.collider = this.ctx.world.addBox({ x: x - hw, y, z: z - hd }, { x: x + hw, y: y + h, z: z + hd }, { tag: 'source', cameraBlocking: this.kind !== 'lamp' });
  }

  update(dt) {
    this._time += dt;
    this.reserve.update(dt);
    const r = this.reserve.ratio;
    // Parpadeo cuando está casi vacía
    const flicker = r < 0.25 && r > 0 ? 0.6 + Math.random() * 0.4 : 1;
    for (const g of this.glowMats) g.mat.emissiveIntensity = g.base * (0.05 + 0.95 * r) * flicker;
    if (this.light) this.light.intensity = 18 * r * flicker;
  }

  reset() {
    this.reserve.reset();
  }
}
