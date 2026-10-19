import * as THREE from 'three';

/**
 * Objeto físico simple (caja): cae, apila, rebota ligeramente y sale
 * despedido por impactos y ondas. Su colisionador se mueve con él, por lo
 * que el jugador puede empujarse contra él o subirse encima.
 */
export class PhysicsProp {
  constructor(ctx, { x, y = 0, z, w = 1, h = 1, d = 1, mass = 1, mat }) {
    this.ctx = ctx;
    this.alive = true;
    this.size = { w, h, d };
    this.mass = mass;
    this.radius = Math.max(w, d) / 2;
    this.spawn = { x, y, z };
    this.pos = { x, y, z }; // base del objeto
    this.vel = { x: 0, y: 0, z: 0 };
    this.spin = 0;
    this.tilt = { x: 0, z: 0, vx: 0, vz: 0 };
    this.sleeping = false;
    this.grounded = false;

    this.mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    ctx.group.add(this.mesh);
    this.collider = ctx.world.addBox({ x: x - w / 2, y, z: z - d / 2 }, { x: x + w / 2, y: y + h, z: z + d / 2 }, { owner: this, tag: 'prop' });
    ctx.combat.register(this);
    this._sync();
  }

  get center() {
    return { x: this.pos.x, y: this.pos.y + this.size.h / 2, z: this.pos.z };
  }

  takeDamage() {
    return 0; // reacciona con retroceso, no tiene salud
  }

  applyImpulse(x, y, z) {
    this.vel.x += x / this.mass;
    this.vel.y += y / this.mass;
    this.vel.z += z / this.mass;
    this.spin += (Math.random() - 0.5) * 8 * Math.hypot(x, z) / this.mass / 10;
    this.tilt.vx += z / this.mass * 1.5;
    this.tilt.vz -= x / this.mass * 1.5;
    this.sleeping = false;
  }

  /** Gravedad: flota `t` segundos a `height` m sobre donde está. */
  float(t, height = 1.6) {
    if (!this._float) this._float = { t, y: this.pos.y + height };
    else this._float.t = Math.max(this._float.t, t);
    this.sleeping = false;
  }

  get floating() {
    return !!this._float;
  }

  update(dt) {
    const w = this.ctx.world;
    if (this._float) {
      this._float.t -= dt;
      if (this._float.t <= 0) this._float = null;
      this.sleeping = false;
    }
    if (this.sleeping) {
      // Despierta si lo que tenía debajo se ha movido.
      this.collider.enabled = false;
      const g = w.groundHeight(this.pos.x, this.pos.z, this.radius * 0.7, this.pos.y + 0.3);
      this.collider.enabled = true;
      if (this.pos.y - g < 0.02) return;
      this.sleeping = false;
    }
    const p = this.pos;
    const v = this.vel;
    const { w: sw, h: sh, d: sd } = this.size;
    this.collider.enabled = false;

    const steps = Math.max(1, Math.ceil((Math.hypot(v.x, v.y, v.z) * dt) / (this.radius * 0.5)));
    const sdt = dt / steps;
    for (let i = 0; i < steps; i++) {
      if (this._float) {
        // Sube hasta la altura de flotación y se mece; el movimiento lateral se frena
        const want = (this._float.y + Math.sin(performance.now() * 0.002 + this.spawn.x) * 0.15 - p.y) * 3;
        v.y += (want - v.y) * Math.min(1, 6 * sdt);
        v.x *= 1 - Math.min(1, 1.5 * sdt);
        v.z *= 1 - Math.min(1, 1.5 * sdt);
        this.spin += 0.6 * sdt;
      } else v.y -= 24 * sdt;
      const prevY = p.y;
      p.x += v.x * sdt;
      p.z += v.z * sdt;
      const before = { x: p.x, z: p.z };
      if (w.resolveHorizontal(p, this.radius * 0.95, p.y, sh, 0.05) > 0) {
        // Rebote amortiguado contra paredes
        if (Math.abs(p.x - before.x) > 1e-6) v.x *= -0.3;
        if (Math.abs(p.z - before.z) > 1e-6) v.z *= -0.3;
      }
      p.y += v.y * sdt;
      const ground = w.groundHeight(p.x, p.z, this.radius * 0.7, prevY + 0.3);
      if (p.y <= ground) {
        p.y = ground;
        v.y = v.y < -4 ? -v.y * 0.25 : 0;
        this.grounded = v.y === 0;
      } else {
        this.grounded = false;
      }
      if (v.y > 0) {
        const ceil = w.ceilingHeight(p.x, p.z, this.radius * 0.7, prevY + sh - 0.01);
        if (p.y + sh > ceil) {
          p.y = ceil - sh;
          v.y = 0;
        }
      }
    }
    if (this.grounded) {
      const k = Math.exp(-dt * 7);
      v.x *= k;
      v.z *= k;
      this.spin *= Math.exp(-dt * 6);
    }
    this.mesh.rotation.y += this.spin * dt;

    // Inclinación visual mientras vuela; vuelve a reposo al apoyarse.
    const t = this.tilt;
    if (this.grounded) {
      t.vx = t.vz = 0;
      t.x += (0 - t.x) * (1 - Math.exp(-dt * 12));
      t.z += (0 - t.z) * (1 - Math.exp(-dt * 12));
    } else {
      t.x += t.vx * dt;
      t.z += t.vz * dt;
    }

    if (p.y < -30) this.reset();

    w.setBox(this.collider, { x: p.x - sw / 2, y: p.y, z: p.z - sd / 2 }, { x: p.x + sw / 2, y: p.y + sh, z: p.z + sd / 2 });
    this.collider.enabled = true;
    this._sync();

    if (this.grounded && Math.hypot(v.x, v.z) < 0.05 && Math.abs(t.x) + Math.abs(t.z) < 0.01 && Math.abs(this.spin) < 0.05) {
      v.x = v.z = 0;
      this.sleeping = true;
    }
  }

  _sync() {
    this.mesh.position.set(this.pos.x, this.pos.y + this.size.h / 2, this.pos.z);
    this.mesh.rotation.x = this.tilt.x;
    this.mesh.rotation.z = this.tilt.z;
  }

  reset() {
    this._float = null;
    this.pos = { ...this.spawn };
    this.vel = { x: 0, y: 0, z: 0 };
    this.spin = 0;
    this.tilt = { x: 0, z: 0, vx: 0, vz: 0 };
    this.mesh.rotation.set(0, 0, 0);
    this.sleeping = false;
    const { w: sw, h: sh, d: sd } = this.size;
    this.ctx.world.setBox(this.collider, { x: this.pos.x - sw / 2, y: this.pos.y, z: this.pos.z - sd / 2 }, { x: this.pos.x + sw / 2, y: this.pos.y + sh, z: this.pos.z + sd / 2 });
    this._sync();
  }

  dispose() {
    this.ctx.combat.unregister(this);
  }
}
