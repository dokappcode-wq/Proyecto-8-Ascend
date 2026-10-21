import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { SparkSystem } from '../../src/vfx/SparkSystem.js';
import { ParticleSystem } from '../../src/vfx/ParticleSystem.js';
import { GradeShader, applyGrade, DEFAULT_GRADE } from '../../src/vfx/gradePass.js';
import { createMountains } from '../../src/world/environment.js';
import { PartSet, bodyMaterials, rbox, sphere } from '../../src/player/bodyParts.js';

test('Chispas: la cola queda detrás de la cabeza, según la velocidad, y como mucho a 0.7 m', () => {
  const s = new SparkSystem(16);
  const white = new THREE.Color(1, 1, 1);
  s.emit({ x: 0, y: 5, z: 0, vx: 10, vy: 0, vz: 0, color: white, life: 1, gravity: 0, stretch: 0.02 });
  s.emit({ x: 0, y: 5, z: 0, vx: 0, vy: 0, vz: -100, color: white, life: 1, gravity: 0, stretch: 0.02 });
  s.update(0.01);
  assert.equal(s.count, 2);
  const P = s.aPos.array;
  // Chispa 1: cabeza delante (x > 0), cola hacia atrás en −X
  assert.ok(P[0] > 0);
  assert.ok(P[3] < P[0]);
  assert.ok(Math.abs(P[0] - P[3] - 10 * Math.exp(-0.016) * 0.02) < 0.01);
  // Chispa 2: muy rápida → cola recortada a 0.7 m
  const tail = Math.hypot(P[6] - P[9], P[7] - P[10], P[8] - P[11]);
  assert.ok(Math.abs(tail - 0.7) < 1e-4, `cola ${tail}`);
  // La cabeza brilla más que la cola
  const C = s.aCol.array;
  assert.ok(C[0] > C[3]);
  assert.equal(s.lines.geometry.drawRange.count, 4);
});

test('Chispas: caen por la gravedad, mueren al acabar su vida y el pool se recicla', () => {
  const s = new SparkSystem(4);
  const c = new THREE.Color(1, 0.5, 0);
  s.burst({ x: 0, y: 1, z: 0 }, { count: 6, speed: 5, color: c, life: 0.2, normal: new THREE.Vector3(0, 1, 0) });
  assert.equal(s.count, 4, 'no pasa de la capacidad');
  const vy0 = s.vel[1];
  s.update(0.05);
  assert.ok(s.vel[1] < vy0, 'la gravedad frena la subida');
  for (let i = 0; i < 10; i++) s.update(0.05);
  assert.equal(s.count, 0);
  assert.equal(s.lines.geometry.drawRange.count, 0);
  s.burst({ x: 0, y: 0, z: 0 }, { count: 2, color: c });
  s.clear();
  assert.equal(s.count, 0);
});

test('Humo: crece y aparece con suavidad; las partículas de energía encogen', () => {
  const smoke = new ParticleSystem(8, { smoke: true });
  const glow = new ParticleSystem(8);
  const c = new THREE.Color(0.5, 0.5, 0.5);
  for (const ps of [smoke, glow]) ps.emit({ x: 0, y: 0, z: 0, color: c, size: 1, life: 1 });
  smoke.update(0.02);
  glow.update(0.02);
  const s0 = smoke.aSize.array[0];
  const a0 = smoke.aAlpha.array[0];
  assert.ok(a0 < 0.2, 'el humo empieza casi transparente');
  assert.ok(glow.aAlpha.array[0] > 0.9, 'la energía aparece de golpe');
  const g0 = glow.aSize.array[0];
  smoke.update(0.5);
  glow.update(0.5);
  assert.ok(smoke.aSize.array[0] > s0, 'el humo crece');
  assert.ok(smoke.aAlpha.array[0] > a0);
  assert.ok(glow.aSize.array[0] < g0, 'la energía encoge');
  assert.equal(smoke.points.material.blending, THREE.NormalBlending);
  assert.equal(glow.points.material.blending, THREE.AdditiveBlending);
  // Cada partícula lleva su semilla (forma irregular del humo)
  assert.ok(smoke.aSeed.array[0] >= 0 && smoke.aSeed.array[0] < 1);
});

test('Gradación: cada mapa ajusta lo que indica y el resto vuelve a los valores por defecto', () => {
  const pass = { uniforms: THREE.UniformsUtils.clone(GradeShader.uniforms) };
  applyGrade(pass, { contrast: 1.3, shadows: '#ff0000', vignette: 0.1 });
  assert.equal(pass.uniforms.contrast.value, 1.3);
  assert.equal(pass.uniforms.vignette.value, 0.1);
  assert.equal(pass.uniforms.shadowTint.value.getHexString(), 'ff0000');
  assert.equal(pass.uniforms.saturation.value, DEFAULT_GRADE.saturation);
  applyGrade(pass);
  assert.equal(pass.uniforms.contrast.value, DEFAULT_GRADE.contrast);
  assert.equal(pass.uniforms.vignette.value, DEFAULT_GRADE.vignette);
});

test('Montañas: una sola malla con color por cara; la nieve solo en las cotas altas', () => {
  const peaks = [{ x: 0, z: 0, rad: 50, h: 100 }, { x: 200, z: 0, rad: 40, h: 80, y0: -10 }];
  const snow = '#ffffff';
  const m = createMountains(peaks, { rock: '#404040', low: '#204020', snow, snowLine: 0.5, seed: 3 });
  assert.ok(m.isMesh);
  const pos = m.geometry.attributes.position;
  const col = m.geometry.attributes.color;
  assert.ok(col, 'colores por vértice');
  m.geometry.computeBoundingBox();
  assert.ok(Math.abs(m.geometry.boundingBox.max.y - 100) < 1e-3, 'la cima llega a la altura pedida');
  let snowy = 0;
  for (let t = 0; t < pos.count; t += 3) {
    const isSnow = col.getX(t) > 0.85 && col.getY(t) > 0.85 && col.getZ(t) > 0.85;
    if (!isSnow) continue;
    snowy++;
    const y = (pos.getY(t) + pos.getY(t + 1) + pos.getY(t + 2)) / 3;
    const x = pos.getX(t);
    const peak = x > 100 ? peaks[1] : peaks[0];
    assert.ok((y - (peak.y0 ?? 0)) / peak.h > 0.43, 'nieve por debajo de la cota de nieve');
  }
  assert.ok(snowy > 0, 'hay caras nevadas');
  // Sin nieve si la cota está por encima de la cima
  const dry = createMountains(peaks, { snow, snowLine: 2, seed: 3 });
  const dc = dry.geometry.attributes.color;
  for (let i = 0; i < dc.count; i++) assert.ok(!(dc.getX(i) > 0.85 && dc.getY(i) > 0.85 && dc.getZ(i) > 0.85));
});

test('Personaje: las piezas se fusionan en una malla por tipo de material, con su color', () => {
  const set = new PartSet();
  set.add('matte', rbox(0.2, 0.3, 0.1), 0xff0000, { pos: [0, 1, 0] });
  set.add('matte', sphere(0.1), 0x00ff00, { pos: [0, 2, 0], scale: 2 });
  set.add('metal', rbox(0.05, 0.05, 0.05), '#0000ff');
  const parent = new THREE.Group();
  const meshes = set.build(parent, bodyMaterials());
  assert.equal(meshes.length, 2, 'una malla mate y una metálica');
  assert.equal(parent.children.length, 2);
  assert.ok(set.empty, 'el conjunto queda vacío tras construir');
  const matte = meshes.find((m) => m.material.metalness === 0 || m.material.roughness > 0.8);
  const c = matte.geometry.attributes.color;
  const p = matte.geometry.attributes.position;
  let red = 0;
  let green = 0;
  for (let i = 0; i < c.count; i++) {
    if (c.getX(i) > 0.9 && c.getY(i) < 0.1) {
      red++;
      assert.ok(Math.abs(p.getY(i) - 1) <= 0.16, 'la caja roja está en y = 1');
    } else if (c.getY(i) > 0.9) {
      green++;
      assert.ok(Math.abs(p.getY(i) - 2) <= 0.2 + 1e-6, 'la esfera verde (escala 2) está en y = 2');
    }
  }
  assert.ok(red > 0 && green > 0);
  // Las primitivas se reutilizan (caché) y no se modifican al añadirlas
  assert.equal(rbox(0.2, 0.3, 0.1), rbox(0.2, 0.3, 0.1));
});
