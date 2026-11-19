#!/usr/bin/env node
// Export a built deck: one vector PDF named after the HTML (<deck-slug>.pdf, every slide in final state),
// one PNG per slide, and notes.json. Fails on page errors, console errors and network requests, like check.cjs.
// usage: node export.cjs <deck.html> <outdir> [lang]
// then:  python3 to_pptx.py <outdir> <out.pptx>   (needs python-pptx and Pillow)
// env:   SCALE=2 (PNG pixel ratio)  PLAYWRIGHT=/path/to/node_modules/playwright  CHROME=/path/to/chrome
const path = require('path'), fs = require('fs');
function loadPW() {
  for (const p of [process.env.PLAYWRIGHT, 'playwright', 'playwright-core']) { if (!p) continue; try { return require(p); } catch (e) {} }
  console.error('playwright not found. npm i -D playwright, or set PLAYWRIGHT=/path/to/node_modules/playwright'); process.exit(2);
}
const MAC_CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const CHROME = process.env.CHROME || (fs.existsSync(MAC_CHROME) ? MAC_CHROME : undefined);
const FILE = path.resolve(process.argv[2]);
const OUT = path.resolve(process.argv[3] || 'export');
const LANG = process.argv[4] || 'all';
fs.mkdirSync(path.join(OUT, 'png'), { recursive: true });

(async () => {
  const { chromium } = loadPW();
  const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});
  const errs = [];
  const watch = pg => {
    pg.on('pageerror', e => errs.push('pageerror: ' + e.message));
    pg.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
    pg.on('request', r => { const u = r.url(); if (!/^(file|data|blob|about):/.test(u)) errs.push('network: ' + u); });
  };

  // 1. PDF from print mode: the engine lays every slide out as a 1920 x 1080 page
  const pp = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  watch(pp);
  await pp.goto('file://' + FILE + `?print=1&lang=${LANG}`);
  await pp.waitForFunction(() => window.DECK_PRINT === 'ready', null, { timeout: 30000 });
  await pp.waitForTimeout(400);
  const pdf = path.join(OUT, path.basename(FILE).replace(/\.html?$/i, '') + '.pdf');
  await pp.pdf({ path: pdf, width: '1920px', height: '1080px', printBackground: true, preferCSSPageSize: true });

  // 2. PNG per slide and notes, from still mode
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: +(process.env.SCALE || 2) });
  watch(page);
  await page.goto('file://' + FILE + `?still=1&lang=${LANG}`);
  await page.waitForFunction(() => window.DECK_STILL === 'ready', null, { timeout: 30000 });
  const n = await page.evaluate(() => DECK.count);
  const manifest = [];
  for (let i = 0; i < n; i++) {
    await page.evaluate(i => DECK.go(i, 999, { instant: true }), i);
    await page.waitForTimeout(250);
    const png = `png/${String(i + 1).padStart(2, '0')}.png`;
    await page.screenshot({ path: path.join(OUT, png) });
    const notes = await page.evaluate(i => {
      const a = document.querySelectorAll('#stage .slide')[i].querySelector('aside.notes');
      return a ? [...a.children].map(c => c.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n') : '';
    }, i);
    const title = await page.evaluate(i => document.querySelectorAll('#stage .slide')[i].getAttribute('aria-label') || '', i);
    manifest.push({ slide: i + 1, title, png, notes });
  }
  fs.writeFileSync(path.join(OUT, 'notes.json'), JSON.stringify(manifest, null, 1));
  await browser.close();
  console.log(`pdf ${pdf}  pngs ${manifest.length}  errors ${errs.length ? errs.join(' | ') : 'none'}`);
  process.exit(errs.length ? 1 : 0);
})();
