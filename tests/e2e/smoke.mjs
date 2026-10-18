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
// detached: el servidor queda en su propio grupo de procesos para poder cerrarlo entero al terminar.
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'ignore', shell: isWin, detached: !isWin });
await new Promise((r) => setTimeout(r, 1500));

const launchOpts = { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] };
const browser = await chromium.launch(launchOpts);
// Un contexto compartido: las pestañas nuevas conservan el guardado (localStorage).
// 960×540: suficiente para las capturas y bastante más rápido con render por software.
const context = await browser.newContext({ viewport: { width: 960, height: 540 } });
const errors = [];
let page = null;
/**
 * Abre una pestaña nueva (y cierra la anterior). Con render por software la
 * memoria del navegador crece durante una prueba tan larga; renovar la pestaña
 * a mitad de la batería la libera.
 */
async function freshPage() {
  const old = page;
  page = await context.newPage();
  // El render por software puede ir muy lento si la máquina está cargada.
  page.setDefaultTimeout(90000);
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)/.test(m.text())) errors.push(m.text());
  });
  if (old) await old.close();
  return page;
}
await freshPage();

try {
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction(() => window.__ascend);
  // El ratón simulado de Playwright genera movimiento con el puntero bloqueado y
  // desviaría la cámara; en la prueba se bloquea solo el movimiento (los clics siguen llegando).
  await page.evaluate(() => window.addEventListener('mousemove', (e) => e.stopImmediatePropagation(), true));
  await page.screenshot({ path: path.join(out, '00-menu.png') });
  check(await page.isVisible('#screen-menu.active'), 'Menú principal visible');

  // ---------------- Adquisición de la marca de Energía (Etapa 4) ----------------
  console.log('\n[adquisición]');
  await page.click('[data-map="campo"]');
  await page.waitForFunction(() => window.__ascend.state === 'playing');
  await page.evaluate(() => {
    const a = window.__ascend;
    window.__acq = [];
    for (const ev of ['acquisition:contact', 'acquisition:failed', 'acquisition:rejected', 'mark:acquired']) a.events.on(ev, (d) => window.__acq.push({ ev, reason: d.reason ?? null }));
  });
  const q = (fn, arg) => page.evaluate(fn, arg);
  check(!(await q(() => window.__ascend.powers.available)) && !(await page.isVisible('#hud-power')), 'Al empezar no hay marca de Energía ni poderes');
  // Regla II: un Acólito no es una fuente válida
  await q(() => window.__ascend.acquisition.beginContact({ source: { kind: 'acolyte', markId: 'energia', name: 'Acólito de Energía' }, position: { x: 0, y: 0, z: 0 } }));
  check(await q(() => window.__acq.some((e) => e.ev === 'acquisition:rejected' && e.reason === 'not-original')), 'Regla II: copiar a un Acólito se rechaza (no posee marca original)');
  // Contacto con la Encarnación
  await q(() => window.__ascend.player.spawnAt({ x: 15, y: 0.4, z: -60.4, yaw: Math.PI }));
  await page.waitForFunction(() => /establecer contacto/.test(document.getElementById('hud-prompt').textContent) && document.getElementById('hud-prompt').classList.contains('show'), null, { timeout: 8000 }).catch(() => {});
  check(await page.isVisible('#hud-prompt'), 'Junto a la Encarnación aparece «E: establecer contacto»');
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => window.__ascend.acquisition.state === 'contact', null, { timeout: 5000 }).catch(() => {});
  check(await q(() => window.__ascend.acquisition.state === 'contact'), 'E establece el contacto');
  // Regla III: soltar antes de completar la voluntad no copia la marca
  await page.keyboard.down('KeyE');
  await page.waitForFunction(() => window.__ascend.acquisition.will > 0.25, null, { timeout: 15000 }).catch(() => {});
  await page.keyboard.up('KeyE');
  await page.waitForFunction(() => window.__ascend.acquisition.state === 'idle', null, { timeout: 5000 }).catch(() => {});
  const r3 = await q(() => ({ failed: window.__acq.find((e) => e.ev === 'acquisition:failed')?.reason, owned: window.__ascend.save.data.profile.marks.includes('energia') }));
  check(r3.failed === 'no-will' && !r3.owned, `Regla III: el contacto sin voluntad completa no copia la marca (${r3.failed})`);
  // Voluntad completa → copia
  await page.waitForTimeout(300);
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => window.__ascend.acquisition.state === 'contact', null, { timeout: 5000 }).catch(() => {});
  await page.keyboard.down('KeyE');
  await page.waitForFunction(() => window.__ascend.acquisition.state === 'copying', null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(out, 'marks-01-copying.png') });
  await page.waitForFunction(() => window.__acq.some((e) => e.ev === 'mark:acquired'), null, { timeout: 20000 }).catch(() => {});
  await page.keyboard.up('KeyE');
  await page.waitForTimeout(300);
  const got = await q(() => ({
    owned: window.__ascend.save.data.profile.marks.includes('energia'), av: window.__ascend.powers.available,
    npcPower: window.__ascend.mapManager.current.entities.find((e) => e.source)?.hasPower,
    npcFx: (() => { let n = 0; window.__ascend.mapManager.current.entities.find((e) => e.source)?.model.root.traverse((o) => { if (o.isLight || o.isPoints) n++; }); return n; })(),
    toast: document.getElementById('hud-toast').textContent,
  }));
  check(got.owned && got.av && (await page.isVisible('#hud-power')), 'Mantener E completa la voluntad: marca de Energía adquirida y poderes disponibles');
  check(got.npcPower === true, 'Regla IV: la Encarnación conserva su marca y su poder');
  check(got.npcFx === 0, `La Encarnación parece una persona normal: sin luces ni aura (${got.npcFx})`);
  await page.screenshot({ path: path.join(out, 'marks-02-acquired.png') });
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(300);
  check(await q(() => window.__acq.some((e) => e.ev === 'acquisition:rejected' && e.reason === 'already-owned')), 'No se puede copiar dos veces la misma marca');
  // Menú de marcas (Tab) y progresión
  await q(() => window.__ascend.combat.applyDamage([...window.__ascend.combat.targets].find((t) => t.maxHealth), 500, { faction: 'player' }));
  const xp = await q(() => window.__ascend.progression.state('energia').xp);
  check(xp === 5, `Neutralizar un maniquí da experiencia de Energía (${xp} EXP)`);
  const lvlUp = await q(() => {
    const a = window.__ascend;
    const max0 = a.powers.energy.max;
    a._awardXp('acolyte');
    a._awardXp('acolyte');
    return { max0, max: a.powers.energy.max, level: a.progression.state('energia').level };
  });
  check(lvlUp.level === 2 && lvlUp.max === lvlUp.max0 + 15, `Subir a nivel ${lvlUp.level} amplía la energía máxima (${lvlUp.max0} → ${lvlUp.max})`);
  await q(() => { window.__ascend.progression.state('energia').points += 1; });
  await page.keyboard.press('Tab');
  await page.waitForFunction(() => window.__ascend.ui.currentScreen === 'marks', null, { timeout: 5000 }).catch(() => {});
  const marksText = await q(() => document.getElementById('marks-body').textContent);
  await page.screenshot({ path: path.join(out, 'marks-03-menu.png') });
  check(/Marca del Destino/.test(marksText) && /Marca de la Energía/.test(marksText) && /Copiada/.test(marksText), 'Tab abre el menú de marcas (Destino original + Energía copiada)');
  await page.click('#screen-marks [data-action="unlock-node"][data-node="cargador"]');
  const magSize = await q(() => window.__ascend.powers.magazine.size);
  check(magSize === 15, `Desbloquear «Cargador ampliado» amplía el cargador a ${magSize}`);
  await page.keyboard.press('Tab');
  await page.waitForFunction(() => window.__ascend.state === 'playing', null, { timeout: 5000 }).catch(() => {});
  // Persistencia: recargar la página conserva marca y progreso
  await page.reload();
  await page.waitForFunction(() => window.__ascend);
  await page.evaluate(() => window.addEventListener('mousemove', (e) => e.stopImmediatePropagation(), true));
  const persisted = await q(() => ({ owned: window.__ascend.save.data.profile.marks.includes('energia'), unlocked: window.__ascend.progression.state('energia').unlocked }));
  check(persisted.owned && persisted.unlocked.includes('cargador'), 'La marca y las mejoras se conservan al recargar la página');
  // El resto de pruebas usa la configuración base (sin mejoras)
  await q(() => { const a = window.__ascend; a.progression.state('energia').unlocked = []; a.save.save(); a.powers.applyModifiers(a.progression.modifiers('energia')); a.powers.resetAbilities(); });

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

    // Salto (esperas por condición: el render por software puede ir muy lento)
    await page.waitForFunction(() => window.__ascend.player.motor.grounded, null, { timeout: 15000 }).catch(() => {});
    const yGround = (await st()).y;
    await page.keyboard.down('Space');
    await page.waitForFunction((y0) => !window.__ascend.player.motor.grounded && window.__ascend.player.motor.position.y > y0 + 0.5, yGround, { timeout: 15000 }).catch(() => {});
    const sJump = await st();
    await page.keyboard.up('Space');
    check(!sJump.grounded && sJump.y > yGround + 0.5, `Salto despega del suelo (y=${sJump.y.toFixed(2)})`);
    await page.screenshot({ path: path.join(out, `${mapId}-02-jump.png`) });
    await page.waitForFunction(() => window.__ascend.player.motor.grounded, null, { timeout: 15000 }).catch(() => {});
    check((await st()).grounded, 'Aterriza tras el salto');

    // Esquiva (Ctrl)
    await page.keyboard.press('ControlLeft');
    await page.waitForFunction(() => window.__ascend.player.motor.dodgeCooldownRemaining > 0, null, { timeout: 5000 }).catch(() => {});
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
    await page.waitForFunction((e0) => window.__ascend.powers.energy.value < e0, eBefore, { timeout: 20000 }).catch(() => {});
    await page.mouse.up();
    await page.waitForFunction(() => window.__ascend.projectiles.list.length === 0, null, { timeout: 60000 });
    const eAfter = await page.evaluate(() => window.__ascend.powers.energy.value);
    check(eAfter < eBefore, `Proyectil disparado en ${mapId} (energía ${eBefore.toFixed(0)} → ${eAfter.toFixed(0)})`);
    if (eAfter >= eBefore) {
      console.log('      estado:', JSON.stringify(await page.evaluate(() => {
        const a = window.__ascend;
        return { av: a.powers.available, dis: a.player.disabled, acq: a.acquisition.state, aim: a.player.aiming, chg: a.powers.isCharging, tgt: a.powers.isTargeting, mag: a.powers.magazine.ammo, rel: a.powers.magazine.reloading, cd: a.powers.abilities.projectile.cooldown, inf: a.powers.energy.infinite, down: [...a.input._down], state: a.state, dead: a.playerCombat.dead };
      })));
    }

    // Pausa y vuelta al menú
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.__ascend.state === 'paused');
    check(true, 'Esc abre el menú de pausa');
    await page.screenshot({ path: path.join(out, `${mapId}-03-pause.png`) });
    await page.click('#screen-pause [data-action="menu"]');
    await page.waitForFunction(() => window.__ascend.state === 'menu');
    check(true, 'Volver al menú');
    // Depuración de la propia prueba: E2E_STOP=campo termina aquí
    if (process.env.E2E_STOP === mapId) throw new Error(`E2E_STOP=${mapId}`);
  }

  // ---------------- Rutas con el bot ----------------
  console.log('\n[rutas]');
  await freshPage();
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction(() => window.__ascend);
  await page.evaluate(() => window.addEventListener('mousemove', (e) => e.stopImmediatePropagation(), true));
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
          if (m.events.parkour) (window.__pk ??= []).push(m.events.parkour);
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
  // Etapa 5: escalando la fachada sur de B6 desde la acera
  await route('Distrito · fachada de B6 escalando', { x: 9, y: 0.2, z: 30.5 }, [{ x: 9, z: 34.5, jump: true }], 10);

  // ---------------- Distrito Cero: reputación y misión (Etapa 6) ----------------
  console.log('\n[distrito · etapa 6]');
  await q(() => { const a = window.__ascend; a.save.data.debug.invulnerable = false; a.playerCombat.restore(); });
  const s6D0 = await q(() => {
    const a = window.__ascend;
    return {
      enemies: a.enemies.list.filter((e) => e.tag === 'distrito').map((e) => e.type.id).sort().join(','),
      pdc: a.factions.pdcLevel.id, mission: a.missions.mission?.state,
      panel: document.getElementById('hud-mission').textContent, faction: document.getElementById('hud-faction').textContent,
    };
  });
  check(s6D0.enemies === 'acolyte,pdc,pdc', `El barrio tiene una patrulla PDC y un Acólito (${s6D0.enemies})`);
  check(s6D0.pdc === 'calm' && /Tranquila/.test(s6D0.faction), `La PDC empieza tranquila (${s6D0.pdc})`);
  check(s6D0.mission === 'inactive' && /teléfono público/i.test(s6D0.panel), 'La misión espera a activarse en el teléfono público');
  // Delante de un agente: le ve pero no ataca
  const placeInFront = () => q(() => {
    const a = window.__ascend;
    const e = a.enemies.list.find((x) => x.tag === 'distrito' && x.type.id === 'pdc' && x.alive);
    e.patrol = [{ x: e.position.x, z: e.position.z }];
    const f = { x: Math.sin(e.facing), z: Math.cos(e.facing) };
    a.player.spawnAt({ x: e.position.x + f.x * 7, y: e.position.y + 0.1, z: e.position.z + f.z * 7, yaw: e.facing });
    window.__watchE = e;
  });
  await placeInFront();
  await page.waitForFunction(() => window.__watchE.seesPlayer, null, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const s6Calm = await q(() => ({ sees: window.__watchE.seesPlayer, st: window.__watchE.brain.state, hp: window.__ascend.playerCombat.health.value }));
  check(s6Calm.sees && s6Calm.st === 'patrol' && s6Calm.hp === 100, `Tranquila: el agente le ve y no ataca (${s6Calm.st}, salud ${s6Calm.hp})`);
  // Usar poderes delante de la PDC: vigilante (le observa sin disparar)
  await page.mouse.down();
  await page.waitForTimeout(300);
  await page.mouse.up();
  // (una detección por segundo como mucho)
  await page.waitForFunction(() => window.__ascend.factions._powerSeenCd === 0, null, { timeout: 8000 }).catch(() => {});
  await page.mouse.down();
  await page.waitForTimeout(300);
  await page.mouse.up();
  await page.waitForTimeout(1200);
  const s6Watch = await q(() => ({ lvl: window.__ascend.factions.pdcLevel.id, w: window.__watchE.watching, st: window.__watchE.brain.state, hp: window.__ascend.playerCombat.health.value }));
  await page.screenshot({ path: path.join(out, 'district-01-watchful.png') });
  check(s6Watch.lvl === 'watchful' && s6Watch.w && s6Watch.st === 'patrol' && s6Watch.hp === 100, `Usar poderes a la vista: la PDC pasa a vigilante y observa sin disparar (${s6Watch.lvl}, ${s6Watch.st})`);
  // Atacar a un agente: hostil, todos los agentes reaccionan
  await q(() => window.__ascend.combat.applyDamage(window.__watchE, 10, { faction: 'player' }));
  await page.waitForFunction(() => window.__ascend.enemies.list.filter((e) => e.type.faction === 'pdc').every((e) => e.brain.state !== 'patrol'), null, { timeout: 8000 }).catch(() => {});
  const s6Hostile = await q(() => ({ lvl: window.__ascend.factions.pdcLevel.id, st: window.__ascend.enemies.list.filter((e) => e.type.faction === 'pdc').map((e) => e.brain.state).join(','), hud: document.getElementById('hud-faction').textContent }));
  check(s6Hostile.lvl === 'hostile' && !/patrol/.test(s6Hostile.st) && /Hostil/.test(s6Hostile.hud), `Atacar a un agente vuelve hostil a la PDC y los agentes reaccionan (${s6Hostile.st})`);
  await page.waitForFunction(() => window.__watchE.brain.state === 'attack', null, { timeout: 8000 }).catch(() => {});
  check(await q(() => window.__watchE.brain.state === 'attack'), 'La PDC hostil ataca al jugador');
  // Calma de nuevo (depuración) para la misión
  await q(() => { const a = window.__ascend; a.factions.reputation.reset({ pdc: 0 }); for (const e of a.enemies.list) e.forgetTarget(); a.playerCombat.restore(); });

  // Misión: activación en el teléfono público
  await q(() => window.__ascend.player.spawnAt({ x: -4.6, y: 0.3, z: 10, yaw: -Math.PI / 2 }));
  await page.waitForFunction(() => /aceptar Operación/i.test(document.getElementById('hud-prompt').textContent), null, { timeout: 8000 }).catch(() => {});
  check(/aceptar Operación/i.test(await q(() => document.getElementById('hud-prompt').textContent)), 'Junto al teléfono aparece «E: aceptar Operación: Distrito Cero»');
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => window.__ascend.missions.mission.state === 'active', null, { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(500);
  const s6Act = await q(() => {
    const a = window.__ascend;
    return {
      st: a.missions.mission.state,
      pdc: a.enemies.list.filter((e) => e.tag === 'mision-pdc').length, aco: a.enemies.list.filter((e) => e.tag === 'mision-acolito').length,
      panel: document.getElementById('hud-mission').textContent.replace(/\s+/g, ' '),
      markers: [...document.querySelectorAll('#hud-markers .marker')].filter((m) => m.style.display !== 'none').map((m) => m.textContent).join(' | '),
    };
  });
  await page.screenshot({ path: path.join(out, 'district-02-mission.png') });
  check(s6Act.st === 'active' && s6Act.pdc === 3 && s6Act.aco === 1, `E activa la misión: aparecen la patrulla (3) y el Acólito (1)`);
  check(/0\/3/.test(s6Act.panel) && /0\/1/.test(s6Act.panel), `El HUD muestra los objetivos con su recuento (${s6Act.panel.trim()})`);
  check(/Patrulla · \d+ m/.test(s6Act.markers) && /Acólito · \d+ m/.test(s6Act.markers), `Marcadores de ubicación con distancia (${s6Act.markers})`);
  // Detección y combate
  await q(() => {
    const a = window.__ascend;
    const e = a.enemies.list.find((x) => x.tag === 'mision-pdc');
    a.player.spawnAt({ x: e.position.x, y: 0.3, z: e.position.z + 9, yaw: Math.PI });
    a.combat.applyDamage(e, 10, { faction: 'player' });
  });
  await page.waitForFunction(() => window.__ascend.missions.mission.detected, null, { timeout: 8000 }).catch(() => {});
  check(await q(() => window.__ascend.missions.mission.detected && /Detectado/i.test(document.getElementById('hud-mission').textContent)), 'Los enemigos de la misión detectan al jugador (aviso y estado en el HUD)');
  await q(() => { const a = window.__ascend; for (const e of a.enemies.list.filter((x) => x.tag === 'mision-pdc')) a.combat.applyDamage(e, 999, { faction: 'player' }); });
  await page.waitForTimeout(400);
  check(/3\/3/.test(await q(() => document.getElementById('hud-mission').textContent)), 'Neutralizar la patrulla completa su objetivo (3/3)');
  check(await q(() => window.__ascend.missions.mission.state === 'active'), 'La misión sigue hasta neutralizar también al Acólito');
  await q(() => { const a = window.__ascend; const e = a.enemies.list.find((x) => x.tag === 'mision-acolito'); a.combat.applyDamage(e, 999, { faction: 'player' }); });
  await page.waitForFunction(() => window.__ascend.ui.currentScreen === 'mission', null, { timeout: 10000 }).catch(() => {});
  const s6Done = await q(() => ({ st: window.__ascend.missions.mission.state, screen: window.__ascend.ui.currentScreen, stats: document.getElementById('mission-stats').textContent, rec: window.__ascend.save.data.profile.missions['op-distrito-cero'] }));
  await page.screenshot({ path: path.join(out, 'district-03-complete.png') });
  check(s6Done.st === 'completed' && s6Done.screen === 'mission' && /3\/3/.test(s6Done.stats) && /1\/1/.test(s6Done.stats), 'Mensaje de finalización con tiempo y objetivos');
  check(s6Done.rec?.completed === true && s6Done.rec.runs >= 1, 'La misión completada se guarda');
  await q(() => { window.__ascend.save.data.debug.invulnerable = true; });
  await page.click('#screen-mission [data-action="mission-continue"]');
  await page.waitForFunction(() => window.__ascend.state === 'playing', null, { timeout: 5000 }).catch(() => {});
  check(await q(() => window.__ascend.state === 'playing'), '«Seguir explorando» vuelve al juego');
  // Límite del mapa
  await q(() => window.__ascend.player.spawnAt({ x: 59, y: 0.3, z: 0, yaw: -Math.PI / 2 }));
  await page.waitForFunction(() => document.getElementById('hud-bounds').classList.contains('show'), null, { timeout: 5000 }).catch(() => {});
  check(await q(() => document.getElementById('hud-bounds').classList.contains('show')), 'Aviso al acercarse al límite del barrio');
  await q(() => window.__ascend.player.spawnAt({ x: 0, y: 0.3, z: 11, yaw: Math.PI }));
  // Etapa 7: barandillas en las pasarelas (pasarela B3 → B4, eje z en x = 38)
  const rail = await q(() => {
    const a = window.__ascend;
    const m = a.player.motor;
    const y = a.world.groundHeight(38, -18, 0.3, 50);
    m.teleport({ x: 38, y: y + 0.1, z: -18 });
    for (let i = 0; i < 180; i++) m.update(1 / 60, { moveX: 1, moveZ: 0, sprint: true });
    const r = { x: m.position.x, y: m.position.y, y0: y, rails: a.world.boxes.filter((b) => b.tag === 'rail').length };
    a.player.spawnAt({ x: 0, y: 0.3, z: 11, yaw: Math.PI });
    return r;
  });
  check(rail.rails > 0 && rail.x < 39.2 && Math.abs(rail.y - rail.y0) < 0.3, `Las barandillas de las pasarelas impiden caerse de lado (x=${rail.x.toFixed(2)}, ${rail.rails} tramos)`);

  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__ascend.state === 'paused');
  await page.click('#screen-pause [data-action="menu"]');
  await page.waitForFunction(() => window.__ascend.state === 'menu');
  check(/✓/.test(await q(() => document.getElementById('menu-mission-done').textContent)), 'El menú marca la Operación: Distrito Cero como completada');
  await page.click('[data-map="campo"]');
  await page.waitForFunction(() => window.__ascend.state === 'playing');
  check(await q(() => window.__ascend.factions.pdcLevel.id === 'hostile'), 'En el Campo de Pruebas (simulacro) la PDC es hostil desde el principio');
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

  // ---------------- Parkour (Etapa 5) ----------------
  console.log('\n[parkour]');
  await page.evaluate(() => {
    window.__pk = [];
    window.__ascend.events.on('player:parkour', (e) => window.__pk.push(e.kind));
  });
  const pkSeen = () => q(() => [...new Set(window.__pk)]);
  await q(() => { window.__pk.length = 0; });
  await route('Parkour · vallas (saltar corriendo) y bloque de 1.3 m', { x: 21, y: 0.2, z: 28 }, [{ x: 39, z: 28, sprint: true }], 1.3);
  check((await pkSeen()).includes('vault') && (await pkSeen()).includes('mantle'), `Las vallas se saltan corriendo y el bloque se sube sin saltar (${(await pkSeen()).join(', ')})`);
  await route('Parkour · torre de 3 m y muro de 6 m', { x: 39, y: 1.5, z: 28 }, [{ x: 43.5, z: 28, jump: true, sprint: true }, { x: 48.5, z: 28, jump: true }], 6);
  await q(() => { window.__pk.length = 0; });
  await route('Parkour · torre de 12 m con cornisas', { x: 49.5, y: 6.2, z: 28 }, [{ x: 56, z: 28, jump: true }], 12, 'parkour-01-tower-top.png');
  check((await pkSeen()).some((k) => k === 'wall' || k === 'hang'), `La torre se escala por la pared y las cornisas (${(await pkSeen()).join(', ')})`);

  // Con el teclado: W + Espacio contra el muro de 6 m del circuito
  await q(() => { window.__pk.length = 0; window.__ascend.player.spawnAt({ x: 45.9, y: 0.3, z: 28, yaw: Math.PI / 2 }); });
  await page.waitForTimeout(300);
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(150);
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__ascend.player.motor.climbState === 'wall', null, { timeout: 8000 }).catch(() => {});
  await page.screenshot({ path: path.join(out, 'parkour-02-climbing.png') });
  const climbing = await q(() => ({ s: window.__ascend.player.motor.climbState, cam: window.__ascend.cameraController._parkourTarget }));
  // Al empezar a subir a la cima se suelta W para no seguir andando
  await page.waitForFunction(() => window.__ascend.player.motor.climbState === 'mantle' || window.__ascend.player.motor.position.y > 5.9, null, { timeout: 15000 }).catch(() => {});
  await page.keyboard.up('KeyW');
  await page.waitForFunction(() => { const m = window.__ascend.player.motor; return m.grounded && m.position.y > 5.9; }, null, { timeout: 10000 }).catch(() => {});
  const atTop = await q(() => ({ y: window.__ascend.player.motor.position.y, kinds: [...new Set(window.__pk)] }));
  check(atTop.kinds.includes('wall') && ['wall', 'mantle'].includes(climbing.s), `W + Espacio contra un muro: el personaje se engancha y trepa (${climbing.s})`);
  check(Math.abs(atTop.y - 6) < 0.1 && atTop.kinds.includes('mantle'), `Al llegar arriba sube a la cima (y=${atTop.y.toFixed(2)}; ${atTop.kinds.join(', ')})`);
  check(climbing.cam === 1, 'La cámara pasa al modo de escalada');

  // Colgado de una cornisa de la fachada y C para soltarse
  // (el salto hasta agarrarse se simula en la página para no depender de la tasa de frames)
  await q(() => {
    const a = window.__ascend;
    a.player.spawnAt({ x: 54, y: 0.3, z: 9.6, yaw: 0 });
    const m = a.player.motor;
    for (let i = 0; i < 120 && m.climbState !== 'hang'; i++) m.update(1 / 60, { moveX: 0, moveZ: 1, jump: i === 2 });
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(out, 'parkour-03-hang.png') });
  const hang = await q(() => ({ s: window.__ascend.player.motor.climbState, x: window.__ascend.player.motor.position.x }));
  check(hang.s === 'hang', `Saltar hacia una cornisa y soltar W: queda colgado (${hang.s})`);
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(700);
  await page.keyboard.up('KeyD');
  const hx = await q(() => ({ s: window.__ascend.player.motor.climbState, x: window.__ascend.player.motor.position.x }));
  check(hx.s === 'hang' && Math.abs(hx.x - hang.x) > 0.4, `A/D desplaza por la cornisa (${hang.x.toFixed(2)} → ${hx.x.toFixed(2)})`);
  check(await q(() => { const p = window.__ascend.powers; return !p.isCharging && window.__ascend.player.motor.isClimbing; }), 'Colgado no se usan poderes');
  await page.keyboard.press('KeyC');
  await page.waitForFunction(() => window.__ascend.player.motor.grounded, null, { timeout: 8000 }).catch(() => {});
  const dropped = await q(() => ({ s: window.__ascend.player.motor.climbState, y: window.__ascend.player.motor.position.y, crouch: window.__ascend.player.motor.crouched }));
  check(dropped.s === null && dropped.y < 0.5 && !dropped.crouch, `C suelta la cornisa y cae al suelo sin agacharse (y=${dropped.y.toFixed(2)})`);
  if (process.env.E2E_STOP === 'parkour') throw new Error('E2E_STOP=parkour');

  // ---------------- Pulido (Etapa 7): sonido y rendimiento ----------------
  console.log('\n[pulido]');
  const au = await q(() => ({ running: window.__ascend.audio.running, stats: { ...window.__ascend.audio.stats } }));
  check(au.running, 'El audio (Web Audio) está activo tras la primera interacción');
  check(au.stats['amb:field'] > 0 && au.stats['amb:city'] > 0, `Ambiente propio de cada mapa (campo ${au.stats['amb:field']}, ciudad ${au.stats['amb:city']})`);
  // Pasos: 2 s de juego andando (pasos fijos, independiente de los FPS del render por software)
  await q(() => window.__ascend.player.spawnAt({ x: 0, y: 0.3, z: 18, yaw: Math.PI }));
  await page.keyboard.down('KeyW');
  const steps = await q(() => {
    const a = window.__ascend;
    const n0 = a.audio.stats.step ?? 0;
    let ev = 0;
    const off = a.events.on('player:step', () => ev++);
    for (let i = 0; i < 120; i++) a.player.update(1 / 60);
    off?.();
    return { ev, sounds: (a.audio.stats.step ?? 0) - n0 };
  });
  await page.keyboard.up('KeyW');
  check(steps.ev >= 4 && steps.sounds === steps.ev && au.stats.jump > 0 && au.stats.land > 0, `Pasos sincronizados con la animación (${steps.ev} en 2 s, ${steps.sounds} sonidos), saltos y aterrizajes suenan`);
  check(au.stats.zap > 0 && au.stats.impact > 0 && au.stats.grab > 0, `Disparo, impacto y agarre suenan (${au.stats.zap}/${au.stats.impact}/${au.stats.grab})`);
  check(au.stats.missionStart > 0 && au.stats.missionComplete > 0 && au.stats.radio > 0, 'Sonidos de misión y aviso de radio de la PDC');
  const perf = await q(() => {
    const a = window.__ascend;
    const r = a.renderer;
    r.info.autoReset = false;
    r.info.reset();
    r.render(a.scene, a.camera);
    const calls = r.info.render.calls;
    r.info.autoReset = true;
    return { merge: a.mapManager.lastMerge, calls };
  });
  check(perf.merge.after * 4 < perf.merge.before, `Geometría estática fusionada (${perf.merge.before} → ${perf.merge.after} mallas)`);
  check(perf.calls < 400, `Llamadas de dibujo en el Campo de Pruebas: ${perf.calls}`);

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
  // Los enemigos de la Zona D no deben interferir en las pruebas de poderes.
  await g(() => window.__ascend.enemies.clear());
  check(await g(() => window.__ascend.powers.available), 'La marca de Energía sigue activa tras cambiar de mapa (adquirida)');
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

  // Cargador: 10 disparos, recarga automática con animación y vuelta a 10
  await g(() => {
    const a = window.__ascend;
    a.mapManager.resetEntities();
    a.powers.resetAbilities();
    a.powers.energy.refill();
    window.__shots = 0;
    a.events.on('power:used', (e) => { if (e.id === 'proyectil') window.__shots++; });
  });
  await g(() => window.__place({ x: -36, y: 0.2, z: -50 }, { x: -36, y: 1.2, z: -58 }));
  await page.waitForFunction(() => document.getElementById('hud-ammo').textContent === '10/10', null, { timeout: 5000 }).catch(() => {});
  check((await g(() => document.getElementById('hud-ammo').textContent)) === '10/10', 'El HUD muestra el cargador lleno (10/10)');
  const icons = await g(() => ({ n: document.querySelectorAll('#hud-ammo-icons .ammo-icon').length, spent: document.querySelectorAll('#hud-ammo-icons .ammo-icon.spent').length }));
  check(icons.n === 10 && icons.spent === 0, `Munición elemental con un símbolo por disparo (${icons.n}, gastados ${icons.spent})`);
  await page.mouse.down();
  await page.waitForFunction(() => window.__ascend.powers.magazine.reloading, null, { timeout: 20000 }).catch(() => {});
  await page.waitForFunction(() => window.__ascend.player.model._reloadW > 0.3 && /recargando/i.test(document.getElementById('hud-ammo').textContent), null, { timeout: 5000 }).catch(() => {});
  const mag = await g(() => ({
    shots: window.__shots, reloading: window.__ascend.powers.magazine.reloading,
    hud: document.getElementById('hud-ammo').textContent, pose: window.__ascend.player.model._reloadW,
  }));
  // Con el clic aún pulsado y la recarga en curso, no debe salir ningún disparo
  const shotsDuring = await g(() => (window.__ascend.powers.magazine.reloading ? window.__shots : -1));
  await page.mouse.up();
  await page.screenshot({ path: path.join(out, 'powers-09-reload.png') });
  check(mag.shots === 10 && mag.reloading, `Se disparan 10 proyectiles y empieza la recarga (${mag.shots} disparos)`);
  check(shotsDuring === 10, `No se dispara mientras recarga, aunque se mantenga el clic (${shotsDuring})`);
  check(/recargando/i.test(mag.hud) && mag.pose > 0.3, `Animación e indicador de recarga ("${mag.hud}", pose ${mag.pose.toFixed(2)})`);
  await page.waitForFunction(() => !window.__ascend.powers.magazine.reloading, null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(200);
  const after10 = await g(() => ({ ammo: window.__ascend.powers.magazine.ammo, hud: document.getElementById('hud-ammo').textContent }));
  check(after10.ammo === 10 && after10.hud === '10/10', `Tras recargar el cargador vuelve a 10 (${after10.hud})`);

  // R pulsada una vez: recarga a mano (mantenerla sigue siendo la descarga)
  await g(() => { const m = window.__ascend.powers.magazine; m.consume(); m.consume(); m.consume(); window.__desc = 0; window.__ascend.events.on('power:used', (e) => { if (e.id === 'descarga') window.__desc++; }); });
  await page.keyboard.press('KeyR');
  await page.waitForFunction(() => window.__ascend.powers.magazine.reloading, null, { timeout: 5000 }).catch(() => {});
  const manual = await g(() => ({ reloading: window.__ascend.powers.magazine.reloading, desc: window.__desc }));
  check(manual.reloading && manual.desc === 0, 'Pulsar R una vez recarga el cargador sin lanzar la descarga');
  await page.waitForFunction(() => window.__ascend.powers.magazine.ammo === window.__ascend.powers.magazine.size && !window.__ascend.powers.magazine.reloading, null, { timeout: 15000 }).catch(() => {});
  check(await g(() => window.__ascend.powers.magazine.ammo === window.__ascend.powers.magazine.size), 'Tras la recarga manual el cargador está lleno');

  // Sin regeneración pasiva; se recarga absorbiendo de fuentes del entorno (mantener E)
  await g(() => { window.__ascend.powers.energy.value = 30; });
  await page.waitForTimeout(2500);
  const eIdle = await g(() => window.__ascend.powers.energy.value);
  check(eIdle === 30, `La energía no se recarga sola (${eIdle.toFixed(0)})`);
  await g(() => window.__ascend.player.spawnAt({ x: 5.2, y: 0.3, z: 18, yaw: Math.PI / 2 }));
  await page.waitForFunction(() => /absorber/i.test(document.getElementById('hud-prompt').textContent), null, { timeout: 8000 }).catch(() => {});
  check(/absorber/i.test(await g(() => document.getElementById('hud-prompt').textContent)), 'Junto al armario eléctrico aparece «Mantén E: absorber energía»');
  const src0 = await g(() => window.__ascend.drain.sources.find((s) => Math.abs(s.position.x - 6.5) < 0.1 && Math.abs(s.position.z - 18) < 0.1).reserve.value);
  await page.keyboard.down('KeyE');
  await page.waitForFunction(() => window.__ascend.powers.energy.value > 70, null, { timeout: 15000 }).catch(() => {});
  await page.screenshot({ path: path.join(out, 'powers-10-drain.png') });
  await page.keyboard.up('KeyE');
  await page.waitForTimeout(300);
  const drained = await g(() => ({
    e: window.__ascend.powers.energy.value, active: !!window.__ascend.drain.active,
    src: window.__ascend.drain.sources.find((s) => Math.abs(s.position.x - 6.5) < 0.1 && Math.abs(s.position.z - 18) < 0.1).reserve.value,
  }));
  check(drained.e > 70 && drained.src < src0 && !drained.active, `Absorber de un armario recarga la energía y vacía su reserva (${drained.e.toFixed(0)}, reserva ${src0.toFixed(0)} → ${drained.src.toFixed(0)})`);
  check(await g(() => window.__ascend.audio.stats.drain > 0), 'La absorción de energía tiene sonido propio');

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
  check(dashE < (await g(() => window.__ascend.powers.energy.max)), `El dash consume energía (${dashE.toFixed(0)})`);

  // Esquiva normal: distancia corta
  await g(() => window.__ascend.player.spawnAt({ x: 0, y: 0.3, z: 18, yaw: Math.PI }));
  await page.waitForTimeout(300);
  const d0 = await g(() => ({ ...window.__ascend.player.motor.position }));
  await page.keyboard.press('AltLeft');
  await page.waitForFunction(() => window.__ascend.player.motor.dodgeCooldownRemaining > 0, null, { timeout: 5000 });
  await page.waitForFunction(() => !window.__ascend.player.motor.isBusy && window.__ascend.player.motor.horizontalSpeed < 0.1, null, { timeout: 5000 });
  const d1 = await g(() => ({ ...window.__ascend.player.motor.position }));
  const dodgeDist = Math.hypot(d1.x - d0.x, d1.z - d0.z);
  check(dodgeDist > 1.5 && dodgeDist < 3.2, `La esquiva normal es corta (${dodgeDist.toFixed(1)} m)`);

  // G en el aire: caída en forma de rayo + explosión, sin daño por caída
  await g(() => { const a = window.__ascend; a.mapManager.resetEntities(); a.powers.resetAbilities(); a.powers.energy.refill(); });
  await g(() => {
    window.__landing = null;
    window.__ascend.events.on('player:landed', (e) => { window.__landing = e; });
    window.__impact = null;
    window.__ascend.events.on('power:impact', (e) => { window.__impact = e; });
    window.__ascend.save.data.debug.invulnerable = false;
    window.__ascend.playerCombat.restore();
    window.__ascend.player.spawnAt({ x: -41, y: 12, z: -55.5, yaw: Math.PI });
  });
  await page.keyboard.press('KeyG');
  await page.waitForFunction(() => window.__ascend.powers.isDiving, null, { timeout: 5000 }).catch(() => {});
  const diving = await g(() => window.__ascend.player.motor.isDiving || window.__impact !== null);
  await page.waitForTimeout(80);
  await page.screenshot({ path: path.join(out, 'powers-06-dive.png') });
  await page.waitForFunction(() => window.__impact !== null, null, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(60);
  await page.screenshot({ path: path.join(out, 'powers-07-dive-impact.png') });
  const dive = await g(() => ({
    impact: window.__impact, landing: window.__landing, pos: { ...window.__ascend.player.motor.position },
    dummies: window.__ascend.mapManager.current.entities.filter((e) => e.maxHealth && Math.abs(e.base.z + 58) < 0.1).map((e) => e.health),
  }));
  check(diving, 'G en el aire inicia la caída en rayo');
  check(dive.impact && dive.impact.fallHeight > 10, `Explosión al tocar suelo (caída ${dive.impact?.fallHeight.toFixed(1)} m, radio ${dive.impact?.radius.toFixed(1)} m, daño ${dive.impact?.damage})`);
  check(Math.abs(dive.pos.x + 41) < 0.01 && Math.abs(dive.pos.z + 55.5) < 0.01, 'La caída es vertical');
  check(dive.dummies.filter((h) => h < 100).length >= 2, `La explosión daña a los maniquíes cercanos (salud ${dive.dummies.join(', ')})`);
  check(dive.landing && dive.landing.immune === true, 'El aterrizaje del rayo es inmune al daño por caída');
  const hpAfterDive = await g(() => window.__ascend.playerCombat.health.value);
  check(hpAfterDive === 100, `La caída en rayo desde 12 m no quita salud (${hpAfterDive})`);

  // Dash dirigido: apuntar + mantener Q muestra la silueta; soltar = desplazarse allí
  await g(() => { const a = window.__ascend; a.powers.resetAbilities(); a.powers.energy.refill(); });
  await g(() => window.__place({ x: 20, y: 0.2, z: 30 }, { x: 20, y: 0, z: 42 }));
  await page.mouse.down({ button: 'right' });
  await page.waitForTimeout(400);
  await g(() => window.__aimAt({ x: 20, y: 0, z: 42 }));
  await page.keyboard.down('KeyQ');
  await page.waitForFunction(() => window.__ascend.powers.isTargeting, null, { timeout: 5000 }).catch(() => {});
  await g(() => window.__aimAt({ x: 20, y: 0, z: 42 }));
  await page.waitForTimeout(300);
  const ghost = await g(() => {
    const pw = window.__ascend.powers;
    return { visible: pw.ghost.visible, pos: pw.ghost.position.toArray(), targeting: pw.isTargeting };
  });
  await page.screenshot({ path: path.join(out, 'powers-08-targeted-ghost.png') });
  check(ghost.targeting && ghost.visible, 'Apuntar + mantener Q muestra la silueta del personaje');
  check(Math.hypot(ghost.pos[0] - 20, ghost.pos[2] - 42) < 1.2, `La silueta aparece donde se apunta (${ghost.pos.map((v) => v.toFixed(1)).join(', ')})`);
  await page.keyboard.up('KeyQ');
  await page.waitForFunction(() => window.__ascend.player.motor.isTraveling, null, { timeout: 5000 }).catch(() => {});
  await page.waitForFunction(() => !window.__ascend.player.motor.isBusy && window.__ascend.player.motor.horizontalSpeed < 0.1, null, { timeout: 8000 }).catch(() => {});
  const arrived = await g(() => ({ ...window.__ascend.player.motor.position }));
  check(Math.hypot(arrived.x - ghost.pos[0], arrived.z - ghost.pos[2]) < 1.2, `Al soltar Q se desplaza hasta la silueta (${arrived.x.toFixed(1)}, ${arrived.z.toFixed(1)})`);
  check(!(await g(() => window.__ascend.powers.ghost.visible)), 'La silueta desaparece tras el dash');

  // Límite de distancia: apuntar muy lejos coloca la silueta a ≤ 20 m
  await g(() => { const a = window.__ascend; a.powers.resetAbilities(); a.powers.energy.refill(); });
  await g(() => window.__place({ x: 20, y: 0.2, z: 30 }, { x: 20, y: 0, z: 80 }));
  await page.waitForTimeout(300);
  await g(() => window.__aimAt({ x: 20, y: 0, z: 80 }));
  await page.keyboard.down('KeyQ');
  await page.waitForFunction(() => window.__ascend.powers.isTargeting, null, { timeout: 5000 }).catch(() => {});
  await g(() => window.__aimAt({ x: 20, y: 0, z: 80 }));
  await page.waitForTimeout(300);
  const far = await g(() => {
    const pw = window.__ascend.powers;
    const m = window.__ascend.player.motor.position;
    return Math.hypot(pw.ghost.position.x - m.x, pw.ghost.position.y + 1 - (m.y + 1), pw.ghost.position.z - m.z);
  });
  await page.keyboard.up('KeyQ');
  await page.mouse.up({ button: 'right' });
  await page.waitForFunction(() => !window.__ascend.player.motor.isBusy, null, { timeout: 8000 }).catch(() => {});
  check(far <= 20.5 && far > 15, `La silueta respeta el límite de distancia (${far.toFixed(1)} m ≤ 20 m)`);

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
    await page.waitForFunction(() => window.__ascend.projectiles.list.length === 0, null, { timeout: 60000 });
    const hits = await g(([t, z]) => window.__ascend.mapManager.current.entities.find((e) => e.hits !== undefined && Math.abs(e.center.x - t) < 0.1 && Math.abs(e.center.z - z) < 0.1).hits, [tx, tz]);
    check(expectHit ? hits > 0 : hits === 0, `Alcance: diana a ${dist} m ${expectHit ? 'recibe' : 'no recibe'} impactos (${hits})`);
  }

  // Menú de depuración: desactivar la marca bloquea los poderes
  await page.keyboard.press('F2');
  await page.waitForFunction(() => window.__ascend.ui.currentScreen === 'debug');
  await page.screenshot({ path: path.join(out, 'powers-04-debug.png') });
  await page.click('#screen-debug [data-action="dbg-reset-acquisition"]');
  const off = await g(() => window.__ascend.powers.available);
  await page.click('#screen-debug [data-action="resume"]');
  await page.waitForFunction(() => window.__ascend.state === 'playing');
  const eOff0 = await g(() => window.__ascend.powers.energy.value);
  await page.keyboard.press('KeyG');
  await page.waitForTimeout(300);
  const usedWhileOff = await g(() => window.__ascend.powers.abilities.wave.cooldown > 0);
  check(!off && !(await page.isVisible('#hud-power')) && !usedWhileOff, 'Reiniciar la adquisición (F2) quita la marca: sin poderes ni HUD de energía');
  check((await g(() => window.__ascend.powers.energy.value)) >= eOff0, 'Sin la marca no se gasta energía');
  await page.keyboard.press('F2');
  await page.waitForFunction(() => window.__ascend.ui.currentScreen === 'debug');
  await page.click('#screen-debug [data-action="dbg-mark"]');
  await page.click('#screen-debug [data-action="dbg-maxmarks"]');
  await page.click('#screen-debug [data-action="dbg-teleport"][data-wp="F"]');
  await page.waitForFunction(() => window.__ascend.state === 'playing');
  await page.waitForFunction(() => window.__ascend.powers.available && window.__ascend.marks.level > 0.9, null, { timeout: 8000 }).catch(() => {});
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

  // ---------------- Combate y enemigos (Etapa 3) ----------------
  console.log('\n[combate]');
  // Ventana pequeña: el render por software es mucho más rápido y la IA avanza más por segundo.
  await page.setViewportSize({ width: 640, height: 360 });
  await g(() => {
    const a = window.__ascend;
    a.save.data.debug.invulnerable = false;
    a.playerCombat.restore();
    a.enemies.clear();
    window.__ev = { dmg: 0, died: 0, neutralized: 0, respawn: 0, states: new Set() };
    a.events.on('player:damaged', () => window.__ev.dmg++);
    a.events.on('player:died', () => window.__ev.died++);
    a.events.on('enemy:neutralized', () => window.__ev.neutralized++);
    a.events.on('player:respawned', (e) => { if (e?.afterDeath) window.__ev.respawn++; });
  });

  // Consola de la Zona D (E): reinicia el encuentro
  await g(() => window.__ascend.player.spawnAt({ x: -12.4, y: 0.2, z: -46.2, yaw: Math.PI }));
  await page.waitForFunction(() => document.getElementById('hud-prompt').classList.contains('show'), null, { timeout: 8000 }).catch(() => {});
  const prompt = await g(() => document.getElementById('hud-prompt').textContent);
  check(/Reiniciar encuentro/.test(prompt), `Aviso de interacción junto a la consola ("${prompt}")`);
  // Registro de estados de la IA en cada frame (dentro de la página)
  await g(() => {
    const loop = () => {
      window.__ascend.enemies.list.forEach((e) => window.__ev.states.add(e.brain.state));
      window.__stateLoop = requestAnimationFrame(loop);
    };
    loop();
  });
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => window.__ascend.enemies.alive.filter((e) => e.tag === 'zonaD').length === 2, null, { timeout: 8000 }).catch(() => {});
  const spawnedTypes = await g(() => window.__ascend.enemies.alive.map((e) => e.type.id).sort().join(','));
  check(spawnedTypes === 'acolyte,pdc', `E en la consola genera el encuentro: Agente PDC y Acólito (${spawnedTypes})`);

  // Detección, ataque y daño al jugador
  await g(() => window.__ascend.player.spawnAt({ x: -10, y: 0.2, z: -56, yaw: Math.PI }));
  await page.waitForFunction(() => window.__ascend.enemies.list.some((e) => e.brain.state === 'attack'), null, { timeout: 90000 }).catch(() => {});
  await page.waitForFunction(() => window.__ascend.playerCombat.health.value < 100, null, { timeout: 90000 }).catch(() => {});
  const c1 = await g(() => ({
    states: [...window.__ev.states], hp: window.__ascend.playerCombat.health.value, dmg: window.__ev.dmg,
    hud: document.getElementById('hud-health-text').textContent,
    ammo: window.__ascend.enemies.list.map((e) => e.magazine.ammo + (e.magazine.reloading ? 'R' : '')),
  }));
  await page.screenshot({ path: path.join(out, 'combat-01-enemies.png') });
  check(c1.states.includes('patrol') && c1.states.includes('alert') && c1.states.includes('attack'), `IA: patrulla → alerta → ataque (${c1.states.join(', ')})`);
  check(c1.hp < 100 && c1.dmg > 0 && Number(c1.hud) < 100, `Los enemigos disparan y el jugador recibe daño (salud ${c1.hp.toFixed(0)}, HUD ${c1.hud})`);

  // Neutralizar a un enemigo con proyectiles (jugador invulnerable para que la prueba sea estable)
  await g(() => { const a = window.__ascend; a.save.data.debug.invulnerable = true; a.save.data.debug.infiniteEnergy = true; });
  const killStart = Date.now();
  let lastLog = 0;
  await page.mouse.down();
  while (Date.now() - killStart < 150000) {
    if (Date.now() - lastLog > 15000) {
      lastLog = Date.now();
      console.log('      ·', await g(() => window.__ascend.enemies.list.map((e) => `${e.type.id} ${Math.round(e.health.value)} ${e.brain.state}`).join(' | ')));
    }
    const done = await g(() => {
      const a = window.__ascend;
      const p = a.player.motor.position;
      const live = a.enemies.alive.sort((x, y) => Math.hypot(x.position.x - p.x, x.position.z - p.z) - Math.hypot(y.position.x - p.x, y.position.z - p.z));
      if (!live.length || window.__ev.neutralized > 0) return true;
      // A corta distancia el desplazamiento lateral del enemigo no hace fallar los disparos.
      const ep = live[0].position;
      if (Math.hypot(ep.x - p.x, ep.z - p.z) > 6) {
        const dx = p.x - ep.x;
        const dz = p.z - ep.z;
        const l = Math.hypot(dx, dz) || 1;
        a.player.spawnAt({ x: ep.x + (dx / l) * 4.5, y: ep.y + 0.2, z: ep.z + (dz / l) * 4.5, yaw: Math.atan2(-dx, -dz) });
      }
      const c = live[0].center;
      window.__aimAt({ x: c.x, y: c.y + 0.2, z: c.z });
      return false;
    });
    if (done) break;
    await page.waitForTimeout(120);
  }
  await page.mouse.up();
  await page.waitForTimeout(300);
  const k = await g(() => ({ n: window.__ev.neutralized, states: window.__ascend.enemies.list.map((e) => e.stateName) }));
  await page.screenshot({ path: path.join(out, 'combat-02-neutralized.png') });
  check(k.n >= 1 && k.states.includes('Neutralizado'), `Los proyectiles neutralizan a un enemigo (${k.states.join(', ')})`);

  // Cuerpo a cuerpo contra el enemigo restante
  const meleeRes = await g(async () => {
    const a = window.__ascend;
    const e = a.enemies.alive[0];
    if (!e) return null;
    const ep = e.position;
    const p = { x: ep.x, y: ep.y + 0.1, z: ep.z + 1.3 };
    a.player.spawnAt({ ...p, yaw: Math.PI });
    return { before: e.health.value, id: e.type.id };
  });
  await page.keyboard.press('KeyF');
  await page.waitForFunction((b) => {
    const e = window.__ascend.enemies.list.find((x) => x.type.id === b.id);
    return !e || e.health.value < b.before;
  }, meleeRes, { timeout: 8000 }).catch(() => {});
  const afterMelee = await g((b) => window.__ascend.enemies.list.find((x) => x.type.id === b.id)?.health.value, meleeRes);
  check(meleeRes && afterMelee <= meleeRes.before - 20, `Golpe (F) daña al enemigo (${meleeRes?.before} → ${afterMelee})`);

  // Golpe elemental (con energía) frente a golpe normal (sin energía), sobre un maniquí
  await g(() => {
    const a = window.__ascend;
    a.enemies.clear();
    a.mapManager.resetEntities();
    a.save.data.debug.infiniteEnergy = false;
    a.powers.energy.refill();
    a.player.spawnAt({ x: -46, y: 0.2, z: -56.7, yaw: Math.PI });
    a.cameraController.yaw = 0;
  });
  const dummyHp = () => g(() => window.__ascend.mapManager.current.entities.find((e) => e.maxHealth && Math.abs(e.base.x + 46) < 0.1).health);
  await page.waitForTimeout(300);
  await page.waitForFunction(() => window.__ascend.playerCombat._meleeCd === 0, null, { timeout: 8000 }).catch(() => {});
  await page.keyboard.press('KeyF');
  await page.waitForFunction(() => window.__ascend.mapManager.current.entities.find((e) => e.maxHealth && Math.abs(e.base.x + 46) < 0.1).health < 100, null, { timeout: 8000 }).catch(() => {});
  const hpElem = await dummyHp();
  await g(() => { window.__ascend.powers.energy.value = 0; window.__ascend.powers.energy.regenPerSecond = 0; });
  await page.waitForFunction(() => window.__ascend.playerCombat._meleeCd === 0, null, { timeout: 8000 }).catch(() => {});
  await page.keyboard.press('KeyF');
  await page.waitForFunction((h) => window.__ascend.mapManager.current.entities.find((e) => e.maxHealth && Math.abs(e.base.x + 46) < 0.1).health < h, hpElem, { timeout: 8000 }).catch(() => {});
  const hpNormal = await dummyHp();
  await g(() => window.__ascend.powers.applyModifiers(window.__ascend.progression.modifiers('energia')));
  check(hpElem === 68, `Golpe elemental con energía: 32 de daño (salud ${hpElem})`);
  check(hpNormal === hpElem - 20, `Sin energía el golpe es normal: 20 de daño (salud ${hpNormal})`);

  // Embestida eléctrica: con energía y un enemigo delante, F lanza al jugador hacia él
  await g(() => {
    const a = window.__ascend;
    a.save.data.debug.invulnerable = true;
    a.powers.energy.refill();
    a.player.spawnAt({ x: 0, y: 0.3, z: 30, yaw: 0 });
    a.cameraController.yaw = Math.PI;
    a.cameraController.pitch = -0.1;
    window.__lungeE = a.enemies.spawn('pdc', { x: 0, y: 0.1, z: 35.5, yaw: Math.PI, tag: 'prueba' });
  });
  await page.waitForTimeout(200);
  await page.waitForFunction(() => window.__ascend.playerCombat._meleeCd === 0, null, { timeout: 8000 }).catch(() => {});
  await page.keyboard.press('KeyF');
  await page.waitForFunction(() => window.__lungeE.health.value < 80, null, { timeout: 8000 }).catch(() => {});
  const lunge = await g(() => ({ z: window.__ascend.player.motor.position.z, hp: window.__lungeE.health.value }));
  await page.screenshot({ path: path.join(out, 'combat-04-lunge.png') });
  check(lunge.z > 32.5 && lunge.hp === 48, `Embestida: avanza hasta el enemigo (z ${lunge.z.toFixed(1)}) y le golpea con puños eléctricos (salud ${lunge.hp})`);

  // Cobertura: agachado tras una barrera el enemigo no le ve; al apuntar se asoma
  await g(() => {
    const a = window.__ascend;
    a.enemies.clear();
    window.__coverE = a.enemies.spawn('pdc', { x: -15, y: 0.1, z: -71, yaw: 0, tag: 'prueba' });
    a.player.spawnAt({ x: -15, y: 0.2, z: -60.8, yaw: Math.PI });
  });
  await page.waitForTimeout(300);
  const seesStanding = await g(() => window.__coverE._computeCanSee(window.__ascend.playerCombat));
  await page.keyboard.press('KeyC');
  await page.waitForFunction(() => window.__ascend.player.stance === 'cover', null, { timeout: 5000 }).catch(() => {});
  const inCover = await g(() => ({ stance: window.__ascend.player.stance, sees: window.__coverE._computeCanSee(window.__ascend.playerCombat), hud: document.getElementById('hud-stance').textContent }));
  await page.mouse.down({ button: 'right' });
  await page.waitForFunction(() => window.__ascend.player.stance === 'peek', null, { timeout: 5000 }).catch(() => {});
  const peek = await g(() => ({ stance: window.__ascend.player.stance, sees: window.__coverE._computeCanSee(window.__ascend.playerCombat) }));
  await page.screenshot({ path: path.join(out, 'combat-05-peek.png') });
  await page.mouse.up({ button: 'right' });
  await page.waitForFunction(() => window.__ascend.player.stance === 'cover', null, { timeout: 5000 }).catch(() => {});
  check(seesStanding && inCover.stance === 'cover' && !inCover.sees && /cubierto/i.test(inCover.hud), `C junto a la barrera: a cubierto y fuera de la vista del enemigo (de pie le veía: ${seesStanding})`);
  check(peek.stance === 'peek' && peek.sees, 'Al apuntar se asoma por encima y queda expuesto');
  check(await g(() => window.__ascend.player.stance === 'cover'), 'Al dejar de apuntar vuelve a cubrirse');
  await page.keyboard.press('KeyC');
  await g(() => { const a = window.__ascend; a.enemies.clear(); a.save.data.debug.invulnerable = false; });

  // Daño por caída (sin el rayo)
  await g(() => { const a = window.__ascend; a.enemies.clear(); a.save.data.debug.invulnerable = false; a.playerCombat.restore(); a.player.spawnAt({ x: 0, y: 14, z: 30, yaw: Math.PI }); });
  await page.waitForFunction(() => window.__ascend.player.motor.grounded, null, { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(200);
  const fallHp = await g(() => window.__ascend.playerCombat.health.value);
  check(fallHp < 100 && fallHp > 50, `Una caída normal de 14 m quita salud (${fallHp})`);

  // Neutralización del jugador y reaparición
  await g(() => window.__ascend.combat.applyDamage(window.__ascend.playerCombat, 500, { faction: 'enemy', kind: 'prueba' }));
  await page.waitForFunction(() => document.getElementById('hud-death').classList.contains('show'), null, { timeout: 5000 }).catch(() => {});
  const deathShown = await page.isVisible('#hud-death');
  await page.screenshot({ path: path.join(out, 'combat-03-death.png') });
  await page.waitForFunction(() => window.__ev.respawn > 0, null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(200);
  const rs = await g(() => ({ hp: window.__ascend.playerCombat.health.value, pos: { ...window.__ascend.player.motor.position }, overlay: document.getElementById('hud-death').classList.contains('show') }));
  check(deathShown && rs.hp === 100 && !rs.overlay, `Neutralizado → pantalla de derrota → reaparece con salud completa (${rs.hp})`);
  check(Math.hypot(rs.pos.x, rs.pos.z - 18) < 1, 'Reaparece en el punto de inicio del mapa');

  // Menú de depuración: generar y eliminar enemigos
  await page.keyboard.press('F2');
  await page.waitForFunction(() => window.__ascend.ui.currentScreen === 'debug');
  await page.click('#screen-debug [data-action="dbg-spawn"]');
  const nSpawn = await g(() => window.__ascend.enemies.alive.length);
  await page.click('#screen-debug [data-action="dbg-clear-enemies"]');
  const nClear = await g(() => window.__ascend.enemies.list.length);
  await page.click('#screen-debug [data-action="resume"]');
  await page.waitForFunction(() => window.__ascend.state === 'playing');
  check(nSpawn === 2 && nClear === 0, `Depuración: generar (${nSpawn}) y eliminar enemigos (${nClear})`);
  await g(() => { const a = window.__ascend; a.save.data.debug.infiniteEnergy = false; a.save.data.debug.invulnerable = false; a.save.save(); });
  await page.setViewportSize({ width: 960, height: 540 });

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
  await page.locator('#set-vol').fill('0.3');
  await page.locator('#set-scale').fill('0.8');
  await page.click('#set-invert');
  await page.click('#screen-settings [data-action="settings-back"]');
  check(await page.isVisible('#screen-pause.active'), 'Ajustes vuelve a la pausa');
  await page.reload();
  await page.waitForFunction(() => window.__ascend);
  const saved = await page.evaluate(() => window.__ascend.save.settings);
  check(saved.fov === 82 && saved.invertY === true, `Ajustes guardados tras recargar (FOV ${saved.fov}, invertir Y ${saved.invertY})`);
  check(saved.volumeMaster === 0.3 && saved.renderScale === 0.8, `Volumen y resolución de render guardados (${saved.volumeMaster}, ${saved.renderScale})`);

  check(errors.length === 0, `Sin errores en consola${errors.length ? `: ${errors.join(' | ')}` : ''}`);
} finally {
  await browser.close();
  if (isWin) spawn('taskkill', ['/pid', String(server.pid), '/T', '/F'], { shell: true });
  else {
    try {
      process.kill(-server.pid); // npx y el servidor vite hijo
    } catch {
      server.kill();
    }
  }
}

console.log(failures ? `\n${failures} comprobación(es) fallida(s)` : '\nTodas las comprobaciones superadas');
process.exit(failures ? 1 : 0);
