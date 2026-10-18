import * as THREE from 'three';
import { LevelBuilder } from './LevelBuilder.js';
import { mergeStatic } from './mergeStatic.js';

/**
 * MapManager — registro, carga y descarga de mapas.
 *
 * Un mapa es un módulo con { id, name, description, build(ctx) } donde
 * build recibe { group, world, builder, scene, combat, events, addEntity }
 * y devuelve { spawn, sun }. Las entidades (dianas, maniquíes, objetos
 * físicos…) se actualizan cada frame y se liberan al descargar el mapa.
 * Todos los mapas comparten el mismo CollisionWorld, jugador y cámara:
 * al cambiar de mapa solo se reemplaza la geometría.
 */
export class MapManager {
  constructor({ scene, world, events }) {
    this.scene = scene;
    this.world = world;
    this.events = events;
    this.maps = new Map();
    this.current = null;
  }

  register(def) {
    this.maps.set(def.id, def);
  }

  list() {
    return [...this.maps.values()];
  }

  /** @param {object} services { combat, enemies, interactions } compartidos con el mapa */
  load(id, services = {}) {
    const def = this.maps.get(id);
    if (!def) throw new Error(`Mapa desconocido: ${id}`);
    this.unload();

    const group = new THREE.Group();
    group.name = `Mapa:${id}`;
    this.scene.add(group);
    const builder = new LevelBuilder(group, this.world);
    const entities = [];
    const ctx = {
      group, world: this.world, builder, scene: this.scene, events: this.events, ...services,
      addEntity: (e) => {
        entities.push(e);
        return e;
      },
    };
    const result = def.build(ctx);
    // Rendimiento: la geometría estática se fusiona por material
    this.lastMerge = mergeStatic(group);
    this.current = { def, group, entities, spawn: result.spawn, sun: result.sun ?? null };
    this.events.emit('map:loaded', { id, name: def.name });
    return this.current;
  }

  update(dt) {
    if (!this.current) return;
    for (const e of this.current.entities) e.update?.(dt);
  }

  /** Devuelve las entidades del mapa a su estado inicial (menú de depuración). */
  resetEntities() {
    if (!this.current) return;
    for (const e of this.current.entities) e.reset?.();
  }

  unload() {
    if (!this.current) return;
    const { group, def, entities } = this.current;
    for (const e of entities) e.dispose?.();
    this.scene.remove(group);
    disposeTree(group);
    this.world.clear();
    this.scene.fog = null;
    this.current = null;
    this.events.emit('map:unloaded', { id: def.id });
  }
}

function disposeTree(root) {
  const mats = new Set();
  root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => mats.add(m));
    if (o.isLight && o.shadow?.map) o.shadow.map.dispose();
  });
  for (const m of mats) {
    for (const key of ['map', 'emissiveMap', 'normalMap', 'roughnessMap']) m[key]?.dispose?.();
    m.dispose();
  }
}
