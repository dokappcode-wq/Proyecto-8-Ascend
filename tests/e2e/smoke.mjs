/**
 * Prueba de humo end-to-end con Playwright + Chromium.
 *
 *  1. Compila (vite build) y sirve el juego (vite preview).
 *  2. Abre el menú, entra en cada mapa, mueve al personaje con el teclado
 *     real (WASD, Shift, Espacio) y comprueba que se desplaza y salta.
 *  3. Recorre rutas de acceso a azoteas con un "bot" que conduce al mismo
 *     CharacterMotor del juego, para verificar que los recorridos diseñados
 *     son practicables con las físicas reales.
 *  4. Guarda capturas en tests/e2e/output/.
 *
 * Uso: npm run test:e2e
 */
import { chromium } from 'playwright';
import { spawn, execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = path.join(root, 'tests/e2e/output');
mkdirSync(out, { recursive: true });

const PORT = 4179;
let failures = 0;
const check = (cond, msg) => {
  console.log(`${cond ? '  ✓' : '  ✗'} ${msg}`);
  if (!cond) failures++;
};

execSync('npx vite build', { cwd: root, stdio: 'ignore' });
// En Windows, npx es un .cmd y necesita shell para lanzarse.
const isWin = process.platform === 'win32';
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'ignore', shell: isWin });
await new Promise((r) => setTimeout(r, 1500));

const launchOpts = { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] };
const browser = await chromium.launch(launchOpts);
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)/.test(m.text())) errors.push(m.text());
});

try {
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction(() => window.__ascend);
  // El ratón simulado de Playwright genera movimiento con el puntero bloqueado y
  // desviaría la cámara; en la prueba se bloquea solo el movimiento (los clics siguen llegando).
  await page.evaluate(() => window.addEventListener('mousemove', (e) => e.stopImmediatePropagation(), true));
  await page.screenshot({ path: path.join(out, '00-menu.png') });
  check(await page.isVisible('#screen-menu.active'), 'Menú principal visible');

  for (const mapId of ['campo', 'distrito']) {
    console.log(`\n[${mapId}]`);
    await page.click(`[data-map="${mapId}"]`);
    await page.waitForFunction(() => window.__ascend.state === 'playing');
    await page.waitForTimeout(1200);
    const st = () => page.evaluate(() => {
      const m = window.__ascend.player.motor;
      return { ...m.position, grounded: m.grounded, speed: m.horizontalSpeed, map: window.__ascend.mapManager.current?.def.id };
    });
    const s0 = await st();
    check(s0.map === mapId, `Mapa cargado: ${s0.map}`);
    check(s0.grounded, `Personaje apoyado en el suelo (y=${s0.y.toFixed(2)})`);
    await page.screenshot({ path: path.join(out, `${mapId}-01-spawn.png`) });

    // Caminar con W
    await page.keyboard.down('KeyW');
    // Espera a recorrer 1.5 m (el render por software puede ir a pocos FPS).
    await page.waitForFunction(([x, z]) => {
      const p = window.__ascend.player.motor.position;
      return Math.hypot(p.x - x, p.z - z) > 1.5;
    }, [s0.x, s0.z], { timeout: 10000 }).catch(() => {});
    const sWalk = await st();
    await page.keyboard.down('ShiftLeft');
    await page.waitForFunction(() => window.__ascend.player.motor.horizontalSpeed > 9, null, { timeout: 10000 }).catch(() => {});
    const sSprint = await st();
    await page.keyboard.up('ShiftLeft');
    await page.keyboard.up('KeyW');
    const moved = Math.hypot(sWalk.x - s0.x, sWalk.z - s0.z);
    check(moved > 1.5, `WASD desplaza al personaje (${moved.toFixed(2)} m)`);
    check(sSprint.speed > sWalk.speed + 2, `Sprint más rápido (${sWalk.speed.toFixed(1)} → ${sSprint.speed.toFixed(1)} m/s)`);

    // Salto
    await page.waitForTimeout(400);
    await page.keyboard.down('Space');
    await page.waitForTimeout(250);
    await page.keyboard.up('Space');
    const sJump = await st();
    check(!sJump.grounded && sJump.y > s0.y + 0.5, `Salto despega del suelo (y=${sJump.y.toFixed(2)})`);
    await page.screenshot({ path: path.join(out, `${mapId}-02-jump.png`) });
    await page.waitForTimeout(1200);
    check((await st()).grounded, 'Aterriza tras el salto');

    // Esquiva (Ctrl)
    await page.keyboard.press('ControlLeft');
    await page.waitForTimeout(100);
    const cd = await page.evaluate(() => window.__ascend.player.motor.dodgeCooldownRemaining);
    check(cd > 0, `Ctrl activa la esquiva (enfriamiento ${cd.toFixed(2)} s)`);

    // Poderes disponibles en este mapa (mismos sistemas)
    await page.evaluate(() => {
      window.__hits = 0;
      window.__ascend.events.on('projectile:hit', () => window.__hits++);
      window.__ascend.cameraController.pitch = -0.05;
    });
    const eBefore = await page.evaluate(() => window.__ascend.powers.energy.value);
    await page.mouse.down();
    await page.waitForTimeout(100);
    await page.mouse.up();
    await page.waitForTimeout(100);
    await page.waitForFunction(() => window.__ascend.projectiles.list.length === 0, null, { timeout: 15000 });
    const eAfter = await page.evaluate(() => window.__ascend.powers.energy.value);
    check(eAfter < eBefore, `Proyectil disparado en ${mapId} (energía ${eBefore.toFixed(0)} → ${eAfter.toFixed(0)})`);

    // Pausa y vuelta al menú
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.__ascend.state === 'paused');
    check(true, 'Esc abre el menú de pausa');
    await page.screenshot({ path: path.join(out, `${mapId}-03-pause.png`) });
    await page.click('#screen-pause [data-action="menu"]');
    await page.waitForFunction(() => window.__ascend.state === 'menu');
    check(true, 'Volver al menú');
  }

  // ---------------- Rutas con el bot ----------------
  console.log('\n[rutas]');
  await page.click('[data-map="distrito"]');
  await page.waitForFunction(() => window.__ascend.state === 'playing');
  await page.evaluate(() => {
    window.__bot = (start, waypoints, opts = {}) => {
      const g = window.__ascend;
      const m = g.player.motor;
      const w = g.world;
      m.teleport(start);
      const dt = 1 / 60;
      const idle = { moveX: 0, moveZ: 0, sprint: false, jump: false, dodge: false };
      for (let i = 0; i < 30; i++) m.update(dt, idle);
      let stuck = 0;
      const trace = [];
      for (const wp of waypoints) {
        let t = 0;
        while (t < 15) {
          const dx = wp.x - m.position.x;
          const dz = wp.z - m.position.z;
          const d = Math.hypot(dx, dz);
          if (d < 0.35 && (m.grounded || !wp.jump)) break;
          const ux = dx / d;
          const uz = dz / d;
          let jump = false;
          if (wp.jump && m.grounded && d > 0.8) {
            // Salta al llegar al borde o al chocar con un obstáculo.
            const ahead = w.groundHeight(m.position.x + ux * 0.6, m.position.z + uz * 0.6, 0.05, m.position.y + 0.45);
            if (ahead < m.position.y - 0.3) jump = true;
            if (m.horizontalSpeed < 1 && t > 0.2) stuck += dt; else stuck = 0;
            if (stuck > 0.1) jump = true;
          }
          const slow = d < 1.5 && !wp.jump ? 0.5 : 1;
          m.update(dt, { moveX: ux * slow, moveZ: uz * slow, sprint: !!wp.sprint, jump, dodge: false });
          t += dt;
        }
        for (let i = 0; i < 40; i++) m.update(dt, idle);
        trace.push(`(${m.position.x.toFixed(1)}, ${m.position.y.toFixed(2)}, ${m.position.z.toFixed(1)})`);
      }
      return { x: m.position.x, y: m.position.y, z: m.position.z, grounded: m.grounded, trace: trace.join(' → ') };
    };
  });
  const route = async (name, start, wps, expectY, shot) => {
    const r = await page.evaluate(([s, w]) => window.__bot(s, w), [start, wps]);
    const ok = r.grounded && Math.abs(r.y - expectY) < 0.35;
    check(ok, `${name}: y=${r.y.toFixed(2)} (esperado ≈ ${expectY}) en (${r.x.toFixed(1)}, ${r.z.toFixed(1)})`);
    if (!ok) console.log(`      traza: ${r.trace}`);
    if (shot) {
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(out, shot) });
    }
  };

  // B5 por la escalera de incendios (fachada oeste, x = 27)
  await route('Distrito · escalera B5 → azotea', { x: 26.2, y: 0.2, z: 46 }, [
    { x: 26.2, z: 38.6 }, { x: 24.6, z: 38.6 }, { x: 24.6, z: 43.8 }, { x: 26.2, z: 43.8 }, { x: 26.2, z: 38.6 }, { x: 31, z: 38.6 },
  ], 7, 'route-b5-roof.png');
  // B5 → B4 por pasarela y B4 → B3 → A2
  await route('Distrito · B5 → B4 → B3 → A2', { x: 38, y: 7.2, z: 33 }, [
    { x: 38, z: 27 }, { x: 38, z: 8 }, { x: 38, z: -8 }, { x: 38, z: -28 }, { x: 38, z: -36 }, { x: 29, z: -36 }, { x: 22, z: -36 },
  ], 6, 'route-b4-b3-a2.png');
  // B6 por la escalera hacia la plaza y cadena de pasarelas hasta B2
  await route('Distrito · escalera B6 → azotea', { x: -9, y: 0.2, z: 32.2 }, [
    { x: -1.6, z: 32.2 }, { x: -1.6, z: 30.6 }, { x: -6.8, z: 30.6 }, { x: -6.8, z: 32.2 }, { x: -1.6, z: 32.2 },
    { x: -1.6, z: 30.6 }, { x: -6.8, z: 30.6 }, { x: -6.8, z: 36 },
  ], 10);
  await route('Distrito · B6 → B7 → B8 → B1 → B2', { x: -8, y: 10.2, z: 42 }, [
    { x: -10, z: 42 }, { x: -30, z: 42 }, { x: -40, z: 36 }, { x: -40, z: 29 }, { x: -40, z: 8 }, { x: -36, z: 8 }, { x: -36, z: -8 }, { x: -42, z: -10 },
    { x: -42, z: -28 }, { x: -36, z: -44 }, { x: -28, z: -44 }, { x: -9, z: -44 }, { x: 0, z: -40 },
  ], 18, 'route-b2-roof.png');
  await route('Distrito · B1 por su escalera', { x: -26.2, y: 0.2, z: -43 }, [
    { x: -26.2, z: -35.7 }, { x: -24.6, z: -35.7 }, { x: -24.6, z: -41.8 }, { x: -26.2, z: -41.8 }, { x: -26.2, z: -35.7 },
    { x: -24.6, z: -35.7 }, { x: -24.6, z: -41.8 }, { x: -29, z: -41.8 },
  ], 12);
  await route('Distrito · A1 por contenedor y cajas', { x: -24, y: 0, z: -16.5 }, [
    { x: -26.5, z: -16.5, jump: true }, { x: -29.2, z: -16, jump: true }, { x: -30.5, z: -18.2, jump: true }, { x: -34, z: -18.5, jump: true },
  ], 5);
  await route('Distrito · A2 por el callejón', { x: 12.2, y: 0.2, z: -48 }, [
    { x: 12.2, z: -45, jump: true }, { x: 12.2, z: -42.4, jump: true }, { x: 12.2, z: -40.2, jump: true }, { x: 13.5, z: -38, jump: true }, { x: 18, z: -38, jump: true },
  ], 6);

  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__ascend.state === 'paused');
  await page.click('#screen-pause [data-action="menu"]');
  await page.waitForFunction(() => window.__ascend.state === 'menu');
  await page.click('[data-map="campo"]');
  await page.waitForFunction(() => window.__ascend.state === 'playing');
  await route('Campo · rampa 15°', { x: -20, y: 0.2, z: 2 }, [{ x: -20, z: -16 }], 2.68);
  await route('Campo · rampa 30°', { x: -26, y: 0.2, z: 2 }, [{ x: -26, z: -12 }], 3.46);
  await route('Campo · escalera 0.3 m', { x: -32, y: 0.2, z: 2 }, [{ x: -32, z: -10 }], 3);
  await route('Campo · peldaños 0.5 m con salto', { x: -38, y: 0.2, z: 1 }, [{ x: -38, z: -8, jump: true }], 2.5);
  await route('Campo · ruta ascendente', { x: 20, y: 0.2, z: 0 }, [
    { x: 22, z: -4, jump: true, sprint: true }, { x: 25.5, z: -8, jump: true, sprint: true }, { x: 29, z: -12, jump: true, sprint: true },
    { x: 32.5, z: -16, jump: true, sprint: true }, { x: 36, z: -20, jump: true, sprint: true }, { x: 40, z: -23.5, jump: true, sprint: true },
    { x: 44, z: -26.5, jump: true, sprint: true }, { x: 49.5, z: -26.5, jump: true, sprint: true }, { x: 56, z: -26.5, jump: true, sprint: true },
    { x: 63.5, z: -26.5, jump: true, sprint: true }, { x: 66, z: -25.5 }, { x: 66, z: -16 },
  ], 8.4, 'route-campo-top.png');
  await route('Campo · torre de acceso', { x: 63.4, y: 0.2, z: -14 }, [
    { x: 63.8, z: -12.2 }, { x: 67.8, z: -12.2 }, { x: 67.8, z: -10.6 }, { x: 62.2, z: -10.6 }, { x: 62.2, z: -12.2 }, { x: 63.8, z: -12.2 },
    { x: 67.8, z: -12.2 }, { x: 67.8, z: -14.5 },
  ], 8.4);
  await route('Campo · salto de 6 m con sprint', { x: -48, y: 1.2, z: 9 }, [{ x: -58, z: 9, jump: true, sprint: true }], 1);

  // ---------------- Poderes de Energía (Etapa 2) ----------------
  console.log('\n[poderes]');
  await page.evaluate(() => {
    // Orienta la cámara para que el centro de la pantalla apunte a `p`.
    window.__aimAt = (p) => {
      const g = window.__ascend;
      const cc = g.cameraController;
      for (let i = 0; i < 6; i++) {
        g.player.update(0);
        cc.update(1 / 60, g.player.motor.position, false);
        const c = g.camera.position;
        const dx = p.x - c.x;
        const dy = p.y - c.y;
        const dz = p.z - c.z;
        cc.yaw = Math.atan2(-dx, -dz);
        cc.pitch = Math.atan2(dy, Math.hypot(dx, dz));
      }
      cc.update(1 / 60, g.player.motor.position, false);
    };
    window.__place = (pos, target) => {
      const g = window.__ascend;
      g.player.spawnAt({ ...pos, yaw: Math.atan2(target.x - pos.x, target.z - pos.z) });
      for (let i = 0; i < 20; i++) g.player.motor.update(1 / 60, { moveX: 0, moveZ: 0 });
      window.__aimAt(target);
    };
  });
  const g = (fn, arg) => page.evaluate(fn, arg);
  check(await g(() => window.__ascend.powers.available), 'La marca de Energía está activa (concedida por depuración hasta la Etapa 4)');
  check(await page.isVisible('#hud-power'), 'HUD de energía visible');

  // Proyectil contra un maniquí
  await g(() => window.__ascend.mapManager.resetEntities());
  await g(() => window.__place({ x: -46, y: 0.2, z: -50 }, { x: -46, y: 1.2, z: -58 }));
  const e0 = await g(() => window.__ascend.powers.energy.value);
  await page.mouse.down();
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(150);
    await g(() => window.__aimAt({ x: -46, y: 1.2, z: -58 }));
  }
  await page.mouse.up();
  await page.waitForTimeout(500);
  const dummy = await g(() => {
    const d = window.__ascend.mapManager.current.entities.find((e) => e.maxHealth && Math.abs(e.base.x + 46) < 0.1);
    return { health: d.health, alive: d.alive };
  });
  const e1 = await g(() => window.__ascend.powers.energy.value);
  check(dummy.health < 100, `El proyectil daña al maniquí (salud ${dummy.health}/100)`);
  check(e1 < e0, `Disparar consume energía (${e0.toFixed(0)} → ${e1.toFixed(0)})`);
  const floaters = await g(() => document.querySelectorAll('#hud-floaters .floater').length);
  await page.screenshot({ path: path.join(out, 'powers-01-projectile.png') });
  check(floaters > 0, `Indicadores de daño en pantalla (${floaters})`);

  // Descarga concentrada: mantener R y soltar
  await g(() => window.__ascend.mapManager.resetEntities());
  await g(() => { window.__ascend.powers.resetAbilities(); window.__ascend.powers.energy.refill(); });
  await g(() => window.__place({ x: -41, y: 0.2, z: -50 }, { x: -41, y: 1.2, z: -58 }));
  await page.keyboard.down('KeyR');
  await page.waitForTimeout(500);
  const charging = await g(() => ({ c: window.__ascend.powers.isCharging, ring: document.getElementById('hud-charge').classList.contains('show') }));
  await g(() => { const pw = window.__ascend.powers; if (pw.charge) pw.charge.time = 2; });
  await g(() => window.__aimAt({ x: -41, y: 1.2, z: -58 }));
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(out, 'powers-02-charge.png') });
  await page.keyboard.up('KeyR');
  await page.waitForTimeout(800);
  const d2 = await g(() => window.__ascend.mapManager.current.entities.find((e) => e.maxHealth && Math.abs(e.base.x + 41) < 0.1).health);
  check(charging.c && charging.ring, 'Mantener R carga la descarga (anillo de carga visible)');
  check(d2 <= 100 - 50, `La descarga completa inflige daño alto (salud ${d2}/100)`);

  // Onda expansiva contra objetos físicos
  await g(() => { window.__ascend.mapManager.resetEntities(); window.__ascend.powers.resetAbilities(); window.__ascend.powers.energy.refill(); });
  await g(() => window.__place({ x: -64, y: 0.2, z: -68.2 }, { x: -67, y: 0.5, z: -70 }));
  const before = await g(() => window.__ascend.mapManager.current.entities.filter((e) => e.mass).map((e) => ({ ...e.pos })));
  await page.keyboard.press('KeyG');
  let lvl = 0;
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(60);
    lvl = Math.max(lvl, await g(() => window.__ascend.marks.level));
    if (i === 1) await page.screenshot({ path: path.join(out, 'powers-03-wave.png') });
  }
  await page.waitForTimeout(1000);
  const after = await g(() => window.__ascend.mapManager.current.entities.filter((e) => e.mass).map((e) => ({ ...e.pos })));
  const movedProps = after.filter((p, i) => Math.hypot(p.x - before[i].x, p.z - before[i].z) > 0.5).length;
  check(movedProps >= 3, `La onda expansiva desplaza los objetos cercanos (${movedProps} movidos)`);
  check(lvl > 0.6, `Los patrones de la marca se intensifican con la onda (nivel ${lvl.toFixed(2)})`);
  await page.waitForTimeout(2500);
  const lvlLater = await g(() => window.__ascend.marks.level);
  check(lvlLater < 0.15, `El brillo de la marca decae después (nivel ${lvlLater.toFixed(2)})`);
  const waveCd = await g(() => window.__ascend.powers.abilities.wave.cooldown);
  check(waveCd > 0, `La onda tiene tiempo de reutilización (${waveCd.toFixed(1)} s restantes)`);

  // Dash energético
  await g(() => { window.__ascend.powers.resetAbilities(); window.__ascend.powers.energy.refill(); });
  await g(() => window.__ascend.player.spawnAt({ x: 0, y: 0.3, z: 18, yaw: Math.PI }));
  await page.waitForTimeout(300);
  const p0 = await g(() => ({ ...window.__ascend.player.motor.position }));
  await page.keyboard.press('KeyQ');
  await page.waitForFunction(() => window.__ascend.powers.abilities.dash.cooldown > 0, null, { timeout: 5000 });
  await page.waitForFunction(() => !window.__ascend.player.motor.isBursting && window.__ascend.player.motor.horizontalSpeed < 0.1, null, { timeout: 5000 });
  const p1 = await g(() => ({ ...window.__ascend.player.motor.position }));
  const dashE = await g(() => window.__ascend.powers.energy.value);
  check(Math.hypot(p1.x - p0.x, p1.z - p0.z) > 3, `Q ejecuta el dash (${Math.hypot(p1.x - p0.x, p1.z - p0.z).toFixed(1)} m)`);
  check(dashE < 100, `El dash consume energía (${dashE.toFixed(0)})`);

  // Prueba de alcance: 40 m impacta, 50 m no
  await g(() => { window.__ascend.mapManager.resetEntities(); window.__ascend.powers.energy.refill(); });
  for (const [dist, dz, expectHit] of [[40, 1, true], [50, 3.5, false]]) {
    const tx = -80 + dist;
    const tz = -79 + dz;
    await g(([t, z]) => window.__place({ x: -80, y: 0.2, z: -79 }, { x: t, y: 1.6, z }), [tx, tz]);
    await page.mouse.down();
    await page.waitForTimeout(150);
    await page.mouse.up();
    await page.waitForTimeout(100);
    // Espera a que todos los proyectiles impacten o caduquen (el render por software va más lento que el tiempo real).
    await page.waitForFunction(() => window.__ascend.projectiles.list.length === 0, null, { timeout: 15000 });
    const hits = await g(([t, z]) => window.__ascend.mapManager.current.entities.find((e) => e.hits !== undefined && Math.abs(e.center.x - t) < 0.1 && Math.abs(e.center.z - z) < 0.1).hits, [tx, tz]);
    check(expectHit ? hits > 0 : hits === 0, `Alcance: diana a ${dist} m ${expectHit ? 'recibe' : 'no recibe'} impactos (${hits})`);
  }

  // Menú de depuración: desactivar la marca bloquea los poderes
  await page.keyboard.press('F2');
  await page.waitForFunction(() => window.__ascend.ui.currentScreen === 'debug');
  await page.screenshot({ path: path.join(out, 'powers-04-debug.png') });
  await page.click('#screen-debug [data-action="dbg-mark"]');
  const off = await g(() => window.__ascend.powers.available);
  await page.click('#screen-debug [data-action="resume"]');
  await page.waitForFunction(() => window.__ascend.state === 'playing');
  const eOff0 = await g(() => window.__ascend.powers.energy.value);
  await page.keyboard.press('KeyG');
  await page.waitForTimeout(300);
  const usedWhileOff = await g(() => window.__ascend.powers.abilities.wave.cooldown > 0);
  check(!off && !(await page.isVisible('#hud-power')) && !usedWhileOff, 'Sin la marca de Energía no hay poderes ni HUD de energía');
  check((await g(() => window.__ascend.powers.energy.value)) === eOff0, 'Sin la marca no se gasta energía');
  await page.keyboard.press('F2');
  await page.waitForFunction(() => window.__ascend.ui.currentScreen === 'debug');
  await page.click('#screen-debug [data-action="dbg-mark"]');
  await page.click('#screen-debug [data-action="dbg-maxmarks"]');
  await page.click('#screen-debug [data-action="dbg-teleport"][data-wp="F"]');
  await page.waitForFunction(() => window.__ascend.state === 'playing');
  await page.waitForTimeout(800);
  check(await g(() => window.__ascend.powers.available && window.__ascend.marks.level > 0.9), 'Reactivar marca y "marcas al máximo" desde depuración');
  await g(() => {
    const cc = window.__ascend.cameraController;
    cc.yaw = window.__ascend.player.facing;
    cc.pitch = -0.1;
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(out, 'powers-05-marks-zoneF.png') });
  await page.keyboard.press('F2');
  await page.waitForFunction(() => window.__ascend.ui.currentScreen === 'debug');
  await page.click('#screen-debug [data-action="dbg-maxmarks"]');
  await page.click('#screen-debug [data-action="resume"]');
  await page.waitForFunction(() => window.__ascend.state === 'playing');

  // Reiniciar mapa desde la pausa
  await page.evaluate(() => window.__ascend.player.motor.teleport({ x: 30, y: 0.3, z: 30 }));
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__ascend.state === 'paused');
  await page.click('#screen-pause [data-action="restart"]');
  await page.waitForFunction(() => window.__ascend.state === 'playing');
  await page.waitForTimeout(500);
  const back = await page.evaluate(() => ({ ...window.__ascend.player.motor.position }));
  check(Math.hypot(back.x - 0, back.z - 18) < 0.5, 'Reiniciar mapa devuelve al punto de inicio');

  // Ajustes persistentes
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__ascend.state === 'paused');
  await page.click('#screen-pause [data-action="settings"]');
  await page.locator('#set-fov').fill('82');
  await page.click('#set-invert');
  await page.click('#screen-settings [data-action="settings-back"]');
  check(await page.isVisible('#screen-pause.active'), 'Ajustes vuelve a la pausa');
  await page.reload();
  await page.waitForFunction(() => window.__ascend);
  const saved = await page.evaluate(() => window.__ascend.save.settings);
  check(saved.fov === 82 && saved.invertY === true, `Ajustes guardados tras recargar (FOV ${saved.fov}, invertir Y ${saved.invertY})`);

  check(errors.length === 0, `Sin errores en consola${errors.length ? `: ${errors.join(' | ')}` : ''}`);
} finally {
  await browser.close();
  if (isWin) spawn('taskkill', ['/pid', String(server.pid), '/T', '/F'], { shell: true });
  else server.kill();
}

console.log(failures ? `\n${failures} comprobación(es) fallida(s)` : '\nTodas las comprobaciones superadas');
process.exit(failures ? 1 : 0);
