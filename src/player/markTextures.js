import * as THREE from 'three';

/**
 * Genera texturas de símbolos de marca mediante canvas (sin recursos externos).
 * Los símbolos son diseños originales y provisionales.
 */
const cache = new Map();

export function markSymbolTexture(symbol, color) {
  const key = `${symbol}:${color}`;
  if (cache.has(key)) return cache.get(key);

  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.clearRect(0, 0, size, size);
  g.strokeStyle = color;
  g.fillStyle = color;
  g.lineWidth = 7;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.shadowColor = color;
  g.shadowBlur = 12;
  const m = size / 2;

  if (symbol === 'destino') {
    // Anillo abierto con tres trazos que convergen en un punto: caminos que
    // se unen en un mismo destino.
    g.beginPath();
    g.arc(m, m, 44, Math.PI * 0.62, Math.PI * 2.38);
    g.stroke();
    for (const a of [-Math.PI / 2, Math.PI / 6, (5 * Math.PI) / 6]) {
      g.beginPath();
      g.moveTo(m + Math.cos(a) * 36, m + Math.sin(a) * 36);
      g.lineTo(m + Math.cos(a) * 12, m + Math.sin(a) * 12);
      g.stroke();
    }
    g.beginPath();
    g.arc(m, m, 7, 0, Math.PI * 2);
    g.fill();
  } else if (symbol === 'energia') {
    // Rombo con un rayo interior.
    g.beginPath();
    g.moveTo(m, 10);
    g.lineTo(size - 22, m);
    g.lineTo(m, size - 10);
    g.lineTo(22, m);
    g.closePath();
    g.stroke();
    g.beginPath();
    g.moveTo(m + 8, 30);
    g.lineTo(m - 10, m + 4);
    g.lineTo(m + 10, m - 4);
    g.lineTo(m - 8, size - 30);
    g.stroke();
  } else if (symbol === 'temperatura') {
    // Dos medias lunas enfrentadas (frío y calor) con un copo y una llama
    const grad = g.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0, color === '#ffffff' ? '#ffffff' : '#2ee6d6');
    grad.addColorStop(1, color === '#ffffff' ? '#ffffff' : '#ff8a2a');
    g.strokeStyle = grad;
    g.fillStyle = grad;
    g.beginPath();
    g.arc(m, m, 42, Math.PI * 0.55, Math.PI * 1.45);
    g.stroke();
    g.beginPath();
    g.arc(m, m, 42, -Math.PI * 0.45, Math.PI * 0.45);
    g.stroke();
    for (let k = 0; k < 3; k++) {
      const a0 = (k / 3) * Math.PI;
      g.beginPath();
      g.moveTo(m - 22 + Math.cos(a0) * 12, m + Math.sin(a0) * 12);
      g.lineTo(m - 22 - Math.cos(a0) * 12, m - Math.sin(a0) * 12);
      g.stroke();
    }
    g.beginPath();
    g.moveTo(m + 22, m - 18);
    g.quadraticCurveTo(m + 34, m + 2, m + 22, m + 16);
    g.quadraticCurveTo(m + 10, m + 2, m + 22, m - 18);
    g.fill();
  } else if (symbol === 'hilo') {
    // Un hilo que se enrolla en tres lazos alrededor de un nudo central
    for (let k = 0; k < 3; k++) {
      const a0 = (k / 3) * Math.PI * 2 - Math.PI / 2;
      g.beginPath();
      g.ellipse(m + Math.cos(a0) * 22, m + Math.sin(a0) * 22, 26, 11, a0, 0, Math.PI * 2);
      g.stroke();
    }
    g.beginPath();
    g.arc(m, m, 8, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(m + 8, m + 6);
    g.quadraticCurveTo(m + 40, m + 30, size - 10, size - 8);
    g.stroke();
  } else if (symbol === 'gravedad') {
    // Órbita inclinada alrededor de un núcleo y flecha hacia abajo: lo que
    // atrae y lo que cae.
    g.beginPath();
    g.ellipse(m, m, 46, 20, -0.35, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.arc(m, m, 13, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(m, 16);
    g.lineTo(m, m - 22);
    g.moveTo(m, m + 22);
    g.lineTo(m, size - 14);
    g.moveTo(m - 12, size - 28);
    g.lineTo(m, size - 14);
    g.lineTo(m + 12, size - 28);
    g.stroke();
  } else if (symbol === 'alas') {
    // Dos alas abiertas: tres plumas largas a cada lado de un punto central
    for (const sx of [-1, 1]) {
      for (let k = 0; k < 3; k++) {
        g.beginPath();
        g.moveTo(m + sx * 8, m + 4);
        g.quadraticCurveTo(m + sx * (26 + k * 8), m - 34 + k * 14, m + sx * (52 - k * 4), m - 18 + k * 18);
        g.stroke();
      }
    }
    g.beginPath();
    g.arc(m, m + 6, 8, 0, Math.PI * 2);
    g.fill();
  } else {
    g.beginPath();
    g.arc(m, m, 40, 0, Math.PI * 2);
    g.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, tex);
  return tex;
}
