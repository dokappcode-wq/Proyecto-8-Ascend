import * as THREE from 'three';
import { LevelBuilder } from './LevelBuilder.js';
import { mergeStatic } from './mergeStatic.js';
import { normalMapFor } from './textures.js';

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
    // Los primeros fotogramas se dibuja todo: así los materiales de lo que el
    // LOD oculta se compilan durante la carga y no al acercarse (tirón)
    this._cullDelay = 3;

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
    applyNormalMaps(group);
    // Rendimiento: la geometría estática se fusiona por material
    this.lastMerge = mergeStatic(group);
    this.current = { def, group, entities, spawn: result.spawn, sun: result.sun ?? null, story: result.story ?? null };
    this.events.emit('map:loaded', { id, name: def.name });
    return this.current;
  }

  update(dt) {
    if (!this.current) return;
    for (const e of this.current.entities) e.update?.(dt);
  }

  /**
   * Oculta las entidades con `lodRoot` que están más lejos de `lodDistance`
   * (figuras pequeñas con muchas piezas: la niebla y la distancia las hacen
   * casi invisibles y cuestan muchas llamadas de dibujo).
   */
  cull(eye) {
    if (!this.current) return;
    if (this._cullDelay > 0) {
      this._cullDelay--;
      return;
    }
    for (const e of this.current.entities) {
      // Nivel de detalle propio (bosques, terreno): reparte según la cámara
      e.lod?.(eye);
      if (!e.lodRoot) continue;
      const p = e.lodRoot.position;
      // `hidden`: la entidad está oculta a propósito (el guion), no por distancia
      e.lodRoot.visible = !e.hidden && Math.hypot(p.x - eye.x, p.y - eye.y, p.z - eye.z) < e.lodDistance;
    }
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

/**
 * Las texturas procedurales traen su mapa normal (relieve de juntas, piedras,
 * tejas, grietas…); se asigna a cada material que use esa textura.
 */
function applyNormalMaps(root) {
  const done = new Set();
  root.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (!m || done.has(m) || !m.isMeshStandardMaterial) continue;
      done.add(m);
      const nm = normalMapFor(m.map);
      if (!nm || m.normalMap) continue;
      // Misma repetición que el color (algunas texturas usan repeat en vez de UV escaladas)
      const n = nm.clone();
      n.repeat.copy(m.map.repeat);
      n.offset.copy(m.map.offset);
      n.rotation = m.map.rotation;
      m.normalMap = n;
      m.needsUpdate = true;
    }
  });
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
