import * as THREE from 'three';
import { CharacterModel } from '../player/CharacterModel.js';
import { createSky, createCity, skyEnvironment } from '../world/environment.js';
import { concreteTexture, metalPlateTexture, normalMapFor } from '../world/textures.js';
import { scaleBoxUVs } from '../world/LevelBuilder.js';
import { ParticleSystem } from '../vfx/ParticleSystem.js';
import { MARKS } from '../data/marks.js';

/** Gradación del menú: atardecer cálido con sombras azuladas. */
export const MENU_GRADE = Object.freeze({ contrast: 1.08, saturation: 1.1, shadows: '#1a2440', highlights: '#ffc89a', split: 0.08, vignette: 0.45 });

/**
 * Fondo animado del menú principal: Jon de pie en el borde de una azotea al
 * anochecer, mirando la ciudad encendida. Motas de energía suben a su
 * alrededor, la marca del Destino late en su muñeca, la luz roja de la
 * antena parpadea y la cámara se mece despacio.
 *
 * Es una escena aparte (pocas mallas, sin sombras): GameManager la dibuja
 * con el mismo compositor (bloom y gradación) mientras el estado es 'menu'.
 */
export class MenuScene {
  constructor(renderer) {
    this.scene = new THREE.Scene();
    this.scene.name = 'Menú';
    this.camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 4000);
    this.scene.fog = new THREE.FogExp2(0x2a2436, 0.0011);
    this._t = 0;

    // --- Cielo de atardecer: el sol se acaba de poner tras la ciudad ---
    const sunDir = new THREE.Vector3(-0.25, 0.03, -1).normalize();
    this.sky = createSky({ top: '#0a1226', horizon: '#e0825a', bottom: '#120f18', sunDir, sunColor: '#ffb27a', clouds: 0.5, cloudColor: '#d88a6c', cloudShade: '#2c2438', stars: 0.55, wind: 0.6 });
    this.scene.add(this.sky);
    this._envRT = renderer ? skyEnvironment(renderer, this.sky) : null;
    if (this._envRT) {
      this.scene.environment = this._envRT.texture;
      this.scene.environmentIntensity = 0.4;
    }

    // --- Luces: contraluz cálido del ocaso y relleno frío desde la cámara ---
    this.scene.add(new THREE.HemisphereLight(0x5a6c96, 0x1c1418, 0.7));
    const rim = new THREE.DirectionalLight(0xffa26a, 3.2);
    rim.position.set(-4, 3, -10);
    this.scene.add(rim);
    const fill = new THREE.DirectionalLight(0x8fb0ff, 0.6);
    fill.position.set(6, 4, 8);
    this.scene.add(fill);

    this._buildRooftop();

    // --- La ciudad: torres cercanas (más bajas) y el horizonte lejano ---
    this.scene.add(createCity({ origin: { x: 0, y: -215, z: 0 }, heading: -Math.PI / 2, spread: 2.2, dist: [140, 320], count: 32, seed: 71, lit: 0.34, intensity: 1 }));
    this.scene.add(createCity({ origin: { x: 0, y: -140, z: 0 }, heading: -Math.PI / 2 - 0.1, spread: 1.7, dist: [420, 900], count: 170, seed: 72, lit: 0.3, intensity: 0.95 }));

    // --- Jon ---
    this.hero = new CharacterModel({ variant: 'protagonist', glow: MARKS.destino.color });
    this.hero.root.position.set(0, 0, -3.6);
    this.hero.root.rotation.y = Math.PI + 0.35;
    this.scene.add(this.hero.root);

    // --- Motas de energía que suben ---
    this.motes = new ParticleSystem(260);
    this.scene.add(this.motes.points);
    this._moteColors = [new THREE.Color(MARKS.destino.color), new THREE.Color('#9fd0ff'), new THREE.Color('#ffd9a0')];
    this._emit = 0;
  }

  _buildRooftop() {
    const tex = (t) => {
      const c = t.clone();
      c.needsUpdate = true;
      c.userData = t.userData;
      const n = normalMapFor(t);
      return { map: c, normalMap: n };
    };
    const concrete = new THREE.MeshStandardMaterial({ ...tex(concreteTexture('#6f6c6a', 41)), roughness: 0.92 });
    const metal = new THREE.MeshStandardMaterial({ ...tex(metalPlateTexture('#4a5058', 42)), metalness: 0.6, roughness: 0.5 });
    const box = (w, h, d, x, y, z, mat, ry = 0) => {
      const g = new THREE.BoxGeometry(w, h, d);
      scaleBoxUVs(g, w, h, d, mat);
      const m = new THREE.Mesh(g, mat);
      m.position.set(x, y, z);
      m.rotation.y = ry;
      this.scene.add(m);
      return m;
    };
    // Losa de la azotea y pretil del borde (la ciudad queda al fondo, −Z)
    box(40, 1, 30, 0, -0.5, 6, concrete);
    box(40, 0.5, 0.45, 0, 0.25, -4.2, concrete);
    box(0.45, 0.5, 30, -6.5, 0.25, 6, concrete);
    // Máquinas de aire acondicionado, depósito y conductos
    box(1.6, 1.1, 1.2, 4.2, 0.55, -0.6, metal, 0.1);
    box(1.6, 1.1, 1.2, 4.3, 0.55, 1.0, metal, 0.05);
    box(0.5, 0.5, 6, -4.4, 0.35, 1.5, metal);
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 2.2, 20), metal);
    tank.position.set(-4.6, 1.6, 3.6);
    this.scene.add(tank);
    for (const [x, z] of [[-5.3, 2.9], [-3.9, 2.9], [-5.3, 4.3], [-3.9, 4.3]]) box(0.12, 0.6, 0.12, x, 0.3, z, metal);
    // Antena con luz roja intermitente
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.07, 6, 6), metal);
    mast.position.set(6.2, 3, -2.6);
    this.scene.add(mast);
    this._beacon = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff2a2a).multiplyScalar(3), toneMapped: false }));
    this._beacon.position.set(6.2, 6.05, -2.6);
    this.scene.add(this._beacon);
  }

  resize(w, h, pixelRatio = 1) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    // La figura queda en el tercio derecho (el menú ocupa la izquierda); en
    // pantallas estrechas se centra un poco más
    this._shift = w / h > 1.3 ? 1 : 0.4;
    this.motes.setViewportHeight(h * pixelRatio);
  }

  update(dt) {
    this._t += dt;
    const t = this._t;
    const shift = this._shift ?? 1;
    // Cámara: plano bajo detrás de Jon que se mece despacio
    const sway = Math.sin(t * 0.07);
    this.camera.position.set(1.3 - 1.6 * shift + sway * 0.5, 1.25 + Math.sin(t * 0.11) * 0.08, 0.6 + Math.cos(t * 0.05) * 0.25);
    this.camera.lookAt(-2.6 * shift + sway * 0.3, 1.55, -12);

    // Jon respira, mira a un lado y a otro de la ciudad
    this.hero.animate(dt, {
      speed: 0, grounded: true, sprinting: false, dodging: false, verticalSpeed: 0,
      lookYaw: Math.sin(t * 0.13) * 0.45, lookPitch: 0.05 + Math.sin(t * 0.09) * 0.04,
    });

    // Motas de energía alrededor de la figura
    this._emit += dt * 26;
    const p = this.hero.root.position;
    while (this._emit > 1) {
      this._emit--;
      const a = Math.random() * Math.PI * 2;
      const r = 0.4 + Math.random() * 2.6;
      this.motes.emit({
        x: p.x + Math.cos(a) * r, y: Math.random() * 0.6, z: p.z + Math.sin(a) * r,
        vx: (Math.random() - 0.5) * 0.25, vy: 0.35 + Math.random() * 0.5, vz: (Math.random() - 0.5) * 0.25,
        color: this._moteColors[Math.floor(Math.random() * 3)], size: 0.03 + Math.random() * 0.05, life: 3 + Math.random() * 3, drag: 0.1,
      });
    }
    this.motes.update(dt);

    // Baliza de la antena
    this._beacon.visible = t % 1.6 < 0.25;
  }
}
