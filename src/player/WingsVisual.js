import * as THREE from 'three';

const FEATHER_GEO = new THREE.PlaneGeometry(0.1, 0.5).translate(0, -0.25, 0);
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();

/** Material de pluma (blanco con el tono de la marca y un leve brillo). */
export function featherMaterial(color) {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color('#fff6fa').lerp(new THREE.Color(color), 0.25),
    emissive: new THREE.Color(color).multiplyScalar(0.18),
    roughness: 0.7, side: THREE.DoubleSide,
  });
}

/** Geometría compartida de una pluma (cuelga desde su raíz hacia -Y). */
export { FEATHER_GEO };

/**
 * WingsVisual — alas de plumas en la espalda del personaje y espada de plumas
 * en la mano derecha (marca de las Alas).
 *
 * Cada ala es un InstancedMesh (una llamada de dibujo): se ven tantas plumas
 * como le quedan al personaje. Plegadas en reposo; abiertas y batiendo al volar.
 */
export class WingsVisual {
  constructor(model, color, perWing = 25) {
    this.model = model;
    this.perWing = perWing;
    this.mat = featherMaterial(color);
    this.root = new THREE.Group();
    this.root.position.set(0, 0.42, -0.16);
    model.anchors.chest.add(this.root);
    this.wings = [-1, 1].map((side) => {
      const pivot = new THREE.Group();
      pivot.position.x = side * 0.1;
      const mesh = new THREE.InstancedMesh(FEATHER_GEO, this.mat, perWing);
      mesh.castShadow = true;
      mesh.frustumCulled = false;
      for (let i = 0; i < perWing; i++) {
        const t = i / (perWing - 1);
        const row = i % 3;
        // A lo largo del ala, en tres filas; más largas hacia la punta
        _p.set(side * (0.05 + t * 1.05), -row * 0.1 - t * 0.12, -row * 0.015);
        _e.set(0, 0, side * (0.15 + t * 0.9));
        _q.setFromEuler(_e);
        const len = 0.7 + t * 0.7 + (2 - row) * 0.15;
        _s.set(1, len, 1);
        mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
      }
      pivot.add(mesh);
      this.root.add(pivot);
      return { side, pivot, mesh };
    });
    this.open = 0; // 0 plegadas, 1 abiertas
    this._t = 0;
    this.sword = null;
    this.setVisible(false);
  }

  setVisible(v) {
    this.root.visible = v;
  }

  /** Muestra tantas plumas como la proporción que queda (0..1). */
  setFeathers(ratio) {
    const n = Math.max(0, Math.min(this.perWing, Math.round(ratio * this.perWing)));
    for (const w of this.wings) w.mesh.count = n;
  }

  update(dt, flying) {
    this._t += dt;
    this.open += ((flying ? 1 : 0) - this.open) * (1 - Math.exp(-dt * 6));
    const flap = flying ? Math.sin(this._t * 7) * 0.35 : 0;
    for (const w of this.wings) {
      // Plegadas: hacia atrás y caídas; abiertas: extendidas y batiendo
      w.pivot.rotation.y = w.side * (1.25 * (1 - this.open)) * -1;
      w.pivot.rotation.z = w.side * ((-0.55 * (1 - this.open)) + flap * this.open);
    }
  }

  /** Espada de plumas en la mano derecha (null la quita). `level` 0..3 la hace más grande. */
  setSword(level) {
    if (this.sword) {
      this.sword.parent?.remove(this.sword);
      this.sword.dispose();
      this.sword = null;
    }
    if (level === null || level === undefined) return;
    const n = 20 + level * 10;
    const len = 0.85 + level * 0.3;
    const mesh = new THREE.InstancedMesh(FEATHER_GEO, this.mat, n);
    mesh.frustumCulled = false;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const side = i % 2 ? 1 : -1;
      // Hoja: plumas a lo largo del eje, alternando a cada lado; se estrecha en la punta
      _p.set(side * 0.015, -0.12 - t * len, 0);
      _e.set(0, 0, side * (0.35 - t * 0.25));
      _q.setFromEuler(_e);
      _s.set(1.2 - t * 0.6, 0.35 + (1 - t) * 0.25, 1);
      mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
    }
    mesh.position.set(0, -0.08, 0.04);
    this.model.anchors.wristR.add(mesh);
    this.sword = mesh;
  }

  dispose() {
    this.setSword(null);
    this.root.parent?.remove(this.root);
    for (const w of this.wings) w.mesh.dispose();
    this.mat.dispose();
  }
}
