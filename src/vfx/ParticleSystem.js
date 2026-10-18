import * as THREE from 'three';

/**
 * ParticleSystem — partículas aditivas en un único THREE.Points (una sola
 * llamada de dibujo). Pool de tamaño fijo; las partículas más antiguas se
 * reutilizan si se agota.
 */
export class ParticleSystem {
  constructor(capacity = 4000) {
    this.capacity = capacity;
    this.count = 0;
    this._next = 0;
    // Estado CPU
    this.pos = new Float32Array(capacity * 3);
    this.vel = new Float32Array(capacity * 3);
    this.col = new Float32Array(capacity * 3);
    this.life = new Float32Array(capacity);
    this.maxLife = new Float32Array(capacity);
    this.size = new Float32Array(capacity);
    this.drag = new Float32Array(capacity);
    this.gravity = new Float32Array(capacity);

    const geo = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(new Float32Array(capacity * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(new Float32Array(capacity * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(new Float32Array(capacity), 1).setUsage(THREE.DynamicDrawUsage);
    this.aAlpha = new THREE.BufferAttribute(new Float32Array(capacity), 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.aPos);
    geo.setAttribute('color', this.aCol);
    geo.setAttribute('size', this.aSize);
    geo.setAttribute('alpha', this.aAlpha);
    geo.setDrawRange(0, 0);

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { scale: { value: 600 } },
      vertexShader: /* glsl */ `
        attribute float size; attribute float alpha; attribute vec3 color;
        uniform float scale;
        varying vec3 vColor; varying float vAlpha;
        void main() {
          vColor = color; vAlpha = alpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * scale / max(-mv.z, 0.1);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vColor; varying float vAlpha;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float d = length(c) * 2.0;
          float a = smoothstep(1.0, 0.0, d);
          a *= a;
          gl_FragColor = vec4(vColor * (1.0 + a * 1.5), a * vAlpha);
        }`,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
  }

  setViewportHeight(h) {
    this.points.material.uniforms.scale.value = h * 0.8;
  }

  /**
   * @param {object} p { x,y,z, vx,vy,vz, color: THREE.Color, size, life, drag=1, gravity=0 }
   */
  emit(p) {
    let i;
    if (this.count < this.capacity) i = this.count++;
    else {
      i = this._next;
      this._next = (this._next + 1) % this.capacity;
    }
    const i3 = i * 3;
    this.pos[i3] = p.x;
    this.pos[i3 + 1] = p.y;
    this.pos[i3 + 2] = p.z;
    this.vel[i3] = p.vx ?? 0;
    this.vel[i3 + 1] = p.vy ?? 0;
    this.vel[i3 + 2] = p.vz ?? 0;
    this.col[i3] = p.color.r;
    this.col[i3 + 1] = p.color.g;
    this.col[i3 + 2] = p.color.b;
    this.life[i] = this.maxLife[i] = p.life;
    this.size[i] = p.size;
    this.drag[i] = p.drag ?? 1;
    this.gravity[i] = p.gravity ?? 0;
  }

  /** Ráfaga esférica (o semiesférica alrededor de `normal`). */
  burst(origin, { count = 20, speed = 6, color, size = 0.15, life = 0.5, drag = 3, gravity = 0, normal = null, spread = 1 }) {
    for (let n = 0; n < count; n++) {
      let dx = Math.random() * 2 - 1;
      let dy = Math.random() * 2 - 1;
      let dz = Math.random() * 2 - 1;
      const l = Math.hypot(dx, dy, dz) || 1;
      dx /= l;
      dy /= l;
      dz /= l;
      if (normal) {
        const dot = dx * normal.x + dy * normal.y + dz * normal.z;
        if (dot < 0) {
          dx -= 2 * dot * normal.x;
          dy -= 2 * dot * normal.y;
          dz -= 2 * dot * normal.z;
        }
        dx = dx * spread + normal.x * (1 - spread);
        dy = dy * spread + normal.y * (1 - spread);
        dz = dz * spread + normal.z * (1 - spread);
      }
      const s = speed * (0.35 + Math.random() * 0.65);
      this.emit({
        x: origin.x, y: origin.y, z: origin.z, vx: dx * s, vy: dy * s, vz: dz * s,
        color, size: size * (0.6 + Math.random() * 0.8), life: life * (0.6 + Math.random() * 0.6), drag, gravity,
      });
    }
  }

  clear() {
    this.count = 0;
    this._next = 0;
    this.points.geometry.setDrawRange(0, 0);
  }

  update(dt) {
    let alive = 0;
    const P = this.aPos.array;
    const C = this.aCol.array;
    const S = this.aSize.array;
    const A = this.aAlpha.array;
    for (let i = 0; i < this.count; i++) {
      const life = this.life[i] - dt;
      if (life <= 0) continue;
      const i3 = i * 3;
      const k = Math.exp(-this.drag[i] * dt);
      this.vel[i3] *= k;
      this.vel[i3 + 1] = this.vel[i3 + 1] * k - this.gravity[i] * dt;
      this.vel[i3 + 2] *= k;
      this.pos[i3] += this.vel[i3] * dt;
      this.pos[i3 + 1] += this.vel[i3 + 1] * dt;
      this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      // Compacta en su sitio
      const j = alive++;
      if (j !== i) {
        const j3 = j * 3;
        for (const arr of [this.pos, this.vel, this.col]) {
          arr[j3] = arr[i3];
          arr[j3 + 1] = arr[i3 + 1];
          arr[j3 + 2] = arr[i3 + 2];
        }
        this.maxLife[j] = this.maxLife[i];
        this.size[j] = this.size[i];
        this.drag[j] = this.drag[i];
        this.gravity[j] = this.gravity[i];
      }
      this.life[j] = life;
      const j3 = j * 3;
      P[j3] = this.pos[j3];
      P[j3 + 1] = this.pos[j3 + 1];
      P[j3 + 2] = this.pos[j3 + 2];
      C[j3] = this.col[j3];
      C[j3 + 1] = this.col[j3 + 1];
      C[j3 + 2] = this.col[j3 + 2];
      const t = life / this.maxLife[j];
      S[j] = this.size[j] * (0.4 + 0.6 * t);
      A[j] = Math.min(1, t * 1.6);
    }
    this.count = alive;
    if (this._next >= alive) this._next = 0;
    const g = this.points.geometry;
    g.setDrawRange(0, alive);
    this.aPos.needsUpdate = this.aCol.needsUpdate = this.aSize.needsUpdate = this.aAlpha.needsUpdate = true;
  }
}
