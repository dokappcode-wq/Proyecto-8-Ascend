import { PhoneBooth } from '../props.js';
import { CITY } from '../../world/maps/ibaia/cityData.js';
import { districtAt } from '../../world/maps/ibaia/decode.js';
import { STORY } from './story.js';
import { SIDE } from './side.js';
import { ACTIVITIES, resetActivitySpots } from './activities.js';
import { EVENTS } from './events.js';
import { streets, place, resetPlaces, spreadSpots, CAST } from './world.js';

/**
 * Distrito Cero (barrio 1) — «Línea Cero», thriller noir de espionaje.
 * 10 misiones de historia, 10 secundarias, 6 actividades (32 sitios) y
 * 4 sucesos. Ver docs/PLAN_BARRIOS.md.
 */
export const CERO = {
  id: 'cero',
  name: 'Distrito Cero',
  streets,
  cast: CAST,
  missions: [...STORY, ...SIDE, ...ACTIVITIES, ...EVENTS],
  events: EVENTS,
  content: {
    sides: SIDE.map((m) => m.id),
    acts: [
      { id: 'cero-base', count: 5 },
      { id: 'cero-tram', count: 3 },
      { id: 'cero-cabina', count: 8 },
      { id: 'cero-cams', count: 6 },
      { id: 'cero-race', count: 4 },
      { id: 'cero-drop', count: 6 },
    ],
  },
  world: { booths: {}, cabinas: [] },

  place(key) {
    return place(this.game, key);
  },

  /** Al cargar Ibaia: cabinas (la de la plaza y las ocho de la Centralita). */
  setup(game, director) {
    this.game = game;
    resetPlaces();
    resetActivitySpots();
    const group = game.mapManager.current.group;
    const add = (p) => {
      group.add(p.object3d);
      director._world.push(p);
      return p;
    };
    const km0 = place(game, 'km0');
    this.world = { booths: {}, cabinas: [] };
    this.world.booths.km0 = add(new PhoneBooth(game, { x: km0.x, z: km0.z, yaw: km0.yaw }));
    const inside = (x, z) => districtAt(CITY, x, z)?.id === 'cero';
    for (const p of spreadSpots(game, 8, 303, { minSep: 230, inside })) this.world.cabinas.push(add(new PhoneBooth(game, { x: p.x, z: p.z, yaw: p.yaw })));
  },

  /** Donde se reaparece al caer fuera de una misión. */
  safehouse(director) {
    const g = director.game;
    if (director.state.flags.pisoFranco) {
      const b = place(g, 'bar');
      return { x: b.x, y: 0.1, z: b.z, yaw: b.yaw };
    }
    return { x: CITY.spawn.x, y: 0.1, z: CITY.spawn.z, yaw: Math.atan2(CITY.spawn.dx, CITY.spawn.dz) };
  },
};
