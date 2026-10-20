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
  // Generador portátil (modo historia): mucha carga y se recupera enseguida
  generator: { name: 'Generador', element: 'energia', capacity: 120, rechargeTime: 8 },
  // Gravedad: cosas pesadas
  rubble: { name: 'Escombros', element: 'gravedad', capacity: 80, rechargeTime: 24 },
  concrete: { name: 'Bloque de hormigón', element: 'gravedad', capacity: 60, rechargeTime: 20 },
  // Hilo: cosas de tela y cuerda
  clothesline: { name: 'Tendedero', element: 'hilo', capacity: 60, rechargeTime: 20 },
  fabric: { name: 'Rollos de tela', element: 'hilo', capacity: 80, rechargeTime: 24 },
  // Temperatura: frío y calor
  icebox: { name: 'Arcón congelador', element: 'temperatura', capacity: 80, rechargeTime: 24 },
  brazier: { name: 'Bidón con fuego', element: 'temperatura', capacity: 60, rechargeTime: 20 },
  // Alas: plumas (palomares y montones de cojines)
  dovecote: { name: 'Palomar', element: 'alas', capacity: 60, rechargeTime: 18 },
  pillows: { name: 'Montón de cojines', element: 'alas', capacity: 50, rechargeTime: 16 },
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
    // Lejos de la cámara se oculta (MapManager.cull); las que tienen luz no, porque
    // cambiar el número de luces obliga a recompilar los materiales
    if (!this.light) {
      this.lodRoot = this.root;
      this.lodDistance = 70;
    }
  }

  _build(kind, withLight) {
    const metal = new THREE.MeshStandardMaterial({ color: 0x6b737d, metalness: 0.55, roughness: 0.5 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2a2f36, metalness: 0.4, roughness: 0.6 });
    const add = (geo, mat, px, py, pz) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(px, py, pz);
      // Solo las piezas grandes proyectan sombra (cada sombra es otra llamada de dibujo)
      geo.computeBoundingSphere();
      m.castShadow = geo.boundingSphere.radius > 0.3;
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
    } else if (kind === 'clothesline') {
      // Dos postes, una cuerda y ropa tendida (la cuerda brilla un poco)
      const post = new THREE.MeshStandardMaterial({ color: 0x5c5f66, metalness: 0.4, roughness: 0.6 });
      add(new THREE.CylinderGeometry(0.04, 0.05, 1.9, 6), post, -1.2, 0.95, 0);
      add(new THREE.CylinderGeometry(0.04, 0.05, 1.9, 6), post, 1.2, 0.95, 0);
      add(new THREE.BoxGeometry(2.4, 0.025, 0.025), glow(0xffffff, 1.2), 0, 1.82, 0);
      const cloth = [0x3d6fa8, 0xd8d2c4, 0xa8443d, 0x6b8a4a];
      cloth.forEach((c, i) => add(new THREE.BoxGeometry(0.42, 0.6, 0.02), new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, side: THREE.DoubleSide }), -0.8 + i * 0.53, 1.5, 0));
      this._drainLocal = new THREE.Vector3(0, 1.8, 0);
      this._size = { w: 2.5, d: 0.3, h: 1.9 };
    } else if (kind === 'fabric') {
      // Puesto con rollos de tela apilados sobre un palé
      add(new THREE.BoxGeometry(1.4, 0.15, 1.0), new THREE.MeshStandardMaterial({ color: 0x8a6a42, roughness: 0.9 }), 0, 0.075, 0);
      const cols = [0xc9c2b4, 0x7b2f3a, 0x2f4f7b, 0xd9c27a, 0x4d6b4a];
      for (let i = 0; i < 5; i++) {
        const row = i < 3 ? 0 : 1;
        const x = row ? -0.22 + (i - 3) * 0.44 : -0.44 + i * 0.44;
        const r = add(new THREE.CylinderGeometry(0.21, 0.21, 0.95, 14), new THREE.MeshStandardMaterial({ color: cols[i], roughness: 0.95 }), x, 0.36 + row * 0.38, 0);
        r.rotation.x = Math.PI / 2;
      }
      add(new THREE.BoxGeometry(1.0, 0.02, 0.02), glow(0xffffff, 1.2), 0, 0.98, 0.3);
      this._drainLocal = new THREE.Vector3(0, 0.8, 0.3);
      this._size = { w: 1.4, d: 1.0, h: 1.0 };
    } else if (kind === 'generator') {
      // Generador de obra: carcasa amarilla, bobinas azules y un cable
      const shell = new THREE.MeshStandardMaterial({ color: 0xc9a13a, roughness: 0.6, metalness: 0.3 });
      add(new THREE.BoxGeometry(1.2, 0.9, 0.8), shell, 0, 0.55, 0);
      add(new THREE.BoxGeometry(1.3, 0.1, 0.9), dark, 0, 0.05, 0);
      for (const x of [-0.3, 0.3]) {
        const coil = add(new THREE.CylinderGeometry(0.12, 0.12, 0.32, 10), glow(0x6fc3ff, 2.2), x, 1.15, 0);
        coil.castShadow = false;
      }
      add(new THREE.BoxGeometry(0.5, 0.25, 0.04), dark, 0, 0.6, 0.42);
      this._drainLocal = new THREE.Vector3(0, 1.2, 0.2);
      this._size = { w: 1.3, d: 0.9, h: 1.3 };
    } else if (kind === 'icebox') {
      // Arcón congelador de tienda con escarcha turquesa en la junta
      const white = new THREE.MeshStandardMaterial({ color: 0xe4e8ea, roughness: 0.45, metalness: 0.1 });
      add(new THREE.BoxGeometry(1.4, 0.82, 0.72), white, 0, 0.41, 0);
      add(new THREE.BoxGeometry(1.44, 0.08, 0.76), new THREE.MeshStandardMaterial({ color: 0xb9c3c8, roughness: 0.4 }), 0, 0.86, 0);
      add(new THREE.BoxGeometry(1.3, 0.04, 0.02), glow(0x2ee6d6, 1.8), 0, 0.8, 0.365);
      add(new THREE.BoxGeometry(0.3, 0.05, 0.03), dark, 0, 0.7, 0.37);
      this._drainLocal = new THREE.Vector3(0, 0.95, 0.2);
      this._size = { w: 1.44, d: 0.76, h: 0.9 };
    } else if (kind === 'brazier') {
      // Bidón de chapa con fuego dentro (las brasas brillan en naranja)
      const drum = new THREE.MeshStandardMaterial({ color: 0x4a3a30, roughness: 0.8, metalness: 0.3 });
      add(new THREE.CylinderGeometry(0.32, 0.3, 0.92, 12, 1, true), drum, 0, 0.46, 0);
      add(new THREE.TorusGeometry(0.32, 0.025, 6, 16), dark, 0, 0.3, 0).rotation.x = Math.PI / 2;
      const ember = add(new THREE.CircleGeometry(0.3, 12), glow(0xff8a2a, 2.4), 0, 0.84, 0);
      ember.rotation.x = -Math.PI / 2;
      add(new THREE.ConeGeometry(0.18, 0.4, 7), glow(0xffb347, 2.0), 0, 1.05, 0);
      this._drainLocal = new THREE.Vector3(0, 1.0, 0);
      this._size = { w: 0.66, d: 0.66, h: 0.95 };
    } else if (kind === 'dovecote') {
      // Palomar de madera sobre un poste, con plumas sueltas que brillan
      const wood = new THREE.MeshStandardMaterial({ color: 0x8a6a48, roughness: 0.85 });
      add(new THREE.CylinderGeometry(0.06, 0.07, 1.6, 6), wood, 0, 0.8, 0);
      add(new THREE.BoxGeometry(0.9, 0.6, 0.6), wood, 0, 1.9, 0);
      const roof = add(new THREE.ConeGeometry(0.72, 0.4, 4), new THREE.MeshStandardMaterial({ color: 0x6b3b2e, roughness: 0.8 }), 0, 2.4, 0);
      roof.rotation.y = Math.PI / 4;
      for (const x of [-0.22, 0.22]) add(new THREE.CircleGeometry(0.09, 10), dark, x, 1.95, 0.301);
      add(new THREE.BoxGeometry(0.7, 0.03, 0.12), glow(0xff6fa8, 1.6), 0, 1.66, 0.33);
      this._drainLocal = new THREE.Vector3(0, 1.9, 0.35);
      this._size = { w: 0.9, d: 0.6, h: 2.6 };
    } else if (kind === 'pillows') {
      // Montón de cojines y un edredón de plumas (las costuras brillan)
      const cols = [0xf1e6ea, 0xd98fae, 0xe9d8c4, 0xb9c8e0];
      add(new THREE.BoxGeometry(1.3, 0.22, 0.9), new THREE.MeshStandardMaterial({ color: 0xf6eef2, roughness: 0.95 }), 0, 0.11, 0);
      [[-0.3, 0.32, 0.1], [0.3, 0.32, -0.1], [0, 0.52, 0], [0.05, 0.3, 0.25]].forEach(([x, y, z], i) => {
        const c = add(new THREE.BoxGeometry(0.55, 0.18, 0.42), new THREE.MeshStandardMaterial({ color: cols[i], roughness: 0.95 }), x, y, z);
        c.rotation.y = i * 0.5;
      });
      add(new THREE.BoxGeometry(1.2, 0.02, 0.02), glow(0xff6fa8, 1.4), 0, 0.23, 0.455);
      this._drainLocal = new THREE.Vector3(0, 0.6, 0.2);
      this._size = { w: 1.3, d: 0.9, h: 0.65 };
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
