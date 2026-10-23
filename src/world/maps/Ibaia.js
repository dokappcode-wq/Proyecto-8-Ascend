import * as THREE from 'three';
import { createSky, createSun } from '../environment.js';
import { createWater } from '../water.js';
import { EnergySource } from '../entities/EnergySource.js';
import { CITY, BIN } from './ibaia/cityData.js';
import { decodeCity, cityColliders, landAt, districtAt } from './ibaia/decode.js';
import { buildingMaterial, buildBuildings, buildGround, buildTrees, buildLamps, buildDashes, buildBridges, buildRail, CHUNK } from './ibaia/meshes.js';
import { DefenseBarriers } from './ibaia/barriers.js';
import { buildTorre, buildSpecials, Anchors } from './ibaia/landmarks.js';

/**
 * MAPA — IBAIA, LA CIUDAD
 *
 * La ciudad del diseño v2 (tools/ciudad), a escala real: 30 km² en diez
 * barrios de 3 km² (la Isla, la Península y la Orilla Este), unos 27 000
 * edificios, puentes, tren elevado, parques y la sierra alrededor. Jon entra
 * por la Autovía de la Sierra en el Distrito Cero.
 *
 * Cada barrio está cerrado por una barrera de la Encarnación de la Defensa
 * (muros de luz de 300 m y la cúpula del Centro). El menú de administración
 * (F4) las baja y las sube, enseña el plano y lleva a cualquier punto.
 *
 * Al caer al agua se vuelve a la última orilla pisada.
 */

/** Recarga de cada barrio según su marca (las marcas nuevas usan farolas y armarios). */
const SOURCES = {
  energia: ['lamp', 'cabinet', 'vending'],
  temperatura: ['icebox', 'brazier'],
  hilo: ['clothesline', 'fabric'],
  gravedad: ['rubble', 'concrete'],
  alas: ['dovecote', 'pillows'],
};

const [FX0, FZ0, FX1, FZ1] = CITY.frame;
const TORRE = CITY.torre;

/** Orientación del jugador (el modelo mira hacia (sin yaw, cos yaw)) para mirar de (x, z) a (tx, tz). */
const yawTo = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);

export default {
  id: 'ibaia',
  name: 'Ibaia',
  description: 'La ciudad: diez barrios cerrados por las barreras de la Defensa · F4 administración',
  /** Cámara: la ciudad se ve a kilómetros (la Torre mide 520 m). */
  view: { near: 0.25, far: 9000 },
  envIntensity: 0.5,
  grade: { contrast: 1.06, saturation: 1.08, shadows: '#1d2442', highlights: '#ffd2a6', split: 0.08, lift: 0.02, vignette: 0.28 },
  bounds: { minX: FX0 + 30, maxX: FX1 - 30, minZ: FZ0 + 30, maxZ: FZ1 - 30 },
  city: CITY,

  build(ctx) {
    const { group, scene, world } = ctx;
    const t0 = performance.now();
    const data = decodeCity(CITY, BIN);

    // --- Atardecer: sol bajo al oeste, ventanas encendiéndose ---
    scene.fog = new THREE.FogExp2(0x8a7488, 0.00042);
    const sunDir = new THREE.Vector3(-0.84, 0.24, 0.3).normalize();
    group.add(createSky({ top: '#17233f', horizon: '#e48a5c', bottom: '#2a2430', sunDir, sunColor: '#ffb070', radius: 8600, clouds: 0.42, cloudColor: '#f2b49a', cloudShade: '#5a4258', stars: 0.12 }));
    group.add(new THREE.HemisphereLight(0xa9b8e0, 0x8a7060, 1.35));
    const sun = createSun({ color: '#ffc08a', intensity: 1.55, direction: sunDir.clone().negate(), shadowSize: 110 });
    sun.userData.distance = 700;
    sun.shadow.camera.far = 1600;
    // Sol bajo y cámara de sombra profunda: sin este desplazamiento las fachadas salen con acné
    sun.shadow.bias = -0.0002;
    sun.shadow.normalBias = 0.25;
    group.add(sun, sun.target);

    // --- Colisión: suelo, sierra, edificios, puentes, tren y barreras ---
    world.addBox({ x: FX0, y: -2, z: FZ0 }, { x: FX1, y: 0, z: FZ1 }, { tag: 'ground', climbable: false });
    const R = data.relief;
    world.addHeightfield({ minX: R.x0, minZ: R.z0, cell: R.cell, cols: R.cols, rows: R.rows, heights: R.heights, tag: 'terrain' });
    const set = world.addObbSet(cityColliders(CITY, data.buildings));
    // Límites del marco (muros invisibles)
    const H = 4000;
    const wall = (x0, z0, x1, z1) => world.addBox({ x: x0, y: -20, z: z0 }, { x: x1, y: H, z: z1 }, { tag: 'bounds', cameraBlocking: false, climbable: false });
    wall(FX0 - 10, FZ0 - 10, FX0, FZ1 + 10);
    wall(FX1, FZ0 - 10, FX1 + 10, FZ1 + 10);
    wall(FX0, FZ0 - 10, FX1, FZ0);
    wall(FX0, FZ1, FX1, FZ1 + 10);

    // --- Agua, sierra y suelo de la ciudad ---
    const water = createWater({ width: 26000, depth: 26000, color: 0x1d4762, repeat: 2600 });
    water.position.set((FX0 + FX1) / 2, -1.2, (FZ0 + FZ1) / 2);
    group.add(water);
    group.add(sierra(R));
    buildGround(group, data, (x, z) => landAt(data.mask, x, z));

    // --- Celdas: edificios, árboles, farolas y marcas viales ---
    const chunks = new Map();
    const chunkRoot = new THREE.Group();
    chunkRoot.name = 'Ciudad';
    group.add(chunkRoot);
    const bmat = buildingMaterial({ lit: 1.0 });
    const drawn = buildBuildings(data.buildings, CITY, chunks, chunkRoot, bmat);
    buildTrees(chunks, chunkRoot, data.trees);
    buildLamps(chunks, chunkRoot, data.lamps);
    buildDashes(chunks, chunkRoot, data.dashes);
    ctx.addEntity(new CityLod(chunks));

    // --- Puentes, tren elevado e hitos ---
    buildBridges(group, CITY);
    buildRail(group, CITY);
    buildTorre(group, CITY);
    buildSpecials(group, CITY, data.buildings);

    // --- Barreras de la Defensa y sus Anclas ---
    const saved = ctx.save?.data.debug.cityBarriers ?? {};
    const barriers = new DefenseBarriers(ctx, CITY, set, saved);
    const anchors = new Anchors(ctx, CITY, world);
    for (const b of barriers.items) anchors.setBroken(b.id, b.down);

    // --- Fuentes de recarga en las zonas de cada barrio ---
    const sources = chargeSources(ctx, world);

    // --- Destinos de viaje: barrios, Anclas (sobre lo que haya) y la autovía ---
    const sp = CITY.spawn;
    const spawn = { x: sp.x, y: 0.1, z: sp.z, yaw: yawTo(0, 0, sp.dx, sp.dz) };
    const waypoints = [{ id: 'autovia', name: 'Autovía de la Sierra (llegada)', ...spawn }];
    for (const d of CITY.districts) {
      waypoints.push({ id: d.id, name: d.name, district: d.id, x: d.center.x, y: 0.1, z: d.center.z, yaw: yawTo(d.center.x, d.center.z, TORRE.x, TORRE.z) });
    }
    for (const d of CITY.districts) {
      const a = anchors.items.find((i) => i.id === d.id);
      // Al lado del Ancla (no dentro del cristal)
      waypoints.push({ id: `ancla-${d.id}`, name: d.anchor.name, district: d.id, anchor: true, x: a.x + 3, y: a.y + 0.1, z: a.z + 3, yaw: yawTo(a.x + 3, a.z + 3, a.x, a.z) });
    }

    const life = ctx.addEntity(new CityLife(ctx, { data, barriers, anchors }));
    const admin = {
      city: CITY,
      data,
      barriers,
      anchors,
      sources,
      buildings: drawn,
      districtAt: (x, z) => districtAt(CITY, x, z),
      landAt: (x, z) => landAt(data.mask, x, z),
      /** Baja o sube una barrera; devuelve el estado para guardar. */
      setBarrier(id, down) {
        barriers.setDown(id, down);
        anchors.setBroken(id, down);
        return barriers.state;
      },
      setAll(down) {
        barriers.setAll(down);
        for (const b of barriers.items) anchors.setBroken(b.id, down);
        return barriers.state;
      },
      /** Punto de llegada al viajar a (x, z): sobre lo más alto que haya allí. */
      landing(x, z) {
        const top = world.groundHeight(x, z, 0.45, 5000);
        return { x, y: Math.max(0, top) + 0.1, z };
      },
      life,
    };
    console.info(`[Ibaia] ${drawn} cajas de edificios, ${chunks.size} celdas, ${set.n} colisionadores en ${(performance.now() - t0).toFixed(0)} ms`);
    return { spawn, sun, waypoints, admin };
  },
};

/** Sierra y fondo del mar: rejilla de 50 m con color por altura y pendiente. */
function sierra(R) {
  const { cols, rows, cell, x0, z0, heights } = R;
  const pos = new Float32Array(cols * rows * 3);
  const col = new Float32Array(cols * rows * 3);
  const c = new THREE.Color();
  const grass = new THREE.Color('#56603e');
  const dry = new THREE.Color('#7a6e4e');
  const rock = new THREE.Color('#6b665f');
  const snow = new THREE.Color('#e8e6e2');
  const sand = new THREE.Color('#8f8468');
  const at = (i, j) => heights[Math.max(0, Math.min(rows - 1, j)) * cols + Math.max(0, Math.min(cols - 1, i))];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const k = j * cols + i;
      let y = heights[k];
      // Bajo la ciudad el terreno queda escondido bajo el asfalto (y sobre el agua)
      if (y === 0) y = -0.5;
      pos.set([x0 + i * cell, y, z0 + j * cell], k * 3);
      const slope = Math.hypot(at(i + 1, j) - at(i - 1, j), at(i, j + 1) - at(i, j - 1)) / (2 * cell);
      if (y < 1) c.copy(sand);
      else c.copy(grass).lerp(dry, Math.min(1, y / 260)).lerp(rock, Math.min(1, Math.max(0, (slope - 0.35) * 2.2)));
      if (y > 470) c.lerp(snow, Math.min(1, (y - 470) / 80));
      col.set([c.r, c.g, c.b], k * 3);
    }
  }
  const idx = new Uint32Array((cols - 1) * (rows - 1) * 6);
  let t = 0;
  for (let j = 0; j < rows - 1; j++) {
    for (let i = 0; i < cols - 1; i++) {
      const a = j * cols + i;
      // Misma diagonal que el colisionador del relieve: (0,0)–(1,1)
      idx.set([a, a + cols + 1, a + 1, a, a + cols, a + cols + 1], t);
      t += 6;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  mesh.receiveShadow = true;
  mesh.name = 'Sierra';
  return mesh;
}

/** Fuentes de recarga junto a las zonas de cada barrio (en la acera, fuera de edificios). */
function chargeSources(ctx, world) {
  const list = [];
  const free = (x, z) => world.groundHeight(x, z, 1.3, 1000) <= 0.01;
  for (const d of CITY.districts) {
    const kinds = SOURCES[d.mark] ?? ['cabinet', 'vending', 'lamp'];
    const pts = d.zones.map((z) => [z.gx, z.gz]).concat([[d.center.x, d.center.z]]);
    // En el barrio de llegada, también junto a la autovía
    if (d.id === 'cero') pts.push([CITY.spawn.x, CITY.spawn.z]);
    pts.forEach(([x, z], n) => {
      let placed = 0;
      for (let k = 0; k < 16 && placed < 2; k++) {
        const a = k * 2.399 + n;
        const r = 6 + (k % 4) * 3;
        const px = x + Math.cos(a) * r;
        const pz = z + Math.sin(a) * r;
        if (!free(px, pz)) continue;
        const kind = kinds[(n + placed) % kinds.length];
        const src = ctx.addEntity(new EnergySource(ctx, { kind, x: px, z: pz, yaw: Math.atan2(x - px, z - pz) }));
        ctx.energySources?.register(src);
        list.push(src);
        placed++;
      }
    });
  }
  return list;
}

/** Oculta las celdas lejanas (la niebla ya las ha borrado). */
class CityLod {
  constructor(chunks, distance = 3900) {
    this.chunks = [...chunks.values()];
    this.d2 = distance * distance;
  }

  lod(eye) {
    const pad = CHUNK * 0.71;
    for (const c of this.chunks) {
      const dx = Math.max(0, Math.abs(eye.x - c.x) - pad);
      const dz = Math.max(0, Math.abs(eye.z - c.z) - pad);
      c.group.visible = dx * dx + dz * dz < this.d2;
    }
  }
}

/**
 * Vida de la ciudad: anima barreras y Anclas, avisa al entrar en un barrio
 * y devuelve a la orilla a quien cae al agua.
 */
class CityLife {
  constructor(ctx, { data, barriers, anchors }) {
    this.ctx = ctx;
    this.data = data;
    this.barriers = barriers;
    this.anchors = anchors;
    this.district = null;
    this._check = 0;
    this._safe = null;
    this._wet = 0;
  }

  update(dt) {
    this.barriers.update(dt);
    this.anchors.update(dt);
    const player = this.ctx.player;
    if (!player) return;
    const m = player.motor;
    const p = m.position;
    // Al agua: tras un instante en el agua se vuelve a la última orilla pisada
    const onLand = landAt(this.data.mask, p.x, p.z);
    if (m.grounded && p.y < 0.06 && !onLand) {
      if (this._wet === 0) {
        this.ctx.vfx?.particles?.burst({ x: p.x, y: 0, z: p.z }, { count: 26, speed: 4, color: new THREE.Color(0x9fd0f0), size: 0.18, life: 0.7, drag: 2, gravity: 9 });
        this.ctx.events.emit('city:water', { x: p.x, z: p.z });
      }
      this._wet += dt;
      if (this._wet > 0.45 && this._safe) {
        player.spawnAt(this._safe);
        this.ctx.ui?.toast('Al agua', 'De vuelta a la orilla', 1600);
        this._wet = 0;
      }
    } else {
      this._wet = 0;
      if (m.grounded && onLand) {
        this._safeT = (this._safeT ?? 0) + dt;
        if (this._safeT > 0.5 || !this._safe) {
          this._safeT = 0;
          this._safe = { x: p.x, y: p.y + 0.05, z: p.z };
        }
      }
    }
    // Barrio actual (cada medio segundo)
    this._check -= dt;
    if (this._check > 0) return;
    this._check = 0.5;
    const d = districtAt(CITY, p.x, p.z);
    if (d && d.id !== this.district?.id) {
      const first = this.district === null;
      this.district = d;
      const down = this.barriers.isDown(d.id);
      this.ctx.ui?.toast(d.name, `${d.area} · Marca: ${d.markName} · Barrera ${down ? 'bajada' : 'levantada'}${first ? ' · F4: administración' : ''}`, first ? 4200 : 2600);
      this.ctx.events.emit('city:district', { id: d.id, name: d.name });
    }
  }
}
