import * as THREE from 'three';
import { markSymbolTexture } from './markTextures.js';
import { rng } from '../world/textures.js';

/**
 * MarkVisual — patrones luminosos de una marca sobre el modelo 3D.
 *
 * Se construye a partir de los datos de la marca (color, símbolo y regiones
 * de `bodyPattern`) y se adhiere a los anclajes del CharacterModel, de modo
 * que cualquier marca futura funciona sin modificar el modelo.
 *
 * Intensidad 0..1: la marca de la muñeca siempre es visible; el resto de
 * regiones se encienden progresivamente (muñeca → antebrazo → brazo →
 * hombro → pecho) a medida que sube la intensidad.
 */

const REGION_THRESHOLDS = { wrist: 0, forearm: 0.08, upperArm: 0.3, shoulder: 0.5, chest: 0.68 };

export class MarkVisual {
  constructor(model, def) {
    this.def = def;
    this.model = model;
    this.side = def.bodyPattern?.side ?? 'R';
    this.color = new THREE.Color(def.color);
    this.glow = new THREE.Color(def.glowColor);
    this.parts = []; // { mesh, threshold, base }
    this.intensity = 0;
    this._build();
    this.setIntensity(0);
  }

  _mat(map, opacity = 1) {
    return new THREE.MeshBasicMaterial({
      map, color: this.color.clone(), transparent: true, opacity, depthWrite: false,
      blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide,
    });
  }

  _build() {
    const a = this.model.anchors;
    const S = this.side;
    const sx = S === 'L' ? 1 : -1;
    const seed = this.def.bodyPattern?.seed ?? 1;
    const regions = new Set(this.def.bodyPattern?.regions ?? ['wrist']);
    // Capa: las marcas del mismo brazo se dibujan un poco más anchas para no solaparse
    const L = this.def.bodyPattern?.layer ?? 1;

    // Símbolo de la muñeca (cara externa)
    const wrist = a[`wrist${S}`];
    const sym = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.08), this._mat(markSymbolTexture(this.def.symbol, '#ffffff')));
    const wy = this.def.bodyPattern?.wristOffset ?? 0;
    sym.position.set(0.053 * sx, 0.02 + wy, 0);
    sym.rotation.y = (Math.PI / 2) * sx;
    wrist.add(sym);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.004, 6, 24), this._mat(null));
    band.rotation.x = Math.PI / 2;
    band.position.y = 0.045 + wy;
    wrist.add(band);
    this.parts.push({ mesh: sym, threshold: -1, base: 0.75 }, { mesh: band, threshold: -1, base: 0.6 });

    const circuit = (i, w, h) => circuitTexture(seed * 10 + i, w, h);
    if (regions.has('forearm')) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.064, 0.058, 0.27, 20, 1, true), this._mat(circuit(1, 128, 256)));
      m.scale.set(L, 1, L);
      a[`forearm${S}`].add(m);
      this.parts.push({ mesh: m, threshold: REGION_THRESHOLDS.forearm, base: 0 });
    }
    if (regions.has('upperArm')) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.074, 0.068, 0.3, 20, 1, true), this._mat(circuit(2, 128, 256)));
      m.scale.set(L, 1, L);
      a[`upperArm${S}`].add(m);
      this.parts.push({ mesh: m, threshold: REGION_THRESHOLDS.upperArm, base: 0 });
    }
    if (regions.has('shoulder')) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.098, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), this._mat(circuit(3, 128, 128)));
      m.position.y = -0.01;
      m.scale.setScalar(L);
      a[`shoulder${S}`].add(m);
      this.parts.push({ mesh: m, threshold: REGION_THRESHOLDS.shoulder, base: 0 });
    }
    if (regions.has('chest')) {
      const tex = circuit(4, 128, 192);
      const front = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.3), this._mat(tex));
      front.position.set(0.11 * sx, 0.33, 0.128);
      a.chest.add(front);
      const back = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.26), this._mat(tex));
      back.position.set(0.15 * sx, 0.33, -0.128);
      back.rotation.y = Math.PI;
      a.chest.add(back);
      this.parts.push({ mesh: front, threshold: REGION_THRESHOLDS.chest, base: 0 }, { mesh: back, threshold: REGION_THRESHOLDS.chest + 0.08, base: 0 });
    }
  }

  /**
   * Visibilidad de la marca de la muñeca en reposo (0..1). Por defecto la
   * del protagonista es claramente visible; una Encarnación que oculta su
   * poder la lleva casi apagada.
   */
  setWristVisibility(v) {
    this._wristBase = v;
    this.setIntensity(this.intensity);
  }

  setIntensity(level) {
    this.intensity = level;
    for (const p of this.parts) {
      let o;
      if (p.threshold < 0) {
        const base = this._wristBase !== undefined ? this._wristBase * (p.base / 0.75) : p.base;
        o = base + (1 - base) * level;
      } else o = Math.min(1, Math.max(0, (level - p.threshold) / 0.22));
      p.mesh.visible = o > 0.01;
      p.mesh.material.opacity = o;
      // Por encima de 1 en color para que el bloom lo realce en ataques fuertes.
      p.mesh.material.color.copy(this.color).lerp(this.glow, level * 0.6).multiplyScalar(1 + level * 1.8);
    }
  }

  dispose() {
    for (const p of this.parts) {
      p.mesh.parent?.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
    }
    this.parts.length = 0;
  }
}

const circuitCache = new Map();

/**
 * Patrón de "circuito orgánico": trazos que descienden con quiebros a 45°,
 * ramificaciones y nodos. Blanco sobre transparente (se tiñe con el color
 * de la marca).
 */
export function circuitTexture(seed, w, h) {
  const key = `${seed}:${w}:${h}`;
  if (circuitCache.has(key)) return circuitCache.get(key);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  const r = rng(seed);
  g.strokeStyle = '#fff';
  g.fillStyle = '#fff';
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.shadowColor = '#fff';
  g.shadowBlur = 6;
  const traces = 3 + Math.floor(r() * 2);
  for (let t = 0; t < traces; t++) {
    let x = ((t + 0.5) / traces) * w + (r() - 0.5) * 10;
    let y = 0;
    g.lineWidth = 2.5 + r() * 2;
    g.beginPath();
    g.moveTo(x, y);
    while (y < h) {
      const seg = 14 + r() * 36;
      if (r() < 0.45) {
        const dir = r() < 0.5 ? -1 : 1;
        const d = 8 + r() * 14;
        x += dir * d;
        y += d;
        g.lineTo(x, y);
        g.stroke();
        g.beginPath();
        g.arc(x, y, 3.2, 0, Math.PI * 2);
        g.fill();
        g.beginPath();
        g.moveTo(x, y);
        // Ramificación corta
        if (r() < 0.5) {
          g.save();
          g.lineWidth = 1.5;
          g.beginPath();
          g.moveTo(x, y);
          const bx = x + (r() < 0.5 ? -1 : 1) * (10 + r() * 14);
          const by = y + 10 + r() * 16;
          g.lineTo(bx, by);
          g.stroke();
          g.beginPath();
          g.arc(bx, by, 2.2, 0, Math.PI * 2);
          g.fill();
          g.restore();
          g.beginPath();
          g.moveTo(x, y);
        }
      } else {
        y += seg;
        g.lineTo(x, y);
      }
      x = Math.max(4, Math.min(w - 4, x));
    }
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  circuitCache.set(key, tex);
  return tex;
}
