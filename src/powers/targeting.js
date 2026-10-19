import * as THREE from 'three';

const _dir = new THREE.Vector3();
const _v = new THREE.Vector3();

/**
 * Enemigo vivo más cercano al centro de la mira: dentro de `range` m del
 * jugador, a menos de `cone` grados del rayo de la cámara y con línea de
 * visión desde el pecho del jugador.
 */
export function enemyAtCrosshair(game, { range, cone }) {
  const cam = game.camera.position;
  game.camera.getWorldDirection(_dir);
  const p = game.player.motor.position;
  let best = null;
  let bestAng = THREE.MathUtils.degToRad(cone);
  for (const e of game.combat.actors) {
    if (!e.alive || e.faction !== 'enemy') continue;
    const t = e.center;
    if (Math.hypot(t.x - p.x, t.z - p.z) > range) continue;
    const ang = _v.set(t.x - cam.x, t.y - cam.y, t.z - cam.z).angleTo(_dir);
    if (ang > bestAng) continue;
    const eye = { x: p.x, y: p.y + 1.4, z: p.z };
    const dx = t.x - eye.x;
    const dy = t.y - eye.y;
    const dz = t.z - eye.z;
    const d = Math.hypot(dx, dy, dz);
    const hit = game.world.raycastHit(eye, { x: dx / d, y: dy / d, z: dz / d }, d, { ignoreTags: ['bounds', 'stone'] });
    if (hit && hit.t < d - 0.6) continue;
    best = e;
    bestAng = ang;
  }
  return best;
}
