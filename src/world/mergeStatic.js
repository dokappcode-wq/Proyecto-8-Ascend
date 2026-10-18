import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Fusiona la geometría estática de un mapa (la creada por LevelBuilder) en
 * una malla por material. Un mapa pasa de cientos de llamadas de dibujo a
 * unas decenas; la colisión no cambia (está en el CollisionWorld).
 *
 * Solo se fusionan mallas marcadas con `userData.levelStatic`, visibles y
 * opacas. Las mallas con varios materiales (fachadas con azotea) se separan
 * por grupo de material antes de fusionar.
 * @returns {{ before: number, after: number }} mallas antes y después
 */
export function mergeStatic(root) {
  root.updateMatrixWorld(true);
  const buckets = new Map();
  const merged = [];
  let before = 0;
  root.traverse((o) => {
    if (!o.isMesh || !o.userData.levelStatic || !o.visible) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (mats.some((m) => m.transparent)) return;
    const src = o.geometry;
    if (!src.attributes.position || !src.attributes.normal || !src.attributes.uv) return;
    before++;
    const geo = src.index ? src.toNonIndexed() : src.clone();
    for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(k)) geo.deleteAttribute(k);
    geo.applyMatrix4(o.matrixWorld);
    const parts = Array.isArray(o.material) && geo.groups.length
      ? geo.groups.map((g) => ({ geo: slice(geo, g.start, g.count), mat: mats[g.materialIndex] }))
      : [{ geo, mat: mats[0] }];
    for (const { geo: pg, mat } of parts) {
      pg.clearGroups();
      const key = `${mat.uuid}|${o.castShadow}|${o.receiveShadow}`;
      if (!buckets.has(key)) buckets.set(key, { mat, cast: o.castShadow, receive: o.receiveShadow, geos: [] });
      buckets.get(key).geos.push(pg);
    }
    merged.push(o);
  });
  if (!merged.length) return { before: 0, after: 0 };

  for (const o of merged) o.parent.remove(o);
  for (const b of buckets.values()) {
    const geo = mergeGeometries(b.geos, false);
    for (const g of b.geos) g.dispose();
    if (!geo) continue;
    const mesh = new THREE.Mesh(geo, b.mat);
    mesh.castShadow = b.cast;
    mesh.receiveShadow = b.receive;
    mesh.name = 'Estático fusionado';
    root.add(mesh);
  }
  // Libera las geometrías originales que ya no use ninguna malla
  const used = new Set();
  root.traverse((o) => o.geometry && used.add(o.geometry));
  for (const o of merged) if (!used.has(o.geometry)) o.geometry.dispose();
  return { before, after: buckets.size };
}

/** Copia de los vértices [start, start + count) de una geometría no indexada. */
function slice(geo, start, count) {
  const out = new THREE.BufferGeometry();
  for (const [name, attr] of Object.entries(geo.attributes)) {
    const n = attr.itemSize;
    out.setAttribute(name, new THREE.BufferAttribute(attr.array.slice(start * n, (start + count) * n), n));
  }
  return out;
}
