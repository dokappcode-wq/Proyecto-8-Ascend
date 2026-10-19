import * as THREE from 'three';

const STONE_MAT = new THREE.MeshStandardMaterial({ color: 0x6d6470, roughness: 0.95, flatShading: true });
const RUNE_MAT = new THREE.MeshBasicMaterial({ color: new THREE.Color('#a24dff').multiplyScalar(1.6), transparent: true, opacity: 0.85, toneMapped: false });

/**
 * Roca elevada por la Gravedad: plataforma sólida (colisionador real) sobre
 * la que el jugador se sostiene, dispara o salta.
 *
 * - En el suelo: sale de la tierra como un pilar y levanta al jugador.
 * - En el aire: sube desde abajo y se detiene justo bajo sus pies.
 * Se desmorona al acabar su tiempo.
 */
export class GravityStone {
  /**
   * @param {object} o { world, scene, x, z, top, bottom, size, life, rise: segundos (0 = ya colocada), ground: pilar desde el suelo }
   */
  constructor({ world, scene, x, z, top, bottom, size, life, rise, ground }) {
    this.world = world;
    this.scene = scene;
    this.x = x;
    this.z = z;
    this.size = size;
    this.top = top; // cima final
    this.bottom = bottom;
    this.life = life;
    this.ground = ground;
    this.riseTime = rise;
    this.t = 0;
    this.crumbling = 0;
    this.done = false;
    // Cima actual: un pilar sube desde el suelo; una roca aérea ya está en su sitio
    this.cur = ground ? bottom : top;
    const h = top - bottom;
    const half = size / 2;
    this.collider = world.addBox({ x: x - half, y: bottom, z: z - half }, { x: x + half, y: this.cur, z: z + half }, { tag: 'stone', cameraBlocking: false });
    if (ground) this.collider.enabled = false;

    // Malla: bloque irregular con una veta luminosa
    const geo = new THREE.BoxGeometry(size, h, size, 2, 2, 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const k = 0.08 * size;
      pos.setX(i, pos.getX(i) + (Math.sin(i * 12.9898) * 0.5) * k);
      pos.setZ(i, pos.getZ(i) + (Math.cos(i * 78.233) * 0.5) * k);
    }
    geo.computeVertexNormals();
    this.mesh = new THREE.Mesh(geo, STONE_MAT);
    this.mesh.castShadow = this.mesh.receiveShadow = true;
    const rune = new THREE.Mesh(new THREE.TorusGeometry(size * 0.32, 0.03, 6, 20), RUNE_MAT);
    rune.rotation.x = Math.PI / 2;
    rune.position.y = h / 2 + 0.01;
    this.mesh.add(rune);
    this.height = h;
    // La roca aérea aparece desde abajo (solo visual: el colisionador ya está)
    this.visualOffset = ground ? 0 : -2.5;
    scene.add(this.mesh);
    this._place();
  }

  /** ¿Está el jugador (pies en p) encima? */
  supports(p, radius) {
    const half = this.size / 2 + radius * 0.6;
    return !this.crumbling && Math.abs(p.x - this.x) < half && Math.abs(p.z - this.z) < half && Math.abs(p.y - this.cur) < 0.3;
  }

  /** Inicia el desmoronamiento (deja de ser sólida). */
  crumble() {
    if (this.crumbling) return;
    this.crumbling = 0.001;
    this.collider.enabled = false;
  }

  /**
   * @param {object} motor CharacterMotor del jugador (para llevarlo encima mientras sube)
   * @returns {boolean} true si sigue existiendo
   */
  update(dt, motor) {
    this.t += dt;
    if (this.crumbling) {
      this.crumbling += dt;
      this.mesh.position.y -= dt * 3;
      this.mesh.scale.multiplyScalar(1 - dt * 1.8);
      if (this.crumbling > 0.6) this.dispose();
      return !this.done;
    }
    if (this.ground && this.cur < this.top) {
      const before = this.cur;
      this.cur = Math.min(this.top, this.bottom + (this.top - this.bottom) * Math.min(1, this.t / this.riseTime));
      this.collider.enabled = true;
      this.world.setBox(this.collider, { x: this.x - this.size / 2, y: this.bottom, z: this.z - this.size / 2 }, { x: this.x + this.size / 2, y: this.cur, z: this.z + this.size / 2 });
      // Lleva al jugador hacia arriba
      const p = motor.position;
      const half = this.size / 2 + motor.cfg.radius * 0.6;
      if (Math.abs(p.x - this.x) < half && Math.abs(p.z - this.z) < half && p.y <= this.cur + 0.05 && p.y >= before - 0.35 && motor.velocity.y <= 1) {
        p.y = this.cur;
        motor.velocity.y = 0;
        motor.grounded = true;
      }
    }
    this.visualOffset = Math.min(0, this.visualOffset + dt * 14);
    if (this.t >= this.life) this.crumble();
    this._place();
    return true;
  }

  _place() {
    const h = this.ground ? Math.max(0.05, this.cur - this.bottom) : this.height;
    this.mesh.scale.y = this.ground ? h / this.height : 1;
    this.mesh.position.set(this.x, (this.ground ? this.bottom + h / 2 : this.top - this.height / 2) + this.visualOffset, this.z);
  }

  dispose() {
    if (this.done) return;
    this.done = true;
    this.world.removeBox(this.collider);
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.children[0]?.geometry.dispose();
  }
}
