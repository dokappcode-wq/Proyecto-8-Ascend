
(() => {
  const map = document.querySelector('svg.map');
  document.querySelectorAll('[data-layer]').forEach((b) => {
    b.addEventListener('click', () => {
      const on = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', on);
      map.querySelectorAll('.' + b.dataset.layer).forEach((g) => { g.style.display = on ? '' : 'none'; });
    });
  });
  const dlg = document.getElementById('viewer');
  const body = dlg.querySelector('.vbody');
  const title = dlg.querySelector('.t');
  let zoom = 1, svg = null;
  const apply = () => { if (svg) svg.style.width = (body.clientWidth - 2) * zoom + 'px'; };
  const open = (src, name) => {
    body.innerHTML = '';
    svg = src.cloneNode(true);
    svg.style.minWidth = '0';
    body.appendChild(svg);
    title.textContent = name;
    zoom = 1;
    dlg.showModal();
    apply();
  };
  document.querySelectorAll('[data-zoom]').forEach((b) => {
    b.addEventListener('click', () => open(b.closest('figure').querySelector('svg'), b.dataset.zoom));
  });
  const setZoom = (z) => {
    const cx = (body.scrollLeft + body.clientWidth / 2) / (svg.clientWidth || 1);
    const cy = (body.scrollTop + body.clientHeight / 2) / (svg.clientHeight || 1);
    zoom = Math.max(1, Math.min(6, z));
    apply();
    body.scrollLeft = cx * svg.clientWidth - body.clientWidth / 2;
    body.scrollTop = cy * svg.clientHeight - body.clientHeight / 2;
  };
  dlg.querySelector('[data-z="in"]').addEventListener('click', () => setZoom(zoom * 1.6));
  dlg.querySelector('[data-z="out"]').addEventListener('click', () => setZoom(zoom / 1.6));
  dlg.querySelector('[data-z="close"]').addEventListener('click', () => dlg.close());
  let drag = null;
  body.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, l: body.scrollLeft, t: body.scrollTop }; });
  window.addEventListener('pointerup', () => { drag = null; });
  body.addEventListener('pointermove', (e) => {
    if (!drag) return;
    body.scrollLeft = drag.l - (e.clientX - drag.x);
    body.scrollTop = drag.t - (e.clientY - drag.y);
  });
  window.addEventListener('resize', apply);
})();
