import { chromium } from 'playwright';
const views = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
p.on('console', (m) => console.log('console:', m.text()));
p.on('pageerror', (e) => console.log('pageerror:', e.message));
const t0 = Date.now();
await p.goto('http://127.0.0.1:8765/tools/ciudad/maq/index.html');
await p.waitForFunction(() => window.ready === true, null, { timeout: 600000 });
console.log('built in', (Date.now() - t0) / 1000, 's');
for (const v of views) {
  const t = Date.now();
  await p.evaluate((v) => window.view(v), v);
  await p.screenshot({ path: `out/maq-${v}.jpg`, type: 'jpeg', quality: 84 });
  console.log(v, (Date.now() - t) / 1000, 's');
}
await b.close();
