import * as THREE from 'three';

/**
 * Hitos de Ibaia con modelo propio: la Torre de la Defensa, las Anclas de
 * las barreras, depósitos, chimeneas, grúas del puerto, la noria, el faro,
 * antenas, la fuente del Kilómetro Cero y la pajarera del zoo.
 * (Su colisión son las cajas del ObbSet; aquí solo va lo que se ve.)
 */

function piece(group, geo, mat, { cast = true, name } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = cast;
  m.receiveShadow = true;
  m.userData.levelStatic = true;
  if (name) m.name = name;
  group.add(m);
  return m;
}

/** Textura de la Torre: vidrio oscuro con nervios verticales ámbar y bandas de luz. */
function torreTextures() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 256;
  const g = c.getContext('2d');
  const e = document.createElement('canvas');
  e.width = 64;
  e.height = 256;
  const ge = e.getContext('2d');
  g.fillStyle = '#28303f';
  g.fillRect(0, 0, 64, 256);
  ge.fillStyle = '#000';
  ge.fillRect(0, 0, 64, 256);
  for (let y = 0; y < 256; y += 8) {
    g.fillStyle = 'rgba(120,150,190,0.18)';
    g.fillRect(0, y, 64, 1);
  }
  ge.fillStyle = '#ffb547';
  ge.fillRect(30, 0, 4, 256);
  ge.fillRect(0, 0, 2, 256);
  ge.fillStyle = 'rgba(255,181,71,0.5)';
  ge.fillRect(0, 124, 64, 3);
  const t = new THREE.CanvasTexture(c);
  const te = new THREE.CanvasTexture(e);
  t.colorSpace = te.colorSpace = THREE.SRGBColorSpace;
  for (const x of [t, te]) {
    x.wrapS = x.wrapT = THREE.RepeatWrapping;
    x.repeat.set(4, 26);
  }
  return { map: t, emissiveMap: te };
}

/** La Torre de la Defensa (520 m) con la corona de luz donde está encadenada la Defensa. */
export function buildTorre(group, CITY) {
  const T = CITY.torre;
  const H = 520;
  const tx = torreTextures();
  const body = new THREE.MeshStandardMaterial({ ...tx, color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.2, metalness: 0.6, roughness: 0.25 });
  // Base cuadrada girada 45° (lado 62 m): cilindro de 4 lados con radio = lado / √2
  const r = 62 / Math.SQRT2;
  piece(group, new THREE.CylinderGeometry(r, r, H, 4, 1).translate(T.x, H / 2, T.z), body, { name: 'Torre de la Defensa' });
  const amber = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb547').multiplyScalar(2.4), toneMapped: false });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1c222c, metalness: 0.7, roughness: 0.3 });
  piece(group, new THREE.CylinderGeometry(r * 0.72, r, 24, 4).translate(T.x, H + 12, T.z), dark);
  piece(group, new THREE.CylinderGeometry(r * 0.78, r * 0.78, 3, 4).translate(T.x, H + 25, T.z), amber, { cast: false });
  piece(group, new THREE.ConeGeometry(4, 80, 4).translate(T.x, H + 64, T.z), dark);
  // Haz de luz hacia el cielo
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(3, 9, 900, 12, 1, true).translate(T.x, H + 480, T.z),
    new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb547').multiplyScalar(0.5), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }),
  );
  beam.name = 'Haz de la Torre';
  group.add(beam);
}

/**
 * Anclas de las barreras: un cristal ámbar con su haz de luz, sobre lo que
 * haya en ese punto (azotea, chimenea o calle). Al bajar la barrera del
 * barrio, el Ancla se apaga.
 */
export class Anchors {
  constructor(ctx, CITY, world) {
    this.root = new THREE.Group();
    this.root.name = 'Anclas';
    ctx.group.add(this.root);
    const crystalGeo = new THREE.OctahedronGeometry(2.2, 0).scale(1, 2.4, 1);
    const beamGeo = new THREE.CylinderGeometry(0.8, 1.6, 360, 10, 1, true).translate(0, 180, 0);
    this.items = CITY.districts.map((d) => {
      const { x, z } = d.anchor;
      const y = Math.max(0, world.groundHeight(x, z, 1.5, 5000));
      const on = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb547').multiplyScalar(2.2), toneMapped: false });
      const crystal = new THREE.Mesh(crystalGeo, on);
      crystal.position.set(x, y + 6, z);
      const beamMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb547').multiplyScalar(0.6), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.set(x, y, z);
      crystal.name = `Ancla · ${d.anchor.name}`;
      this.root.add(crystal, beam);
      return { id: d.id, crystal, beam, mat: on, beamMat, y, x, z, broken: false };
    });
    this.time = 0;
  }

  setBroken(id, broken) {
    const a = this.items.find((i) => i.id === id);
    if (!a) return;
    a.broken = broken;
    a.beam.visible = !broken;
    a.mat.color.set(broken ? '#3a2a14' : '#ffb547');
    if (!broken) a.mat.color.multiplyScalar(2.2);
  }

  update(dt) {
    this.time += dt;
    for (const a of this.items) {
      if (a.broken) continue;
      a.crystal.rotation.y += dt * 0.6;
      a.crystal.position.y = a.y + 6 + Math.sin(this.time * 1.3 + a.x) * 0.6;
      a.beamMat.opacity = 0.38 + 0.12 * Math.sin(this.time * 2.1 + a.z);
    }
  }
}

/** Modelos de los tipos especiales (depósitos, chimeneas, noria, faro, antenas…). */
export function buildSpecials(group, CITY, B) {
  const M = {
    tank: new THREE.MeshStandardMaterial({ color: 0xc9ccd0, metalness: 0.5, roughness: 0.45 }),
    chimney: new THREE.MeshStandardMaterial({ color: 0xa7a29c, roughness: 0.85 }),
    red: new THREE.MeshStandardMaterial({ color: 0xb8352a, roughness: 0.6 }),
    white: new THREE.MeshStandardMaterial({ color: 0xf0ece4, roughness: 0.6 }),
    wheel: new THREE.MeshStandardMaterial({ color: 0xe9c46a, metalness: 0.4, roughness: 0.4 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x9aa1aa, metalness: 0.6, roughness: 0.4 }),
    crane: new THREE.MeshStandardMaterial({ color: 0xc96a3a, metalness: 0.3, roughness: 0.55 }),
    water: new THREE.MeshStandardMaterial({ color: 0x5aa6d6, roughness: 0.05, metalness: 0.2 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x9fd6e6, roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.35, depthWrite: false }),
    frame: new THREE.MeshStandardMaterial({ color: 0x3f4a52, metalness: 0.6, roughness: 0.4, wireframe: true }),
  };
  const lamp = new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff2c4').multiplyScalar(3), toneMapped: false });
  const redLight = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff3b30').multiplyScalar(3), toneMapped: false });
  for (const s of CITY.specials) {
    const { x, z, r, h } = s;
    if (s.k === 'tank') {
      piece(group, new THREE.CylinderGeometry(r, r, h, 24).translate(x, h / 2, z), M.tank);
      piece(group, new THREE.SphereGeometry(r, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.25, 1).translate(x, h, z), M.tank);
    } else if (s.k === 'chimney') {
      piece(group, new THREE.CylinderGeometry(r * 0.7, r, h, 16).translate(x, h / 2, z), M.chimney);
      for (const yy of [h - 6, h - 16]) piece(group, new THREE.CylinderGeometry(r * 0.72, r * 0.74, 4, 16).translate(x, yy, z), M.red);
      piece(group, new THREE.SphereGeometry(0.8, 8, 6).translate(x, h + 1, z), redLight, { cast: false });
    } else if (s.k === 'wheel') {
      // Noria de 60 m: aro, radios y patas
      const R = h / 2 - 3;
      const cy = R + 4;
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(R, 0.7, 6, 48), M.wheel);
      ring.position.y = cy;
      g.add(ring);
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.4, R, 0.4), M.steel);
        spoke.position.set(Math.cos(a) * R / 2, cy + Math.sin(a) * R / 2, 0);
        spoke.rotation.z = a - Math.PI / 2;
        g.add(spoke);
        const cab = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.4, 2.2), k % 2 ? M.red : M.white);
        cab.position.set(Math.cos(a) * R, cy + Math.sin(a) * R - 1.6, 0);
        g.add(cab);
      }
      for (const s2 of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.9, cy + 2, 0.9), M.steel);
        leg.position.set(s2 * R * 0.35, cy / 2, 0);
        leg.rotation.z = s2 * 0.32;
        g.add(leg);
      }
      g.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.userData.levelStatic = true;
        }
      });
      group.add(g);
    } else if (s.k === 'lighthouse') {
      piece(group, new THREE.CylinderGeometry(r * 0.6, r, h, 16).translate(x, h / 2, z), M.white);
      piece(group, new THREE.CylinderGeometry(r * 0.62, r * 0.75, 5, 16).translate(x, h * 0.62, z), M.red);
      piece(group, new THREE.CylinderGeometry(r * 0.45, r * 0.45, 3.5, 12).translate(x, h + 1.75, z), lamp, { cast: false });
      piece(group, new THREE.ConeGeometry(r * 0.55, 3, 12).translate(x, h + 5, z), M.red);
    } else if (s.k === 'fountain') {
      piece(group, new THREE.CylinderGeometry(r, r, 0.8, 32).translate(x, 0.4, z), M.chimney);
      piece(group, new THREE.CylinderGeometry(r - 0.6, r - 0.6, 0.1, 32).translate(x, 0.72, z), M.water, { cast: false });
      piece(group, new THREE.CylinderGeometry(0.8, 1.2, h, 12).translate(x, h / 2, z), M.chimney);
    } else if (s.k === 'antenna') {
      piece(group, new THREE.CylinderGeometry(0.4, 1.4, h, 6).translate(x, h / 2, z), M.steel);
      piece(group, new THREE.SphereGeometry(0.9, 8, 6).translate(x, h + 0.6, z), redLight, { cast: false });
    } else if (s.k === 'glass') {
      const dome = new THREE.SphereGeometry(r, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, h / r, 1).translate(x, 0, z);
      const m = new THREE.Mesh(dome, M.glass);
      m.name = 'Pajarera';
      group.add(m);
      group.add(new THREE.Mesh(dome.clone(), M.frame));
    }
  }
  // Grúas del puerto: patas, pórtico y pluma (en el lugar de su caja)
  const k = CITY.kinds.indexOf('crane');
  for (let i = 0; i < B.n; i++) {
    if (B.kind[i] !== k) continue;
    const g = new THREE.Group();
    g.position.set(B.cx[i], 0, B.cz[i]);
    g.rotation.y = -B.ang[i];
    const hw = B.hw[i];
    const hd = B.hd[i];
    const h = B.h[i];
    const deck = h * 0.55;
    for (const a of [-1, 1]) {
      for (const b of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(1.2, deck, 1.2), M.crane);
        leg.position.set(a * (hw - 1), deck / 2, b * (hd - 1));
        g.add(leg);
      }
    }
    const top = new THREE.Mesh(new THREE.BoxGeometry(2 * hw, deck * 0.12, 2 * hd), M.crane);
    top.position.y = deck * 1.06;
    g.add(top);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(8, 7, 2 * hd - 4), M.crane);
    cab.position.set(-hw * 0.4, deck * 1.12 + 3.5, 0);
    g.add(cab);
    const boom = new THREE.Mesh(new THREE.BoxGeometry(2 * hw + 50, 2.4, 3), M.crane);
    boom.position.set(25, h * 0.78, 0);
    g.add(boom);
    const mast = new THREE.Mesh(new THREE.BoxGeometry(2, h - deck, 2), M.crane);
    mast.position.set(-hw * 0.4, deck + (h - deck) / 2, 0);
    g.add(mast);
    g.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.userData.levelStatic = true;
      }
    });
    group.add(g);
  }
}
