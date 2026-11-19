#!/usr/bin/env node
// Automated QA for a built deck: one screenshot per slide (final step), layout checks, contact sheet.
// usage: node check.cjs <deck.html> <outdir>
// env:   VW=1920 VH=1080 (viewport)  STEPS=all (also shoot every build step)  LANG_=xx (one language)
//        PLAYWRIGHT=/path/to/node_modules/playwright   CHROME=/path/to/chrome
// exit 1 when any error-level issue is found. Read contact.png yourself after it passes.
const path = require('path'), fs = require('fs');

function loadPW() {
  for (const p of [process.env.PLAYWRIGHT, 'playwright', 'playwright-core']) {
    if (!p) continue;
    try { return require(p); } catch (e) { /* try next */ }
  }
  console.error('playwright not found. npm i -D playwright, or set PLAYWRIGHT=/path/to/node_modules/playwright');
  process.exit(2);
}
const MAC_CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const CHROME = process.env.CHROME || (fs.existsSync(MAC_CHROME) ? MAC_CHROME : undefined);

const FILE = path.resolve(process.argv[2] || 'dist/index.html');
const OUT = path.resolve(process.argv[3] || 'qa');
const VW = +(process.env.VW || 1920), VH = +(process.env.VH || 1080);
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const { chromium } = loadPW();
  const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});
  const page = await browser.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1 });
  const logs = [], net = [];
  page.on('console', m => { if (['warning', 'error'].includes(m.type())) logs.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', e => logs.push('pageerror: ' + e.message));
  page.on('request', r => { const u = r.url(); if (!/^(file|data|blob|about):/.test(u)) net.push(u); });

  const q = `?still=1${process.env.LANG_ ? '&lang=' + process.env.LANG_ : ''}`;
  await page.goto('file://' + FILE + q);
  await page.waitForFunction(() => window.DECK_STILL === 'ready', null, { timeout: 30000 });
  const n = await page.evaluate(() => DECK.count);
  const report = { file: FILE, viewport: `${VW}x${VH}`, slides: n, errors: [], warnings: [], shots: [] };

  for (let i = 0; i < n; i++) {
    const last = await page.evaluate(i => DECK.steps(i), i);
    const ks = process.env.STEPS === 'all' ? [...Array(last + 1).keys()] : [last];
    for (const k of ks) {
      await page.evaluate(([i, k]) => DECK.go(i, k, { instant: true }), [i, k]);
      await page.waitForTimeout(250);
      const name = `${String(i + 1).padStart(2, '0')}${ks.length > 1 ? '-s' + k : ''}.png`;
      await page.screenshot({ path: path.join(OUT, name) });
      report.shots.push(name);
      if (k !== last) continue;
      const found = await page.evaluate(i => {
        const sl = document.querySelectorAll('#stage .slide')[i];
        const st = document.getElementById('stage').getBoundingClientRect();
        const scale = st.width / 1920;
        const err = [], warn = [];
        const vis = el => { for (let e = el; e && e !== sl; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) return false; } return true; };
        const label = el => `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''} "${(el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 36)}"`;
        // text leaves: elements that own a non-empty text node
        const leaves = [...sl.querySelectorAll('*')].filter(e => !e.closest('aside.notes') && [...e.childNodes].some(c => c.nodeType === 3 && c.textContent.trim()) && vis(e));
        for (const e of leaves) {
          const r = e.getBoundingClientRect();
          if (r.width && (r.left < st.left - 2 || r.top < st.top - 2 || r.right > st.right + 2 || r.bottom > st.bottom + 2)) err.push(`beyond stage: ${label(e)}`);
          const fs = parseFloat(getComputedStyle(e).fontSize);
          if (fs < 20 && !e.closest('.micro,[data-small]')) warn.push(`small text ${fs}px: ${label(e)}`);
          if (r.bottom > st.bottom - 64 * scale && r.right > st.right - 260 * scale) warn.push(`in HUD corner: ${label(e)}`);
        }
        // boxes: overflow and text sticking out
        const boxes = [...sl.querySelectorAll('.box,.card,[data-qa="box"]')].filter(vis);
        for (const b of boxes) {
          if (b.scrollHeight > b.clientHeight + 2) err.push(`overflow Y ${b.scrollHeight}>${b.clientHeight}: ${label(b)}`);
          if (b.scrollWidth > b.clientWidth + 2) err.push(`overflow X ${b.scrollWidth}>${b.clientWidth}: ${label(b)}`);
          const br = b.getBoundingClientRect();
          b.querySelectorAll('*').forEach(c => { if (!vis(c)) return; const r = c.getBoundingClientRect(); if (r.width && (r.bottom > br.bottom + 2 || r.right > br.right + 2)) err.push(`sticks out of box: ${label(c)}`); });
        }
        // collisions: boxes with boxes, text leaves with text leaves
        // inline boxes report the font content area (taller than the ink); clip them to the em box
        const box = E => { const r = E.getBoundingClientRect(), cs = getComputedStyle(E); if (cs.display !== 'inline') return r; const fs = parseFloat(cs.fontSize) * scale, pad = Math.max(0, (r.height - fs) / 2); return { left: r.left, right: r.right, top: r.top + pad, bottom: r.bottom - pad }; };
        const hit = (A, B) => { const a = box(A), b = box(B); const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left), oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top); return ox > 3 && oy > 3 ? [Math.round(ox), Math.round(oy)] : null; };
        const pairs = (list, kind) => { for (let a = 0; a < list.length; a++) for (let b = a + 1; b < list.length; b++) {
          const A = list[a], B = list[b];
          if (A.contains(B) || B.contains(A) || A.closest('[data-allow-overlap]') || B.closest('[data-allow-overlap]')) continue;
          const o = hit(A, B); if (o) err.push(`${kind} overlap ${o[0]}x${o[1]}: ${label(A)} / ${label(B)}`);
        } };
        pairs(boxes, 'box');
        pairs(leaves, 'text');
        const words = leaves.map(e => [...e.childNodes].filter(c => c.nodeType === 3).map(c => c.textContent).join(' ')).join(' ').split(/\s+/).filter(Boolean).length;
        if (words > 60) warn.push(`dense slide: ${words} words on screen (aim for 30 or fewer)`);
        if (!sl.querySelector('aside.notes')?.textContent.trim()) warn.push('no speaker notes');
        return { err: [...new Set(err)], warn: [...new Set(warn)], words };
      }, i);
      found.err.forEach(e => report.errors.push(`slide ${i + 1}: ${e}`));
      found.warn.forEach(w => report.warnings.push(`slide ${i + 1}: ${w}`));
    }
  }
  logs.forEach(l => report.errors.push('console ' + l));
  [...new Set(net)].forEach(u => report.errors.push('network request: ' + u));

  // contact sheet
  const cols = 4, tw = 480, th = Math.round(tw * VH / VW);
  const cells = report.shots.map(s => `<figure><img src="${s}" width="${tw}" height="${th}"><figcaption>${s.replace('.png', '')}</figcaption></figure>`).join('');
  fs.writeFileSync(path.join(OUT, 'contact.html'), `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#1b1d22;font:13px/1 ui-monospace,monospace;color:#aab}main{display:grid;grid-template-columns:repeat(${cols},${tw}px);gap:16px;padding:16px}figure{margin:0}img{display:block;border-radius:6px;background:#000}figcaption{padding:6px 2px}</style><main>${cells}</main>`);
  const sheet = await browser.newPage({ viewport: { width: cols * (tw + 16) + 16, height: 400 } });
  await sheet.goto('file://' + path.join(OUT, 'contact.html'));
  await sheet.waitForTimeout(300);
  await sheet.screenshot({ path: path.join(OUT, 'contact.png'), fullPage: true });
  await browser.close();

  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 1));
  console.log(`slides ${n}  shots ${report.shots.length}  errors ${report.errors.length}  warnings ${report.warnings.length}`);
  report.errors.forEach(e => console.log('ERROR', e));
  report.warnings.forEach(w => console.log('warn ', w));
  console.log('contact sheet:', path.join(OUT, 'contact.png'));
  process.exit(report.errors.length ? 1 : 0);
})();
