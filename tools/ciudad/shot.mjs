import { chromium } from 'playwright';
const [,, input, output, w = '1240', h = '1040'] = process.argv;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: +w, height: +h } });
await p.goto('file://' + input);
await p.waitForTimeout(300);
await p.screenshot({ path: output, fullPage: false });
await b.close();
