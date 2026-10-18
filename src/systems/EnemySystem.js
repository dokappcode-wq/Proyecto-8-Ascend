import * as THREE from 'three';
import { Enemy } from '../ai/Enemy.js';
import { ENEMY_TYPES } from '../ai/enemyTypes.js';

/**
 * EnemySystem — crea, actualiza y elimina enemigos; reparte el "ruido"
 * (disparos e impactos) para que puedan oír, y separa a los personajes
 * para que no se solapen.
 */
export class EnemySystem {
  constructor({ scene, world, combat, projectiles, vfx, events }) {
    this.world = world;
    this.combat = combat;
    this.projectiles = projectiles;
    this.vfx = vfx;
    this.events = events;
    this.player = null; // actor del jugador (PlayerCombat)
    /**
     * Reacción de una facción ante el jugador: 'hostile' | 'watchful' | 'calm'.
     * Por defecto todas hostiles; FactionSystem la sustituye.
     */
    this.attitude = () => 'hostile';
    this.list = [];
    this.corpseTime = 6;
    this.group = new THREE.Group();
    this.group.name = 'Enemigos';
    scene.add(this.group);

    // Los disparos del jugador se oyen; los impactos, de cerca.
    events.on('power:used', (e) => {
      if (!this.player) return;
      const loud = e.id === 'proyectil' || e.id === 'descarga' || e.id === 'onda' || e.id === 'rayo';
      if (loud) this.noise(this.player.position, e.id === 'proyectil' ? 16 : 24);
    });
    events.on('projectile:hit', (e) => {
      if (e.faction === 'player') this.noise(e.point, 9);
    });
  }

  /** @param {string} typeId 'pdc' | 'acolyte' */
  spawn(typeId, o) {
    const type = ENEMY_TYPES[typeId];
    if (!type) throw new Error(`Tipo de enemigo desconocido: ${typeId}`);
    const e = new Enemy(this, type, o);
    this.list.push(e);
    this.events.emit('enemy:spawned', { enemy: e, type: typeId, tag: e.tag });
    return e;
  }

  remove(enemy) {
    const i = this.list.indexOf(enemy);
    if (i >= 0) this.list.splice(i, 1);
    this.events.emit('enemy:removed', { enemy });
    enemy.dispose();
  }

  /** Elimina todos (o los de una etiqueta). */
  clear(tag = null) {
    for (const e of [...this.list]) if (tag === null || e.tag === tag) this.remove(e);
  }

  noise(pos, radius) {
    for (const e of this.list) e.hear(pos, radius);
  }

  forgetTarget() {
    for (const e of this.list) e.forgetTarget();
  }

  get alive() {
    return this.list.filter((e) => e.alive);
  }

  /** ¿Algún enemigo vivo de la facción ve ahora al jugador? */
  seenBy(faction) {
    return this.list.some((e) => e.alive && e.type.faction === faction && e.seesPlayer);
  }

  update(dt) {
    for (const e of [...this.list]) e.update(dt);
    this._separate();
  }

  /** Empuja a los personajes que se solapan (enemigos entre sí y con el jugador). */
  _separate() {
    const bodies = this.list.filter((e) => e.alive).map((e) => e.motor);
    if (this.player?.alive) bodies.push(this.player.motor);
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i].position;
        const b = bodies[j].position;
        if (Math.abs(a.y - b.y) > 1.6) continue;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const d = Math.hypot(dx, dz);
        const min = 0.8;
        if (d >= min || d < 1e-6) continue;
        const push = (min - d) / 2;
        a.x -= (dx / d) * push;
        a.z -= (dz / d) * push;
        b.x += (dx / d) * push;
        b.z += (dz / d) * push;
      }
    }
  }
}
