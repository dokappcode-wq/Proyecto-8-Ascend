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

    this._pivot = new THREE.Vector3();
    this._smoothedPivot = new THREE.Vector3();
    this._fovBoost = 0;
    this._dir = new THREE.Vector3();
    this._initialized = false;
  }

  reset(yaw = 0) {
    this.yaw = yaw;
    this.pitch = -0.18;
    this._initialized = false;
  }

  applyMouse(dx, dy) {
    const s = 0.0022 * (this.settings.mouseSensitivity ?? 1);
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
    this._pivot.set(target.x, target.y + this.pivotHeight, target.z);
    if (!this._initialized) {
      this._smoothedPivot.copy(this._pivot);
      this._initialized = true;
    } else {
      // Seguimiento rápido en horizontal y algo más suave en vertical (saltos).
      const kh = 1 - Math.exp(-dt * 22);
      const kv = 1 - Math.exp(-dt * 12);
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

    const shoulderOrigin = { x: p.x + rightX * this.shoulder, y: p.y, z: p.z + rightZ * this.shoulder };
    // Comprueba que el hombro no esté dentro de un muro.
    const sideHit = this.world.raycast(
      { x: p.x, y: p.y, z: p.z },
      { x: rightX, y: 0, z: rightZ },
      this.shoulder + 0.2,
      { cameraOnly: true },
    );
    if (sideHit !== Infinity) {
      const s = Math.max(0, sideHit - 0.25);
      shoulderOrigin.x = p.x + rightX * s;
      shoulderOrigin.z = p.z + rightZ * s;
    }

    let dist = this.distance;
    const hit = this.world.raycast(shoulderOrigin, this._dir, dist + 0.3, { cameraOnly: true });
    if (hit !== Infinity) dist = Math.max(0.6, hit - 0.3);

    this.camera.position.set(
      shoulderOrigin.x + this._dir.x * dist,
      shoulderOrigin.y + this._dir.y * dist,
      shoulderOrigin.z + this._dir.z * dist,
    );
    this.camera.lookAt(shoulderOrigin.x, shoulderOrigin.y, shoulderOrigin.z);

    const targetBoost = sprinting ? 7 : 0;
    this._fovBoost += (targetBoost - this._fovBoost) * (1 - Math.exp(-dt * 6));
    const fov = (this.settings.fov ?? 70) + this._fovBoost;
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  }
}
