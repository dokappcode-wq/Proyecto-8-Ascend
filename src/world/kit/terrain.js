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
  const index = [];
  for (let j = 0; j < rows - 1; j++) {
    for (let i = 0; i < cols - 1; i++) {
      const a = j * cols + i; // (0,0)
      const b = a + 1; // (1,0)
      const c = a + cols; // (0,1)
      const d = c + 1; // (1,1)
      // Misma diagonal que CollisionWorld.heightfieldAt
      index.push(a, c, d, a, d, b);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('splat', new THREE.BufferAttribute(spl, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  // `simple`: terreno de fondo con solo hierba y tinte (sin mezcla: mucho más barato por píxel)
  const mat = o.simple ? new THREE.MeshStandardMaterial({ map: o.grass, vertexColors: true, roughness: 1 }) : terrainMaterial(o);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.castShadow = !o.simple;
  mesh.name = 'Terreno';
  ctx.group.add(mesh);
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
