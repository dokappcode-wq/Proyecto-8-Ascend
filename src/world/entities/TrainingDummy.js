import * as THREE from 'three';

/**
 * Maniquí de entrenamiento con salud: recibe daño, muestra su barra de
 * vida, cae al ser neutralizado y se recupera tras unos segundos.
 */
export class TrainingDummy {
  constructor(ctx, { x, z, y = 0, maxHealth = 100, respawnTime = 4, facing = 0 }) {
    this.ctx = ctx;
    this.maxHealth = maxHealth;
    this.health = maxHealth;
    this.alive = true;
    this.radius = 0.4;
    this.base = { x, y, z };
    this.center = { x, y: y + 1.1, z };
    this.respawnTime = respawnTime;
    this._dead = 0;
    this._flash = 0;
    this._wobble = 0;
    this._wobbleDir = { x: 0, z: 1 };

    this.root = new THREE.Group();
    this.root.position.set(x, y, z);
    this.root.rotation.y = facing;
    this.body = new THREE.Group();
    this.root.add(this.body);
    this.mat = new THREE.MeshStandardMaterial({ color: 0xc9a46a, roughness: 0.85, emissive: 0xffffff, emissiveIntensity: 0 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x3a3028, roughness: 0.9 });
    const add = (geo, mat, px, py, pz) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(px, py, pz);
      m.castShadow = true;
      this.body.add(m);
      return m;
    };
    add(new THREE.CylinderGeometry(0.35, 0.4, 0.12, 16), dark, 0, 0.06, 0);
    add(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 8), dark, 0, 0.4, 0);
    add(new THREE.CapsuleGeometry(0.26, 0.6, 4, 12), this.mat, 0, 1.05, 0);
    add(new THREE.SphereGeometry(0.17, 14, 10), this.mat, 0, 1.68, 0);
    add(new THREE.BoxGeometry(0.9, 0.12, 0.14), this.mat, 0, 1.25, 0);
    ctx.group.add(this.root);

    // Barra de salud (sprite con canvas)
    this.barCanvas = document.createElement('canvas');
    this.barCanvas.width = 128;
    this.barCanvas.height = 20;
    this.barTex = new THREE.CanvasTexture(this.barCanvas);
    this.bar = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.barTex, depthTest: false, transparent: true }));
    this.bar.scale.set(1.0, 0.16, 1);
    this.bar.position.set(x, y + 2.2, z);
    this.bar.renderOrder = 20;
    ctx.group.add(this.bar);
    this._drawBar();

    this.collider = ctx.world.addBox({ x: x - 0.32, y, z: z - 0.32 }, { x: x + 0.32, y: y + 1.9, z: z + 0.32 }, { owner: this, tag: 'dummy' });
    ctx.combat.register(this);
  }

  _drawBar() {
    const g = this.barCanvas.getContext('2d');
    g.clearRect(0, 0, 128, 20);
    g.fillStyle = 'rgba(0,0,0,0.7)';
    g.fillRect(0, 0, 128, 20);
    const r = this.health / this.maxHealth;
    g.fillStyle = r > 0.5 ? '#5fd38a' : r > 0.25 ? '#f2c45a' : '#e5533d';
    g.fillRect(3, 3, 122 * r, 14);
    this.barTex.needsUpdate = true;
  }

  takeDamage(amount, info = {}) {
    if (!this.alive) return 0;
    const dealt = Math.min(amount, this.health);
    this.health -= dealt;
    this._flash = 1;
    this._wobble = 1;
    if (info.dir) {
      const l = Math.hypot(info.dir.x, info.dir.z) || 1;
      this._wobbleDir = { x: info.dir.x / l, z: info.dir.z / l };
    }
    if (this.health <= 0) {
      this.alive = false;
      this._dead = 0;
      this.collider.enabled = false;
    }
    this._drawBar();
    return dealt;
  }

  applyImpulse() {
    this._wobble = 1;
  }

  update(dt) {
    this._flash = Math.max(0, this._flash - dt * 5);
    this.mat.emissiveIntensity = this._flash * 0.8;
    this.mat.emissive.setHex(this.alive ? 0xffffff : 0x2f8bff);
    if (!this.alive) {
      this._dead += dt;
      // Cae hacia la dirección del impacto
      const fall = Math.min(1, this._dead * 3);
      const ax = this._wobbleDir.z * (Math.PI / 2) * fall;
      const az = -this._wobbleDir.x * (Math.PI / 2) * fall;
      this._setTilt(ax, az);
      this.bar.visible = false;
      if (this._dead >= this.respawnTime) this.reset();
      return;
    }
    this._wobble = Math.max(0, this._wobble - dt * 2);
    const w = Math.sin(this._wobble * 20) * 0.18 * this._wobble;
    this._setTilt(this._wobbleDir.z * w, -this._wobbleDir.x * w);
  }

  /** Inclinación en ejes del mundo (el cuerpo puede estar rotado en Y). */
  _setTilt(ax, az) {
    const ry = this.root.rotation.y;
    this.body.rotation.x = ax * Math.cos(ry) - az * Math.sin(ry);
    this.body.rotation.z = ax * Math.sin(ry) + az * Math.cos(ry);
  }

  reset() {
    this.health = this.maxHealth;
    this.alive = true;
    this._dead = 0;
    this._wobble = 0;
    this.collider.enabled = true;
    this.bar.visible = true;
    this._setTilt(0, 0);
    this._drawBar();
  }

  dispose() {
    this.ctx.combat.unregister(this);
    this.barTex.dispose();
  }
}
