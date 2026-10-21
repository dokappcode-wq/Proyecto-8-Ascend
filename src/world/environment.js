import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng } from './textures.js';

/**
 * Cúpula de cielo procedural (sin texturas externas): degradado, sol con
 * halo, nubes animadas (ruido fractal proyectado sobre un plano alto),
 * estrellas que titilan y luna.
 *
 * @param {object} o
 *  - top, horizon, bottom, sunDir, sunColor: degradado y sol (como antes)
 *  - clouds: cobertura 0..1 · cloudColor: color de las nubes · cloudShade: base en sombra
 *  - stars: intensidad de las estrellas 0..1 · moonDir: dirección de la luna (o null)
 *  - wind: velocidad de las nubes
 */
export function createSky({
  top = '#0b1a33', horizon = '#d9774a', bottom = '#1a1c22', sunDir = new THREE.Vector3(0.4, 0.15, -1), sunColor = '#ffb46b', radius = 900,
  clouds = 0.35, cloudColor = '#ffffff', cloudShade = null, stars = 0, moonDir = null, wind = 0.006,
} = {}) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(top) },
      horizon: { value: new THREE.Color(horizon) },
      bottom: { value: new THREE.Color(bottom) },
      sunDir: { value: sunDir.clone().normalize() },
      sunColor: { value: new THREE.Color(sunColor) },
      clouds: { value: clouds },
      cloudColor: { value: new THREE.Color(cloudColor) },
      cloudShade: { value: new THREE.Color(cloudShade ?? new THREE.Color(horizon).lerp(new THREE.Color(top), 0.5).multiplyScalar(0.8)) },
      stars: { value: stars },
      moonDir: { value: (moonDir ?? new THREE.Vector3(0, -1, 0)).clone().normalize() },
      moon: { value: moonDir ? 1 : 0 },
      time: { value: 0 },
      wind: { value: wind },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom;
      uniform vec3 sunDir; uniform vec3 sunColor;
      uniform float clouds; uniform vec3 cloudColor; uniform vec3 cloudShade;
      uniform float stars; uniform vec3 moonDir; uniform float moon;
      uniform float time; uniform float wind;
      varying vec3 vDir;
      float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
      float hash13(vec3 p3) { p3 = fract(p3 * 0.1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
      float vnoise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
      }
      float fbm(vec2 p) {
        float v = 0.0; float a = 0.5;
        for (int i = 0; i < 4; i++) { v += a * vnoise(p); p = p * 2.03 + vec2(17.1, 9.3); a *= 0.5; }
        return v;
      }
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = h > 0.0 ? mix(horizon, top, pow(clamp(h, 0.0, 1.0), 0.55))
                           : mix(horizon, bottom, pow(clamp(-h, 0.0, 1.0), 0.4));
        vec3 sd = normalize(sunDir);
        float s = max(dot(d, sd), 0.0);
        // Halo amplio cerca del horizonte (dispersión) y disco del sol
        col += sunColor * (pow(s, 8.0) * 0.25 * (1.0 - abs(h)) + pow(s, 900.0) * 4.0 + pow(s, 60.0) * 0.4);
        // Estrellas (celdas 3D con un punto desplazado; titilan)
        if (stars > 0.0 && h > 0.0) {
          vec3 p = d * 260.0;
          vec3 c = floor(p);
          float r = hash13(c);
          if (r > 0.982) {
            vec3 o = vec3(hash13(c + 1.3), hash13(c + 2.7), hash13(c + 5.1)) - 0.5;
            float dist = length(fract(p) - 0.5 - o * 0.6);
            float tw = 0.65 + 0.35 * sin(time * (2.0 + r * 9.0) + r * 40.0);
            col += vec3(0.85, 0.9, 1.0) * smoothstep(0.16, 0.0, dist) * tw * stars * smoothstep(0.0, 0.25, h) * (r - 0.982) * 55.0;
          }
        }
        // Luna
        if (moon > 0.5) {
          float m = max(dot(d, normalize(moonDir)), 0.0);
          col += vec3(0.75, 0.82, 0.95) * (smoothstep(0.99955, 0.9997, m) * 1.6 + pow(m, 120.0) * 0.18);
        }
        // Nubes: ruido fractal sobre un plano alto, iluminadas por el sol
        if (clouds > 0.0 && h > -0.02) {
          vec2 uv = d.xz / (h + 0.18) * 0.55 + vec2(time * wind, time * wind * 0.35);
          float n = fbm(uv * 1.7) * 0.75 + fbm(uv * 5.3 + 3.1) * 0.25;
          float cov = smoothstep(1.0 - clouds * 0.9, 1.05 - clouds * 0.55, n);
          float fade = smoothstep(-0.02, 0.2, h);
          float lit = clamp(dot(d, sd) * 0.5 + 0.5, 0.0, 1.0);
          float thick = smoothstep(0.45, 0.95, n);
          vec3 cc = mix(cloudColor, cloudShade, thick * 0.75) + sunColor * pow(lit, 6.0) * 0.35;
          col = mix(col, cc, cov * fade * 0.92);
        }
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 16), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  mesh.name = 'Cielo';
  // Las nubes se mueven y las estrellas titilan
  mesh.onBeforeRender = () => {
    mat.uniforms.time.value = performance.now() / 1000;
  };
  return mesh;
}

/**
 * Mapa de entorno (reflejos y luz ambiental) generado a partir del cielo del
 * mapa: los metales, cristales y superficies brillantes reflejan ese cielo.
 */
export function skyEnvironment(renderer, sky) {
  const mat = sky.material.clone();
  mat.vertexShader = mat.vertexShader.replace('gl_Position = p.xyww;', 'gl_Position = p;');
  mat.uniforms.time.value = 7;
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), mat));
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(scene, 0.03, 0.1, 50);
  pmrem.dispose();
  mat.dispose();
  scene.children[0].geometry.dispose();
  return rt;
}

/**
 * Luz solar con sombras que sigue al jugador (la cámara de sombras cubre
 * solo el entorno cercano para mantener la resolución). Bordes suaves (PCF con radio).
 */
export function createSun({ color = '#ffd2a1', intensity = 2.2, direction = new THREE.Vector3(-0.5, -0.8, 0.35), shadowSize = 45 }) {
  const sun = new THREE.DirectionalLight(color, intensity);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const s = shadowSize;
  Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 220 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  sun.shadow.radius = 2.2;
  sun.userData.direction = direction.clone().normalize();
  return sun;
}

/** Recoloca el sol alrededor de un punto (el jugador). */
export function followSun(sun, p) {
  const d = sun.userData.direction;
  sun.target.position.set(p.x, p.y, p.z);
  sun.position.set(p.x - d.x * 100, p.y - d.y * 100, p.z - d.z * 100);
  sun.target.updateMatrixWorld();
}

/**
 * Cordillera de fondo: conos con crestas irregulares (desplazamiento por
 * ángulo y altura), sombreado plano y color por cara — falda verde, roca y
 * nieve en las caras altas y poco inclinadas. Todas las cumbres se fusionan
 * en una sola malla (una llamada de dibujo).
 *
 * @param {Array<{x:number,z:number,rad:number,h:number,y0?:number}>} peaks
 * @param {object} o { rock, low, snow, snowLine (0..1 de la altura; >1 = sin nieve), seed }
 */
export function createMountains(peaks, { rock = '#5d636b', low = '#3e4a3a', snow = '#eef2f6', snowLine = 0.62, seed = 1 } = {}) {
  const r = rng(seed);
  const cRock = new THREE.Color(rock);
  const cLow = new THREE.Color(low);
  const cSnow = new THREE.Color(snow);
  const c = new THREE.Color();
  const n = new THREE.Vector3();
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  const geos = [];
  for (const p of peaks) {
    const y0 = p.y0 ?? 0;
    const ph = [r() * 6.28, r() * 6.28, r() * 6.28, (r() - 0.5) * 0.3, (r() - 0.5) * 0.3];
    let g = new THREE.ConeGeometry(1, 1, 11, 6, true);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i) + 0.5; // 0 en la base, 1 en la cima
      const z = pos.getZ(i);
      const rr = Math.hypot(x, z);
      if (rr < 1e-5) {
        // Cima algo desplazada (no todas las cumbres son simétricas)
        pos.setXYZ(i, p.x + ph[3] * p.rad, y0 + p.h, p.z + ph[4] * p.rad);
        continue;
      }
      const a = Math.atan2(z, x);
      const k = 1 + 0.2 * Math.sin(a * 3 + ph[0] + y * 2.2) + 0.12 * Math.sin(a * 5 + ph[1]) + 0.07 * Math.sin(a * 9 + ph[2] + y * 6);
      const lean = (1 - rr) * 0.5; // las cotas altas se inclinan hacia la cima desplazada
      pos.setXYZ(
        i,
        p.x + Math.cos(a) * rr * k * p.rad + ph[3] * p.rad * lean,
        y0 + (y + 0.04 * Math.sin(a * 4 + ph[1]) * y * (1 - y)) * p.h,
        p.z + Math.sin(a) * rr * k * p.rad + ph[4] * p.rad * lean,
      );
    }
    g.deleteAttribute('uv');
    g = g.toNonIndexed();
    const P = g.attributes.position;
    const col = new Float32Array(P.count * 3);
    for (let t = 0; t < P.count; t += 3) {
      e1.fromBufferAttribute(P, t + 1).sub(n.fromBufferAttribute(P, t));
      e2.fromBufferAttribute(P, t + 2).sub(n);
      n.crossVectors(e1, e2).normalize();
      const hy = ((P.getY(t) + P.getY(t + 1) + P.getY(t + 2)) / 3 - y0) / p.h;
      const jitter = (r() - 0.5) * 0.12;
      if (hy > snowLine + jitter && Math.abs(n.y) > 0.32) c.copy(cSnow).multiplyScalar(0.92 + r() * 0.08);
      else if (hy < 0.3) c.copy(cLow).lerp(cRock, Math.max(0, hy / 0.3 + jitter)).multiplyScalar(0.85 + r() * 0.2);
      else c.copy(cRock).multiplyScalar(0.8 + r() * 0.3);
      for (let v = 0; v < 3; v++) c.toArray(col, (t + v) * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    geos.push(g);
  }
  const mesh = new THREE.Mesh(mergeGeometries(geos), new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }));
  for (const g of geos) g.dispose();
  mesh.name = 'Montañas';
  return mesh;
}

/**
 * Ciudad lejana: torres instanciadas en abanico (una llamada de dibujo) con
 * ventanas encendidas. Las ventanas se proyectan en metros (no en UV) para
 * que todas las torres tengan plantas del mismo tamaño, y cada torre lleva
 * su propio tono de fachada. Sin niebla: se ve desde muy lejos.
 *
 * @param {object} o { origin, heading (rad; 0 = +X), spread (rad), dist: [min, max], count, seed, lit (0..1), fog (false | true | escala de la niebla suave) }
 */
export function createCity({ origin = { x: 0, y: 0, z: 0 }, heading = 0, spread = 1.2, dist = [640, 900], count = 180, seed = 33, lit = 0.26, intensity = 0.9, fog = false, near = null } = {}) {
  const r = rng(seed);
  const list = [];
  for (let i = 0; i < count; i++) {
    const a = (r() - 0.5) * spread;
    const d = dist[0] + r() * (dist[1] - dist[0]);
    const h = 30 + Math.pow(r(), 2) * 190 + (Math.abs(a) < spread * 0.15 ? 80 : 0);
    const w = 14 + r() * 22;
    list.push({ x: origin.x + Math.cos(heading + a) * d, y: origin.y, z: origin.z + Math.sin(heading + a) * d, ry: r() * 0.5, w, h, d: w * (0.7 + r() * 0.6), tone: 0.85 + r() * 0.3 });
  }
  return cityTowers(list, { lit, intensity, fog, near });
}

/**
 * Niebla suave: la niebla exponencial del mapa con la densidad multiplicada
 * por `k` en este material. Para lo muy lejano (ciudad, horizonte) que debe
 * verse velado por la bruma y no recortado contra ella, sin desaparecer.
 */
export function softFog(mat, k = 0.3) {
  mat.fog = true;
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, renderer) => {
    prev?.call(mat, sh, renderer);
    sh.fragmentShader = sh.fragmentShader.replace(
      '#include <fog_fragment>',
      `#ifdef USE_FOG
        #ifdef FOG_EXP2
          float fogFactor = 1.0 - exp( - fogDensity * fogDensity * ${(k * k).toFixed(5)} * vFogDepth * vFogDepth );
        #else
          float fogFactor = smoothstep( fogNear, fogFar / ${k.toFixed(4)}, vFogDepth );
        #endif
        gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
      #endif`,
    );
  };
  mat.customProgramCacheKey = () => `${prev.toString()}|softFog${k}`;
  return mat;
}

/**
 * Torres de ciudad en una sola llamada de dibujo (instancias) en las
 * posiciones dadas: [{ x, y, z, w, h, d, ry, tone }]. `fog`: si les afecta la
 * niebla (las cercanas sí; el horizonte lejano, no; un número: niebla suave).
 * Material Lambert (barato: tapan mucha pantalla). `near`: punto desde el que
 * se ven; las torres se ordenan de cerca a lejos para pintar menos píxeles ocultos.
 */
export function cityTowers(list, { lit = 0.26, intensity = 0.9, fog = false, near = null } = {}) {
  if (near) list = [...list].sort((a, b) => Math.hypot(a.x - near.x, a.z - near.z) - Math.hypot(b.x - near.x, b.z - near.z));
  const geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xffc98a, emissiveMap: cityWindows(lit), emissiveIntensity: intensity, fog: fog === true });
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCityP;\nvarying vec3 vCityN;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vec3 citySc = vec3(1.0);
        #ifdef USE_INSTANCING
          citySc = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
        #endif
        vCityP = position * citySc;
        vCityN = normal;`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCityP;\nvarying vec3 vCityN;')
      .replace(
        '#include <emissivemap_fragment>',
        `vec3 cityA = abs(vCityN);
        vec2 cityUv = (cityA.x > cityA.z ? vCityP.zy : vCityP.xy) / vec2(64.0, 57.6);
        totalEmissiveRadiance *= cityA.y > 0.5 ? vec3(0.0) : texture2D(emissiveMap, cityUv).rgb;
        // Las plantas bajas quedan en la bruma; las altas, algo más oscuras
        diffuseColor.rgb *= 0.75 + 0.25 * smoothstep(0.0, 40.0, vCityP.y);`,
      );
  };
  if (typeof fog === 'number') softFog(mat, fog);
  const towers = new THREE.InstancedMesh(geo, mat, list.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const col = new THREE.Color();
  const up = new THREE.Vector3(0, 1, 0);
  const tones = [0x262d38, 0x2f3642, 0x38332f, 0x22282e, 0x3b4250];
  list.forEach((t, i) => {
    p.set(t.x, t.y ?? 0, t.z);
    q.setFromAxisAngle(up, t.ry ?? 0);
    s.set(t.w, t.h, t.d ?? t.w);
    m.compose(p, q, s);
    towers.setMatrixAt(i, m);
    towers.setColorAt(i, col.setHex(tones[i % tones.length]).multiplyScalar(t.tone ?? 1));
  });
  towers.userData.city = true;
  towers.name = 'Ciudad';
  return towers;
}

/**
 * Ventanas de la ciudad: 16 × 16 huecos (4 m × 3.6 m cada uno), unas
 * encendidas en tonos cálidos o fríos y otras apagadas.
 */
function cityWindows(lit) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, 256, 256);
  const r = rng(5);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      if (r() > lit) continue;
      const v = 0.35 + r() * 0.65;
      const warm = r() < 0.8;
      g.fillStyle = warm ? `rgb(${255 * v},${200 * v},${130 * v})` : `rgb(${170 * v},${200 * v},${255 * v})`;
      g.fillRect(x * 16 + 3, y * 16 + 4, 10, 9);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}
