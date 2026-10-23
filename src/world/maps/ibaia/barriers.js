import * as THREE from 'three';
import { forRingSegments } from './decode.js';

/**
 * BARRERAS DE LA DEFENSA: un muro de luz ámbar con dibujo de hexágonos
 * (300 m de alto) siguiendo el borde de cada barrio, y la cúpula sobre el
 * Centro. Al bajar una barrera el muro se hunde en el suelo y su colisión
 * (grupo del ObbSet) se apaga; al subirla, emerge y vuelve a cerrar el paso.
 */
export const BARRIER_HEIGHT = 300;

const VERT = /* glsl */ `
uniform float uLevel;
uniform float uTop;
uniform float uSink;
varying vec2 vUv;
varying vec3 vWorld;
void main() {
  vec3 p = position;
  p.y -= (1.0 - uLevel) * uSink;
  vUv = uv;
  vec4 w = modelMatrix * vec4(p, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uTime;
uniform float uLevel;
uniform float uTop;
uniform float uHex;
varying vec2 vUv;
varying vec3 vWorld;
float hexDist(vec2 p) { p = abs(p); return max(dot(p, vec2(0.5, 0.8660254)), p.x); }
float h21(vec2 p) { p = fract(p * vec2(233.34, 851.73)); p += dot(p, p + 23.45); return fract(p.x * p.y); }
void main() {
  if (vWorld.y < -0.3) discard;
  vec2 q = vUv / uHex;
  const vec2 r = vec2(1.0, 1.7320508);
  vec2 a = mod(q, r) - r * 0.5;
  vec2 b = mod(q - r * 0.5, r) - r * 0.5;
  vec2 gv = dot(a, a) < dot(b, b) ? a : b;
  vec2 id = q - gv;
  float e = 0.5 - hexDist(gv);
  float fw = fwidth(e);
  float edge = 1.0 - smoothstep(0.0, 0.035 + fw * 1.5, e);
  // A lo lejos los bordes se funden en un velo uniforme (sin moaré)
  float far = smoothstep(0.08, 0.3, fw);
  edge = mix(edge, 0.12, far);
  float cell = h21(id);
  float flick = step(0.93, fract(cell * 13.7 + uTime * 0.11)) * 0.5;
  float scan = smoothstep(0.92, 1.0, fract(vUv.y / 60.0 - uTime * 0.12));
  float ground = exp(-max(vWorld.y, 0.0) / 5.0);
  float top = 1.0 - smoothstep(uTop * 0.55, uTop, vUv.y);
  float d = distance(vWorld, cameraPosition);
  float dist = mix(1.0, 0.22, smoothstep(200.0, 2500.0, d));
  // Vista desde arriba (a ras de muro se ve de canto y se acumula): más tenue
  float above = smoothstep(80.0, 600.0, cameraPosition.y - vWorld.y);
  dist *= mix(1.0, 0.45, above);
  float a2 = (0.05 + edge * 0.42 + flick * (1.0 - far) + scan * 0.18) * top * dist + ground * 0.9;
  // Destello al moverse (subiendo o bajando)
  a2 *= 1.0 + (1.0 - uLevel) * uLevel * 3.0;
  gl_FragColor = vec4(uColor * a2, 1.0);
}`;

function barrierMaterial(color) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color).multiplyScalar(1.6) },
      uTime: { value: 0 },
      uLevel: { value: 1 },
      uTop: { value: BARRIER_HEIGHT },
      uSink: { value: BARRIER_HEIGHT + 6 },
      uHex: { value: 3.2 },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    fog: false,
  });
}

/** Cinta vertical a lo largo de los anillos (u = metros recorridos, v = altura). */
function ribbon(rings, h) {
  const pos = [];
  const uv = [];
  for (const r of rings) {
    let acc = 0;
    forRingSegments(r, (ax, az, bx, bz) => {
      const L = Math.hypot(bx - ax, bz - az);
      pos.push(ax, -2, az, bx, -2, bz, bx, h, bz, ax, -2, az, bx, h, bz, ax, h, az);
      uv.push(acc, -2, acc + L, -2, acc + L, h, acc, -2, acc + L, h, acc, h);
      acc += L;
    });
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeBoundingSphere();
  return g;
}

/** Cúpula (media elipsoide) con UV en metros para el mismo dibujo. */
function domeGeometry(rx, ry, rz) {
  const g = new THREE.SphereGeometry(1, 64, 24, 0, Math.PI * 2, 0, Math.PI / 2);
  const p = g.attributes.position;
  const uv = g.attributes.uv;
  const R = (rx + rz) / 2;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const phi = Math.atan2(z, x);
    const theta = Math.acos(Math.min(1, Math.max(-1, y)));
    uv.setXY(i, (phi + Math.PI) * R * 0.25, (Math.PI / 2 - theta) * ry * 1.6);
  }
  g.scale(rx, ry, rz);
  return g;
}

export class DefenseBarriers {
  /**
   * @param {object} ctx contexto del mapa
   * @param {object} CITY datos de la ciudad
   * @param {import('../../../physics/ObbSet.js').ObbSet} set colisión (un grupo por barrio)
   * @param {object} [state] { [id]: true } barreras bajadas al cargar
   */
  constructor(ctx, CITY, set, state = {}) {
    this.set = set;
    this.time = 0;
    this.root = new THREE.Group();
    this.root.name = 'Barreras de la Defensa';
    ctx.group.add(this.root);
    this.items = CITY.districts.map((d, i) => {
      const mat = barrierMaterial('#ffb547');
      const mesh = new THREE.Mesh(ribbon(d.barrier, BARRIER_HEIGHT), mat);
      mesh.name = `Barrera · ${d.name}`;
      mesh.frustumCulled = true;
      mesh.renderOrder = 3;
      this.root.add(mesh);
      return { id: d.id, name: d.name, group: i + 1, down: false, level: 1, mat, mesh };
    });
    // Cúpula del Centro: va con la barrera del Centro
    const dm = CITY.dome;
    const centro = this.items.find((b) => b.id === 'centro');
    if (centro && dm) {
      const mat = barrierMaterial('#ffb547');
      mat.uniforms.uTop.value = dm.ry * 3;
      mat.uniforms.uSink.value = 0;
      const dome = new THREE.Mesh(domeGeometry(dm.rx, dm.ry, dm.rz), mat);
      dome.position.set(dm.x, 0, dm.z);
      dome.name = 'Cúpula del Centro';
      dome.renderOrder = 3;
      this.root.add(dome);
      centro.dome = dome;
      centro.domeMat = mat;
      centro.domeRy = dm.ry;
    }
    for (const [id, down] of Object.entries(state)) if (down) this.setDown(id, true, true);
  }

  get(id) {
    return this.items.find((b) => b.id === id) ?? null;
  }

  isDown(id) {
    return !!this.get(id)?.down;
  }

  /** Estado para guardar: { id: true } de las bajadas. */
  get state() {
    return Object.fromEntries(this.items.filter((b) => b.down).map((b) => [b.id, true]));
  }

  /**
   * Baja (true) o sube una barrera. La colisión se apaga al empezar a bajar
   * y se enciende al empezar a subir (nadie se cuela mientras emerge).
   */
  setDown(id, down, instant = false) {
    const b = this.get(id);
    if (!b) return false;
    b.down = !!down;
    this.set.setGroup(b.group, !b.down);
    if (instant) {
      b.level = b.down ? 0 : 1;
      this._apply(b);
    }
    return true;
  }

  setAll(down, instant = false) {
    for (const b of this.items) this.setDown(b.id, down, instant);
  }

  _apply(b) {
    b.mat.uniforms.uLevel.value = b.level;
    b.mesh.visible = b.level > 0.001;
    if (b.dome) {
      b.domeMat.uniforms.uLevel.value = b.level;
      b.dome.scale.y = Math.max(0.001, b.level);
      b.dome.visible = b.level > 0.001;
    }
  }

  update(dt) {
    this.time += dt;
    for (const b of this.items) {
      const target = b.down ? 0 : 1;
      if (b.level !== target) {
        // Baja en ~2.4 s y sube en ~1.6 s (con aceleración suave)
        const speed = b.down ? 0.42 : 0.62;
        b.level = target > b.level ? Math.min(target, b.level + speed * dt) : Math.max(target, b.level - speed * dt);
        this._apply(b);
      }
      b.mat.uniforms.uTime.value = this.time;
      if (b.domeMat) b.domeMat.uniforms.uTime.value = this.time;
    }
  }
}
