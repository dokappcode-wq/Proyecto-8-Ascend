import * as THREE from 'three';
import { MARKS } from '../data/marks.js';
import { markSymbolTexture } from './markTextures.js';

/**
 * CharacterModel — modelo provisional del protagonista construido con
 * primitivas y animado proceduralmente (sin recursos externos).
 *
 * Mira hacia +Z en su espacio local. Los pies están en el origen.
 *
 * Expone `anchors` (muñecas, antebrazos, hombros, pecho…) para que el futuro
 * sistema de patrones de marcas (Etapa 2) pueda adherir geometría emisiva al
 * cuerpo sin modificar el modelo.
 */
export class CharacterModel {
  constructor() {
    this.root = new THREE.Group();
    this.root.name = 'Protagonista';
    this.anchors = {};
    this._phase = 0;
    this._time = 0;
    this._air = 0;
    this._dodge = 0;
    this._lean = 0;
    this._land = 0;
    this._cast = 0;
    this._waveT = 0;
    this._dive = 0;
    this._build();
  }

  _build() {
    const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.05, ...opts });
    const M = {
      skin: mat(0xc99a7c, { roughness: 0.6 }),
      jacket: mat(0x1d2128, { roughness: 0.55, metalness: 0.15 }),
      hoodie: mat(0x2a2f38),
      pants: mat(0x15171b),
      boots: mat(0x3a2c22, { roughness: 0.7 }),
      hair: mat(0x0d0d10, { roughness: 0.9 }),
      strap: mat(0x4a3b2e),
      tech: mat(0x2a3440, { metalness: 0.6, roughness: 0.35 }),
    };
    const box = (w, h, d, m) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      return mesh;
    };
    const cap = (r, len, m) => {
      const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 10), m);
      mesh.castShadow = true;
      return mesh;
    };

    // --- Cadera y torso ---
    const hips = new THREE.Group();
    hips.position.y = 0.95;
    this.root.add(hips);
    this.hips = hips;

    const pelvis = box(0.36, 0.18, 0.22, M.pants);
    pelvis.position.y = 0.02;
    hips.add(pelvis);

    const chest = new THREE.Group();
    chest.position.y = 0.1;
    hips.add(chest);
    this.chest = chest;

    const torso = box(0.44, 0.5, 0.25, M.jacket);
    torso.position.y = 0.28;
    chest.add(torso);
    const hoodieFront = box(0.2, 0.42, 0.02, M.hoodie);
    hoodieFront.position.set(0, 0.27, 0.13);
    chest.add(hoodieFront);
    const collar = box(0.36, 0.08, 0.27, M.hoodie);
    collar.position.y = 0.55;
    chest.add(collar);

    // Mochila con tecnología básica
    const pack = box(0.32, 0.36, 0.13, M.tech);
    pack.position.set(0, 0.3, -0.19);
    chest.add(pack);
    const packLight = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.02, 0.01),
      new THREE.MeshStandardMaterial({ color: 0x0, emissive: 0x6fb6ff, emissiveIntensity: 1.2 }),
    );
    packLight.position.set(0, 0.36, -0.26);
    chest.add(packLight);
    for (const sx of [-0.12, 0.12]) {
      const strap = box(0.04, 0.5, 0.02, M.strap);
      strap.position.set(sx, 0.3, 0.13);
      chest.add(strap);
    }
    this.anchors.chest = chest;

    // --- Cabeza ---
    const neck = new THREE.Group();
    neck.position.y = 0.6;
    chest.add(neck);
    const neckMesh = cap(0.055, 0.06, M.skin);
    neckMesh.position.y = 0.04;
    neck.add(neckMesh);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.125, 18, 14), M.skin);
    head.scale.set(0.95, 1.1, 1);
    head.position.y = 0.2;
    head.castShadow = true;
    neck.add(head);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.135, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), M.hair);
    hair.position.y = 0.225;
    hair.rotation.x = -0.25;
    hair.scale.set(1.02, 1.05, 1.08);
    hair.castShadow = true;
    neck.add(hair);
    const fringe = box(0.2, 0.06, 0.05, M.hair);
    fringe.position.set(0, 0.29, 0.1);
    fringe.rotation.x = 0.5;
    neck.add(fringe);
    this.neck = neck;

    // --- Brazos ---
    // Lado izquierdo del personaje = +X (mira hacia +Z).
    this.arms = {};
    for (const side of ['L', 'R']) {
      const s = side === 'L' ? 1 : -1;
      const shoulder = new THREE.Group();
      shoulder.position.set(0.27 * s, 0.5, 0);
      chest.add(shoulder);
      const upper = cap(0.065, 0.2, M.jacket);
      upper.position.y = -0.15;
      shoulder.add(upper);
      const elbow = new THREE.Group();
      elbow.position.y = -0.3;
      shoulder.add(elbow);
      const fore = cap(0.055, 0.18, M.jacket);
      fore.position.y = -0.13;
      elbow.add(fore);
      const wrist = new THREE.Group();
      wrist.position.y = -0.27;
      elbow.add(wrist);
      const hand = box(0.07, 0.1, 0.09, M.skin);
      hand.position.y = -0.05;
      wrist.add(hand);
      // Piel visible de la muñeca (la manga está remangada para mostrar la marca).
      const wristSkin = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.06, 12), M.skin);
      wristSkin.position.y = 0.02;
      wrist.add(wristSkin);

      this.arms[side] = { shoulder, elbow, wrist };
      this.anchors[`shoulder${side}`] = shoulder;
      this.anchors[`upperArm${side}`] = upper;
      this.anchors[`forearm${side}`] = fore;
      this.anchors[`wrist${side}`] = wrist;
    }

    // --- Piernas ---
    this.legs = {};
    for (const side of ['L', 'R']) {
      const s = side === 'L' ? 1 : -1;
      const hip = new THREE.Group();
      hip.position.set(0.1 * s, 0, 0);
      hips.add(hip);
      const thigh = cap(0.085, 0.3, M.pants);
      thigh.position.y = -0.22;
      hip.add(thigh);
      const knee = new THREE.Group();
      knee.position.y = -0.45;
      hip.add(knee);
      const shin = cap(0.07, 0.3, M.pants);
      shin.position.y = -0.2;
      knee.add(shin);
      const boot = box(0.12, 0.1, 0.24, M.boots);
      boot.position.set(0, -0.44, 0.04);
      knee.add(boot);
      this.legs[side] = { hip, knee };
    }

    // --- Marca original del Destino (muñeca izquierda) ---
    const destino = MARKS.destino;
    const markMat = new THREE.MeshBasicMaterial({
      map: markSymbolTexture(destino.symbol, destino.glowColor),
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
    const mark = new THREE.Mesh(new THREE.PlaneGeometry(0.075, 0.075), markMat);
    // Cara externa de la muñeca izquierda (+X).
    mark.position.set(0.052, 0.02, 0);
    mark.rotation.y = Math.PI / 2;
    this.anchors.wristL.add(mark);
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(0.052, 0.004, 6, 24),
      new THREE.MeshBasicMaterial({ color: destino.color, toneMapped: false }),
    );
    band.rotation.x = Math.PI / 2;
    band.position.y = -0.005;
    this.anchors.wristL.add(band);
    this.destinoMark = { plane: mark, band };
  }

  /** Gestos breves: 'cast' (retroceso del brazo al disparar) y 'wave' (onda expansiva). */
  trigger(kind) {
    if (kind === 'cast') this._cast = 1;
    if (kind === 'wave') this._waveT = 1;
  }

  /**
   * @param {number} dt
   * @param {object} s estado del motor: { speed, grounded, sprinting, dodging, verticalSpeed, landed, landingSpeed }
   */
  animate(dt, s) {
    this._time += dt;
    const k = (rate) => 1 - Math.exp(-dt * rate);

    const speed = s.speed;
    const moving = Math.min(1, speed / 5);
    const run = Math.min(1, Math.max(0, (speed - 5) / 4.5));
    this._air += ((s.grounded ? 0 : 1) - this._air) * k(14);
    this._dodge += ((s.dodging ? 1 : 0) - this._dodge) * k(20);
    if (s.landed) this._land = Math.min(1, s.landingSpeed / 18);
    this._land = Math.max(0, this._land - dt * 4);

    // Ciclo de pasos proporcional a la velocidad.
    if (s.grounded) this._phase += dt * (4.2 + speed * 1.05);
    const ph = this._phase;
    const swing = Math.sin(ph) * (0.25 + 0.45 * moving + 0.25 * run) * moving;

    const ground = 1 - this._air;
    const L = this.legs.L;
    const R = this.legs.R;
    const airTuck = this._air;

    // Piernas
    L.hip.rotation.x = -swing * ground + airTuck * -0.7;
    R.hip.rotation.x = swing * ground + airTuck * 0.15;
    L.knee.rotation.x = Math.max(0, Math.sin(ph + Math.PI * 0.5)) * 0.9 * moving * ground + airTuck * 1.1;
    R.knee.rotation.x = Math.max(0, Math.sin(ph - Math.PI * 0.5)) * 0.9 * moving * ground + airTuck * 0.5;

    // Brazos (opuestos a las piernas)
    const armSwing = swing * 1.1;
    const A = this.arms;
    A.L.shoulder.rotation.x = armSwing * ground + airTuck * -0.9 + this._dodge * 0.9;
    A.R.shoulder.rotation.x = -armSwing * ground + airTuck * -0.6 + this._dodge * 0.9;
    A.L.shoulder.rotation.z = 0.08 + airTuck * 0.35;
    A.R.shoulder.rotation.z = -0.08 - airTuck * 0.35;
    A.L.elbow.rotation.x = -0.25 - 0.6 * run - airTuck * 0.4;
    A.R.elbow.rotation.x = -0.25 - 0.6 * run - airTuck * 0.4;

    // Brazo derecho apuntando (poderes) y gestos
    this._cast = Math.max(0, this._cast - dt * 6);
    this._waveT = Math.max(0, this._waveT - dt * 3);
    const w = s.aimWeight ?? 0;
    if (w > 0.001) {
      const aimX = -Math.PI / 2 - (s.aimPitch ?? 0) + this._cast * 0.25;
      A.R.shoulder.rotation.x += (aimX - A.R.shoulder.rotation.x) * w;
      A.R.shoulder.rotation.z += (0.05 - A.R.shoulder.rotation.z) * w;
      A.R.elbow.rotation.x += (-0.08 - this._cast * 0.3 - A.R.elbow.rotation.x) * w;
    }
    if (this._waveT > 0) {
      const e = Math.sin(this._waveT * Math.PI);
      A.L.shoulder.rotation.z += 1.2 * e;
      A.R.shoulder.rotation.z -= 1.2 * e;
      A.L.shoulder.rotation.x -= 0.3 * e;
      A.R.shoulder.rotation.x -= 0.3 * e;
      this._land = Math.max(this._land, 0.5 * e);
    }

    // Picado en rayo: cuerpo recto, piernas juntas, puño derecho hacia abajo
    this._dive += ((s.diving ? 1 : 0) - this._dive) * k(18);
    if (this._dive > 0.001) {
      const d = this._dive;
      const mix = (obj, axis, v) => (obj.rotation[axis] += (v - obj.rotation[axis]) * d);
      mix(L.hip, 'x', -0.1);
      mix(R.hip, 'x', 0.15);
      mix(L.knee, 'x', 0.25);
      mix(R.knee, 'x', 0.5);
      mix(A.R.shoulder, 'x', -0.35);
      mix(A.R.shoulder, 'z', -0.05);
      mix(A.R.elbow, 'x', 0);
      mix(A.L.shoulder, 'x', 0.9);
      mix(A.L.shoulder, 'z', 0.5);
    }

    // Torso: inclinación al correr / esquivar, respiración en reposo
    const targetLean = 0.08 * moving + 0.18 * run + this._dodge * 0.55 + airTuck * 0.05 + this._dive * 0.35;
    this._lean += (targetLean - this._lean) * k(10);
    this.chest.rotation.x = this._lean;
    const breathe = Math.sin(this._time * 2.2) * 0.012 * (1 - moving);
    const bob = Math.abs(Math.cos(ph)) * 0.05 * moving * ground;
    this.hips.position.y = 0.95 + bob + breathe - this._land * 0.25 - this._dodge * 0.18;
    this.neck.rotation.x = -this._lean * 0.6;

    // Pulso suave de la marca del Destino
    const pulse = 0.75 + Math.sin(this._time * 2.5) * 0.25;
    this.destinoMark.plane.material.opacity = pulse;
  }
}
