import * as THREE from 'three';

/**
 * TERRENO CON RELIEVE: una malla de rejilla cuyas alturas salen de una
 * función, con su colisionador (CollisionWorld.addHeightfield) para que las
 * cuestas se suban andando y lo muy empinado haga de muro.
 *
 * El material mezcla tres texturas por vértice (atributo `splat`): hierba,
 * tierra (sendas, orillas) y roca (laderas empinadas, con proyección
 * vertical para que no se estire). `tint` (color por vértice) oscurece
 * hondonadas y varía el tono.
 */

/**
 * @param {object} o {
 *   minX, minZ, maxX, maxZ, cell (m), height(x, z) → y,
 *   splat(x, z, y, slope) → [tierra, roca] (0..1),
 *   tint(x, z, y, slope) → número (multiplicador de brillo, 1 = neutro),
 *   grass, dirt, rock (texturas), collide (por defecto true) }
 * @returns {{ mesh, hf, heightAt(x, z) }}
 */
export function terrain(ctx, o) {
  const { minX, minZ, maxX, maxZ, cell = 2, height, collide = true } = o;
  const cols = Math.round((maxX - minX) / cell) + 1;
  const rows = Math.round((maxZ - minZ) / cell) + 1;
  const n = cols * rows;
  const heights = new Float32Array(n);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) heights[j * cols + i] = height(minX + i * cell, minZ + j * cell);
  }
  const at = (i, j) => heights[Math.max(0, Math.min(rows - 1, j)) * cols + Math.max(0, Math.min(cols - 1, i))];
  const pos = new Float32Array(n * 3);
  const uv = new Float32Array(n * 2);
  const col = new Float32Array(n * 3);
  const spl = new Float32Array(n * 2);
  // UV en repeticiones de la hierba (las usa su mapa normal; el color se muestrea en metros)
  const gu = o.grass?.userData?.unit ?? 3;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const k = j * cols + i;
      const x = minX + i * cell;
      const z = minZ + j * cell;
      const y = heights[k];
      pos.set([x, y, z], k * 3);
      uv.set([x / gu, z / gu], k * 2);
      const gx = (at(i + 1, j) - at(i - 1, j)) / (2 * cell);
      const gz = (at(i, j + 1) - at(i, j - 1)) / (2 * cell);
      const slope = Math.hypot(gx, gz);
      const [d, r] = o.splat ? o.splat(x, z, y, slope) : [0, Math.min(1, Math.max(0, (slope - 0.7) * 2.5))];
      spl.set([Math.min(1, Math.max(0, d)), Math.min(1, Math.max(0, r))], k * 2);
      // Hondonadas algo más oscuras (oclusión barata) y variación del tinte
      const cavity = (at(i - 1, j) + at(i + 1, j) + at(i, j - 1) + at(i, j + 1)) / 4 - y;
      const t = (o.tint ? o.tint(x, z, y, slope) : 1) * (1 - Math.min(0.35, Math.max(0, cavity) * 0.5));
      col.set([t, t, t], k * 3);
    }
  }
  // Normales a partir de la rejilla completa (continuas entre baldosas)
  const nrm = new Float32Array(n * 3);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const gx = (at(i + 1, j) - at(i - 1, j)) / (2 * cell);
      const gz = (at(i, j + 1) - at(i, j - 1)) / (2 * cell);
      const l = Math.hypot(gx, 1, gz);
      nrm.set([-gx / l, 1 / l, -gz / l], (j * cols + i) * 3);
    }
  }
  // `simple`: terreno de fondo con solo hierba y tinte (sin mezcla: mucho más barato por píxel)
  const mat = o.simple ? new THREE.MeshStandardMaterial({ map: o.grass, vertexColors: true, roughness: 1 }) : terrainMaterial(o);
  // Baldosas de TILE × TILE celdas: se descartan fuera de cámara y, lejos,
  // usan la rejilla cada 2 o 4 vértices (con faldones que tapan las rendijas
  // entre baldosas de distinto detalle)
  const TILE = o.tile ?? 32;
  const lodD = o.simple ? null : o.lodDistances ?? [70, 170];
  const skirt = cell * 2 + 1;
  const mesh = new THREE.Group();
  mesh.name = 'Terreno';
  const tiles = [];
  for (let tj = 0; tj < rows - 1; tj += TILE) {
    for (let ti = 0; ti < cols - 1; ti += TILE) {
      const ci = Math.min(TILE, cols - 1 - ti);
      const cj = Math.min(TILE, rows - 1 - tj);
      const tc = ci + 1;
      const tr = cj + 1;
      // Bordes (índices de la baldosa) en orden: sur, este, norte, oeste
      const edges = [
        Array.from({ length: tc }, (_, k) => k),
        Array.from({ length: tr }, (_, k) => k * tc + ci),
        Array.from({ length: tc }, (_, k) => cj * tc + k),
        Array.from({ length: tr }, (_, k) => k * tc),
      ];
      const nv = tc * tr + edges.reduce((a, e) => a + e.length, 0);
      const P = new Float32Array(nv * 3);
      const U = new Float32Array(nv * 2);
      const C = new Float32Array(nv * 3);
      const S = new Float32Array(nv * 2);
      const N = new Float32Array(nv * 3);
      const copy = (dst, src, g) => {
        P.set(pos.subarray(src * 3, src * 3 + 3), dst * 3);
        U.set(uv.subarray(src * 2, src * 2 + 2), dst * 2);
        C.set(col.subarray(src * 3, src * 3 + 3), dst * 3);
        S.set(spl.subarray(src * 2, src * 2 + 2), dst * 2);
        N.set(nrm.subarray(src * 3, src * 3 + 3), dst * 3);
        if (g) P[dst * 3 + 1] -= g;
      };
      for (let j = 0; j < tr; j++) for (let i = 0; i < tc; i++) copy(j * tc + i, (tj + j) * cols + ti + i, 0);
      const skirtBase = [];
      let v = tc * tr;
      for (const e of edges) {
        skirtBase.push(v);
        for (const k of e) copy(v++, (tj + Math.floor(k / tc)) * cols + ti + (k % tc), skirt);
      }
      const attrs = {
        position: new THREE.BufferAttribute(P, 3), uv: new THREE.BufferAttribute(U, 2), color: new THREE.BufferAttribute(C, 3),
        splat: new THREE.BufferAttribute(S, 2), normal: new THREE.BufferAttribute(N, 3),
      };
      const strides = lodD ? [1, 2, 4].filter((st) => ci % st === 0 && cj % st === 0) : [1];
      const meshes = strides.map((st) => {
        const index = [];
        for (let j = 0; j + st <= cj; j += st) {
          for (let i = 0; i + st <= ci; i += st) {
            const a = j * tc + i; // (0,0)
            const b = a + st; // (1,0)
            const c = a + st * tc; // (0,1)
            const d = c + st; // (1,1)
            // Misma diagonal que CollisionWorld.heightfieldAt
            index.push(a, c, d, a, d, b);
          }
        }
        if (strides.length > 1) {
          edges.forEach((e, ei) => {
            for (let k = 0; k + st < e.length; k += st) {
              const t0 = e[k];
              const t1 = e[k + st];
              const b0 = skirtBase[ei] + k;
              const b1 = skirtBase[ei] + k + st;
              // A las dos caras (el faldón se ve desde la baldosa vecina)
              index.push(t0, b0, b1, t0, b1, t1, t0, b1, b0, t0, t1, b1);
            }
          });
        }
        const geo = new THREE.BufferGeometry();
        for (const [k, a] of Object.entries(attrs)) geo.setAttribute(k, a);
        geo.setIndex(index);
        geo.computeBoundingSphere();
        const m = new THREE.Mesh(geo, mat);
        m.receiveShadow = true;
        m.castShadow = !o.simple;
        m.name = 'Terreno';
        m.visible = st === 1;
        mesh.add(m);
        return m;
      });
      const x0 = minX + ti * cell;
      const z0 = minZ + tj * cell;
      tiles.push({ x0, z0, x1: x0 + ci * cell, z1: z0 + cj * cell, meshes, cur: 0 });
    }
  }
  ctx.group.add(mesh);
  if (lodD) {
    ctx.addEntity({
      lod(eye) {
        for (const t of tiles) {
          const dx = Math.max(t.x0 - eye.x, 0, eye.x - t.x1);
          const dz = Math.max(t.z0 - eye.z, 0, eye.z - t.z1);
          const d = Math.hypot(dx, dz);
          const k = Math.min(t.meshes.length - 1, d < lodD[0] ? 0 : d < lodD[1] ? 1 : 2);
          if (k === t.cur) continue;
          t.meshes[t.cur].visible = false;
          t.meshes[k].visible = true;
          t.cur = k;
        }
      },
    });
  }
  const hf = collide ? ctx.world.addHeightfield({ minX, minZ, cell, cols, rows, heights, tag: 'terrain' }) : null;
  const heightAt = (x, z) => {
    const fx = Math.max(0, Math.min(cols - 1, (x - minX) / cell));
    const fz = Math.max(0, Math.min(rows - 1, (z - minZ) / cell));
    const i = Math.min(cols - 2, Math.floor(fx));
    const j = Math.min(rows - 2, Math.floor(fz));
    const tx = fx - i;
    const tz = fz - j;
    const h00 = at(i, j);
    const h10 = at(i + 1, j);
    const h01 = at(i, j + 1);
    const h11 = at(i + 1, j + 1);
    return tx >= tz ? h00 + tx * (h10 - h00) + tz * (h11 - h10) : h00 + tz * (h01 - h00) + tx * (h11 - h01);
  };
  return { mesh, hf, heightAt };
}

/** Material del terreno: mezcla hierba / tierra / roca según el atributo `splat`. */
export function terrainMaterial({ grass, dirt, rock }) {
  const unit = (t) => t.userData?.unit ?? 3;
  const mat = new THREE.MeshStandardMaterial({ map: grass, vertexColors: true, roughness: 1 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.dirtMap = { value: dirt };
    sh.uniforms.rockMap = { value: rock };
    sh.uniforms.terrUnits = { value: new THREE.Vector3(1 / unit(grass), 1 / unit(dirt), 1 / unit(rock)) };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 splat;\nvarying vec2 vSplat;\nvarying vec3 vTerrPos;\nvarying vec3 vTerrN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSplat = splat;\nvTerrPos = position;\nvTerrN = normal;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D dirtMap;\nuniform sampler2D rockMap;\nuniform vec3 terrUnits;\nvarying vec2 vSplat;\nvarying vec3 vTerrPos;\nvarying vec3 vTerrN;')
      .replace('#include <map_fragment>', `
        vec2 tuv = vTerrPos.xz;
        vec3 tg = texture2D(map, tuv * terrUnits.x).rgb;
        vec3 td = texture2D(dirtMap, tuv * terrUnits.y).rgb;
        vec3 tn = abs(normalize(vTerrN));
        // Roca triplanar en las laderas: dos proyecciones verticales mezcladas por la normal
        vec2 wxz = tn.xz * tn.xz;
        wxz /= max(wxz.x + wxz.y, 1e-4);
        vec3 rside = texture2D(rockMap, vTerrPos.zy * terrUnits.z).rgb * wxz.x + texture2D(rockMap, vTerrPos.xy * terrUnits.z).rgb * wxz.y;
        vec3 tr = mix(texture2D(rockMap, tuv * terrUnits.z).rgb, rside, smoothstep(0.25, 0.5, 1.0 - tn.y));
        // Bordes de la mezcla con algo de ruido de la propia textura (no degradados lisos)
        float nd = clamp(vSplat.x + (td.r - 0.35) * 0.6, 0.0, 1.0);
        float nr = clamp(vSplat.y + (tr.g - 0.4) * 0.5, 0.0, 1.0);
        vec3 tcol = mix(tg, td, smoothstep(0.35, 0.65, nd));
        tcol = mix(tcol, tr, smoothstep(0.3, 0.7, nr));
        diffuseColor.rgb *= tcol;
      `);
  };
  mat.customProgramCacheKey = () => 'terrain-splat';
  return mat;
}
