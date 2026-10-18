import * as THREE from 'three';

/** Cúpula de cielo con degradado (sin texturas externas). */
export function createSky({ top = '#0b1a33', horizon = '#d9774a', bottom = '#1a1c22', sunDir = new THREE.Vector3(0.4, 0.15, -1), sunColor = '#ffb46b', radius = 900 }) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(top) },
      horizon: { value: new THREE.Color(horizon) },
      bottom: { value: new THREE.Color(bottom) },
      sunDir: { value: sunDir.clone().normalize() },
      sunColor: { value: new THREE.Color(sunColor) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom;
      uniform vec3 sunDir; uniform vec3 sunColor;
      varying vec3 vDir;
      void main() {
        float h = vDir.y;
        vec3 col = h > 0.0 ? mix(horizon, top, pow(clamp(h, 0.0, 1.0), 0.55))
                           : mix(horizon, bottom, pow(clamp(-h, 0.0, 1.0), 0.4));
        float s = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
        col += sunColor * (pow(s, 600.0) * 3.0 + pow(s, 12.0) * 0.35);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 16), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  mesh.name = 'Cielo';
  return mesh;
}

/**
 * Luz solar con sombras que sigue al jugador (la cámara de sombras cubre
 * solo el entorno cercano para mantener la resolución).
 */
export function createSun({ color = '#ffd2a1', intensity = 2.2, direction = new THREE.Vector3(-0.5, -0.8, 0.35), shadowSize = 45 }) {
  const sun = new THREE.DirectionalLight(color, intensity);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const s = shadowSize;
  Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 220 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  sun.userData.direction = direction.clone().normalize();
  return sun;
}

/** Recoloca el sol alrededor de un punto (el jugador). */
export function followSun(sun, p) {
  const d = sun.userData.direction;
  sun.target.position.set(p.x, p.y, p.z);
  sun.position.set(p.x - d.x * 100, p.y - d.y * 100, p.z - d.z * 100);
  sun.target.updateMatrixWorld();
}
