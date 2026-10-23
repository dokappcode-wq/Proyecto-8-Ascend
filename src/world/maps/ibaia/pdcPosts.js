import * as THREE from 'three';
import { pdcBannerTexture } from '../../textures.js';
import { postFrame, at } from './pdcPlan.js';

/**
 * Puestos de la PDC en las calles de Ibaia, girados con la calle: vallas
 * de hormigón que cortan medio carril, garita, torre de escaneo con anillos
 * azules (la de la torre de vigilancia es alta y lleva estandarte), camión
 * aparcado (de él bajan los refuerzos) y foco con su charco de luz.
 * Cada pieza tiene su caja orientada en `set`; se omite la que chocaría con
 * un edificio (`blocked`).
 */
export function buildPdcPosts(group, CITY, set, blocked) {
  const M = {
    concrete: new THREE.MeshStandardMaterial({ color: 0xbdb8ae, roughness: 0.85 }),
    stripe: new THREE.MeshStandardMaterial({ color: 0xc23b2e, roughness: 0.6 }),
    navy: new THREE.MeshStandardMaterial({ color: 0x1f2a44, metalness: 0.4, roughness: 0.45 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x14181f, metalness: 0.5, roughness: 0.4 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x6fb6dc, emissive: 0x2a7aa8, emissiveIntensity: 0.8, roughness: 0.15 }),
    scan: new THREE.MeshBasicMaterial({ color: new THREE.Color('#3ac8ff').multiplyScalar(2.2), toneMapped: false }),
    lamp: new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff2d8').multiplyScalar(2.5), toneMapped: false }),
    banner: new THREE.MeshStandardMaterial({ map: pdcBannerTexture(), side: THREE.DoubleSide, roughness: 0.7 }),
  };
  const pools = [];
  let placed = 0;
  const piece = (geo, mat, cast = true) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = cast;
    m.receiveShadow = true;
    m.userData.levelStatic = true;
    group.add(m);
    return m;
  };
  /** Caja girada con malla y colisión (u, v locales al puesto; along: 'u' o 'v'). */
  const box = (p, u, v, { len, wid, h, y = 0, along = 'u', mat, collide = true, tag = 'pdc' }) => {
    const c = at(p, u, v);
    const angle = along === 'u' ? p.ang : p.ang + Math.PI / 2;
    const hw = len / 2;
    const hd = wid / 2;
    const ext = Math.abs(Math.cos(angle)) * hw + Math.abs(Math.sin(angle)) * hd;
    const ezt = Math.abs(Math.sin(angle)) * hw + Math.abs(Math.cos(angle)) * hd;
    if (blocked(c.x - ext, c.x + ext, y, y + h, c.z - ezt, c.z + ezt)) return null;
    const g = new THREE.BoxGeometry(len, h, wid).translate(0, y + h / 2, 0).rotateY(-angle).translate(c.x, 0, c.z);
    piece(g, mat);
    if (collide) set.add({ cx: c.x, cz: c.z, angle, hw, hd, minY: y, maxY: y + h, tag });
    return c;
  };

  for (const p of CITY.pdc.posts) {
    const f = postFrame(p);
    const tall = p.kind === 'tower';
    // Vallas: cortan el carril +v y dejan el otro como paso de control
    for (let v = 1.5; v < f.half - 1; v += 3.3) {
      if (box(p, 0, v, { len: 3, wid: 0.6, h: 0.95, along: 'v', mat: M.concrete })) {
        box(p, 0, v, { len: 3.02, wid: 0.62, h: 0.12, y: 0.55, along: 'v', mat: M.stripe, collide: false });
      }
    }
    // Garita en la acera opuesta
    const booth = box(p, 4, -(f.half + 1.8), { len: 2.6, wid: 2.4, h: 2.7, mat: M.navy });
    if (booth) box(p, 4, -(f.half + 0.55), { len: 2.2, wid: 0.1, h: 0.9, y: 1.3, mat: M.glass, collide: false });
    // Torre de escaneo (alta en la torre de vigilancia)
    const H = tall ? 14 : 7;
    const t = box(p, -6, f.half + 2.5, { len: 1.3, wid: 1.3, h: H, mat: M.navy });
    if (t) {
      for (let k = 0; k < (tall ? 5 : 3); k++) {
        const ring = piece(new THREE.TorusGeometry(1.15, 0.09, 6, 24).rotateX(Math.PI / 2), M.scan, false);
        ring.position.set(t.x, 2.5 + k * (tall ? 2.6 : 2), t.z);
      }
      box(p, -6, f.half + 2.5, { len: 3, wid: 3, h: 0.4, y: H, mat: M.navy });
      pools.push({ x: t.x, z: t.z, r: 5, color: 0x3ac8ff });
      if (tall) {
        const b = piece(new THREE.PlaneGeometry(1.9, 4.6), M.banner, false);
        b.position.set(t.x, H - 4, t.z);
        b.rotation.y = -p.ang;
        const lamp = piece(new THREE.CylinderGeometry(0.5, 0.7, 0.8, 10), M.lamp, false);
        lamp.position.set(t.x, H + 0.8, t.z);
      }
    }
    // Camión de la PDC aparcado junto al bordillo (de él bajan los refuerzos)
    if (p.kind !== 'metro') {
      const body = box(p, 14, -(f.half - 3), { len: 8.5, wid: 2.6, h: 3.2, y: 0.4, mat: M.navy });
      if (body) {
        box(p, 19.6, -(f.half - 3), { len: 2.4, wid: 2.5, h: 2.6, y: 0.4, mat: M.dark });
        box(p, 14, -(f.half - 3), { len: 8.6, wid: 2.62, h: 0.25, y: 2.4, mat: M.scan, collide: false });
      }
    }
    // Foco sobre el control
    const fl = box(p, -2, -(f.half + 1.5), { len: 0.25, wid: 0.25, h: 7, mat: M.dark });
    if (fl) {
      const head = piece(new THREE.BoxGeometry(1, 0.4, 0.6), M.lamp, false);
      head.position.set(fl.x, 7.1, fl.z);
      const c = at(p, -2, 0);
      pools.push({ x: c.x, z: c.z, r: 9, color: 0xfff0d8 });
    }
    placed++;
  }
  // Charcos de luz (azul de los escáneres, blanco de los focos)
  if (pools.length) {
    const geos = pools.map(({ x, z, r, color }) => {
      const g = new THREE.CircleGeometry(r, 20).rotateX(-Math.PI / 2).translate(x, 0.14, z);
      const col = new THREE.Color(color).multiplyScalar(0.35);
      const n = g.attributes.position.count;
      const arr = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) arr.set([col.r, col.g, col.b], i * 3);
      g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
      return g;
    });
    const merged = new THREE.Mesh(mergeAll(geos), new THREE.MeshBasicMaterial({ map: poolTexture(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    merged.renderOrder = 1;
    merged.name = 'Luces de la PDC';
    group.add(merged);
  }
  return placed;
}

/** Hoguera de un campamento de Acólitos: troncos, brasas y resplandor violeta. */
export function buildCamp(group, { x, z }) {
  const wood = new THREE.MeshStandardMaterial({ color: 0x4a3324, roughness: 0.9 });
  const ember = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff7a3a').multiplyScalar(2.4), toneMapped: false });
  const glow = new THREE.MeshBasicMaterial({ map: poolTexture(), color: new THREE.Color('#b45cff').multiplyScalar(0.9), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  for (let k = 0; k < 4; k++) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 1.4, 6).rotateZ(Math.PI / 2).rotateY((k * Math.PI) / 4), wood);
    log.position.set(x, 0.18, z);
    group.add(log);
  }
  const e = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.9, 8), ember);
  e.position.set(x, 0.55, z);
  const g = new THREE.Mesh(new THREE.PlaneGeometry(12, 12).rotateX(-Math.PI / 2), glow);
  g.position.set(x, 0.15, z);
  g.renderOrder = 1;
  group.add(e, g);
  return e;
}

function mergeAll(geos) {
  let n = 0;
  for (const g of geos) n += g.index ? g.index.count : g.attributes.position.count;
  const pos = [];
  const uv = [];
  const col = [];
  for (const g of geos) {
    const ng = g.index ? g.toNonIndexed() : g;
    pos.push(...ng.attributes.position.array);
    uv.push(...ng.attributes.uv.array);
    col.push(...ng.attributes.color.array);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  out.computeBoundingSphere();
  return n ? out : new THREE.BufferGeometry();
}

function poolTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.5, 'rgba(255,255,255,0.4)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
