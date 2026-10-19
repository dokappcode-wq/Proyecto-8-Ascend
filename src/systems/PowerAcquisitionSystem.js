import * as THREE from 'three';
import { evaluateAcquisition, ACQUISITION_CONFIG as CFG, REASONS } from '../powers/acquisition.js';
import { MARKS } from '../data/marks.js';

/**
 * PowerAcquisitionSystem — copia de marcas por contacto físico y voluntad.
 *
 * Flujo con una fuente:
 *   1. Acercarse y pulsar E → contacto (el protagonista agarra el brazo).
 *   2. Mantener E → voluntad (barra). Soltar antes de tiempo o no ejercerla
 *      hace que la conexión se pierda: el contacto solo no basta (Regla III).
 *   3. Voluntad completa → copia: arcos entre las muñecas, aparece la marca,
 *      se registra, se desbloquean las capacidades fundamentales y se guarda.
 *   La fuente conserva su marca y su poder (Regla IV).
 *
 * Fuentes no válidas (p. ej. Acólitos) se rechazan explicando la Regla II.
 */
export class PowerAcquisitionSystem {
  constructor(game) {
    this.game = game;
    this.state = 'idle'; // 'idle' | 'contact' | 'copying'
    this.target = null;
    this.will = 0;
    this.timer = 0;
    this._acquired = false;
    this._v = new THREE.Vector3();
    this._w = new THREE.Vector3();

    game.events.on('enemy:spawned', ({ enemy }) => {
      if (enemy.type.id !== 'acolyte') return;
      enemy._interaction = game.interactions.add({
        getPosition: () => enemy.position,
        radius: CFG.contactRange,
        enabled: () => enemy.alive && this.state === 'idle',
        label: 'Acólito — intentar copiar su poder',
        onInteract: () => this.beginContact({ source: { kind: 'acolyte', markId: 'energia', name: 'Acólito de Energía' }, position: enemy.position }),
      });
    });
    game.events.on('enemy:removed', ({ enemy }) => {
      if (enemy._interaction) game.interactions.remove(enemy._interaction);
    });
  }

  get active() {
    return this.state !== 'idle';
  }

  get owned() {
    return this.game.save.data.profile.marks;
  }

  /** Registra una Encarnación del mapa como fuente (interacción con E). */
  registerSource(entity) {
    this.game.interactions.add({
      getPosition: () => entity.position,
      radius: CFG.contactRange,
      enabled: () => this.state === 'idle',
      label: () => (this.owned.includes(entity.markId)
        ? `${entity.source.name} — ya posees su marca`
        : `${entity.source.name} — establecer contacto`),
      onInteract: () => this.beginContact(entity),
    });
  }

  /** E junto a una fuente: comprueba las reglas que no dependen de la voluntad y establece contacto. */
  beginContact(entity) {
    if (this.active || this.game.playerCombat.dead) return;
    const pre = evaluateAcquisition(entity.source, this.owned, { contact: true, will: 1 });
    if (!pre.ok) return this._reject(entity, pre.reason);
    this.target = entity;
    this.state = 'contact';
    this.will = 0;
    this.timer = 0;
    this._acquired = false;
    this.game.player.lookTarget = entity.position;
    this.game.events.emit('acquisition:contact', { source: entity.source });
  }

  cancel(reason = null) {
    if (!this.active) return;
    if (reason) {
      this.game.ui.toast('Conexión perdida', REASONS[reason] ?? reason, 2600);
      this.game.events.emit('acquisition:failed', { reason, source: this.target?.source });
    }
    this._end();
  }

  _end() {
    if (this.target) {
      this.target.reach = 0;
      this.target.channel = 0;
    }
    this.target = null;
    this.state = 'idle';
    this.will = 0;
    this.game.player.lookTarget = null;
    this.game.ui.setPrompt(null);
  }

  _reject(entity, reason) {
    const name = entity.source?.name ?? 'Fuente';
    this.game.ui.toast(name, REASONS[reason] ?? reason, 3000);
    this.game.events.emit('acquisition:rejected', { reason, source: entity.source });
  }

  update(dt) {
    if (!this.active) return;
    const g = this.game;
    const t = this.target;
    const p = g.player.motor.position;
    const tp = t.position;
    const dist = Math.hypot(tp.x - p.x, tp.z - p.z);
    if (g.playerCombat.dead) return this._end();
    t.faceTowards?.(p, dt);

    if (this.state === 'contact') {
      this.timer += dt;
      if (t.reach !== undefined) t.reach = Math.min(1, t.reach + dt * 4);
      // Moverse o alejarse rompe el contacto
      const moving = ['moveForward', 'moveBack', 'moveLeft', 'moveRight', 'jump'].some((a) => g.input.isDown(a));
      if (moving || dist > CFG.contactRange + 0.6) return this.cancel('no-contact');

      if (g.input.isDown('interact') && this.timer > 0.15) {
        this.will = Math.min(1, this.will + dt / CFG.willTime);
        g.marks.sustain(this.will * 0.4);
        this._flow(this.will);
      } else if (this.will > 0) {
        // Soltó antes de completar la voluntad
        const r = evaluateAcquisition(t.source, this.owned, { contact: true, will: this.will });
        return this.cancel(r.reason);
      } else if (this.timer > CFG.contactTimeout) {
        return this.cancel('no-will');
      }
      g.ui.setPrompt(this.will > 0 ? 'Voluntad' : 'Contacto establecido — mantén E para copiar la marca', this.will);

      if (this.will >= 1) {
        const r = evaluateAcquisition(t.source, this.owned, { contact: true, will: this.will });
        if (!r.ok) return this.cancel(r.reason);
        this.state = 'copying';
        this.timer = 0;
        g.ui.setPrompt(null);
        g.events.emit('acquisition:copying', { source: t.source });
      }
      return;
    }

    if (this.state === 'copying') {
      this.timer += dt;
      const k = Math.min(1, this.timer / CFG.copyDuration);
      if (t.channel !== undefined) t.channel = Math.sin(k * Math.PI);
      g.marks.sustain(0.3 + 0.7 * k);
      g.cameraController.shake(0.02 * dt * 60);
      // Arcos entre la marca original y la muñeca del protagonista
      if (Math.random() < 0.35) {
        g.player.updateModelMatrices();
        const hand = g.player.handWorldPosition(this._v);
        const src = t.wristPosition ? t.wristPosition(this._w) : this._w.set(tp.x, tp.y + 1.2, tp.z);
        g.vfx.lightning(src, hand, MARKS[t.markId].color, { width: 0.035, duration: 0.15, jitter: 0.15, branches: 0 });
      }
      this._flow(1);

      if (!this._acquired && k >= 0.6) {
        this._acquired = true;
        g.marks.acquire(t.markId);
        g.marks.setActive(t.markId); // la nueva marca pasa a ser la activa
        const hand = g.player.handWorldPosition(this._v);
        const color = MARKS[t.markId].color;
        g.vfx.impact(hand, null, color, 2);
        g.vfx.ring({ x: p.x, y: p.y, z: p.z }, 4, color, 0.6);
        g.vfx.lights.flash(hand, color, 60, 12, 0.5);
        g.marks.pulse(1, 0.6);
        g.cameraController.shake(0.4);
      }
      if (k >= 1) {
        const def = MARKS[t.markId];
        g.ui.toast(`${def.name} adquirida`, `La Encarnación conserva su poder · Tab: marcas y habilidades`, 4200);
        g.events.emit('mark:acquired', { markId: t.markId, source: t.source });
        this._end();
      }
    }
  }

  /** Partículas que fluyen de la marca original hacia la muñeca del protagonista. */
  _flow(amount) {
    const g = this.game;
    const t = this.target;
    if (!t?.wristPosition || Math.random() > 0.3 + amount * 0.7) return;
    g.player.updateModelMatrices();
    const src = t.wristPosition(this._w);
    const hand = g.player.handWorldPosition(this._v);
    const life = 0.35;
    g.vfx.particles.emit({
      x: src.x, y: src.y, z: src.z,
      vx: (hand.x - src.x) / life, vy: (hand.y - src.y) / life, vz: (hand.z - src.z) / life,
      color: new THREE.Color(MARKS[t.markId].glowColor), size: 0.06 + amount * 0.05, life, drag: 0,
    });
  }
}
