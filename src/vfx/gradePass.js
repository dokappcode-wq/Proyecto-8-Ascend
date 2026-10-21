import * as THREE from 'three';

/**
 * Gradación de color final (en espacio de pantalla, tras el mapeo de tonos):
 * contraste, saturación, tono de sombras y luces, viñeta y un grano muy
 * suave. Cada mapa puede ajustar su aspecto con `def.grade`.
 */
export const DEFAULT_GRADE = Object.freeze({
  contrast: 1.06,
  saturation: 1.08,
  shadows: '#1c2a44', // tono que tiñe las sombras
  highlights: '#ffe2bd', // tono que tiñe las luces
  split: 0.06,
  vignette: 0.32,
  grain: 0.012,
});

export const GradeShader = {
  name: 'GradeShader',
  uniforms: {
    tDiffuse: { value: null },
    contrast: { value: DEFAULT_GRADE.contrast },
    saturation: { value: DEFAULT_GRADE.saturation },
    shadowTint: { value: new THREE.Color(DEFAULT_GRADE.shadows) },
    highTint: { value: new THREE.Color(DEFAULT_GRADE.highlights) },
    split: { value: DEFAULT_GRADE.split },
    vignette: { value: DEFAULT_GRADE.vignette },
    grain: { value: DEFAULT_GRADE.grain },
    time: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float contrast; uniform float saturation; uniform float split;
    uniform vec3 shadowTint; uniform vec3 highTint;
    uniform float vignette; uniform float grain; uniform float time;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec4 tex = texture2D(tDiffuse, vUv);
      vec3 c = tex.rgb;
      c = (c - 0.5) * contrast + 0.5;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, saturation);
      c += (shadowTint - 0.5) * (1.0 - l) * split + (highTint - 0.5) * l * split * 0.7;
      vec2 q = vUv - 0.5;
      c *= clamp(1.0 - dot(q, q) * vignette * 2.0, 0.0, 1.0);
      c += (hash(vUv * 731.0 + fract(time) * 37.0) - 0.5) * grain;
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), tex.a);
    }`,
};

/** Aplica los valores de gradación de un mapa (lo que no se indique, por defecto). */
export function applyGrade(pass, grade = {}) {
  const g = { ...DEFAULT_GRADE, ...grade };
  const u = pass.uniforms;
  u.contrast.value = g.contrast;
  u.saturation.value = g.saturation;
  u.shadowTint.value.set(g.shadows);
  u.highTint.value.set(g.highlights);
  u.split.value = g.split;
  u.vignette.value = g.vignette;
  u.grain.value = g.grain;
}
