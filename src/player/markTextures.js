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
