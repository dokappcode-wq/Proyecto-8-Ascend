import * as THREE from 'three';
import { EnergyPool } from '../powers/EnergyPool.js';
import { Ability } from '../powers/Ability.js';
import { Magazine } from '../powers/Magazine.js';
import { TEMPERATURE_CONFIG } from '../powers/temperature/temperatureConfig.js';

const ICE = '#2ee6d6';
const FIRE = '#ff8a2a';
const ICE_C = new THREE.Color(ICE);
const FIRE_C = new THREE.Color(FIRE);
const FROST_C = new THREE.Color('#d8fffb');
const TICK = 0.5; // la estela y la tormenta hacen daño cada medio segundo

const ICE_MAT = new THREE.MeshStandardMaterial({ color: 0x9feee8, emissive: new THREE.Color(ICE).multiplyScalar(0.25), roughness: 0.15, metalness: 0.05, transparent: true, opacity: 0.72 });
const TILE_GEO = new THREE.BoxGeometry(1, 1, 1);

/**
 * TemperaturePowerSystem — familia Temperatura (frío y calor). Misma interfaz
 * que PowerSystem.
 *
 * - Clic izq.: 10 disparos; alterna hielo (mano derecha) y fuego (izquierda).
 * - Q (alterna): suelo sin fricción para patinar. Contra una pared se patina
 *   por ella cayendo en U (en el motor). Mantener Shift patinando: fuego hacia
 *   atrás (más velocidad) y una plataforma de hielo bajo los pies hacia donde
 *   se apunta: «andar en el aire».
 * - R: muro de hielo. G: estela de fuego. X: fuego frío (nube de tormenta).
 * - Pasiva: los golpes físicos queman (Enemy.burn), en GameManager.
 */
export class TemperaturePowerSystem {
  constructor(game) {
    this.game = game;
    this.id = 'temperatura';
    this.cfg = structuredClone(TEMPERATURE_CONFIG);
    this.energy = new EnergyPool(this.cfg.pool);
    this.abilities = {
      projectile: new Ability(this.cfg.projectile),
      dash: new Ability(this.cfg.skate),
      discharge: new Ability(this.cfg.wall),
      wave: new Ability(this.cfg.trail),
      grenade: new Ability(this.cfg.storm),
    };
    this.abilities.projectile.magazine = new Magazine({ size: this.cfg.projectile.magazineSize, reloadTime: this.cfg.projectile.reloadTime });
    this.mods = null;
    /** Próxima mano que dispara: 'R' hielo, 'L' fuego. */
    this.nextHand = 'R';
    this.skating = false;
    this.tiles = []; // plataformas de hielo de la carrera
    this.walls = [];
    this.trails = [];
    this.storms = [];
    this._lastTile = null;
    this._lastFail = 0;
    this._hand = new THREE.Vector3();
    this._dir = new THREE.Vector3();
    game.events.on('map:unloaded', () => this.clear());
  }

  // ---------------------------------------------------------------- Interfaz común
  get available() {
    return this.game.marks.activeFamily === 'temperatura';
  }

  get color() {
    return ICE;
  }

  get isCharging() {
    return false;
  }

  get chargeRatio() {
    return 0;
  }

  get isTargeting() {
    return false;
  }

  get isDiving() {
    return false;
  }

  get magazine() {
    return this.abilities.projectile.magazine;
  }

  get iceRunning() {
    return !!this.game.player.motor.iceRun;
  }

  applyModifiers(m) {
    this.mods = m;
    const c = structuredClone(TEMPERATURE_CONFIG);
    c.projectile.magazineSize += m.magazineBonus ?? 0;
    c.wall.width += m.wallWidthAdd;
    c.wall.life += m.wallLifeAdd;
    c.trail.dps *= m.trailDpsMul;
    c.trail.life += m.trailLifeAdd;
    c.storm.radius += m.stormRadiusAdd;
    c.storm.life += m.stormLifeAdd;
    c.drain.rate *= m.drainMul;
    this.cfg = c;
    this.abilities.projectile.def = c.projectile;
    this.abilities.dash.def = c.skate;
    this.abilities.discharge.def = c.wall;
    this.abilities.wave.def = c.trail;
    this.abilities.grenade.def = c.storm;
    const mag = this.magazine;
    if (mag.size !== c.projectile.magazineSize) {
      mag.size = c.projectile.magazineSize;
      mag.ammo = Math.min(mag.ammo, mag.size);
    }
    if (this.skating) this.game.player.motor.skate = c.skate;
    const max = c.pool.max + (m.energyMaxAdd ?? 0);
    const grow = max - this.energy.max;
    this.energy.max = max;
    this.energy.value = Math.min(max, this.energy.value + Math.max(0, grow));
  }

  resetAbilities() {
    for (const a of Object.values(this.abilities)) {
      a.reset();
      a.magazine?.refill();
    }
    this.stopSkate();
  }

  /** Quita muros, estelas, tormentas y plataformas (cambio de mapa). */
  clear() {
    this.stopSkate();
    for (const t of this.tiles) this._removeTile(t);
    for (const w of this.walls) this._removeWall(w);
    for (const t of this.trails) this._removeGroup(t.group);
    for (const s of this.storms) this._removeGroup(s.group);
    this.tiles.length = this.walls.length = this.trails.length = this.storms.length = 0;
  }

  _fail(id) {
    const now = performance.now();
    if (now - this._lastFail < 300) return;
    this._lastFail = now;
    this.game.events.emit('power:failed', { id });
  }

  _handPos(side) {
    this.game.player.updateModelMatrices();
    return this.game.player.handWorldPosition(this._hand, side);
  }

  // ---------------------------------------------------------------- Por frame
  update(dt) {
    const g = this.game;
    const input = g.input;
    const motor = g.player.motor;
    this.energy.infinite = !!g.save.data.debug?.infiniteEnergy;
    this.energy.update(dt);
    for (const a of Object.values(this.abilities)) a.tick(dt);
    this._updateMagazine(dt);
    this._updateTiles(dt);
    this._updateWalls(dt);
    this._updateTrails(dt);
    this._updateStorms(dt);

    const blocked = !this.available || g.playerCombat?.dead || g.acquisition?.active || g.drain?.active || motor.isClimbing;
    if (blocked) {
      this.stopSkate();
      return;
    }
    const aiming = input.isDown('aim');
    g.player.aiming = aiming;
    g.player.speedScale = aiming ? 0.65 : 1;

    if (input.isDown('attack') || input.wasPressed('attack')) this._fire();
    if (input.wasPressed('special')) {
      if (this.skating) this.stopSkate();
      else this._startSkate();
    }
    if (this.skating) this._updateSkate(dt, input.isDown('sprint'));
    if (input.wasPressed('charged')) this._wall();
    if (input.wasPressed('wave')) this._trail();
    if (input.wasPressed('grenade')) this._storm();
  }

  _updateMagazine(dt) {
    const g = this.game;
    const mag = this.magazine;
    const done = mag.update(dt);
    if (mag.reloading && this.available) {
      g.player.model.setReload(mag.reloadProgress);
      g.marks.sustain(0.2 + 0.25 * mag.reloadProgress);
    }
    if (done) {
      if (this.available) g.player.model.setReload(null);
      g.events.emit('power:reloaded', { id: 'disparo' });
    }
  }

  // ---------------------------------------------------------------- Disparo
  _fire() {
    const g = this.game;
    const a = this.abilities.projectile;
    const mag = this.magazine;
    if (!a.ready || !mag.canFire) return;
    if (!a.commit(this.energy)) return this._fail('projectile');
    mag.consume();
    if (mag.reloading) g.events.emit('power:reloading', { id: 'disparo' });
    const c = this.cfg.projectile;
    const side = this.nextHand;
    const ice = side === 'R';
    this.nextHand = ice ? 'L' : 'R';
    g.player.faceAim(0.6);
    const hand = this._handPos(side);
    const dir = g.powers._aimDirFrom(hand);
    const color = ice ? ICE : FIRE;
    g.projectiles.spawn({
      origin: { x: hand.x, y: hand.y, z: hand.z }, dir, speed: c.speed, range: c.range, radius: c.radius,
      damage: c.damage, color, kind: ice ? 'hielo' : 'fuego', knockback: 1,
    });
    g.marks.pulse(0.35, 0.1);
    g.vfx.particles.burst(hand, { count: 7, speed: 3, color: ice ? FROST_C : FIRE_C, size: 0.1, life: 0.18 });
    g.player.model.trigger('cast');
    g.events.emit('power:used', { id: ice ? 'hielo' : 'fuego', hand: side });
  }

  // ---------------------------------------------------------------- Patinar (Q) y carrera de hielo (Shift)
  _startSkate() {
    const g = this.game;
    const a = this.abilities.dash;
    if (g.player.motor.isBusy) return;
    if (!a.commit(this.energy)) return this._fail('dash');
    this.skating = true;
    g.player.motor.skate = this.cfg.skate;
    const p = g.player.motor.position;
    g.vfx.ring({ x: p.x, y: p.y + 0.04, z: p.z }, 1.6, ICE, 0.35);
    g.marks.pulse(0.5, 0.15);
    g.events.emit('power:used', { id: 'patinar' });
  }

  stopSkate() {
    if (!this.skating) return;
    const motor = this.game.player.motor;
    this.skating = false;
    motor.skate = null;
    if (motor.iceRun) this._endIceRun();
    this.game.events.emit('temperature:skate-end');
  }

  _updateSkate(dt, boost) {
    const g = this.game;
    const motor = g.player.motor;
    const run = this.cfg.iceRun;
    const drain = (motor.iceRun ? run.drainPerSecond : this.cfg.skate.drainPerSecond) * dt;
    if (!this.energy.spend(drain)) {
      this.stopSkate();
      return this._fail('dash');
    }
    // Shift: carrera de hielo hacia donde se apunta (inclinación limitada)
    if (boost && !motor.isBusy) {
      g.camera.getWorldDirection(this._dir);
      const max = THREE.MathUtils.degToRad(run.maxPitch);
      const h = Math.hypot(this._dir.x, this._dir.z) || 1;
      const pitch = THREE.MathUtils.clamp(Math.atan2(this._dir.y, h), -max, max);
      const dir = { x: (this._dir.x / h) * Math.cos(pitch), y: Math.sin(pitch), z: (this._dir.z / h) * Math.cos(pitch) };
      if (!motor.iceRun) {
        this._lastTile = null;
        g.events.emit('temperature:ice-run');
      }
      motor.iceRun = { ...dir, speed: run.speed };
      this._iceRunFx(dir);
    } else if (motor.iceRun) {
      this._endIceRun();
    }
    // Escarcha bajo los pies al patinar
    const p = motor.position;
    if ((motor.grounded || motor.isWallRiding) && motor.horizontalSpeed > 2 && Math.random() < 0.7) {
      g.vfx.particles.emit({ x: p.x + (Math.random() - 0.5) * 0.5, y: p.y + 0.05, z: p.z + (Math.random() - 0.5) * 0.5, vx: 0, vy: 0.4, vz: 0, color: FROST_C, size: 0.09, life: 0.4, drag: 2 });
    }
  }

  _endIceRun() {
    const motor = this.game.player.motor;
    // Última plataforma justo bajo los pies: se puede caminar sobre ella. Sostiene
    // desde ya (su cara de arriba está a la altura de los pies; con un frame
    // largo la caída la atravesaría antes de activarse) y la inercia de la
    // carrera se pierde (si no, saldría despedido de la placa)
    this._spawnTile(motor.position).collider.enabled = true;
    motor.velocity.x = motor.velocity.z = 0;
    motor.velocity.y = Math.min(0, motor.velocity.y);
    motor.iceRun = null;
    this._lastTile = null;
  }

  _iceRunFx(dir) {
    const g = this.game;
    const p = g.player.motor.position;
    const last = this._lastTile;
    if (!last || Math.hypot(p.x - last.x, p.y - last.y, p.z - last.z) >= this.cfg.iceRun.tileEvery) this._spawnTile(p);
    // Fuego hacia atrás (propulsión)
    for (let i = 0; i < 3; i++) {
      const sp = 6 + Math.random() * 5;
      g.vfx.particles.emit({
        x: p.x - dir.x * 0.4, y: p.y + 0.9 - dir.y * 0.4, z: p.z - dir.z * 0.4,
        vx: -dir.x * sp + (Math.random() - 0.5) * 2, vy: -dir.y * sp + (Math.random() - 0.5) * 2, vz: -dir.z * sp + (Math.random() - 0.5) * 2,
        color: Math.random() < 0.7 ? FIRE_C : new THREE.Color('#ffd27a'), size: 0.16, life: 0.3, drag: 3,
      });
    }
  }

  _spawnTile(p) {
    const g = this.game;
    const r = this.cfg.iceRun;
    const half = r.tileSize / 2;
    const top = p.y;
    const collider = g.world.addBox({ x: p.x - half, y: top - 0.22, z: p.z - half }, { x: p.x + half, y: top, z: p.z + half }, { tag: 'ice', cameraBlocking: false });
    collider.enabled = false; // se activa cuando el jugador ya no la atraviesa
    const mesh = new THREE.Mesh(TILE_GEO, ICE_MAT);
    mesh.scale.set(r.tileSize, 0.22, r.tileSize);
    mesh.position.set(p.x, top - 0.11, p.z);
    mesh.receiveShadow = true;
    g.scene.add(mesh);
    const tile = { x: p.x, y: top, z: p.z, half, t: 0, life: r.tileLife, collider, mesh };
    this.tiles.push(tile);
    this._lastTile = tile;
    // Máximo de plataformas: la más antigua se funde
    if (this.tiles.length > 40) this._removeTile(this.tiles.shift());
    return tile;
  }

  _updateTiles(dt) {
    const motor = this.game.player.motor;
    const p = motor.position;
    const rad = motor.cfg.radius;
    for (let i = this.tiles.length - 1; i >= 0; i--) {
      const t = this.tiles[i];
      t.t += dt;
      if (!t.collider.enabled && t.t < t.life - 0.6) {
        const clearH = Math.abs(p.x - t.x) > t.half + rad + 0.1 || Math.abs(p.z - t.z) > t.half + rad + 0.1;
        const above = p.y >= t.y - 0.02;
        const below = p.y + motor.cfg.height < t.y - 0.22;
        // Durante la carrera solo cuando queda atrás; después, en cuanto no la atraviesa
        if (clearH || (!motor.iceRun && (above || below))) t.collider.enabled = true;
      }
      // Se funde: deja de sostener y encoge
      const melt = (t.life - t.t) / 0.6;
      if (melt < 1) {
        t.collider.enabled = false;
        t.mesh.scale.y = 0.22 * Math.max(0.05, melt);
      }
      if (t.t >= t.life) {
        this._removeTile(t);
        this.tiles.splice(i, 1);
      }
    }
  }

  _removeTile(t) {
    this.game.world.removeBox(t.collider);
    this.game.scene.remove(t.mesh);
    if (this._lastTile === t) this._lastTile = null;
  }

  // ---------------------------------------------------------------- Muro de hielo (R)
  _forward() {
    const f = this.game.cameraController.forward();
    const l = Math.hypot(f.x, f.z) || 1;
    return { x: f.x / l, z: f.z / l };
  }

  _wall() {
    const g = this.game;
    const a = this.abilities.discharge;
    const c = this.cfg.wall;
    if (!a.canActivate(this.energy)) return this._fail('discharge');
    const p = g.player.motor.position;
    const f = this._forward();
    const cx = p.x + f.x * c.distance;
    const cz = p.z + f.z * c.distance;
    const base = g.world.groundHeight(cx, cz, 0.3, p.y + 1.5);
    const y0 = Number.isFinite(base) && base > p.y - 3 ? base : p.y;
    // Tramos cuadrados a lo largo del muro (los colisionadores son AABB)
    const side = { x: -f.z, z: f.x };
    const step = 0.6;
    const n = Math.max(2, Math.round(c.width / step));
    const half = Math.max(c.thickness, step) / 2 + 0.05;
    const colliders = [];
    for (let i = 0; i < n; i++) {
      const s = (i + 0.5) * step - (n * step) / 2;
      const x = cx + side.x * s;
      const z = cz + side.z * s;
      const gy = g.world.groundHeight(x, z, 0.2, y0 + 1.5);
      const by = Number.isFinite(gy) && Math.abs(gy - y0) < 1.2 ? gy : y0;
      if (this._actorAt(x, z, by, c.height, half)) continue; // no encierra a nadie dentro
      colliders.push(g.world.addBox({ x: x - half, y: by - 0.3, z: z - half }, { x: x + half, y: by + c.height, z: z + half }, { tag: 'ice', cameraBlocking: false }));
    }
    if (!colliders.length) return this._fail('discharge');
    a.commit(this.energy);
    const mesh = new THREE.Mesh(TILE_GEO, ICE_MAT);
    mesh.scale.set(n * step, c.height + 0.3, c.thickness + 0.1);
    mesh.position.set(cx, y0 + (c.height - 0.3) / 2, cz);
    mesh.rotation.y = Math.atan2(f.x, f.z);
    mesh.castShadow = mesh.receiveShadow = true;
    g.scene.add(mesh);
    this.walls.push({ colliders, mesh, t: 0, life: c.life, height: c.height + 0.3, y0 });
    g.player.faceAim(0.5);
    g.vfx.particles.burst({ x: cx, y: y0 + 0.3, z: cz }, { count: 26, speed: 4, color: FROST_C, size: 0.14, life: 0.6, drag: 3, gravity: 5 });
    g.vfx.lights.flash({ x: cx, y: y0 + 1.2, z: cz }, ICE, 25, 8, 0.3);
    g.cameraController.shake(0.15);
    g.marks.pulse(0.6, 0.2);
    g.player.model.trigger('wave');
    g.events.emit('power:used', { id: 'muro', segments: colliders.length });
  }

  _actorAt(x, z, y, h, half) {
    const g = this.game;
    for (const t of g.combat.targets) {
      if (!t.alive || !t.position) continue;
      const r = (t.radius ?? 0.4) + half;
      if (Math.abs(t.position.x - x) < r && Math.abs(t.position.z - z) < r && t.position.y < y + h && t.position.y + 1.8 > y) return true;
    }
    const p = g.player.motor.position;
    return Math.abs(p.x - x) < half + 0.4 && Math.abs(p.z - z) < half + 0.4 && p.y < y + h && p.y + 1.8 > y;
  }

  _updateWalls(dt) {
    for (let i = this.walls.length - 1; i >= 0; i--) {
      const w = this.walls[i];
      w.t += dt;
      // Se derrite el último segundo
      const melt = Math.min(1, (w.life - w.t) / 1);
      if (melt < 1) {
        w.mesh.scale.y = w.height * Math.max(0.02, melt);
        w.mesh.position.y = w.y0 - 0.3 + (w.height * Math.max(0.02, melt)) / 2;
        if (melt < 0.5) for (const c of w.colliders) c.enabled = false;
      }
      if (w.t >= w.life) {
        this._removeWall(w);
        this.walls.splice(i, 1);
      }
    }
  }

  _removeWall(w) {
    for (const c of w.colliders) this.game.world.removeBox(c);
    this.game.scene.remove(w.mesh);
  }

  // ---------------------------------------------------------------- Estela de fuego (G)
  _trail() {
    const g = this.game;
    const a = this.abilities.wave;
    const c = this.cfg.trail;
    if (!a.commit(this.energy)) return this._fail('wave');
    const p = g.player.motor.position;
    const f = this._forward();
    // Puntos a lo largo de la raya, sobre el suelo (se corta en los muros)
    const pts = [];
    const n = Math.max(4, Math.round(c.length / 0.9));
    let y = p.y;
    for (let i = 0; i <= n; i++) {
      const d = 0.8 + (i / n) * c.length;
      const x = p.x + f.x * d;
      const z = p.z + f.z * d;
      const gy = g.world.groundHeight(x, z, 0.15, y + 1.2);
      if (!Number.isFinite(gy) || Math.abs(gy - y) > 1.2) break;
      y = gy;
      pts.push({ x, y, z });
    }
    if (pts.length < 2) pts.push({ x: p.x + f.x, y: p.y, z: p.z + f.z });
    const group = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: FIRE_C.clone().multiplyScalar(1.5), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    const geo = new THREE.PlaneGeometry(c.width, 1).rotateX(-Math.PI / 2);
    for (let i = 0; i < pts.length - 1; i++) {
      const a0 = pts[i];
      const a1 = pts[i + 1];
      const m = new THREE.Mesh(geo, mat);
      m.position.set((a0.x + a1.x) / 2, (a0.y + a1.y) / 2 + 0.04, (a0.z + a1.z) / 2);
      m.rotation.y = Math.atan2(f.x, f.z);
      m.scale.z = Math.hypot(a1.x - a0.x, a1.z - a0.z) + 0.1;
      group.add(m);
    }
    g.scene.add(group);
    this.trails.push({ pts, group, mat, t: 0, tick: 0, life: c.life, dps: c.dps, width: c.width });
    g.player.faceAim(0.4);
    g.vfx.lights.flash({ x: pts[0].x, y: pts[0].y + 0.5, z: pts[0].z }, FIRE, 30, 10, 0.4);
    g.marks.pulse(0.7, 0.2);
    g.player.model.trigger('wave');
    g.events.emit('power:used', { id: 'estela', length: pts.length });
  }

  /** Distancia horizontal de un punto a la raya (y altura del suelo más cercano). */
  static distToPolyline(pts, x, z) {
    let best = { d: Infinity, y: pts[0].y };
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const vx = b.x - a.x;
      const vz = b.z - a.z;
      const l2 = vx * vx + vz * vz || 1e-6;
      const k = Math.max(0, Math.min(1, ((x - a.x) * vx + (z - a.z) * vz) / l2));
      const d = Math.hypot(x - (a.x + vx * k), z - (a.z + vz * k));
      if (d < best.d) best = { d, y: a.y + (b.y - a.y) * k };
    }
    return best;
  }

  _updateTrails(dt) {
    const g = this.game;
    for (let i = this.trails.length - 1; i >= 0; i--) {
      const tr = this.trails[i];
      tr.t += dt;
      tr.tick += dt;
      const fade = Math.min(1, (tr.life - tr.t) / 0.6);
      tr.mat.opacity = 0.55 * Math.max(0, fade) * (0.85 + Math.sin(tr.t * 18) * 0.15);
      // Llamas
      for (let k = 0; k < 3; k++) {
        const a = tr.pts[Math.floor(Math.random() * tr.pts.length)];
        g.vfx.particles.emit({ x: a.x + (Math.random() - 0.5) * tr.width, y: a.y + 0.1, z: a.z + (Math.random() - 0.5) * tr.width, vx: 0, vy: 1.8 + Math.random() * 1.5, vz: 0, color: Math.random() < 0.75 ? FIRE_C : new THREE.Color('#ffd27a'), size: 0.16, life: 0.45, drag: 1 });
      }
      if (tr.tick >= TICK) {
        tr.tick -= TICK;
        const dmg = Math.max(1, Math.round(tr.dps * TICK));
        for (const t of [...g.combat.targets]) {
          if (!t.alive || t === g.playerCombat || !t.position) continue;
          const near = TemperaturePowerSystem.distToPolyline(tr.pts, t.position.x, t.position.z);
          if (near.d > tr.width / 2 + (t.radius ?? 0.4) || Math.abs(t.position.y - near.y) > 1.5) continue;
          g.combat.applyDamage(t, dmg, { kind: 'estela', faction: 'player', source: g.playerCombat });
          t.burn?.(this.cfg.burn); // pisar la estela prende al enemigo
        }
      }
      if (tr.t >= tr.life) {
        this._removeGroup(tr.group);
        this.trails.splice(i, 1);
      }
    }
  }

  // ---------------------------------------------------------------- Fuego frío (X)
  _storm() {
    const g = this.game;
    const a = this.abilities.grenade;
    const c = this.cfg.storm;
    if (!a.commit(this.energy)) return this._fail('grenade');
    const p = g.player.motor.position;
    const center = { x: p.x, y: p.y, z: p.z };
    const ceil = g.world.ceilingHeight(p.x, p.z, 0.3, p.y + 2);
    const cloudY = Math.min(p.y + c.height, Number.isFinite(ceil) ? ceil - 0.6 : Infinity);
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x31474f, emissive: new THREE.Color(ICE).multiplyScalar(0.18), roughness: 1, transparent: true, opacity: 0.9, flatShading: true });
    const geo = new THREE.IcosahedronGeometry(1, 1);
    for (let i = 0; i < 9; i++) {
      const ang = (i / 9) * Math.PI * 2;
      const r = i === 0 ? 0 : c.radius * (0.35 + 0.3 * ((i * 37) % 10) / 10);
      const m = new THREE.Mesh(geo, mat);
      const s = 1.6 + ((i * 53) % 10) / 10 * 1.4;
      m.scale.set(s * 1.3, s * 0.6, s * 1.3);
      m.position.set(Math.cos(ang) * r, ((i * 17) % 5) * 0.12, Math.sin(ang) * r);
      group.add(m);
    }
    group.position.set(center.x, cloudY, center.z);
    group.scale.setScalar(0.1);
    g.scene.add(group);
    this.storms.push({ center, cloudY, radius: c.radius, life: c.life, dps: c.dps, t: 0, tick: 0, bolt: 0, group, mat });
    g.vfx.ring({ x: center.x, y: center.y + 0.05, z: center.z }, c.radius, ICE, 0.6);
    g.marks.pulse(0.9, 0.3);
    g.player.model.trigger('cast');
    g.events.emit('power:used', { id: 'tormenta' });
  }

  _updateStorms(dt) {
    const g = this.game;
    for (let i = this.storms.length - 1; i >= 0; i--) {
      const s = this.storms[i];
      s.t += dt;
      s.tick += dt;
      s.bolt -= dt;
      const grow = Math.min(1, s.t / 0.5);
      const fade = Math.min(1, (s.life - s.t) / 0.8);
      s.group.scale.setScalar(Math.max(0.05, grow * Math.max(0.05, fade)));
      s.group.rotation.y += dt * 0.3;
      s.mat.opacity = 0.9 * Math.max(0, fade);
      // Lluvia helada y brasas
      for (let k = 0; k < 4; k++) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * s.radius;
        g.vfx.particles.emit({ x: s.center.x + Math.cos(a) * r, y: s.cloudY - 0.4, z: s.center.z + Math.sin(a) * r, vx: 0, vy: -14, vz: 0, color: Math.random() < 0.6 ? ICE_C : FIRE_C, size: 0.08, life: (s.cloudY - s.center.y) / 14, drag: 0 });
      }
      // Daño a los que están debajo
      const inside = [];
      for (const t of g.combat.targets) {
        if (!t.alive || t === g.playerCombat || !t.position) continue;
        const d = Math.hypot(t.position.x - s.center.x, t.position.z - s.center.z);
        if (d <= s.radius + (t.radius ?? 0.4) && t.position.y < s.cloudY && t.position.y > s.center.y - 3) inside.push(t);
      }
      if (s.tick >= TICK) {
        s.tick -= TICK;
        const dmg = Math.max(1, Math.round(s.dps * TICK));
        for (const t of inside) g.combat.applyDamage(t, dmg, { kind: 'tormenta', faction: 'player', source: g.playerCombat });
      }
      // Rayos de fuego frío (prefiere caer sobre los enemigos)
      if (s.bolt <= 0 && s.t > 0.4 && fade > 0.3) {
        s.bolt = 0.25 + Math.random() * 0.35;
        const t = inside.length ? inside[Math.floor(Math.random() * inside.length)] : null;
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * s.radius;
        const to = t ? t.center : { x: s.center.x + Math.cos(a) * r, y: s.center.y, z: s.center.z + Math.sin(a) * r };
        const from = { x: to.x + (Math.random() - 0.5) * 1.5, y: s.cloudY - 0.3, z: to.z + (Math.random() - 0.5) * 1.5 };
        g.vfx.lightning(from, to, Math.random() < 0.5 ? ICE : FIRE, { width: 0.06, duration: 0.18, jitter: 0.5, branches: 2 });
        g.events.emit('temperature:bolt', { point: to });
      }
      if (s.t >= s.life) {
        this._removeGroup(s.group);
        this.storms.splice(i, 1);
      }
    }
  }

  _removeGroup(group) {
    this.game.scene.remove(group);
    const geos = new Set();
    const mats = new Set();
    group.traverse((o) => {
      if (o.geometry) geos.add(o.geometry);
      if (o.material) mats.add(o.material);
    });
    for (const x of geos) x.dispose();
    for (const x of mats) x.dispose();
  }
}
