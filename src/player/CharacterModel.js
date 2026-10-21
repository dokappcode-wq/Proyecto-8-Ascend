import * as THREE from 'three';
import { MARKS } from '../data/marks.js';
import { markSymbolTexture } from './markTextures.js';
import { PartSet, bodyMaterials, rbox, sphere, cyl, cone, torus, limb, shade } from './bodyParts.js';

/**
 * CharacterModel — personaje construido con primitivas y animado
 * proceduralmente (sin recursos externos).
 *
 * Mira hacia +Z en su espacio local. Los pies están en el origen.
 *
 * Cada hueso (cadera, pecho, cuello, cabeza, brazos, piernas, tobillos) junta
 * sus piezas en una malla por material con el color en los vértices
 * (bodyParts.js): cara con ojos, cejas, nariz y orejas, pelo por estilos,
 * ropa por capas, manos con dedos y calzado con suela, con pocas llamadas
 * de dibujo.
 *
 * Expone `anchors` (muñecas, antebrazos, hombros, pecho…) para que el
 * sistema de patrones de marcas pueda adherir geometría emisiva al cuerpo
 * sin modificar el modelo.
 *
 * Variantes (misma estructura y animación):
 *  - 'protagonist': chaqueta abierta con capucha, mochila tecnológica y
 *    marca del Destino.
 *  - 'pdc': agente de la Policía del Control (uniforme, chaleco, casco con
 *    visor, guantes, rodilleras y arma).
 *  - 'acolyte': Acólito de Energía (capucha, túnica y brazaletes luminosos;
 *    sin marca original, su poder es prestado).
 *  - 'incarnation': Encarnación o vecino vestido como cualquier persona;
 *    la paleta elige colores, peinado (`hairStyle`) y barba (`beard`).
 */
const PALETTES = {
  protagonist: { skin: 0xc99a7c, jacket: 0x1d2128, hoodie: 0x39404c, pants: 0x1c2230, boots: 0x3a2c22, sole: 0xcfc6b6, hair: 0x17120f, hairStyle: 'messy' },
  pdc: { skin: 0xb98a6c, jacket: 0x1f2b3d, hoodie: 0x2b3a50, pants: 0x18202c, boots: 0x111317, sole: 0x0b0c0e, hair: 0x15120f, hairStyle: 'none' },
  acolyte: { skin: 0xa77e66, jacket: 0x2a1f38, hoodie: 0x3a2a4e, pants: 0x1c1626, boots: 0x231a1a, sole: 0x141012, hair: 0x15120f, hairStyle: 'none' },
  // Ropa de calle corriente: nada delata que es una Encarnación
  incarnation: { skin: 0xd9a888, jacket: 0x4a5640, hoodie: 0xb9b2a2, pants: 0x3a4a66, boots: 0x5a4632, sole: 0x2a2420, hair: 0x4a3324, hairStyle: 'short' },
};

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export class CharacterModel {
  /** @param {object} [o] { variant: 'protagonist' | 'pdc' | 'acolyte' | 'incarnation', glow, palette, gear } */
  constructor({ variant = 'protagonist', glow = 0xb45cff, palette = null, gear = null } = {}) {
    this.variant = variant;
    /** Equipo extra de la PDC: 'shield' (escudo), 'rifle' (francotirador) o 'heavy' (reforzado). */
    this.gear = gear;
    this.paletteOverride = palette;
    this.glowColor = glow;
    this.root = new THREE.Group();
    this.root.name = variant === 'protagonist' ? 'Protagonista' : variant;
    this.anchors = {};
    this._hit = 0;
    this._punch = 0;
    this._phase = 0;
    this._time = Math.random() * 10;
    this._air = 0;
    this._dodge = 0;
    this._lean = 0;
    this._land = 0;
    this._landV = 0;
    this._cast = 0;
    this._waveT = 0;
    this._dive = 0;
    this._climbW = 0;
    this._climbPose = null;
    this._reload = null; // progreso 0..1 de la recarga, o null
    this._reloadW = 0;
    this._crouch = 0;
    this._fists = null;
    this._spd = 0;
    this._prevSpd = 0;
    this._acc = 0;
    this._turn = 0;
    this._prevYaw = null;
    this._look = { yaw: 0, pitch: 0 };
    this._glance = { t: 2 + Math.random() * 4, yaw: 0 };
    this._blink = { t: 1 + Math.random() * 3, d: 0 };
    this._fall = 0;
    this._smoothed = null;
    this._build();
    this._joints = this._jointList();
  }

  // ------------------------------------------------------------------ Construcción
  _build() {
    const V = this.variant;
    const pal = { ...(PALETTES[V] ?? PALETTES.protagonist), ...(this.paletteOverride ?? {}) };
    this.palette = pal;
    const mats = bodyMaterials();
    this.materials = mats;
    const glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(this.glowColor).multiplyScalar(1.6), toneMapped: false });
    const pdc = V === 'pdc';
    const civil = V === 'incarnation';
    const skin = pal.skin;
    const hand = pdc ? 0x1a1c20 : skin; // la PDC lleva guantes

    // --- Cadera ---
    const hips = new THREE.Group();
    hips.position.y = 0.95;
    this.root.add(hips);
    this.hips = hips;
    const hp = new PartSet();
    hp.add('matte', rbox(0.33, 0.2, 0.21, 0.07), pal.pants, { pos: [0, -0.01, 0] });
    hp.add('soft', rbox(0.345, 0.045, 0.222, 0.016), pdc ? 0x15171b : 0x2a211b, { pos: [0, 0.075, 0] });
    hp.add('metal', rbox(0.05, 0.034, 0.014, 0.006), 0x9a9488, { pos: [0, 0.075, 0.113] });
    if (pdc) {
      // Cinturón con cartucheras y funda
      for (const x of [-0.11, 0, 0.11]) hp.add('matte', rbox(0.07, 0.06, 0.045, 0.012), 0x262a30, { pos: [x, 0.07, 0.125] });
      hp.add('matte', rbox(0.05, 0.12, 0.06, 0.015), 0x15171b, { pos: [-0.185, 0.0, 0.02] });
    }
    if (V === 'acolyte') {
      // Faldón de la túnica
      hp.add('matte', cyl(0.24, 0.33, 0.5, 14, true), pal.hoodie, { pos: [0, -0.2, 0] });
    }
    hp.build(hips, mats);

    // --- Pecho ---
    const chest = new THREE.Group();
    chest.position.y = 0.1;
    hips.add(chest);
    this.chest = chest;
    this.anchors.chest = chest;
    const ch = new PartSet();
    const jk = pal.jacket;
    if (pdc) {
      ch.add('matte', cyl(0.195, 0.17, 0.5, 14), jk, { pos: [0, 0.27, 0], scale: [1, 1, 0.62] });
      ch.add('matte', sphere(0.19, 14, 8), jk, { pos: [0, 0.47, 0], scale: [1.15, 0.42, 0.66] });
      // Chaleco táctico: placas, cartucheras y radio
      const vest = 0x2c3138;
      ch.add('matte', rbox(0.43, 0.38, 0.28, 0.06), vest, { pos: [0, 0.3, 0] });
      ch.add('matte', rbox(0.3, 0.24, 0.04, 0.02), shade(vest, 1.12), { pos: [0, 0.33, 0.142] });
      for (const x of [-0.12, 0, 0.12]) ch.add('matte', rbox(0.08, 0.075, 0.05, 0.014), shade(vest, 0.8), { pos: [x, 0.16, 0.155] });
      ch.add('metal', rbox(0.045, 0.08, 0.03, 0.01), 0x1a1d22, { pos: [0.15, 0.47, 0.13] });
      ch.add('metal', cyl(0.004, 0.004, 0.09, 4), 0x111111, { pos: [0.165, 0.55, 0.13] });
      ch.add('matte', rbox(0.3, 0.07, 0.2, 0.03), shade(jk, 0.85), { pos: [0, 0.55, -0.01] });
    } else if (V === 'acolyte') {
      ch.add('matte', cyl(0.205, 0.18, 0.56, 14), pal.hoodie, { pos: [0, 0.25, 0], scale: [1, 1, 0.64] });
      ch.add('matte', sphere(0.2, 14, 8), pal.hoodie, { pos: [0, 0.47, 0], scale: [1.12, 0.42, 0.66] });
      // Solapas cruzadas de la túnica
      for (const s of [-1, 1]) ch.add('matte', rbox(0.06, 0.42, 0.02, 0.01), shade(pal.hoodie, 0.75), { pos: [0.05 * s, 0.28, 0.124], rot: [0, 0, 0.32 * s] });
    } else {
      // Camiseta / sudadera y chaqueta abierta por delante
      ch.add('matte', cyl(0.19, 0.165, 0.5, 14), pal.hoodie, { pos: [0, 0.27, 0], scale: [1, 1, 0.62] });
      ch.add('soft', cyl(0.205, 0.182, 0.47, 16, true, 0.34, Math.PI * 2 - 0.68), jk, { pos: [0, 0.255, 0], scale: [1, 1, 0.64] });
      ch.add('soft', sphere(0.2, 14, 8), jk, { pos: [0, 0.47, 0], scale: [1.13, 0.4, 0.66] });
      // Solapas, bolsillos y dobladillo
      for (const s of [-1, 1]) {
        ch.add('soft', rbox(0.035, 0.44, 0.016, 0.007), shade(jk, 0.82), { pos: [0.066 * s, 0.255, 0.122], rot: [0, 0.3 * s, 0] });
        ch.add('soft', rbox(0.085, 0.07, 0.018, 0.008), shade(jk, 0.86), { pos: [0.125 * s, 0.1, 0.108], rot: [0, 0.45 * s, 0] });
      }
      ch.add('soft', cyl(0.186, 0.186, 0.035, 16, true, 0.34, Math.PI * 2 - 0.68), shade(jk, 0.8), { pos: [0, 0.035, 0], scale: [1, 1, 0.66] });
      // Cuello de la chaqueta y capucha recogida detrás
      ch.add('soft', torus(0.072, 0.022, 6, 16, Math.PI * 1.6), shade(jk, 0.9), { pos: [0, 0.575, -0.005], rot: [Math.PI / 2, 0, Math.PI * 0.7], scale: [1.1, 1.05, 1.2] });
      ch.add('matte', sphere(0.12, 12, 8), V === 'protagonist' ? pal.hoodie : jk, { pos: [0, 0.55, -0.1], scale: [1.15, 0.55, 0.75] });
    }
    if (V === 'protagonist') {
      // Mochila tecnológica: cuerpo, tapa, bolsillos laterales y correas
      const t = 0x2a3440;
      ch.add('metal', rbox(0.3, 0.36, 0.12, 0.045), t, { pos: [0, 0.3, -0.185] });
      ch.add('matte', rbox(0.31, 0.07, 0.135, 0.03), shade(t, 0.7), { pos: [0, 0.465, -0.185] });
      for (const s of [-1, 1]) ch.add('matte', rbox(0.045, 0.16, 0.09, 0.02), shade(t, 0.8), { pos: [0.172 * s, 0.22, -0.185] });
      ch.add('metal', torus(0.035, 0.008, 5, 10, Math.PI), 0x15181c, { pos: [0, 0.5, -0.185] });
      const strap = 0x4a3b2e;
      for (const s of [-1, 1]) {
        ch.add('soft', rbox(0.045, 0.022, 0.25, 0.008), strap, { pos: [0.11 * s, 0.54, -0.03] });
        ch.add('soft', rbox(0.045, 0.34, 0.018, 0.008), strap, { pos: [0.11 * s, 0.33, 0.132] });
      }
      ch.add('soft', rbox(0.2, 0.022, 0.016, 0.006), strap, { pos: [0, 0.36, 0.14] });
      ch.add('metal', rbox(0.035, 0.03, 0.02, 0.006), 0x8a8478, { pos: [0, 0.36, 0.146] });
    }
    if (this.gear === 'heavy') {
      // Agente reforzado: placa pectoral y hombreras
      const armor = 0x2a2f36;
      ch.add('metal', rbox(0.48, 0.42, 0.31, 0.06), armor, { pos: [0, 0.3, 0.01] });
      ch.add('metal', rbox(0.36, 0.12, 0.05, 0.02), shade(armor, 1.15), { pos: [0, 0.4, 0.16] });
      for (const s of [-1, 1]) ch.add('metal', rbox(0.2, 0.1, 0.26, 0.04), armor, { pos: [0.3 * s, 0.56, 0], rot: [0, 0, -0.35 * s] });
    }
    ch.build(chest, mats);
    // Detalles luminosos (mallas propias: material emisivo)
    if (V === 'protagonist') {
      const light = new THREE.Mesh(rbox(0.14, 0.012, 0.008, 0.004), new THREE.MeshStandardMaterial({ color: 0x0, emissive: 0x6fb6ff, emissiveIntensity: 0.7 }));
      light.position.set(0, 0.37, -0.248);
      chest.add(light);
    } else if (pdc) {
      const badge = new THREE.Mesh(rbox(0.07, 0.045, 0.01, 0.004), new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xe0a53a, emissiveIntensity: 0.9 }));
      badge.position.set(-0.11, 0.42, 0.165);
      chest.add(badge);
    } else if (V === 'acolyte') {
      const sash = new THREE.Mesh(cyl(0.2, 0.2, 0.04, 16), glowMat);
      sash.scale.z = 0.66;
      sash.position.y = 0.04;
      chest.add(sash);
    }
    if (this.gear === 'shield') {
      // Escudo antidisturbios delante del cuerpo (un poco a la izquierda)
      const shield = new THREE.Group();
      const sp = new PartSet();
      sp.add('metal', rbox(0.62, 1.15, 0.05, 0.03), 0x2b3442);
      sp.add('metal', rbox(0.64, 0.05, 0.06, 0.02), 0xe0a53a, { pos: [0, -0.3, 0] });
      sp.add('metal', rbox(0.04, 0.2, 0.05, 0.01), 0x15181c, { pos: [0, 0, -0.05] });
      sp.build(shield, mats);
      const visor = new THREE.Mesh(rbox(0.42, 0.12, 0.054, 0.02), new THREE.MeshStandardMaterial({ color: 0x9fd0ff, emissive: 0x1d4a6a, roughness: 0.15, transparent: true, opacity: 0.8 }));
      visor.position.y = 0.32;
      shield.add(visor);
      shield.position.set(0.1, 0.05, 0.34);
      chest.add(shield);
      this.shieldMesh = shield;
    }

    // --- Cuello y cabeza ---
    const neck = new THREE.Group();
    neck.position.y = 0.6;
    chest.add(neck);
    this.neck = neck;
    const nk = new PartSet();
    nk.add('soft', cyl(0.047, 0.053, 0.14, 10), skin, { pos: [0, 0.055, 0.005] });
    if (pdc) nk.add('matte', cyl(0.06, 0.068, 0.07, 12), shade(jk, 0.85), { pos: [0, 0.01, 0] });
    nk.build(neck, mats);
    const head = new THREE.Group();
    head.position.y = 0.185;
    neck.add(head);
    this.head = head;
    this._buildHead(head, pal, mats, glowMat);

    // --- Brazos ---
    // Lado izquierdo del personaje = +X (mira hacia +Z).
    this.arms = {};
    const sleeve = V === 'acolyte' ? pal.hoodie : jk;
    for (const side of ['L', 'R']) {
      const s = side === 'L' ? 1 : -1;
      const shoulder = new THREE.Group();
      shoulder.position.set(0.27 * s, 0.5, 0);
      chest.add(shoulder);
      const up = new PartSet();
      up.add('soft', sphere(0.074, 12, 8), sleeve, { pos: [0, -0.01, 0], scale: [1, 1.05, 1] });
      limb(up, 'soft', sleeve, 0.066, 0.058, 0.27, { y0: -0.02, caps: false });
      if (pdc) up.add('matte', rbox(0.01, 0.055, 0.045, 0.004), 0x8a6a2a, { pos: [0.067 * s, -0.09, 0] });
      up.build(shoulder, mats);
      const upperAnchor = new THREE.Object3D();
      upperAnchor.position.y = -0.15;
      shoulder.add(upperAnchor);

      const elbow = new THREE.Group();
      elbow.position.y = -0.3;
      shoulder.add(elbow);
      const fo = new PartSet();
      fo.add('soft', sphere(0.057, 12, 8), sleeve);
      if (pdc || V === 'acolyte') {
        limb(fo, 'soft', sleeve, 0.056, 0.048, 0.24, { caps: false });
        fo.add('soft', torus(0.047, 0.01, 5, 12), shade(sleeve, 0.75), { pos: [0, -0.235, 0], rot: [Math.PI / 2, 0, 0] });
      } else {
        // Manga remangada: se ve la piel del antebrazo (y la marca)
        limb(fo, 'soft', sleeve, 0.056, 0.05, 0.15, { caps: false });
        fo.add('soft', torus(0.05, 0.013, 5, 12), shade(sleeve, 0.8), { pos: [0, -0.155, 0], rot: [Math.PI / 2, 0, 0] });
        limb(fo, 'soft', skin, 0.044, 0.04, 0.11, { y0: -0.15, caps: false });
      }
      fo.build(elbow, mats);
      const foreAnchor = new THREE.Object3D();
      foreAnchor.position.y = -0.13;
      elbow.add(foreAnchor);

      const wrist = new THREE.Group();
      wrist.position.y = -0.27;
      elbow.add(wrist);
      const hd = new PartSet();
      hd.add('soft', cyl(0.042, 0.043, 0.05, 10), V === 'acolyte' ? pal.hoodie : hand, { pos: [0, 0.015, 0] });
      // Mano: palma, dedos ligeramente cerrados hacia dentro y pulgar
      hd.add('soft', rbox(0.034, 0.08, 0.072, 0.014), hand, { pos: [0, -0.045, 0.004] });
      hd.add('soft', rbox(0.03, 0.066, 0.066, 0.013), hand, { pos: [-0.008 * s, -0.1, 0.008], rot: [0, 0, -0.32 * s] });
      hd.add('soft', rbox(0.022, 0.052, 0.024, 0.01), hand, { pos: [-0.012 * s, -0.045, 0.044], rot: [-0.55, 0, -0.25 * s] });
      hd.build(wrist, mats);
      if (V === 'acolyte') {
        const cuff = new THREE.Mesh(cyl(0.046, 0.046, 0.05, 12), glowMat);
        cuff.position.y = 0.015;
        wrist.add(cuff);
      }
      if (pdc && side === 'R') this._buildGun(wrist, mats);

      this.arms[side] = { shoulder, elbow, wrist };
      this.anchors[`shoulder${side}`] = shoulder;
      this.anchors[`upperArm${side}`] = upperAnchor;
      this.anchors[`forearm${side}`] = foreAnchor;
      this.anchors[`wrist${side}`] = wrist;
    }

    // --- Piernas ---
    this.legs = {};
    for (const side of ['L', 'R']) {
      const s = side === 'L' ? 1 : -1;
      const hip = new THREE.Group();
      hip.position.set(0.1 * s, 0, 0);
      hips.add(hip);
      const th = new PartSet();
      limb(th, 'matte', pal.pants, 0.086, 0.07, 0.43, { sz: 1.06 });
      if (pdc) th.add('matte', rbox(0.035, 0.11, 0.09, 0.012), shade(pal.pants, 0.8), { pos: [0.083 * s, -0.25, 0.01] });
      th.build(hip, mats);
      const knee = new THREE.Group();
      knee.position.y = -0.45;
      hip.add(knee);
      const sh = new PartSet();
      sh.add('matte', sphere(0.068, 12, 8), pal.pants);
      limb(sh, 'matte', pal.pants, 0.066, 0.056, 0.33, { caps: false });
      if (pdc) sh.add('metal', rbox(0.11, 0.12, 0.05, 0.022), 0x22262c, { pos: [0, -0.03, 0.06] });
      else sh.add('matte', cyl(0.064, 0.071, 0.05, 12, true), shade(pal.pants, 0.85), { pos: [0, -0.345, 0] });
      sh.build(knee, mats);
      const ankle = new THREE.Group();
      ankle.position.y = -0.42;
      knee.add(ankle);
      const ft = new PartSet();
      const boot = pal.boots;
      ft.add('soft', cyl(0.054, 0.058, 0.07, 10), boot, { pos: [0, -0.005, 0] });
      ft.add('soft', rbox(0.105, 0.075, 0.22, 0.032), boot, { pos: [0, -0.035, 0.035] });
      ft.add('soft', sphere(0.052, 10, 8), boot, { pos: [0, -0.045, 0.125], scale: [1, 0.62, 1.2] });
      ft.add('matte', rbox(0.113, 0.022, 0.258, 0.008), pal.sole ?? shade(boot, 0.5), { pos: [0, -0.07, 0.04] });
      if (!pdc) ft.add('matte', rbox(0.06, 0.01, 0.07, 0.004), shade(boot, 1.35), { pos: [0, 0.002, 0.085], rot: [0.35, 0, 0] });
      ft.build(ankle, mats);
      this.legs[side] = { hip, knee, ankle };
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
    mark.position.set(0.046, 0.02, 0);
    mark.rotation.y = Math.PI / 2;
    this.anchors.wristL.add(mark);
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(0.046, 0.004, 6, 24),
      new THREE.MeshBasicMaterial({ color: destino.color, toneMapped: false }),
    );
    band.rotation.x = Math.PI / 2;
    band.position.y = -0.005;
    this.anchors.wristL.add(band);
    this.destinoMark = { plane: mark, band };
  }

  /** Cabeza: cráneo, mandíbula, orejas, nariz, boca, cejas, ojos (malla aparte para parpadear) y pelo. */
  _buildHead(head, pal, mats, glowMat) {
    const V = this.variant;
    const skin = pal.skin;
    const hair = pal.hair ?? 0x15120f;
    const hd = new PartSet();
    hd.add('soft', sphere(0.118, 18, 14), skin, { pos: [0, 0.005, -0.005], scale: [0.93, 1.08, 1] });
    hd.add('soft', sphere(0.085, 14, 10), skin, { pos: [0, -0.06, 0.025], scale: [0.95, 0.72, 1] });
    for (const s of [-1, 1]) hd.add('soft', sphere(0.026, 8, 6), shade(skin, 0.93), { pos: [0.107 * s, -0.002, -0.01], scale: [0.45, 1, 0.72] });
    hd.add('soft', sphere(0.019, 8, 6), shade(skin, 0.97), { pos: [0, -0.012, 0.113], scale: [0.85, 1.3, 1.1] });
    hd.add('soft', sphere(0.015, 8, 6), shade(skin, 0.95), { pos: [0, -0.036, 0.118] });
    hd.add('soft', rbox(0.042, 0.008, 0.012, 0.003), shade(skin, 0.68), { pos: [0, -0.066, 0.107] });
    for (const s of [-1, 1]) hd.add('matte', rbox(0.04, 0.009, 0.012, 0.004), V === 'pdc' ? 0x15120f : hair, { pos: [0.04 * s, 0.048, 0.107], rot: [0, 0, -0.12 * s] });
    if (pal.beard) {
      hd.add('matte', sphere(0.089, 14, 8, 0, Math.PI * 2, Math.PI * 0.42, Math.PI * 0.58), hair, { pos: [0, -0.04, 0.027], scale: [0.97, 0.95, 1.02] });
      hd.add('matte', rbox(0.052, 0.012, 0.014, 0.005), hair, { pos: [0, -0.052, 0.112] });
    }
    this._hair(hd, pal.hairStyle ?? 'short', hair);
    if (V === 'pdc') {
      // Casco con borde, protector de nuca y visor
      const hel = 0x1a2230;
      hd.add('metal', sphere(0.142, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), hel, { pos: [0, 0.03, -0.01], rot: [-0.3, 0, 0], scale: [1, 0.95, 1.08] });
      hd.add('metal', torus(0.14, 0.011, 5, 18), shade(hel, 0.8), { pos: [0, 0.03, -0.01], rot: [Math.PI / 2 - 0.3, 0, 0], scale: [1, 1.08, 1] });
      hd.add('metal', rbox(0.2, 0.06, 0.03, 0.012), hel, { pos: [0, -0.04, -0.125], rot: [-0.2, 0, 0] });
    } else if (V === 'acolyte') {
      const hood = pal.hoodie;
      // Capucha abierta por delante (la abertura queda centrada en +Z)
      hd.add('matte', sphere(0.165, 16, 12, Math.PI * 0.82, Math.PI * 1.36, 0, Math.PI * 0.74), hood, { pos: [0, 0.0, -0.02], scale: [1, 1.12, 1.05] });
      hd.add('matte', sphere(0.168, 16, 4, Math.PI * 0.82, Math.PI * 1.36, Math.PI * 0.5, Math.PI * 0.24), shade(hood, 0.8), { pos: [0, 0.0, -0.02], scale: [1.02, 1.12, 1.07] });
    }
    hd.build(head, mats);
    // Ojos: grupo propio para parpadear
    const eyes = new THREE.Group();
    eyes.position.set(0, 0.015, 0);
    head.add(eyes);
    this.eyes = eyes;
    if (V === 'acolyte') {
      for (const ex of [-0.04, 0.04]) {
        const eye = new THREE.Mesh(rbox(0.032, 0.011, 0.01, 0.004), glowMat);
        eye.position.set(ex, 0, 0.11);
        eyes.add(eye);
      }
    } else {
      const ey = new PartSet();
      for (const s of [-1, 1]) {
        ey.add('soft', sphere(0.018, 10, 8), 0xf2efe8, { pos: [0.04 * s, 0, 0.098], scale: [1.2, 0.85, 0.55] });
        ey.add('soft', sphere(0.0095, 8, 6), pal.eyes ?? 0x2b1d14, { pos: [0.04 * s, 0, 0.106] });
      }
      ey.build(eyes, mats, { cast: false });
    }
    if (V === 'pdc') {
      const visorMat = this.gear === 'heavy'
        ? new THREE.MeshBasicMaterial({ color: 0xff3b3b, toneMapped: false })
        : new THREE.MeshStandardMaterial({ color: 0x0b0e12, emissive: 0xff6a3a, emissiveIntensity: 0.9, metalness: 0.8, roughness: 0.2 });
      const visor = new THREE.Mesh(rbox(0.2, 0.05, 0.03, 0.012), visorMat);
      visor.position.set(0, 0.018, 0.122);
      visor.rotation.x = 0.08;
      head.add(visor);
    }
  }

  /** Peinados: 'messy', 'short', 'slick', 'bun', 'long', 'buzz', 'none'. */
  _hair(set, style, c) {
    if (style === 'none') return;
    const cap = () => set.add('matte', sphere(0.126, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), c, { pos: [0, 0.018, -0.012], rot: [-0.42, 0, 0], scale: [0.97, 1.04, 1.08] });
    const nape = () => set.add('matte', sphere(0.112, 12, 8), c, { pos: [0, -0.02, -0.042], scale: [0.95, 0.8, 0.86] });
    if (style === 'buzz') {
      set.add('matte', sphere(0.121, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), c, { pos: [0, 0.012, -0.008], rot: [-0.4, 0, 0], scale: [0.96, 1.05, 1.05] });
      return;
    }
    cap();
    nape();
    if (style === 'messy') {
      // Mechones desordenados y flequillo
      const tufts = [[0, 0.13, 0.02, -0.5, 0], [0.05, 0.12, 0.05, -0.8, -0.4], [-0.05, 0.125, 0.04, -0.7, 0.5], [0.07, 0.1, -0.05, 0.2, -0.7], [-0.07, 0.105, -0.04, 0.3, 0.6], [0, 0.11, -0.08, 0.7, 0], [0.03, 0.095, 0.095, -1.25, -0.3], [-0.04, 0.098, 0.093, -1.2, 0.35], [0.08, 0.085, 0.07, -0.9, -0.9]];
      for (const [x, y, z, rx, rz] of tufts) set.add('matte', cone(0.034, 0.085, 5), c, { pos: [x, y, z], rot: [rx, 0, rz] });
    } else if (style === 'short') {
      set.add('matte', rbox(0.17, 0.03, 0.05, 0.014), c, { pos: [0, 0.092, 0.088], rot: [0.5, 0, 0] });
    } else if (style === 'slick') {
      set.add('matte', sphere(0.122, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), shade(c, 1.1), { pos: [0, 0.03, -0.03], rot: [-0.3, 0, 0], scale: [0.98, 0.9, 1.1] });
    } else if (style === 'bun') {
      set.add('matte', sphere(0.05, 12, 8), c, { pos: [0, 0.075, -0.115] });
      set.add('matte', torus(0.035, 0.012, 5, 10), shade(c, 0.85), { pos: [0, 0.06, -0.1], rot: [0.9, 0, 0] });
    } else if (style === 'long') {
      set.add('matte', rbox(0.2, 0.28, 0.08, 0.035), c, { pos: [0, -0.11, -0.08], rot: [0.12, 0, 0] });
      for (const s of [-1, 1]) set.add('matte', rbox(0.04, 0.2, 0.07, 0.02), c, { pos: [0.1 * s, -0.07, -0.01] });
      set.add('matte', rbox(0.16, 0.035, 0.05, 0.016), c, { pos: [0, 0.09, 0.088], rot: [0.55, 0, 0] });
    }
  }

  /** Arma reglamentaria (alineada con el antebrazo; apunta al levantar el brazo). */
  _buildGun(wrist, mats) {
    const rifle = this.gear === 'rifle';
    const gun = new THREE.Group();
    const gp = new PartSet();
    const black = 0x15181c;
    const len = rifle ? 0.95 : 0.45;
    gp.add('metal', rbox(0.06, len, 0.085, 0.015), black, { pos: [0, -len / 2 + 0.05, 0] });
    gp.add('metal', cyl(0.014, 0.014, rifle ? 0.25 : 0.1, 8), 0x0d0f12, { pos: [0, -len + 0.02 - (rifle ? 0.1 : 0.04), 0] });
    gp.add('metal', rbox(0.045, 0.1, 0.05, 0.01), 0x22262c, { pos: [0, -0.15, -0.07], rot: [0.25, 0, 0] });
    gp.add('metal', rbox(0.05, 0.05, 0.12, 0.012), black, { pos: [0, -0.06, -0.08] });
    gp.add('metal', rbox(0.012, 0.18, 0.03, 0.004), 0x2a2f36, { pos: [0, -0.25, 0.055] });
    if (rifle) {
      // Mira telescópica
      gp.add('metal', cyl(0.025, 0.025, 0.22, 10), 0x2a2f36, { pos: [0, -0.32, 0.075] });
    }
    gp.build(gun, mats);
    if (rifle) {
      const lens = new THREE.Mesh(cyl(0.02, 0.02, 0.01, 10), new THREE.MeshBasicMaterial({ color: 0xff3b3b, toneMapped: false }));
      lens.position.set(0, -0.435, 0.075);
      gun.add(lens);
    }
    gun.position.z = 0.03;
    wrist.add(gun);
    this.anchors.muzzle = new THREE.Object3D();
    this.anchors.muzzle.position.set(0, rifle ? -0.92 : -0.44, 0.03);
    wrist.add(this.anchors.muzzle);
  }

  /** Articulaciones que se suavizan entre fotogramas (transiciones sin saltos). */
  _jointList() {
    const A = this.arms;
    const L = this.legs;
    return [this.hips, this.chest, this.neck, this.head, A.L.shoulder, A.R.shoulder, A.L.elbow, A.R.elbow, A.L.wrist, A.R.wrist, L.L.hip, L.R.hip, L.L.knee, L.R.knee, L.L.ankle, L.R.ankle];
  }

  // ------------------------------------------------------------------ Gestos y estados
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
        m.position.y = -0.07;
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

  /** Gestos breves: 'cast' (retroceso del brazo al disparar), 'wave' (onda), 'hit' (impacto) y 'punch'. */
  trigger(kind) {
    if (kind === 'cast') this._cast = 1;
    if (kind === 'wave') this._waveT = 1;
    if (kind === 'hit') this._hit = 1;
    if (kind === 'punch') this._punch = 1;
  }

  // ------------------------------------------------------------------ Animación
  /**
   * @param {number} dt
   * @param {object} s estado: { speed, grounded, sprinting, dodging, verticalSpeed, landed, landingSpeed,
   *   aimWeight, aimPitch, crouch, climb, climbDistance, mantleProgress, diving, gliding, swinging,
   *   skating, flying, lookYaw, lookPitch }
   */
  animate(dt, s) {
    if (dt <= 0) return;
    this._time += dt;
    const k = (rate) => 1 - Math.exp(-dt * rate);
    const A = this.arms;
    const L = this.legs.L;
    const R = this.legs.R;

    // --- Velocidad, aceleración y giro (suavizados) ---
    this._spd += (s.speed - this._spd) * k(10);
    const sp = this._spd;
    const accel = (sp - this._prevSpd) / dt;
    this._prevSpd = sp;
    this._acc += (Math.max(-12, Math.min(12, accel)) - this._acc) * k(5);
    const moving = clamp01(sp / 4);
    const run = clamp01((sp - 4.5) / 4.5);
    const e = this.root.matrixWorld.elements;
    const yaw = Math.atan2(e[8], e[10]);
    const dyaw = this._prevYaw === null ? 0 : wrapAngle(yaw - this._prevYaw);
    this._prevYaw = yaw;
    const turnRate = Math.max(-8, Math.min(8, dyaw / dt));
    this._turn += (Math.max(-0.22, Math.min(0.22, turnRate * sp * 0.012)) - this._turn) * k(6);

    this._air += ((s.grounded ? 0 : 1) - this._air) * k(14);
    this._dodge += ((s.dodging ? 1 : 0) - this._dodge) * k(20);
    const vy = s.verticalSpeed ?? 0;
    this._fall += (clamp01(-vy / 9) - this._fall) * k(8);
    // Aterrizaje: muelle amortiguado (baja y rebota)
    if (s.landed) this._landV -= Math.min(1.4, (s.landingSpeed ?? 0) / 10) * 9;
    this._landV += (-this._land * 170 - this._landV * 17) * dt;
    this._land += this._landV * dt;
    this._land = Math.max(-0.6, Math.min(0.2, this._land));
    const land = Math.max(0, -this._land);

    // --- Ciclo de pasos: un paso cada π (los pasos del sonido dependen de ello) ---
    if (s.grounded && sp > 0.15) this._phase += dt * Math.PI * (1.5 + sp * 0.3);
    const ph = this._phase;
    const ground = 1 - this._air;
    const hipA = moving * (0.36 + 0.32 * run);
    const kneeA = moving * (0.7 + 0.75 * run);
    const armA = moving * (0.3 + 0.42 * run);

    const leg = (P, phase) => {
      const sn = Math.sin(phase);
      const cs = Math.cos(phase);
      const swing = Math.max(0, cs); // pierna adelantándose
      const load = Math.max(0, -cs) * Math.max(0, sn); // apoyo recién posado
      P.hip.rotation.x = -hipA * sn * ground;
      P.hip.rotation.z = 0;
      P.knee.rotation.x = (kneeA * Math.pow(swing, 1.3) + moving * (0.1 + 0.2 * run) * load) * ground + 0.06;
      // Pie: apoyado plano, despega con la punta y se levanta antes de posarse
      const push = Math.max(0, -sn) * Math.max(0, -cs);
      P._footWorld = moving * ground * (0.6 * push - 0.3 * Math.max(0, sn) * swing);
    };
    leg(L, ph);
    leg(R, ph + Math.PI);

    // Brazos opuestos a las piernas; con la carrera, codos más doblados
    const sL = Math.sin(ph);
    A.L.shoulder.rotation.x = armA * sL * ground;
    A.R.shoulder.rotation.x = -armA * sL * ground;
    A.L.shoulder.rotation.z = 0.07 + 0.08 * run;
    A.R.shoulder.rotation.z = -0.07 - 0.08 * run;
    const elbowBase = -0.16 - 0.3 * moving - 0.85 * run;
    A.L.elbow.rotation.x = elbowBase - 0.25 * run * Math.max(0, -sL);
    A.R.elbow.rotation.x = elbowBase - 0.25 * run * Math.max(0, sL);
    A.L.wrist.rotation.y = 0;
    A.R.wrist.rotation.y = 0;
    A.L.wrist.rotation.x = -0.08 * moving;
    A.R.wrist.rotation.x = -0.08 * moving;

    // --- En el aire: subiendo encoge las piernas; cayendo las estira y abre los brazos ---
    if (this._air > 0.001) {
      const a = this._air;
      const f = this._fall;
      const rise = 1 - f;
      const mix = (obj, axis, v) => (obj.rotation[axis] += (v - obj.rotation[axis]) * a);
      mix(L.hip, 'x', -0.75 * rise - 0.3 * f);
      mix(L.knee, 'x', 1.15 * rise + 0.3 * f);
      mix(R.hip, 'x', 0.12 * rise - 0.05 * f);
      mix(R.knee, 'x', 0.55 * rise + 0.45 * f);
      mix(A.L.shoulder, 'x', -0.85 * rise - 0.2 * f);
      mix(A.R.shoulder, 'x', -0.55 * rise - 0.2 * f);
      mix(A.L.shoulder, 'z', 0.35 + 0.45 * f);
      mix(A.R.shoulder, 'z', -0.35 - 0.45 * f);
      mix(A.L.elbow, 'x', -0.5 * rise - 0.3 * f);
      mix(A.R.elbow, 'x', -0.5 * rise - 0.3 * f);
    }

    // --- Brazo derecho apuntando (poderes) y gestos ---
    this._cast = Math.max(0, this._cast - dt * 6);
    this._waveT = Math.max(0, this._waveT - dt * 3);
    const w = s.aimWeight ?? 0;
    if (w > 0.001) {
      const aimX = -Math.PI / 2 - (s.aimPitch ?? 0) + this._cast * 0.25;
      A.R.shoulder.rotation.x += (aimX - A.R.shoulder.rotation.x) * w;
      A.R.shoulder.rotation.z += (0.05 - A.R.shoulder.rotation.z) * w;
      A.R.elbow.rotation.x += (-0.08 - this._cast * 0.3 - A.R.elbow.rotation.x) * w;
      // El brazo libre se recoge un poco (guardia)
      A.L.shoulder.rotation.x += (-0.35 - A.L.shoulder.rotation.x) * w * 0.6;
      A.L.elbow.rotation.x += (-0.9 - A.L.elbow.rotation.x) * w * 0.6;
    }
    if (this._waveT > 0) {
      const ew = Math.sin(this._waveT * Math.PI);
      A.L.shoulder.rotation.z += 1.2 * ew;
      A.R.shoulder.rotation.z -= 1.2 * ew;
      A.L.shoulder.rotation.x -= 0.3 * ew;
      A.R.shoulder.rotation.x -= 0.3 * ew;
      this._land = Math.min(this._land, -0.3 * ew);
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
      A.R.wrist.rotation.y = wR * (p > 0.8 ? (p - 0.8) * 10 : 0);
    }

    // Golpe cuerpo a cuerpo: puñetazo recto con el brazo derecho y giro del torso
    this._punch = Math.max(0, this._punch - dt * 4.5);
    let punchTwist = 0;
    if (this._punch > 0) {
      const ep = Math.sin(Math.min(1, (1 - this._punch) * 1.6) * Math.PI);
      A.R.shoulder.rotation.x = -1.5 * ep + A.R.shoulder.rotation.x * (1 - ep);
      A.R.shoulder.rotation.z = 0.15 * ep + A.R.shoulder.rotation.z * (1 - ep);
      A.R.elbow.rotation.x = -0.1 * ep + A.R.elbow.rotation.x * (1 - ep);
      A.L.shoulder.rotation.x += (-0.6 - A.L.shoulder.rotation.x) * ep;
      A.L.elbow.rotation.x += (-1.5 - A.L.elbow.rotation.x) * ep;
      punchTwist = -0.38 * ep;
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

    // Planeo (Gravedad): brazos abiertos y piernas atrás
    this._glideW = (this._glideW ?? 0) + ((s.gliding ? 1 : 0) - (this._glideW ?? 0)) * k(10);
    if (this._glideW > 0.001) {
      const gw = this._glideW;
      const mix = (obj, axis, v) => (obj.rotation[axis] += (v - obj.rotation[axis]) * gw);
      mix(A.L.shoulder, 'z', 1.35);
      mix(A.R.shoulder, 'z', -1.35);
      mix(A.L.shoulder, 'x', -0.2);
      mix(A.R.shoulder, 'x', -0.2);
      mix(A.L.elbow, 'x', -0.15);
      mix(A.R.elbow, 'x', -0.15);
      mix(L.hip, 'x', 0.35);
      mix(R.hip, 'x', 0.25);
      mix(L.knee, 'x', 0.4);
      mix(R.knee, 'x', 0.5);
    }

    // Balanceo (Hilo): brazo derecho arriba sujetando el hilo, piernas juntas
    this._swingW = (this._swingW ?? 0) + ((s.swinging ? 1 : 0) - (this._swingW ?? 0)) * k(14);
    if (this._swingW > 0.001) {
      const sw = this._swingW;
      const mix = (obj, axis, v) => (obj.rotation[axis] += (v - obj.rotation[axis]) * sw);
      mix(A.R.shoulder, 'x', -2.95);
      mix(A.R.shoulder, 'z', -0.15);
      mix(A.R.elbow, 'x', -0.1);
      mix(A.L.shoulder, 'x', -0.6);
      mix(A.L.shoulder, 'z', 0.5);
      mix(L.hip, 'x', -0.35);
      mix(R.hip, 'x', -0.15);
      mix(L.knee, 'x', 0.7);
      mix(R.knee, 'x', 0.35);
    }

    // Patinaje (Temperatura): rodillas flexionadas, zancadas largas y brazos abiertos
    this._skateW = (this._skateW ?? 0) + ((s.skating ? 1 : 0) - (this._skateW ?? 0)) * k(10);
    if (this._skateW > 0.001) {
      const sw = this._skateW;
      const mix = (obj, axis, v) => (obj.rotation[axis] += (v - obj.rotation[axis]) * sw);
      const stroke = Math.sin(this._time * 3.2) * Math.min(1, s.speed / 6);
      mix(L.hip, 'x', -0.55 + stroke * 0.5);
      mix(R.hip, 'x', -0.55 - stroke * 0.5);
      mix(L.knee, 'x', 0.9 - stroke * 0.3);
      mix(R.knee, 'x', 0.9 + stroke * 0.3);
      mix(A.L.shoulder, 'z', 0.55 + stroke * 0.25);
      mix(A.R.shoulder, 'z', -0.55 + stroke * 0.25);
      mix(A.L.shoulder, 'x', 0.3 * stroke);
      mix(A.R.shoulder, 'x', -0.3 * stroke);
    }

    // Vuelo (Alas): cuerpo inclinado hacia delante, piernas estiradas y brazos atrás
    this._flyW = (this._flyW ?? 0) + ((s.flying ? 1 : 0) - (this._flyW ?? 0)) * k(8);
    let hipsPitch = 0;
    if (this._flyW > 0.001) {
      const fw = this._flyW;
      const mix = (obj, axis, v) => (obj.rotation[axis] += (v - obj.rotation[axis]) * fw);
      const lean = Math.min(1, s.speed / 12);
      mix(A.L.shoulder, 'x', 0.5);
      mix(A.R.shoulder, 'x', 0.5);
      mix(A.L.shoulder, 'z', 0.3);
      mix(A.R.shoulder, 'z', -0.3);
      mix(A.L.elbow, 'x', -0.2);
      mix(A.R.elbow, 'x', -0.2);
      mix(L.hip, 'x', 0.05 + Math.sin(this._time * 2) * 0.08);
      mix(R.hip, 'x', 0.15 - Math.sin(this._time * 2) * 0.08);
      mix(L.knee, 'x', 0.2);
      mix(R.knee, 'x', 0.35);
      hipsPitch = fw * (0.25 + 0.85 * lean);
    }

    // Parkour: trepar, colgar, subir a una cornisa y saltar obstáculos
    if (s.climb) this._climbPose = s.climb;
    this._climbW += ((s.climb ? 1 : 0) - this._climbW) * k(s.climb ? 22 : 10);
    if (this._climbW > 0.001 && this._climbPose) {
      const cw = this._climbW;
      const mix = (obj, axis, v) => (obj.rotation[axis] += (v - obj.rotation[axis]) * cw);
      const pose = this._climbPose;
      if (pose === 'wall') {
        const a = Math.sin((s.climbDistance ?? 0) * 2.4);
        mix(A.L.shoulder, 'x', -2.55 + a * 0.45);
        mix(A.R.shoulder, 'x', -2.55 - a * 0.45);
        mix(A.L.shoulder, 'z', 0.3);
        mix(A.R.shoulder, 'z', -0.3);
        mix(A.L.elbow, 'x', -0.7 - a * 0.35);
        mix(A.R.elbow, 'x', -0.7 + a * 0.35);
        mix(L.hip, 'x', -0.75 - a * 0.45);
        mix(R.hip, 'x', -0.75 + a * 0.45);
        mix(L.knee, 'x', 1.25 + a * 0.4);
        mix(R.knee, 'x', 1.25 - a * 0.4);
      } else if (pose === 'hang') {
        const sway = Math.sin(this._time * 2.2) * 0.07;
        mix(A.L.shoulder, 'x', -2.95);
        mix(A.R.shoulder, 'x', -2.95);
        mix(A.L.shoulder, 'z', 0.32);
        mix(A.R.shoulder, 'z', -0.32);
        mix(A.L.elbow, 'x', -0.15);
        mix(A.R.elbow, 'x', -0.15);
        mix(L.hip, 'x', -0.2 + sway);
        mix(R.hip, 'x', 0.05 + sway);
        mix(L.knee, 'x', 0.35);
        mix(R.knee, 'x', 0.2);
      } else if (pose === 'mantle') {
        const t = s.mantleProgress ?? 0;
        const em = Math.sin(Math.min(1, t) * Math.PI);
        mix(A.L.shoulder, 'x', -2.8 + 2.3 * t);
        mix(A.R.shoulder, 'x', -2.8 + 2.3 * t);
        mix(A.L.shoulder, 'z', 0.3);
        mix(A.R.shoulder, 'z', -0.3);
        mix(A.L.elbow, 'x', -0.2 - 1.1 * em);
        mix(A.R.elbow, 'x', -0.2 - 1.1 * em);
        mix(L.hip, 'x', -1.5 * em);
        mix(L.knee, 'x', 0.3 + 1.7 * em);
        mix(R.hip, 'x', 0.25 * em);
        mix(R.knee, 'x', 0.3 + 0.6 * em);
      } else if (pose === 'vault') {
        const ev = Math.sin(Math.min(1, s.mantleProgress ?? 0) * Math.PI);
        mix(A.L.shoulder, 'x', -0.9);
        mix(A.L.shoulder, 'z', 0.2);
        mix(A.L.elbow, 'x', -0.1);
        mix(A.R.shoulder, 'x', -0.4);
        mix(A.R.shoulder, 'z', -0.7);
        mix(L.hip, 'x', -1.2 * ev);
        mix(R.hip, 'x', -1.0 * ev);
        mix(L.knee, 'x', 1.6 * ev);
        mix(R.knee, 'x', 1.4 * ev);
      }
    }

    // --- Pelvis y columna: rebote, giro de cadera contra hombros, balanceo e inclinación ---
    const idle = 1 - moving;
    const breathe = Math.sin(this._time * 2.1);
    const bob = -Math.cos(ph * 2) * moving * (0.022 + 0.03 * run) * ground;
    const weight = Math.sin(this._time * 0.55) * idle;
    const pelvisYaw = -moving * (0.12 - 0.04 * run) * sL * ground;
    const accLean = Math.max(-0.12, Math.min(0.18, this._acc * 0.018)) * moving;
    const targetLean = 0.05 * moving + 0.2 * run + accLean + this._dodge * 0.55 + this._dive * 0.35 + land * 0.4 + this._air * 0.06 * (1 - this._fall);
    this._lean += (targetLean - this._lean) * k(10);
    this._hit = Math.max(0, this._hit - dt * 5);
    const hitE = Math.sin(this._hit * Math.PI);
    this.hips.rotation.x = hipsPitch;
    this.hips.rotation.y = pelvisYaw;
    this.hips.rotation.z = -this._turn + weight * 0.02 + moving * 0.035 * Math.cos(ph) * ground;
    this.hips.position.x = weight * 0.012;
    this.hips.position.y = 0.95 + bob + breathe * 0.006 * idle - land * 0.32 - this._dodge * 0.18 - (this._skateW ?? 0) * 0.14;
    this.chest.position.y = 0.1 + breathe * 0.004 * idle;
    this.chest.rotation.x = this._lean - hitE * 0.35 + breathe * 0.012 * idle;
    this.chest.rotation.y = -pelvisYaw * 1.3 + punchTwist;
    this.chest.rotation.z = this._turn * 0.4;

    // Aterrizaje: rodillas y brazos absorben el golpe
    if (land > 0.001) {
      L.hip.rotation.x -= 0.6 * land;
      R.hip.rotation.x -= 0.5 * land;
      L.knee.rotation.x += 1.2 * land;
      R.knee.rotation.x += 1.0 * land;
      A.L.shoulder.rotation.x -= 0.5 * land;
      A.R.shoulder.rotation.x -= 0.5 * land;
    }

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

    // Tobillos: los pies apoyados quedan planos; en el aire o trepando, la punta cae
    const plant = (1 - this._air) * (1 - this._climbW) * (1 - (this._flyW ?? 0)) * (1 - (this._swingW ?? 0));
    for (const P of [L, R]) {
      const flat = (P._footWorld ?? 0) - (hipsPitch + P.hip.rotation.x + P.knee.rotation.x);
      P.ankle.rotation.x = flat * plant + 0.35 * (1 - plant);
    }

    // --- Cabeza: compensa la inclinación del torso y mira hacia donde mira la cámara ---
    let lookYaw = s.lookYaw;
    let lookPitch = s.lookPitch ?? 0;
    if (lookYaw === undefined) {
      // Sin cámara (NPC): miradas ocasionales en reposo
      const g = this._glance;
      g.t -= dt;
      if (g.t <= 0) {
        g.t = 2.5 + Math.random() * 4;
        g.yaw = idle > 0.8 && Math.random() < 0.6 ? (Math.random() - 0.5) * 1.1 : 0;
      }
      lookYaw = g.yaw * idle;
      lookPitch = 0;
    }
    const lockLook = this._climbW > 0.5 || w > 0.5 || this._punch > 0;
    const ly = lockLook ? 0 : Math.max(-1.1, Math.min(1.1, lookYaw));
    const lp = lockLook ? 0 : Math.max(-0.5, Math.min(0.5, lookPitch));
    this._look.yaw += (ly - this._look.yaw) * k(6);
    this._look.pitch += (lp - this._look.pitch) * k(6);
    this.neck.rotation.x = -this._lean * 0.55 - this._look.pitch * 0.25 + hitE * 0.2;
    this.neck.rotation.y = this._look.yaw * 0.35;
    this.head.rotation.y = this._look.yaw * 0.55 - pelvisYaw * 0.4;
    this.head.rotation.x = -this._look.pitch * 0.45 + Math.sin(ph * 2) * 0.02 * moving;
    this.head.rotation.z = -this._turn * 0.3;

    // Parpadeo
    const b = this._blink;
    b.t -= dt;
    if (b.t <= 0) {
      b.d = 0.13;
      b.t = 2.2 + Math.random() * 3.5;
    }
    b.d = Math.max(0, b.d - dt);
    if (this.eyes) this.eyes.scale.y = b.d > 0 ? 0.12 : 1;

    this._smoothJoints(dt);

    // Pulso suave de la marca del Destino
    const pulse = 0.75 + Math.sin(this._time * 2.5) * 0.25;
    if (this.destinoMark) this.destinoMark.plane.material.opacity = pulse;
  }

  /**
   * Suavizado final de todas las articulaciones: las poses calculadas son el
   * objetivo y el cuerpo las sigue muy deprisa, así los cambios de estado
   * (apuntar, aterrizar, agarrarse) no saltan de golpe. El puñetazo va sin
   * suavizar para que sea seco.
   */
  _smoothJoints(dt) {
    const J = this._joints;
    if (!this._smoothed) {
      this._smoothed = J.map((o) => [o.rotation.x, o.rotation.y, o.rotation.z]);
      return;
    }
    const a = 1 - Math.exp(-dt * (this._punch > 0 || this._hit > 0.5 ? 60 : 26));
    for (let i = 0; i < J.length; i++) {
      const r = J[i].rotation;
      const p = this._smoothed[i];
      p[0] += wrapAngle(r.x - p[0]) * a;
      p[1] += wrapAngle(r.y - p[1]) * a;
      p[2] += wrapAngle(r.z - p[2]) * a;
      r.set(p[0], p[1], p[2]);
    }
  }
}
