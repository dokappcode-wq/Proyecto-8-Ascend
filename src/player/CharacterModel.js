import * as THREE from 'three';
import { MARKS } from '../data/marks.js';
import { markSymbolTexture } from './markTextures.js';

/**
 * CharacterModel — modelo provisional del protagonista construido con
 * primitivas y animado proceduralmente (sin recursos externos).
 *
 * Mira hacia +Z en su espacio local. Los pies están en el origen.
 *
 * Expone `anchors` (muñecas, antebrazos, hombros, pecho…) para que el
 * sistema de patrones de marcas pueda adherir geometría emisiva al cuerpo
 * sin modificar el modelo.
 *
 * Variantes (misma estructura y animación):
 *  - 'protagonist': chaqueta, mochila tecnológica y marca del Destino.
 *  - 'pdc': agente de la Policía del Control (uniforme, chaleco, casco con
 *    visor y arma).
 *  - 'acolyte': Acólito de Energía (capucha, túnica y brazaletes luminosos;
 *    sin marca original, su poder es prestado).
 *  - 'incarnation': Encarnación vestida como cualquier persona (chaqueta y
 *    vaqueros); su marca original se añade con MarkVisual.
 */
const PALETTES = {
  protagonist: { skin: 0xc99a7c, jacket: 0x1d2128, hoodie: 0x2a2f38, pants: 0x15171b, boots: 0x3a2c22 },
  pdc: { skin: 0xb98a6c, jacket: 0x1f2b3d, hoodie: 0x2b3a50, pants: 0x18202c, boots: 0x111317 },
  acolyte: { skin: 0xa77e66, jacket: 0x2a1f38, hoodie: 0x3a2a4e, pants: 0x1c1626, boots: 0x231a1a },
  // Ropa de calle corriente: nada delata que es una Encarnación
  incarnation: { skin: 0xd9a888, jacket: 0x4a5640, hoodie: 0xb9b2a2, pants: 0x3a4a66, boots: 0x5a4632, hair: 0x4a3324 },
};

export class CharacterModel {
  /** @param {object} [o] { variant: 'protagonist' | 'pdc' | 'acolyte', glow: color del Acólito } */
  constructor({ variant = 'protagonist', glow = 0xb45cff } = {}) {
    this.variant = variant;
    this.glowColor = glow;
    this.root = new THREE.Group();
    this.root.name = variant === 'protagonist' ? 'Protagonista' : variant;
    this._hit = 0;
    this._punch = 0;
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
    this._reload = null; // progreso 0..1 de la recarga, o null
    this._reloadW = 0;
    this._crouch = 0;
    this._fists = null;
    this._build();
  }

  _build() {
    const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.05, ...opts });
    const V = this.variant;
    const pal = PALETTES[V] ?? PALETTES.protagonist;
    const M = {
      skin: mat(pal.skin, { roughness: 0.6 }),
      jacket: mat(pal.jacket, { roughness: 0.55, metalness: 0.15 }),
      hoodie: mat(pal.hoodie),
      pants: mat(pal.pants),
      boots: mat(pal.boots, { roughness: 0.7 }),
      hair: mat(pal.hair ?? 0x0d0d10, { roughness: 0.9 }),
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

    const glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(this.glowColor).multiplyScalar(1.6), toneMapped: false });
    if (V === 'protagonist') {
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
    } else if (V === 'pdc') {
      // Chaleco táctico con distintivo
      const vest = box(0.48, 0.4, 0.3, mat(0x2c3138, { roughness: 0.7 }));
      vest.position.y = 0.3;
      chest.add(vest);
      const badge = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.01), new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xe0a53a, emissiveIntensity: 0.9 }));
      badge.position.set(-0.12, 0.4, 0.156);
      chest.add(badge);
      const pouch = box(0.3, 0.08, 0.06, mat(0x2c3138));
      pouch.position.set(0, 0.14, 0.17);
      chest.add(pouch);
    } else if (V === 'acolyte') {
      // Túnica abierta y fajín con el brillo del poder prestado
      const robe = box(0.46, 0.62, 0.28, M.hoodie);
      robe.position.y = 0.22;
      chest.add(robe);
      const sash = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.3), glowMat);
      sash.position.y = 0.05;
      chest.add(sash);
      const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.32, 0.45, 12, 1, true), M.hoodie);
      skirt.position.y = -0.18;
      skirt.castShadow = true;
      hips.add(skirt);
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
    if (V === 'protagonist' || V === 'incarnation') {
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
    } else if (V === 'pdc') {
      const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.6), mat(0x1a2230, { metalness: 0.4, roughness: 0.45 }));
      helmet.position.y = 0.22;
      helmet.castShadow = true;
      neck.add(helmet);
      const visor = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.05), new THREE.MeshStandardMaterial({ color: 0x0b0e12, emissive: 0xff6a3a, emissiveIntensity: 0.9, metalness: 0.8, roughness: 0.2 }));
      visor.position.set(0, 0.22, 0.11);
      neck.add(visor);
    } else if (V === 'acolyte') {
      const hood = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.7), M.hoodie);
      hood.position.set(0, 0.2, -0.02);
      hood.scale.set(1, 1.15, 1.05);
      hood.castShadow = true;
      neck.add(hood);
      for (const ex of [-0.045, 0.045]) {
        const eye = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.012, 0.01), glowMat);
        eye.position.set(ex, 0.21, 0.122);
        neck.add(eye);
      }
    }
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
      const wristSkin = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.06, 12), V === 'acolyte' ? glowMat : M.skin);
      wristSkin.position.y = 0.02;
      wrist.add(wristSkin);
      if (V === 'pdc' && side === 'R') {
        // Arma reglamentaria (alineada con el antebrazo; apunta al levantar el brazo)
        const gun = new THREE.Group();
        const body = box(0.06, 0.45, 0.09, mat(0x15181c, { metalness: 0.6, roughness: 0.4 }));
        body.position.y = -0.2;
        gun.add(body);
        const grip = box(0.05, 0.05, 0.12, mat(0x15181c));
        grip.position.set(0, -0.06, -0.08);
        gun.add(grip);
        gun.position.z = 0.03;
        wrist.add(gun);
        this.anchors.muzzle = new THREE.Object3D();
        this.anchors.muzzle.position.set(0, -0.44, 0.03);
        wrist.add(this.anchors.muzzle);
      }

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

    if (V !== 'protagonist') {
      this.destinoMark = null;
      return;
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

  /**
   * Puños cargados de energía (golpe elemental). `intensity` 0 los oculta.
   */
  setFists(intensity, color = '#2f8bff') {
    if (!this._fists) {
      if (intensity <= 0) return;
      const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
      this._fists = [];
      for (const side of ['L', 'R']) {
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 8), mat);
        m.position.y = -0.06;
        this.anchors[`wrist${side}`].add(m);
        this._fists.push(m);
      }
    }
    for (const m of this._fists) {
      m.visible = intensity > 0.01;
      m.material.opacity = Math.min(1, intensity);
      m.scale.setScalar(0.8 + intensity * 0.6 + Math.random() * 0.15 * intensity);
    }
  }

  /** Pose de recarga: las manos se juntan ante el pecho mientras se carga energía. */
  setReload(progress) {
    this._reload = progress;
  }

  /** Gestos breves: 'cast' (retroceso del brazo al disparar) y 'wave' (onda expansiva). */
  trigger(kind) {
    if (kind === 'cast') this._cast = 1;
    if (kind === 'wave') this._waveT = 1;
    if (kind === 'hit') this._hit = 1;
    if (kind === 'punch') this._punch = 1;
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

    // Recarga: manos juntas delante del pecho, con un giro de muñeca al terminar
    this._reloadW += ((this._reload !== null ? 1 : 0) - this._reloadW) * k(16);
    if (this._reloadW > 0.001) {
      const wR = this._reloadW;
      const p = this._reload ?? 1;
      const pump = Math.sin(p * Math.PI * 3) * 0.12;
      const mix = (obj, axis, v) => (obj.rotation[axis] += (v - obj.rotation[axis]) * wR);
      mix(A.R.shoulder, 'x', -0.95 + pump);
      mix(A.R.shoulder, 'z', 0.35);
      mix(A.R.elbow, 'x', -1.45);
      mix(A.L.shoulder, 'x', -0.75 - pump);
      mix(A.L.shoulder, 'z', -0.3);
      mix(A.L.elbow, 'x', -1.3);
      this.arms.R.wrist.rotation.y = wR * (p > 0.8 ? (p - 0.8) * 10 : 0);
    } else {
      this.arms.R.wrist.rotation.y = 0;
    }

    // Golpe cuerpo a cuerpo: puñetazo recto con el brazo derecho
    this._punch = Math.max(0, this._punch - dt * 4.5);
    if (this._punch > 0) {
      const e = Math.sin(Math.min(1, (1 - this._punch) * 1.6) * Math.PI);
      A.R.shoulder.rotation.x = -1.5 * e + A.R.shoulder.rotation.x * (1 - e);
      A.R.shoulder.rotation.z = 0.15 * e + A.R.shoulder.rotation.z * (1 - e);
      A.R.elbow.rotation.x = -0.1 * e + A.R.elbow.rotation.x * (1 - e);
      this.chest.rotation.y = -0.35 * e;
    } else {
      this.chest.rotation.y = 0;
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
    // Reacción a impactos: sacudida hacia atrás del torso
    this._hit = Math.max(0, this._hit - dt * 5);
    this.chest.rotation.x = this._lean - Math.sin(this._hit * Math.PI) * 0.35;
    const breathe = Math.sin(this._time * 2.2) * 0.012 * (1 - moving);
    const bob = Math.abs(Math.cos(ph)) * 0.05 * moving * ground;
    this.hips.position.y = 0.95 + bob + breathe - this._land * 0.25 - this._dodge * 0.18;
    this.neck.rotation.x = -this._lean * 0.6;

    // Agachado: cadera baja, rodillas flexionadas, torso inclinado
    this._crouch += ((s.crouch ?? 0) - this._crouch) * k(14);
    if (this._crouch > 0.001) {
      const c = this._crouch;
      L.hip.rotation.x -= 1.15 * c;
      R.hip.rotation.x -= 0.95 * c;
      L.knee.rotation.x += 2.0 * c;
      R.knee.rotation.x += 1.8 * c;
      this.hips.position.y -= 0.4 * c;
      this.chest.rotation.x += 0.25 * c;
    }

    // Pulso suave de la marca del Destino
    const pulse = 0.75 + Math.sin(this._time * 2.5) * 0.25;
    if (this.destinoMark) this.destinoMark.plane.material.opacity = pulse;
  }
}
