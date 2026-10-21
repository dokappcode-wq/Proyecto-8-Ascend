import * as THREE from 'three';

/**
 * SparkSystem — chispas como trazos que se estiran en la dirección de su
 * velocidad (la cabeza brilla, la cola se apaga). Todas en un único
 * THREE.LineSegments con mezcla aditiva: una llamada de dibujo. Pool fijo;
 * si se agota se reutilizan las más antiguas.
 */
export class SparkSystem {
  constructor(capacity = 800) {
    this.capacity = capacity;
    this.count = 0;
    this._next = 0;
    this.pos = new Float32Array(capacity * 3);
    this.vel = new Float32Array(capacity * 3);
    this.col = new Float32Array(capacity * 3);
    this.life = new Float32Array(capacity);
    this.maxLife = new Float32Array(capacity);
    this.gravity = new Float32Array(capacity);
    this.stretch = new Float32Array(capacity);

    const geo = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(new Float32Array(capacity * 6), 3).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(new Float32Array(capacity * 6), 3).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.aPos);
    geo.setAttribute('color', this.aCol);
    geo.setDrawRange(0, 0);
    this.lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    }));
    this.lines.frustumCulled = false;
    this.lines.renderOrder = 10;
    this.lines.name = 'Chispas';
  }

  /** @param {object} p { x,y,z, vx,vy,vz, color: THREE.Color, life, gravity=14, stretch=0.035 } */
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
    this.vel[i3] = p.vx;
    this.vel[i3 + 1] = p.vy;
    this.vel[i3 + 2] = p.vz;
    this.col[i3] = p.color.r;
    this.col[i3 + 1] = p.color.g;
    this.col[i3 + 2] = p.color.b;
    this.life[i] = this.maxLife[i] = p.life;
    this.gravity[i] = p.gravity ?? 14;
    this.stretch[i] = p.stretch ?? 0.035;
  }

  /** Ráfaga (semiesférica alrededor de `normal` si se indica). */
  burst(origin, { count = 10, speed = 9, color, life = 0.35, gravity = 14, normal = null, spread = 0.85, stretch = 0.035 }) {
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
      const s = speed * (0.4 + Math.random() * 0.6);
      this.emit({ x: origin.x, y: origin.y, z: origin.z, vx: dx * s, vy: dy * s + speed * 0.15, vz: dz * s, color, life: life * (0.5 + Math.random() * 0.7), gravity, stretch });
    }
  }

  clear() {
    this.count = 0;
    this._next = 0;
    this.lines.geometry.setDrawRange(0, 0);
    this.lines.visible = false;
  }

  update(dt) {
    let alive = 0;
    const P = this.aPos.array;
    const C = this.aCol.array;
    const k = Math.exp(-1.6 * dt);
    for (let i = 0; i < this.count; i++) {
      const life = this.life[i] - dt;
      if (life <= 0) continue;
      const i3 = i * 3;
      this.vel[i3] *= k;
      this.vel[i3 + 1] = this.vel[i3 + 1] * k - this.gravity[i] * dt;
      this.vel[i3 + 2] *= k;
      this.pos[i3] += this.vel[i3] * dt;
      this.pos[i3 + 1] += this.vel[i3 + 1] * dt;
      this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      const j = alive++;
      const j3 = j * 3;
      if (j !== i) {
        for (const arr of [this.pos, this.vel, this.col]) {
          arr[j3] = arr[i3];
          arr[j3 + 1] = arr[i3 + 1];
          arr[j3 + 2] = arr[i3 + 2];
        }
        this.maxLife[j] = this.maxLife[i];
        this.gravity[j] = this.gravity[i];
        this.stretch[j] = this.stretch[i];
      }
      this.life[j] = life;
      const t = life / this.maxLife[j];
      // Cola: hacia atrás según la velocidad (máx. 0.7 m)
      let tx = this.vel[j3] * this.stretch[j];
      let ty = this.vel[j3 + 1] * this.stretch[j];
      let tz = this.vel[j3 + 2] * this.stretch[j];
      const tl = Math.hypot(tx, ty, tz);
      if (tl > 0.7) {
        tx *= 0.7 / tl;
        ty *= 0.7 / tl;
        tz *= 0.7 / tl;
      }
      const o = j * 6;
      P[o] = this.pos[j3];
      P[o + 1] = this.pos[j3 + 1];
      P[o + 2] = this.pos[j3 + 2];
      P[o + 3] = this.pos[j3] - tx;
      P[o + 4] = this.pos[j3 + 1] - ty;
      P[o + 5] = this.pos[j3 + 2] - tz;
      // Cabeza muy brillante (pasa el umbral del bloom); cola tenue
      const head = 2.4 * t;
      const tail = 0.25 * t;
      C[o] = this.col[j3] * head;
      C[o + 1] = this.col[j3 + 1] * head;
      C[o + 2] = this.col[j3 + 2] * head;
      C[o + 3] = this.col[j3] * tail;
      C[o + 4] = this.col[j3 + 1] * tail;
      C[o + 5] = this.col[j3 + 2] * tail;
    }
    this.count = alive;
    if (this._next >= alive) this._next = 0;
    this.lines.geometry.setDrawRange(0, alive * 2);
    this.lines.visible = alive > 0;
    this.aPos.needsUpdate = this.aCol.needsUpdate = true;
  }
}
