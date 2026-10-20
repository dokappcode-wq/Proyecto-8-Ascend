import * as THREE from 'three';

const RED = new THREE.Color('#ff3b3b');

/**
 * DroneModel — dron de vigilancia de la PDC (cuatro rotores y una lente).
 * Misma interfaz que CharacterModel para que Enemy lo use igual:
 * `root`, `anchors` (muzzle, wristR, chest), `animate`, `trigger`, `setReload`.
 * Los pies (el origen) quedan bajo el cuerpo.
 */
export class DroneModel {
  constructor() {
    this.root = new THREE.Group();
    this.root.name = 'dron';
    this.anchors = {};
    this._time = Math.random() * 10;
    this._hit = 0;
    const dark = new THREE.MeshStandardMaterial({ color: 0x1d232b, metalness: 0.6, roughness: 0.4 });
    const panel = new THREE.MeshStandardMaterial({ color: 0x3a4656, metalness: 0.5, roughness: 0.5 });
    const body = new THREE.Group();
    body.position.y = 0.32;
    this.root.add(body);
    this.body = body;
    const core = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.42), panel);
    core.castShadow = true;
    body.add(core);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), dark);
    dome.position.y = 0.08;
    body.add(dome);
    // Lente (el «ojo») delante
    const lens = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshBasicMaterial({ color: RED.clone().multiplyScalar(1.6), toneMapped: false }));
    lens.position.set(0, -0.02, 0.22);
    body.add(lens);
    this.lens = lens;
    // Brazos y rotores
    this.rotors = [];
    for (const [x, z] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.04, 0.05), dark);
      arm.position.set(x * 0.24, 0.02, z * 0.24);
      arm.rotation.y = Math.atan2(z, x) * -1;
      body.add(arm);
      const rotor = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.015, 14), new THREE.MeshBasicMaterial({ color: 0x8fa0b0, transparent: true, opacity: 0.35, depthWrite: false }));
      rotor.position.set(x * 0.38, 0.07, z * 0.38);
      body.add(rotor);
      this.rotors.push(rotor);
    }
    // Arma bajo el cuerpo
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.26), dark);
    gun.position.set(0, -0.12, 0.1);
    body.add(gun);
    this.anchors.muzzle = new THREE.Object3D();
    this.anchors.muzzle.position.set(0, -0.12, 0.25);
    body.add(this.anchors.muzzle);
    this.anchors.wristR = this.anchors.muzzle;
    this.anchors.chest = body;
  }

  setReload() {}

  trigger(kind) {
    if (kind === 'hit') this._hit = 1;
  }

  /** @param {object} s { speed, verticalSpeed, … } */
  animate(dt, s) {
    this._time += dt;
    for (const r of this.rotors) r.rotation.y += dt * 40;
    this._hit = Math.max(0, this._hit - dt * 5);
    // Balanceo suave al flotar, inclinación hacia delante al moverse y sacudida al recibir
    const lean = Math.min(0.35, (s.speed ?? 0) * 0.04);
    this.body.rotation.x = lean + Math.sin(this._hit * Math.PI) * 0.4;
    this.body.rotation.z = Math.sin(this._time * 1.7) * 0.06;
    this.body.position.y = 0.32 + Math.sin(this._time * 2.3) * 0.04;
    this.lens.material.color.copy(RED).multiplyScalar(1.2 + Math.sin(this._time * 6) * 0.4);
  }
}
