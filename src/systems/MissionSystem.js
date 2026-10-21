import * as THREE from 'three';
import { Mission } from '../missions/Mission.js';
import { MISSIONS } from '../data/missions.js';
import { LevelBuilder } from '../world/LevelBuilder.js';
import { PROGRESSION } from '../data/progression.js';

const BEAM_COLOR = 0xf2c45a;

/**
 * MissionSystem — misiones de prueba (no es una campaña).
 *
 * Al cargar un mapa con misión: coloca el punto de activación (teléfono
 * público) y su marcador. Al activarla con E aparecen sus enemigos, el HUD
 * muestra los objetivos con su recuento y los marcadores de ubicación; la
 * primera detección se avisa; al completar todos los objetivos se muestra
 * el mensaje de finalización y se guarda el resultado.
 */
export class MissionSystem {
  constructor(game) {
    this.game = game;
    this.mission = null;
    this.giver = null;
    this._interaction = null;
    this._beams = [];
    this._doneTimer = null;
    const g = game;

    g.events.on('map:loaded', ({ id }) => this._onMapLoaded(id));
    g.events.on('map:unloaded', () => this._teardown());
    g.events.on('enemy:neutralized', (e) => this._onNeutralized(e));
    g.events.on('player:damaged', (d) => {
      if (this.mission?.active) this.mission.damageTaken += d.amount ?? 0;
    });
  }

  get active() {
    return !!this.mission?.active;
  }

  // ------------------------------------------------------------------ Mapa
  _onMapLoaded(id) {
    this._teardown();
    const def = Object.values(MISSIONS).find((m) => m.map === id);
    if (!def) return;
    const g = this.game;
    this.mission = new Mission(def);
    this._buildGiver(def.giver);
    this._interaction = g.interactions.add({
      getPosition: () => this.giver.interactPoint,
      radius: 2.2,
      enabled: () => this.mission && !this.mission.active,
      label: () => (this.mission.completed ? `${def.giver.label}: repetir ${def.name}` : `${def.giver.label}: aceptar ${def.name}`),
      onInteract: () => this.start(),
    });
    // Dos haces (uno por objetivo) que se reutilizan
    const grp = g.mapManager.current.group;
    for (let i = 0; i < 2; i++) {
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.35, 60, 10, 1, true),
        new THREE.MeshBasicMaterial({ color: BEAM_COLOR, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
      );
      beam.visible = false;
      beam.renderOrder = 5;
      grp.add(beam);
      this._beams.push(beam);
    }
    setTimeout(() => {
      if (this.mission && !this.mission.active && g.state === 'playing') g.ui.toast(def.name, `Ve al ${def.giver.label.toLowerCase()} de la plaza (E) para empezar`, 3500);
    }, 3200);
  }

  /** Teléfono público: poste, cabina y pantalla luminosa, con colisión. */
  _buildGiver(o) {
    const g = this.game;
    const B = new LevelBuilder(g.mapManager.current.group, g.world);
    const metal = new THREE.MeshStandardMaterial({ color: 0x2f3a46, metalness: 0.6, roughness: 0.4 });
    const panel = new THREE.MeshStandardMaterial({ color: 0x1a2430, emissive: 0xf2c45a, emissiveIntensity: 0.9 });
    const fx = Math.sin(o.yaw);
    const fz = Math.cos(o.yaw);
    const sideX = Math.abs(fx) < 0.5;
    B.block({ x: o.x, z: o.z, w: sideX ? 1.1 : 0.5, d: sideX ? 0.5 : 1.1, y: 0.2, h: 2.3, mat: metal });
    // Pantalla y auricular en la cara frontal (sin colisión)
    B.block({ x: o.x + fx * 0.27, z: o.z + fz * 0.27, w: sideX ? 0.7 : 0.04, d: sideX ? 0.04 : 0.7, y: 1.2, h: 0.55, mat: panel, collide: false, cast: false });
    B.block({ x: o.x + fx * 0.3, z: o.z + fz * 0.3, w: sideX ? 0.12 : 0.08, d: sideX ? 0.08 : 0.12, y: 0.95, h: 0.25, mat: metal, collide: false });
    B.sign(['TELÉFONO'], { x: o.x + fx * 0.26, y: 2.05, z: o.z + fz * 0.26, w: 0.9, h: 0.28, facing: o.yaw, opts: { width: 256, height: 80 } });
    this.giver = {
      position: { x: o.x, y: 0.2, z: o.z },
      interactPoint: { x: o.x + fx * 0.9, y: 0.4, z: o.z + fz * 0.9 },
      markerPoint: { x: o.x, y: 2.6, z: o.z },
    };
  }

  _teardown() {
    clearTimeout(this._doneTimer);
    this.mission = null;
    this.giver = null;
    this._interaction = null;
    this._beams.length = 0; // se liberan con el grupo del mapa
    this.game.ui.setMission(null);
    this.game.ui.updateMarkers([], this.game.camera);
  }

  // ------------------------------------------------------------------ Flujo
  start() {
    const g = this.game;
    const m = this.mission;
    if (!m || m.active) return false;
    if (m.completed) m.reset();
    g.enemies.clear('mision-pdc');
    g.enemies.clear('mision-acolito');
    m.activate();
    for (const s of m.def.spawns) {
      // Llegan a su puesto por un camino (salen de un vehículo o de un callejón);
      // `delay`: esperan dentro unos instantes para no salir todos a la vez
      const y = s.y ?? 0;
      const path = s.from ? [...s.from, { x: s.x, z: s.z }].map((p) => ({ x: p.x, y, z: p.z })) : null;
      g.enemies.spawn(s.type, { x: s.x, y: y + 0.2, z: s.z, yaw: s.yaw, tag: s.tag, patrol: s.patrol, entrance: path ? { path, speed: 2.6, delay: s.delay ?? 0 } : null });
    }
    g.events.emit('mission:started', { id: m.def.id });
    g.ui.toast(m.def.name, m.def.brief, 5000);
    return true;
  }

  /** Vuelve al estado inicial (depuración): retira sus enemigos. */
  reset() {
    const g = this.game;
    if (!this.mission) return;
    clearTimeout(this._doneTimer);
    for (const o of this.mission.def.objectives) g.enemies.clear(o.tag);
    this.mission.reset();
  }

  _onNeutralized(e) {
    const m = this.mission;
    if (!m?.active || !e.tag) return;
    const r = m.onNeutralized(e.tag);
    if (!r.objective) return;
    const g = this.game;
    if (r.objective.done >= r.objective.count && !r.completed) g.ui.toast('Objetivo completado', r.objective.label, 2200);
    if (r.completed) this._complete();
  }

  _complete() {
    const g = this.game;
    const m = this.mission;
    const rec = (g.save.data.profile.missions[m.def.id] ??= { completed: false, bestTime: null, runs: 0 });
    const best = rec.bestTime === null || m.time < rec.bestTime;
    rec.completed = true;
    rec.runs++;
    if (best) rec.bestTime = Math.round(m.time * 10) / 10;
    // Recompensa de experiencia para la marca activa
    const mark = g.marks.activeFamily;
    if (mark && m.def.xp && PROGRESSION[mark]) {
      const levels = g.progression.addXp(mark, m.def.xp);
      if (levels > 0) g.powers.applyModifiers(g.progression.modifiers(mark));
    }
    g.save.save();
    g.events.emit('mission:completed', { id: m.def.id, time: m.time, detected: m.detected });
    const stats = {
      name: m.def.name,
      time: m.time,
      best: rec.bestTime,
      newBest: best,
      damage: Math.round(m.damageTaken),
      detected: m.detected,
      objectives: m.objectives.map((o) => `${o.label}: ${o.done}/${o.count}`),
      xp: mark && m.def.xp ? m.def.xp : 0,
    };
    g.ui.toast('Operación completada', m.def.name, 2400);
    this._doneTimer = setTimeout(() => {
      if (g.state === 'playing') {
        g.ui.renderMissionComplete(stats);
        g.pause('mission');
      }
    }, 2200);
  }

  // ------------------------------------------------------------------ Por frame
  update(dt) {
    const g = this.game;
    const m = this.mission;
    if (!m) return;
    m.update(dt);

    // Detección: el primer enemigo de la misión que entra en alerta o ataque
    if (m.active && !m.detected) {
      const tags = m.pendingTags;
      if (g.enemies.alive.some((e) => tags.includes(e.tag) && e.brain.state !== 'patrol')) {
        m.markDetected();
        g.events.emit('mission:detected', { id: m.def.id });
        g.ui.toast('¡Te han detectado!', 'Neutraliza a los objetivos', 1800);
      }
    }

    // Marcadores: el teléfono antes de empezar; después, cada grupo objetivo
    const markers = [];
    if (!m.active) {
      if (this.giver) markers.push({ ...this.giver.markerPoint, label: m.completed ? 'Repetir' : 'Aceptar', kind: 'giver' });
    } else {
      for (const o of m.objectives) {
        if (o.done >= o.count) continue;
        const list = g.enemies.alive.filter((e) => e.tag === o.tag);
        if (!list.length) continue;
        const c = list.reduce((a, e) => ({ x: a.x + e.position.x / list.length, y: a.y + e.position.y / list.length, z: a.z + e.position.z / list.length }), { x: 0, y: 0, z: 0 });
        markers.push({ x: c.x, y: c.y + 2.6, z: c.z, label: o.id === 'acolito' ? 'Acólito' : 'Patrulla', kind: 'target' });
      }
    }
    this._beams.forEach((b, i) => {
      const mk = markers[i];
      b.visible = !!mk;
      if (mk) b.position.set(mk.x, mk.y + 28, mk.z);
    });
    g.ui.updateMarkers(markers, g.camera, g.player.motor.position);
    g.ui.setMission({
      name: m.def.name,
      state: m.state,
      detected: m.detected,
      time: m.time,
      objectives: m.active || m.completed
        ? m.objectives.map((o) => ({ label: o.label, done: o.done, count: o.count }))
        : [{ label: `Ve al ${m.def.giver.label.toLowerCase()} de la plaza (E)`, done: 0, count: 0 }],
    });
  }
}
