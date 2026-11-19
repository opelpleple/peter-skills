// Measure and capture the UI kit. Opens ui/components.html in headless Chromium and, for every element with
// [data-name]:
//   1. records its CSS size and every [data-anchor] inside it (component coordinates, CSS px, top left origin;
//      [data-slot] or [data-font] anchors also record their font) -> work/ui/anchors.json
//   2. screenshots the element alone with a transparent background at DPR (default 3), plus a margin `pad` on
//      every side so CSS shadows are not cut -> film/assets/ui/<name>.png, and film/assets/ui/index.json
// Run by tools/ui/capture.sh. Optional arguments: component names to (re)capture; the others are kept.
// Environment: DPR (default 3), PAD (default margin in CSS px, 48), CHROME (path to a Chrome or Chromium binary;
// default = the browser playwright-core installed), PLAYWRIGHT_CORE_DIR.
// Per component margin: data-pad="80" on the [data-name] element.
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
function loadPw() {
  for (const t of [process.env.PLAYWRIGHT_CORE_DIR, path.join(ROOT, 'tools/vendor/playwright-core')].filter(Boolean)) {
    try { return require(t); } catch { /* next */ }
  }
  throw new Error('playwright-core not found in tools/vendor: run ./setup.sh first');
}
const { chromium } = loadPw();
const DPR = Number(process.env.DPR || 3), PAD = Number(process.env.PAD || 48);
const only = process.argv.slice(2);
const OUT = path.join(ROOT, 'film/assets/ui');

(async () => {
  const o = { headless: true };
  if (process.env.CHROME) o.executablePath = process.env.CHROME;
  const b = await chromium.launch(o);
  const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: DPR });
  const url = 'file://' + path.join(ROOT, 'ui/components.html');
  await p.goto(url, { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(300);
  // the page background must be transparent for the captures
  await p.addStyleTag({ content: 'html, body { background: transparent !important; }' });
  const data = await p.evaluate(() => {
    const out = {};
    for (const el of document.querySelectorAll('[data-name]')) {
      const r = el.getBoundingClientRect();
      const anchors = {};
      for (const a of el.querySelectorAll('[data-anchor]')) {
        const q = a.getBoundingClientRect();
        const o = { x: +(q.left - r.left).toFixed(1), y: +(q.top - r.top).toFixed(1), w: +q.width.toFixed(1), h: +q.height.toFixed(1) };
        o.cx = +(o.x + o.w / 2).toFixed(1); o.cy = +(o.y + o.h / 2).toFixed(1);
        if (a.hasAttribute('data-slot') || a.dataset.font !== undefined) {
          const cs = getComputedStyle(a);
          o.font = { size: parseFloat(cs.fontSize), weight: +cs.fontWeight, color: cs.color, lineHeight: parseFloat(cs.lineHeight) || null, align: cs.textAlign };
        }
        anchors[a.dataset.anchor] = o;
      }
      out[el.dataset.name] = { w: Math.round(r.width), h: Math.round(r.height), anchors, pad: el.dataset.pad ? Number(el.dataset.pad) : null,
        box: [r.left + scrollX, r.top + scrollY, r.width, r.height] };
    }
    return out;
  });
  fs.mkdirSync(path.join(ROOT, 'work/ui'), { recursive: true });
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'work/ui/anchors.json'), JSON.stringify(data, null, 1));
  const idxFile = path.join(OUT, 'index.json');
  const index = fs.existsSync(idxFile) ? JSON.parse(fs.readFileSync(idxFile, 'utf8')) : {};
  // a page tall enough to hold every component plus its margin
  const full = await p.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.scrollHeight]);
  await p.setViewportSize({ width: Math.max(1440, full[0] + 400), height: Math.max(900, full[1] + 400) });
  for (const [name, d] of Object.entries(data)) {
    if (only.length && !only.includes(name)) continue;
    const pad = d.pad ?? PAD;
    const [x, y, w, h] = await p.evaluate((n) => { const r = document.querySelector(`[data-name="${n}"]`).getBoundingClientRect(); return [r.left + scrollX, r.top + scrollY, r.width, r.height]; }, name);
    // the shot is exactly (w + 2 pad) x (h + 2 pad) CSS px, so the PNG maps 1:1 to the manifest numbers
    const clip = { x: x - pad, y: y - pad, width: Math.round(w) + 2 * pad, height: Math.round(h) + 2 * pad };
    if (clip.x < 0 || clip.y < 0) console.warn(`${name}: margin runs off the page (move it away from the edge in components.html)`);
    await p.screenshot({ path: path.join(OUT, `${name}.png`), clip, omitBackground: true, fullPage: true });
    index[name] = { w: Math.round(w), h: Math.round(h), pad, dpr: DPR };
    console.log(`  ${name}: ${Math.round(w)}x${Math.round(h)} css px, pad ${pad}, ${clip.width * DPR}x${clip.height * DPR} png`);
  }
  fs.writeFileSync(idxFile, JSON.stringify(index, null, 1));
  await b.close();
  console.log('components', Object.keys(data).length);
})().catch((e) => { console.error(e); process.exit(1); });
