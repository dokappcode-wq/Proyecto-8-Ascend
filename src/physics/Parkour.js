/**
 * Parkour — consultas geométricas para escalada, cornisas y obstáculos.
 *
 * Independiente de Three.js, como CollisionWorld y CharacterMotor. Las
 * normales de los muros son siempre horizontales y alineadas con los ejes
 * (los colisionadores son AABB), lo que simplifica el agarre.
 */

export const PARKOUR_CONFIG = Object.freeze({
  /** Altura máxima (sobre los pies) que se supera sin saltar. */
  vaultMaxHeight: 1.35,
  /** Grosor máximo de un obstáculo para saltarlo por encima. */
  vaultMaxDepth: 1.1,
  /** Velocidad mínima para saltar por encima (si no, se sube encima). */
  vaultMinSpeed: 3.5,
  /** Altura de las manos sobre los pies al colgar de una cornisa. */
  hangReach: 2.1,
  /** Cornisas agarrables en el aire: cima entre pies + 0.3 y pies + grabMax. */
  grabMax: 2.35,
  /** Distancia máxima (más allá del radio) para engancharse a un muro. */
  reach: 0.35,
  climbUpSpeed: 4.2,
  climbDownSpeed: 4.5,
  climbSideSpeed: 2.6,
  shimmySpeed: 2.2,
  /** Impulso vertical con salto durante la escalada. */
  leapSpeed: 9,
  leapTime: 0.22,
  leapCooldown: 0.35,
  /** Salto hacia atrás desde la pared. */
  wallJumpOut: 6.5,
  wallJumpUp: 8.5,
  /** Tiempo sin poder volver a agarrarse tras soltarse o saltar. */
  regrabDelay: 0.35,
  dropRegrabDelay: 0.6,
  /** Tiempo mínimo colgado antes de trepar (para que se lea el agarre). */
  hangMinTime: 0.3,
  /** Por debajo de esta velocidad vertical no se engancha a un muro (caída). */
  wallGrabMinVy: -18,
});

const EPS = 1e-4;

/** ¿Se puede trepar por este colisionador? (no límites, objetos móviles ni fuentes). */
export function isClimbable(c) {
  return !!c && c.kind === 'box' && c.enabled !== false && c.climbable !== false && c.tag !== 'bounds' && c.tag !== 'source' && !c.owner;
}

/**
 * Rayo horizontal desde (p.x, y, p.z) en la dirección (dx, dz).
 * @returns {{t:number, nx:number, nz:number, collider:object, x:number, z:number} | null}
 *   Solo impactos contra caras verticales.
 */
export function probeWall(world, p, dx, dz, y, maxDist) {
  const hit = world.raycastHit({ x: p.x, y, z: p.z }, { x: dx, y: 0, z: dz }, maxDist);
  if (!hit) return null;
  const n = hit.normal;
  if (Math.abs(n.y) > 0.1) return null;
  return { t: hit.t, nx: n.x, nz: n.z, collider: hit.collider, x: p.x + dx * hit.t, z: p.z + dz * hit.t };
}

/** Cara exterior (en el eje de la normal) de una caja: coordenada del plano. */
export function faceCoord(box, nx, nz) {
  if (Math.abs(nx) > 0.5) return nx > 0 ? box.maxX : box.minX;
  return nz > 0 ? box.maxZ : box.minZ;
}

/**
 * Busca la cima de una cornisa en (x, z): rayo hacia abajo desde `fromY`
 * hasta `toY`. Si el punto de partida está dentro de un sólido (el muro sigue
 * más arriba) no hay cornisa.
 * @returns {{y:number, collider:object} | null}
 */
export function ledgeTop(world, x, z, fromY, toY) {
  if (fromY <= toY) return null;
  const hit = world.raycastHit({ x, y: fromY, z }, { x: 0, y: -1, z: 0 }, fromY - toY);
  if (!hit || hit.t < EPS || hit.normal.y < 0.9) return null;
  return { y: fromY - hit.t, collider: hit.collider };
}

/** ¿Cabe el cilindro del personaje en esta posición? */
export function bodyFits(world, x, y, z, radius, height, stepHeight = 0.05) {
  const pos = { x, z };
  world.resolveHorizontal(pos, radius, y, height, stepHeight);
  if (Math.hypot(pos.x - x, pos.z - z) > 0.03) return false;
  return world.ceilingHeight(x, z, radius * 0.9, y + 0.01) >= y + height;
}

/**
 * Cornisa delante del personaje (muro de normal n), con la cima entre
 * pies + minRel y pies + maxRel.
 * @returns {{y:number, collider:object, front:number, nx:number, nz:number} | null}
 *   `front` es la coordenada de la cara exterior de la cornisa en el eje de n.
 */
export function findLedge(world, p, n, radius, minRel, maxRel) {
  // Punto más cercano de la pared a varias alturas (los salientes, como las
  // cornisas de una fachada, quedan más cerca que el muro).
  let tMin = Infinity;
  for (const h of [0.6, 1.1, 1.6, 2.0, 2.3]) {
    if (h > maxRel + 0.05) break;
    const w = probeWall(world, p, -n.nx, -n.nz, p.y + h, radius + 1.0);
    if (w && Math.abs(w.nx - n.nx) < 0.1 && Math.abs(w.nz - n.nz) < 0.1 && w.t < tMin) tMin = w.t;
  }
  if (tMin === Infinity) {
    // Empieza dentro del saliente (escalando justo debajo): mide desde el cuerpo.
    tMin = 0;
  }
  const sx = p.x - n.nx * (tMin + 0.12);
  const sz = p.z - n.nz * (tMin + 0.12);
  const top = ledgeTop(world, sx, sz, p.y + maxRel + 0.3, p.y + minRel);
  if (!top || top.y > p.y + maxRel || !isClimbable(top.collider)) return null;
  return { ...top, front: faceCoord(top.collider, n.nx, n.nz), nx: n.nx, nz: n.nz };
}

/**
 * Lugar donde quedarse de pie al subir a una cornisa (o null si no cabe).
 * @returns {{x:number, y:number, z:number, crouch:boolean} | null}
 */
export function standSpot(world, p, ledge, radius, height, crouchHeight) {
  const { nx, nz, front, y } = ledge;
  const inset = radius + 0.18;
  const x = Math.abs(nx) > 0.5 ? front - nx * inset : p.x;
  const z = Math.abs(nz) > 0.5 ? front - nz * inset : p.z;
  const ground = world.groundHeight(x, z, radius * 0.85, y + 0.05);
  if (ground < y - 0.05) return null; // la cima es demasiado estrecha
  if (bodyFits(world, x, ground, z, radius, height)) return { x, y: ground, z, crouch: false };
  if (bodyFits(world, x, ground, z, radius, crouchHeight)) return { x, y: ground, z, crouch: true };
  return null;
}

/**
 * Posición colgado de una cornisa: pegado a su cara exterior, con las manos
 * sobre la cima. Null si el cuerpo no cabe.
 */
export function hangSpot(world, p, ledge, radius, height, reach) {
  const { nx, nz, front, y } = ledge;
  const x = Math.abs(nx) > 0.5 ? front + nx * (radius + 0.03) : p.x;
  const z = Math.abs(nz) > 0.5 ? front + nz * (radius + 0.03) : p.z;
  const feet = y - reach;
  if (!bodyFits(world, x, feet, z, radius, height)) return null;
  return { x, y: feet, z };
}

/**
 * Muro trepable por encima de una cornisa estrecha (fachada con molduras):
 * posición para seguir escalando con los pies sobre la cornisa.
 */
export function wallAboveLedge(world, p, ledge, radius, height) {
  const { nx, nz, front, y } = ledge;
  const ox = Math.abs(nx) > 0.5 ? front + nx * 0.5 : p.x;
  const oz = Math.abs(nz) > 0.5 ? front + nz * 0.5 : p.z;
  const w = probeWall(world, { x: ox, z: oz }, -nx, -nz, y + 1.1, 1.6);
  if (!w || !isClimbable(w.collider) || Math.abs(w.nx - nx) > 0.1 || Math.abs(w.nz - nz) > 0.1) return null;
  const x = Math.abs(nx) > 0.5 ? w.x + nx * (radius + 0.02) : p.x;
  const z = Math.abs(nz) > 0.5 ? w.z + nz * (radius + 0.02) : p.z;
  if (!bodyFits(world, x, y + 0.02, z, radius, height)) return null;
  return { x, y: y + 0.02, z };
}

/**
 * Obstáculo bajo que se puede saltar por encima: devuelve el punto de
 * aterrizaje al otro lado, o null si es demasiado grueso o no hay sitio.
 */
export function vaultLanding(world, p, ledge, radius, height, maxDepth) {
  const { nx, nz, front, y } = ledge;
  const along = (d) => ({
    x: Math.abs(nx) > 0.5 ? front - nx * d : p.x,
    z: Math.abs(nz) > 0.5 ? front - nz * d : p.z,
  });
  // Dónde termina la cima del obstáculo
  let depth = null;
  for (let d = 0.15; d <= maxDepth + 0.15; d += 0.1) {
    const q = along(d);
    const g = world.groundHeight(q.x, q.z, 0.02, y + 0.05);
    if (g < y - 0.3) {
      depth = d;
      break;
    }
  }
  if (depth === null) return null;
  const land = along(depth + radius + 0.25);
  const ground = world.groundHeight(land.x, land.z, radius * 0.85, y + 0.05);
  if (ground === -Infinity || ground < y - 3) return null; // caída alta al otro lado: mejor subir
  if (!bodyFits(world, land.x, ground, land.z, radius, height)) return null;
  // Hueco para pasar por encima
  const mid = along(depth / 2);
  if (world.ceilingHeight(mid.x, mid.z, radius * 0.5, y + 0.05) < y + 1.0) return null;
  return { x: land.x, y: ground, z: land.z, depth };
}
