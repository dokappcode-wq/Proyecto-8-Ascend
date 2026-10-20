import * as THREE from 'three';

/**
 * CameraController — cámara orbital en tercera persona sobre el hombro.
 *
 * - Yaw/pitch con el ratón (bloqueo de puntero).
 * - Colisión con la geometría para no atravesar muros.
 * - Suavizado de seguimiento y ligero aumento de FOV al esprintar.
 */
export class CameraController {
  constructor(camera, world, settings) {
    this.camera = camera;
    this.world = world;
    this.settings = settings;

    this.yaw = 0; // 0 = mirando hacia -Z
    this.pitch = -0.18;
    this.distance = 4.6;
    this.shoulder = 0.55;
    this.pivotHeight = 1.55;
    this.minPitch = -1.2;
    this.maxPitch = 0.55;

    this._aim = 0;
    this._aimTarget = 0;
    this._parkour = 0;
    this._parkourTarget = 0;
    this._trauma = 0;
    this._time = 0;
    /** Origen sobre el hombro en el último frame (lo usan los poderes para apuntar). */
    this.shoulderOrigin = new THREE.Vector3();

    this._pivot = new THREE.Vector3();
    this._smoothedPivot = new THREE.Vector3();
    this._fovBoost = 0;
    this._dir = new THREE.Vector3();
    this._initialized = false;
    /**
     * Plano de cinemática (modo historia): { from:{pos,look}, to:{pos,look}, t, dur }.
     * Mientras hay uno, la cámara no sigue al jugador.
     */
    this.shot = null;
    this._lookV = new THREE.Vector3();
  }

  /**
   * Fija la cámara en un plano. Con `to` y `dur` se mueve suavemente de un
   * encuadre a otro (travelling). `null` devuelve el control a la cámara normal.
   */
  setShot(from, to = null, dur = 0) {
    if (!from) {
      this.shot = null;
      this._initialized = false;
      return;
    }
    const v = (p) => new THREE.Vector3(p.x, p.y, p.z);
    this.shot = { from: { pos: v(from.pos), look: v(from.look) }, to: to ? { pos: v(to.pos), look: v(to.look) } : null, t: 0, dur: Math.max(0.001, dur) };
  }

  _updateShot(dt) {
    const s = this.shot;
    s.t += dt;
    const k = s.to ? smooth(Math.min(1, s.t / s.dur)) : 0;
    const pos = s.to ? this._dir.copy(s.from.pos).lerp(s.to.pos, k) : s.from.pos;
    const look = s.to ? this._lookV.copy(s.from.look).lerp(s.to.look, k) : s.from.look;
    this.camera.position.copy(pos);
    this.camera.lookAt(look);
    this.shoulderOrigin.copy(look);
    if (this._trauma > 0) {
      const t = this._trauma * this._trauma;
      const tt = this._time * 40;
      this.camera.rotation.x += Math.sin(tt * 1.3) * 0.03 * t;
      this.camera.rotation.z += Math.sin(tt * 2.1 + 2) * 0.02 * t;
      this._trauma = Math.max(0, this._trauma - dt * 1.8);
    }
  }

  reset(yaw = 0) {
    this.yaw = yaw;
    this.pitch = -0.18;
    this._initialized = false;
  }

  /** 0 = cámara normal, 1 = apuntando (más cerca y con menos FOV). */
  setAim(v) {
    this._aimTarget = v;
  }

  /** 1 = escalando: cámara más alejada y alta para ver la pared y la cornisa. */
  setParkour(v) {
    this._parkourTarget = v;
  }

  /** Sacudida de cámara (se acumula y decae). */
  shake(amount) {
    this._trauma = Math.min(1, this._trauma + amount);
  }

  applyMouse(dx, dy) {
    const s = 0.0022 * (this.settings.mouseSensitivity ?? 1) * (1 - this._aim * 0.35);
    this.yaw -= dx * s;
    this.pitch -= dy * s * (this.settings.invertY ? -1 : 1);
    this.pitch = Math.max(this.minPitch, Math.min(this.maxPitch, this.pitch));
  }

  /** Vector "adelante" horizontal de la cámara (para orientar el movimiento). */
  forward(out = { x: 0, z: 0 }) {
    out.x = -Math.sin(this.yaw);
    out.z = -Math.cos(this.yaw);
    return out;
  }

  update(dt, target, sprinting) {
    this._time += dt;
    if (this.shot) return this._updateShot(dt);
    this._aim += (this._aimTarget - this._aim) * (1 - Math.exp(-dt * 14));
    this._parkour += (this._parkourTarget - this._parkour) * (1 - Math.exp(-dt * 5));
    const pk = this._parkour * (1 - this._aim);
    // Escalando, la cámara tiende a mirar algo hacia arriba (hacia la cornisa)
    if (this._parkourTarget > 0 && this.pitch < 0.08) this.pitch = Math.min(0.08, this.pitch + dt * 0.6);
    const shoulder = this.shoulder + this._aim * 0.25 - pk * 0.15;
    const distance = this.distance - this._aim * 2.1 + pk * 1.3;
    this._pivot.set(target.x, target.y + this.pivotHeight + pk * 0.45, target.z);
    if (!this._initialized) {
      this._smoothedPivot.copy(this._pivot);
      this._initialized = true;
    } else {
      // Seguimiento rápido en horizontal y algo más suave en vertical (saltos).
      const kh = 1 - Math.exp(-dt * 22);
      // Escalando, el seguimiento vertical es más suave (subidas a cornisas).
      const kv = 1 - Math.exp(-dt * (12 - this._parkour * 4));
      this._smoothedPivot.x += (this._pivot.x - this._smoothedPivot.x) * kh;
      this._smoothedPivot.z += (this._pivot.z - this._smoothedPivot.z) * kh;
      this._smoothedPivot.y += (this._pivot.y - this._smoothedPivot.y) * kv;
    }
    const p = this._smoothedPivot;

    const cp = Math.cos(this.pitch);
    // Dirección desde el pivote hacia la cámara.
    this._dir.set(Math.sin(this.yaw) * cp, -Math.sin(this.pitch), Math.cos(this.yaw) * cp).normalize();
    // Desplazamiento lateral (hombro derecho).
    const rightX = Math.cos(this.yaw);
    const rightZ = -Math.sin(this.yaw);

    const shoulderOrigin = { x: p.x + rightX * shoulder, y: p.y, z: p.z + rightZ * shoulder };
    // Comprueba que el hombro no esté dentro de un muro.
    const sideHit = this.world.raycast(
      { x: p.x, y: p.y, z: p.z },
      { x: rightX, y: 0, z: rightZ },
      shoulder + 0.2,
      { cameraOnly: true },
    );
    if (sideHit !== Infinity) {
      const s = Math.max(0, sideHit - 0.25);
      shoulderOrigin.x = p.x + rightX * s;
      shoulderOrigin.z = p.z + rightZ * s;
    }

    let dist = distance;
    const hit = this.world.raycast(shoulderOrigin, this._dir, dist + 0.3, { cameraOnly: true });
    if (hit !== Infinity) dist = Math.max(0.6, hit - 0.3);

    this.camera.position.set(
      shoulderOrigin.x + this._dir.x * dist,
      shoulderOrigin.y + this._dir.y * dist,
      shoulderOrigin.z + this._dir.z * dist,
    );
    this.camera.lookAt(shoulderOrigin.x, shoulderOrigin.y, shoulderOrigin.z);
    this.shoulderOrigin.set(shoulderOrigin.x, shoulderOrigin.y, shoulderOrigin.z);

    // Sacudida: rotación ligera proporcional a trauma²
    if (this._trauma > 0) {
      const t = this._trauma * this._trauma;
      const tt = this._time * 40;
      this.camera.rotation.x += Math.sin(tt * 1.3) * 0.03 * t;
      this.camera.rotation.y += Math.sin(tt * 1.7 + 1) * 0.03 * t;
      this.camera.rotation.z += Math.sin(tt * 2.1 + 2) * 0.02 * t;
      this._trauma = Math.max(0, this._trauma - dt * 1.8);
    }

    const targetBoost = (sprinting ? 7 : 0) - this._aim * 14;
    this._fovBoost += (targetBoost - this._fovBoost) * (1 - Math.exp(-dt * 6));
    const fov = (this.settings.fov ?? 70) + this._fovBoost;
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  }
}

/** Suavizado de entrada y salida (0..1 → 0..1). */
function smooth(k) {
  return k * k * (3 - 2 * k);
}
