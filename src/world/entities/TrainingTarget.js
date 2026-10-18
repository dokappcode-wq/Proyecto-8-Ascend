import * as THREE from 'three';

/**
 * Diana de entrenamiento: registra impactos, destella y se balancea.
 * No se destruye (salud infinita); sirve para medir precisión y alcance.
 */
export class TrainingTarget {
  /**
   * @param {object} o { x, y (centro del disco), z, facing: 'x+'|'x-'|'z+'|'z-', radius=0.6, post=true }
   */
  constructor(ctx, o) {
    this.ctx = ctx;
    this.alive = true;
    this.hits = 0;
    this.radius = o.radius ?? 0.6;
    this.center = { x: o.x, y: o.y, z: o.z };
    this._flash = 0;
    this._wobble = 0;

    const group = new THREE.Group();
    group.position.set(o.x, o.y, o.z);
    const rot = { 'z+': 0, 'z-': Math.PI, 'x+': Math.PI / 2, 'x-': -Math.PI / 2 }[o.facing ?? 'z+'];
    group.rotation.y = rot;
    this.pivot = new THREE.Group();
    group.add(this.pivot);
    this.mat = new THREE.MeshStandardMaterial({ map: targetTexture(), roughness: 0.6, emissive: 0x2f8bff, emissiveIntensity: 0 });
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(this.radius, this.radius, 0.08, 32).rotateX(Math.PI / 2), [
      new THREE.MeshStandardMaterial({ color: 0x3a3f46 }), this.mat, this.mat,
    ]);
    disc.castShadow = true;
    this.pivot.add(disc);
    ctx.group.add(group);
    this.group = group;

    if (o.post ?? true) {
      const h = o.y - this.radius;
      if (h > 0.05) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, h, 0.1), new THREE.MeshStandardMaterial({ color: 0x59636e, metalness: 0.5, roughness: 0.4 }));
        post.position.set(o.x, h / 2, o.z);
        post.castShadow = true;
        ctx.group.add(post);
        ctx.world.addBox({ x: o.x - 0.06, y: 0, z: o.z - 0.06 }, { x: o.x + 0.06, y: h, z: o.z + 0.06 });
      }
    }
    const r = this.radius;
    const thinX = o.facing === 'x+' || o.facing === 'x-';
    this.collider = ctx.world.addBox(
      { x: o.x - (thinX ? 0.06 : r), y: o.y - r, z: o.z - (thinX ? r : 0.06) },
      { x: o.x + (thinX ? 0.06 : r), y: o.y + r, z: o.z + (thinX ? r : 0.06) },
      { owner: this, tag: 'target' },
    );
    ctx.combat.register(this);
  }

  takeDamage(amount) {
    this.hits++;
    this._flash = 1;
    this._wobble = 1;
    return amount;
  }

  update(dt) {
    this._flash = Math.max(0, this._flash - dt * 4);
    this._wobble = Math.max(0, this._wobble - dt * 2.5);
    this.mat.emissiveIntensity = this._flash * 2;
    this.pivot.rotation.x = Math.sin(this._wobble * 18) * 0.25 * this._wobble;
  }

  reset() {
    this.hits = 0;
  }

  dispose() {
    this.ctx.combat.unregister(this);
  }
}

let tex = null;
function targetTexture() {
  if (tex) return tex;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const rings = ['#e8e8e8', '#d23a2e', '#e8e8e8', '#d23a2e', '#e8e8e8', '#f2c45a'];
  rings.forEach((col, i) => {
    g.fillStyle = col;
    g.beginPath();
    g.arc(128, 128, 128 - i * 21, 0, Math.PI * 2);
    g.fill();
  });
  tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
