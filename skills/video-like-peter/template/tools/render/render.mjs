#!/usr/bin/env node
// Frame-exact renderer for pages that follow the MV contract (docs/engine.md, "Render contract").
// Serves the project folder over http, opens the page in headless Chromium (Metal GPU by default), calls
// window.MV.renderFrame(f) for each frame and captures the result, in parallel workers (one browser each).
// Pixels travel from the page to Node as a base64 string over the DevTools protocol: no Blob per frame
// (8 MB Blobs piled up in Chromium's blob store and helped freeze the Mac; see docs/engine.md, "Rendering safely").
// A memory guard pauses the workers when the Mac runs short of memory and stops the run cleanly if it gets worse.
const HELP = `usage: node tools/render/render.mjs <page.html> [mode] [options]

modes (pick one; default --info)
  --info                       load the page, print its MV metadata and the GPU in use
  --check [--frames a,b]       determinism: each frame twice in one worker (another frame between) and once in
                               a second browser; reports hashes and blank or transparent frames
  --frames 0,150,300           stills by frame index            (default format png, out <out>/stills)
  --times 12.5,40              stills by time in seconds (frame = round(t*fps)); times at or past the film
                               length are skipped with a note (the last frame is at length - 1/fps)
  --from A --to B [--step S]   frame range, B exclusive         (default format jpg, out <out>/frames)
  --from-t 10 --to-t 20        the same in seconds
  --all                        every frame of the film          (default format chunks, out <out>/chunks)

options
  --w 1920 --h 1080            output size, passed to the page as ?w=&h= (also the viewport); --preview = 960x540
  --out DIR                    output folder (default work/render/<page-slug>-<w>x<h>)
  --format png|jpg|chunks      one image file per frame, or lossless video chunks (one ffmpeg per worker)
  --codec utvideo|ffv1|x264rgb chunk codec, all lossless RGB (default utvideo: least CPU; ffv1: smallest files)
  --chunk 300                  frames per chunk (default 300 = 10 s)
  --quality 92                 jpg quality
  --capture canvas|screenshot  canvas (default when the page sets MV.canvas): pixels of MV.canvas read in the page;
                               screenshot: compositor screenshot of the viewport (any DOM/SVG/canvas mix)
  --workers N                  parallel pages, one browser each (default 4, at most 6)
  --i-tested-8                 allow up to 8 workers (see docs/engine.md, "Rendering safely")
  --browsers K                 spread the workers over K browser processes (default = workers)
  --browser shell|chromium|chrome  chromium-headless-shell 1248 (default), Chrome for Testing 1248, or an
                               installed Google Chrome: env CHROME=/path/to/chrome, else the macOS app path,
                               else Playwright's 'chrome' channel (Linux, Windows)
  --gpu metal|swiftshader      metal (default on macOS, verified at start) or the software rasterizer (default
                               elsewhere); env RENDER_GPU sets the default too
  --param k=v                  extra URL parameter for the page (repeatable)
  --chrome-arg=--flag          extra Chromium command-line flag (repeatable)
  --accel-2d                   keep GPU-accelerated 2D canvases (faster in some pages, not bit-identical across
                               browsers); default is the software 2D canvas
  --batch 30                   frames per work unit in file modes
  --force                      ignore and overwrite previous output in the out folder
  --allow-changed              resume even though the page files changed since the last run
  --strict                     abort on any page error, console error or failed request
  --timeout 120                seconds to wait for MV.ready and for any single frame
  --mem-pause 20               free memory (sysctl kern.memorystatus_level, percent) below which the workers wait;
                               they resume at mem-pause + 5; the run stops after --mem-wait 600 seconds of waiting
  --mem-abort 12               free memory below which the run stops at once, closing every browser and encoder
  --progress-every 5           seconds between progress lines
  --summary FILE               write the timing summary JSON here too
  --quiet / --verbose
Resume is automatic: finished frame files and finished chunks are skipped.
Exit codes: 0 ok, 1 error, 2 bad arguments, 3 stopped by the memory or disk guard, 129/130/143 signal.`;

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawn, execFile, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';
import { startServer, PROJECT_ROOT } from './server.mjs';

const require = createRequire(import.meta.url);
// System tools by absolute path, so the memory guard and the leftover-process check also work from a shell
// whose PATH lacks /usr/sbin (verified 2026-11-08: `env -i bash` has no sysctl on PATH, and a guard that cannot
// read the memory level would otherwise do nothing). ffmpeg: PATH first, then the Homebrew location.
function which(name, fallbacks) {
  for (const d of String(process.env.PATH || '').split(path.delimiter)) {
    if (d && fs.existsSync(path.join(d, name))) return path.join(d, name);
  }
  return fallbacks.find((p) => fs.existsSync(p)) || name;
}
const BIN = {
  sysctl: fs.existsSync('/usr/sbin/sysctl') ? '/usr/sbin/sysctl' : 'sysctl',
  ps: fs.existsSync('/bin/ps') ? '/bin/ps' : 'ps',
  ffmpeg: which('ffmpeg', ['/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg']),
};
function loadPlaywright() {
  const tries = [process.env.PLAYWRIGHT_CORE_DIR, path.join(PROJECT_ROOT, 'tools/vendor/playwright-core')].filter(Boolean);
  for (const t of tries) { try { return { pw: require(t), from: t }; } catch { /* try next */ } }
  throw new Error('playwright-core not found (looked in tools/vendor/playwright-core): run ./setup.sh, or set PLAYWRIGHT_CORE_DIR');
}

// ------------------------------------------------------------------ args
const BOOL = new Set(['info', 'check', 'all', 'force', 'allow-changed', 'strict', 'quiet', 'verbose', 'help', 'preview', 'accel-2d', 'i-tested-8']);
const argv = process.argv.slice(2);
const flags = { param: [], 'chrome-arg': [] };
const pos = [];
function die(msg) { console.error('render: ' + msg); process.exit(2); }
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (!a.startsWith('--')) { pos.push(a); continue; }
  const eq = a.indexOf('=');
  const k = eq > 2 ? a.slice(2, eq) : a.slice(2);
  if (BOOL.has(k)) { flags[k] = true; continue; }
  const v = eq > 2 ? a.slice(eq + 1) : argv[++i];
  if (v === undefined) die(`missing value for --${k}`);
  if (k === 'param' || k === 'chrome-arg') flags[k].push(v); else flags[k] = v;
}
if (flags.help || !pos[0]) { console.log(HELP); process.exit(flags.help ? 0 : 1); }
const log = (...a) => { if (!flags.quiet) console.log(...a); };
const vlog = (...a) => { if (flags.verbose) console.log(...a); };

const pageFile = path.resolve(pos[0]);
if (!fs.existsSync(pageFile)) die('page not found: ' + pageFile);
const root = path.resolve(flags.root || PROJECT_ROOT);
if (!pageFile.startsWith(root + path.sep)) die(`page must be inside the served root ${root}`);
const pageRel = path.relative(root, pageFile).split(path.sep).join('/');
const W = Number(flags.w || (flags.preview ? 960 : 1920));
const H = Number(flags.h || (flags.preview ? 540 : 1080));
// Worker cap: 6 by default. Each worker is a whole Chromium (browser, GPU and renderer processes) plus an
// ffmpeg; 12 of them with leaking per-frame Blobs froze the Mac on 2026-11-08. 8 needs --i-tested-8.
const WORKER_CAP = flags['i-tested-8'] ? 8 : 6;
const workersN = Number(flags.workers ?? 4);
if (!Number.isInteger(workersN) || workersN < 1) die('--workers must be a positive integer');
if (workersN > WORKER_CAP) die(`--workers ${workersN} is above the cap of ${WORKER_CAP}${WORKER_CAP < 8 ? ' (8 needs --i-tested-8, see docs/engine.md "Rendering safely"; more than 8 is never allowed)' : ' (more than 8 is never allowed)'}`);
const browsersN = Math.max(1, Math.min(workersN, Number(flags.browsers || workersN)));
const timeoutMs = Number(flags.timeout || 120) * 1000;
const gpu = flags.gpu || process.env.RENDER_GPU || (process.platform === 'darwin' ? 'metal' : 'swiftshader');
const browserKind = flags.browser || 'shell';
const MEM_PAUSE = Number(flags['mem-pause'] ?? 20), MEM_ABORT = Number(flags['mem-abort'] ?? 12), MEM_WAIT_MAX_S = Number(flags['mem-wait'] ?? 600);
if (!(MEM_ABORT >= 0 && MEM_PAUSE >= MEM_ABORT && MEM_PAUSE <= 95)) die('need 0 <= --mem-abort <= --mem-pause <= 95');
if (!(MEM_WAIT_MAX_S > 0)) die('--mem-wait must be a positive number of seconds');
const progressEvery = Math.max(1, Number(flags['progress-every'] || 5)) * 1000;
const slug = pageRel.replace(/\/index\.html?$/, '').replace(/\.html?$/, '').replace(/[^A-Za-z0-9._-]+/g, '-');
const outDir = path.resolve(flags.out || path.join(root, 'work', 'render', `${slug}-${W}x${H}`));

let mode = 'info';
if (flags.check) mode = 'check';
else if (flags.frames || flags.times) mode = 'stills';
else if (flags.all) mode = 'all';
else if (flags.from !== undefined || flags['from-t'] !== undefined || flags.to !== undefined || flags['to-t'] !== undefined) mode = 'range';

// ------------------------------------------------------------------ helpers
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fmtTime = (s) => { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return (h ? h + 'h' : '') + (h || m ? String(m).padStart(h ? 2 : 1, '0') + 'm' : '') + String(x).padStart(h || m ? 2 : 1, '0') + 's'; };
const pad5 = (f) => String(f).padStart(5, '0');
const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex');
function stats(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b), q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return { n: s.length, mean: +(s.reduce((a, b) => a + b, 0) / s.length).toFixed(2), p50: +q(0.5).toFixed(2), p95: +q(0.95).toFixed(2), max: +s[s.length - 1].toFixed(2) };
}
/** A frame file is complete when it ends with the format's end marker (PNG IEND chunk, JPEG EOI). */
function fileComplete(file) {
  let fd;
  try {
    fd = fs.openSync(file, 'r');
    const size = fs.fstatSync(fd).size;
    if (size < 64) return false;
    const tail = Buffer.alloc(12);
    fs.readSync(fd, tail, 0, 12, size - 12);
    if (file.endsWith('.png')) return tail.subarray(4, 8).toString('latin1') === 'IEND';
    if (file.endsWith('.jpg')) return tail[10] === 0xff && tail[11] === 0xd9;
    return true;
  } catch { return false; } finally { if (fd !== undefined) fs.closeSync(fd); }
}
/** Frames the song lasts at `fps`, read from the WAV header (RIFF fmt + data chunks); null if unreadable. */
function songFrames(wav, fps) {
  let fd;
  try {
    fd = fs.openSync(wav, 'r');
    const head = Buffer.alloc(4096);
    const n = fs.readSync(fd, head, 0, head.length, 0);
    if (n < 44 || head.toString('latin1', 0, 4) !== 'RIFF' || head.toString('latin1', 8, 12) !== 'WAVE') return null;
    let pos = 12, rate = 0, align = 0;
    while (pos + 8 <= n) {
      const id = head.toString('latin1', pos, pos + 4), size = head.readUInt32LE(pos + 4);
      if (id === 'fmt ') { rate = head.readUInt32LE(pos + 12); align = head.readUInt16LE(pos + 20); }
      if (id === 'data') return rate && align ? Math.round(size / align / rate * fps) : null;
      pos += 8 + size + (size & 1);
    }
    return null;
  } catch { return null; } finally { if (fd !== undefined) fs.closeSync(fd); }
}
async function writeAtomic(file, buf) {
  const tmp = file + '.tmp' + process.pid;
  await fs.promises.writeFile(tmp, buf);
  await fs.promises.rename(tmp, file);
}
function withTimeout(promise, ms, what) {
  let timer;
  const limit = new Promise((_, rej) => { timer = setTimeout(() => rej(new Error(what + ` did not finish within ${ms / 1000} s`)), ms); });
  return Promise.race([promise, limit]).finally(() => clearTimeout(timer));
}

// Lossless chunk codecs. Measured on the demo (noisy grain, 1920x1080), CPU summed over threads per frame:
// utvideo 27 ms, 2.7 MB/frame | x264rgb ultrafast 48 ms, 3.4 MB | ffv1 85-108 ms, 2.3 MB. utvideo is the default.
const CODECS = {
  utvideo: { ext: 'mkv', mbPerFrame: 2.8, args: (t) => ['-c:v', 'utvideo', '-pix_fmt', 'gbrp', '-threads', String(t)] },
  ffv1: { ext: 'mkv', mbPerFrame: 2.4, args: (t) => ['-c:v', 'ffv1', '-level', '3', '-coder', '0', '-g', '1', '-slices', t > 4 ? '9' : '4', '-slicecrc', '0', '-threads', String(t), '-pix_fmt', 'bgr0'] },
  x264rgb: { ext: 'mkv', mbPerFrame: 3.5, args: (t) => ['-c:v', 'libx264rgb', '-preset', 'ultrafast', '-qp', '0', '-pix_fmt', 'rgb24', '-threads', String(t)] },
};

// ------------------------------------------------------------------ run state, process tree, guards
const problems = [];
let aborted = false, stopCode = 0, stopReason = '';
const children = new Set();   // ffmpeg encoders
const browsers = [];

function problem(kind, detail, worker = '') {
  const msg = `${kind}${worker !== '' ? ' [w' + worker + ']' : ''}: ${detail}`;
  problems.push(msg);
  if (problems.length <= 40) console.log('  PAGE PROBLEM ' + msg);
  if (flags.strict) aborted = true;
}

/** {self, list:[{pid, rss}]} for every descendant of `rootPid`, from one `ps` listing (rss in KB). */
function descendants(psOut, rootPid) {
  const kids = new Map(), info = new Map();
  for (const l of psOut.split('\n')) {
    const m = /^\s*(\d+)\s+(\d+)\s+(\d+)\s*(.*)$/.exec(l);
    if (!m) continue;
    const [pid, ppid, rss] = [Number(m[1]), Number(m[2]), Number(m[3])];
    info.set(pid, { rss, comm: path.basename(m[4] || '') });
    if (!kids.has(ppid)) kids.set(ppid, []);
    kids.get(ppid).push(pid);
  }
  const list = [], st = [...(kids.get(rootPid) || [])];
  while (st.length) { const q = st.pop(); list.push({ pid: q, ...(info.get(q) || { rss: 0, comm: '' }) }); for (const c of kids.get(q) || []) st.push(c); }
  return { self: (info.get(rootPid) || { rss: 0 }).rss, list };
}
/** Last resort on exit: SIGKILL anything this process started that is still alive (browsers, encoders). */
function killDescendantsSync() {
  try {
    const d = descendants(execFileSync(BIN.ps, ['-axo', 'pid=,ppid=,rss=,comm='], { encoding: 'utf8' }), process.pid);
    // not worth reporting: the guard's own short probes, zombies (already dead) and processes still exec'ing
    const left = d.list.filter((x) => !['ps', 'sysctl', '<defunct>'].includes(x.comm) && !x.comm.startsWith('('));
    for (const { pid } of d.list) { try { process.kill(pid, 'SIGKILL'); } catch { /* gone */ } }
    return left;
  } catch { return []; }
}
// One render.mjs per output folder: a second process would delete the first one's unfinished chunk files at start-up
// and both would write the same chunks. The lock lives in the stills/, frames/ or chunks/ folder, so preview stills
// can still be rendered while a full render writes chunks into the same <out> folder.
let lockFile = null;
function takeLock(dir) {
  const f = path.join(dir, '.render.lock');
  for (let i = 0; i < 2; i++) {
    try {
      fs.writeFileSync(f, JSON.stringify({ pid: process.pid, since: new Date().toISOString(), argv: process.argv.slice(2) }), { flag: 'wx' });
      lockFile = f;
      return;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      let other = null;
      try { other = JSON.parse(fs.readFileSync(f, 'utf8')); } catch { /* unreadable: treat as stale */ }
      let alive = false;
      if (other && Number.isInteger(other.pid) && other.pid !== process.pid) {
        // alive and still a node process (a recycled pid of some other program does not count)
        try { alive = /node/i.test(execFileSync(BIN.ps, ['-p', String(other.pid), '-o', 'comm='], { encoding: 'utf8' })); } catch { alive = false; }
      }
      if (alive) throw new Error(`another render.mjs (pid ${other.pid}, since ${other.since}) is writing to ${dir}; wait for it to finish or use another --out`);
      fs.rmSync(f, { force: true }); // stale lock of a process that is gone
    }
  }
  throw new Error('could not take the output lock ' + f);
}
function releaseLock() {
  if (!lockFile) return;
  try { const o = JSON.parse(fs.readFileSync(lockFile, 'utf8')); if (o.pid === process.pid) fs.rmSync(lockFile, { force: true }); } catch { /* gone */ }
  lockFile = null;
}
process.on('exit', () => { releaseLock(); const left = killDescendantsSync(); if (left.length) console.error(`render: killed ${left.length} leftover child processes on exit: ${left.map((x) => x.comm).join(', ')}`); });

// Rejected by stopRun: the main flow races its work against it, so a stop never waits for a call that a closing
// browser leaves unanswered (measured: without it, 4 of 7 interrupted runs sat 20 s until the hard exit).
let abortReject = () => {};
const abortPromise = new Promise((_, rej) => { abortReject = rej; });
abortPromise.catch(() => {});

/** Stop everything now: kill the encoders, close the browsers, stop waiting for the work, exit with `code`. */
function stopRun(reason, code) {
  if (stopCode) return;
  aborted = true; stopCode = code; stopReason = reason;
  abortReject(new Error(reason));
  console.error(`render: STOP ${reason}. Closing browsers and encoders; finished frames and chunks are kept for resume.`);
  for (const c of children) { try { c.kill('SIGKILL'); } catch { /* gone */ } }
  for (const b of browsers) b.close().catch(() => {});
  // a browser that has not exited after 3 s is killed with its helpers (pending page calls then fail at once);
  // measured: a graceful close sometimes took over 20 s while a frame was in flight
  setTimeout(() => { const left = killDescendantsSync(); if (left.length) console.error(`render: killed ${left.length} processes that did not close within 3 s: ${[...new Set(left.map((x) => x.comm))].join(', ')}`); }, 3000).unref();
  setTimeout(() => { killDescendantsSync(); process.exit(code); }, 20000).unref();
}
for (const [sig, code] of [['SIGINT', 130], ['SIGTERM', 143], ['SIGHUP', 129]]) {
  process.on(sig, () => { if (stopCode) { killDescendantsSync(); process.exit(code); } stopRun('interrupted by ' + sig, code); });
}

// Memory guard: every 2 s read the free-memory level macOS uses for its own pressure decisions, and the RSS of
// this process tree. Pause below --mem-pause, stop below --mem-abort (an outside heavy-job wrapper, if you use one, may kill earlier).
const mem = { level: null, min: 101, paused: false, pausedSince: 0, treeMB: 0, peakTreeMB: 0, busy: false, unreadable: 0 };
const execOut = (cmd, args) => new Promise((res) => execFile(cmd, args, { timeout: 5000, maxBuffer: 16 << 20 }, (e, out) => res(e ? null : String(out))));
async function memTick() {
  if (mem.busy) return;
  mem.busy = true;
  try {
    // test hook: RENDER_TEST_MEMFILE names a file whose number replaces the sysctl reading,
    // so the pause, resume and stop paths of the guard can be exercised without starving the Mac of memory
    const fake = process.env.RENDER_TEST_MEMFILE ? (() => { try { return fs.readFileSync(process.env.RENDER_TEST_MEMFILE, 'utf8'); } catch { return null; } })() : null;
    const v = Number((fake ?? await execOut(BIN.sysctl, ['-n', 'kern.memorystatus_level']) ?? '').trim());
    if (!(Number.isFinite(v) && v > 0) && ++mem.unreadable === 1) console.error(`render: WARNING cannot read free memory (${BIN.sysctl} -n kern.memorystatus_level): the memory guard is not working`);
    if (Number.isFinite(v) && v > 0) {
      mem.level = v; mem.min = Math.min(mem.min, v);
      if (v < MEM_ABORT) stopRun(`free memory ${v}% is below --mem-abort ${MEM_ABORT}%`, 3);
      else if (v < MEM_PAUSE && !mem.paused) { mem.paused = true; mem.pausedSince = Date.now(); console.log(`  MEMORY free ${v}% < ${MEM_PAUSE}%: workers wait until ${MEM_PAUSE + 5}%`); }
      else if (mem.paused && v >= MEM_PAUSE + 5) { mem.paused = false; console.log(`  MEMORY free ${v}%: workers resume`); }
      if (mem.paused && Date.now() - mem.pausedSince > MEM_WAIT_MAX_S * 1000) stopRun(`free memory stayed below ${MEM_PAUSE + 5}% for ${MEM_WAIT_MAX_S} s (--mem-wait)`, 3);
    }
    const out = await execOut(BIN.ps, ['-axo', 'pid=,ppid=,rss=,comm=']);
    if (out) {
      const d = descendants(out, process.pid);
      mem.treeMB = Math.round((d.self + d.list.reduce((s, x) => s + x.rss, 0)) / 1024);
      mem.peakTreeMB = Math.max(mem.peakTreeMB, mem.treeMB);
    }
  } finally { mem.busy = false; }
}
const memTimer = setInterval(memTick, 2000);
memTimer.unref();
async function memGate() { while (mem.paused && !aborted) await sleep(500); }

// Disk guard: stop (instead of filling the disk) when the output still to come does not fit, keeping 2 GB spare.
const DISK_SPARE = 2e9;
function diskFree(dir) { try { const st = fs.statfsSync(dir); return Number(st.bavail) * Number(st.bsize); } catch { return null; } }

// ------------------------------------------------------------------ browsers and pages
const { pw, from: pwFrom } = loadPlaywright();
const server = await startServer({ root, onEvent: (e) => problem(e.type, e.path + (e.detail ? ' ' + e.detail : '')) });
function launchArgs() {
  const a = ['--force-color-profile=srgb', '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows', '--disable-features=CalculateNativeWinOcclusion,PaintHolding', '--hide-scrollbars',
    '--mute-audio', '--autoplay-policy=no-user-gesture-required', '--disable-gpu-vsync', '--disable-frame-rate-limit',
    // offline by construction: every hostname except localhost fails to resolve
    '--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE localhost , EXCLUDE 127.0.0.1'];
  // GPU-accelerated 2D canvases differ by +-1 in a few edge pixels between browser processes (measured with
  // shadowBlur text); the software 2D canvas is bit-identical across processes. --accel-2d turns it back on.
  if (!flags['accel-2d']) a.push('--disable-accelerated-2d-canvas');
  if (gpu === 'metal') a.push('--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist');
  else if (gpu === 'swiftshader') a.push('--use-angle=swiftshader', '--enable-unsafe-swiftshader');
  return a.concat(flags['chrome-arg']);
}
async function launchBrowser() {
  // our own signal handlers close the browsers (Playwright's would exit before the encoders are stopped)
  const o = { headless: true, args: launchArgs(), handleSIGINT: false, handleSIGTERM: false, handleSIGHUP: false };
  if (browserKind === 'chromium') o.channel = 'chromium';
  else if (browserKind === 'chrome') {
    // an installed Google Chrome: env CHROME=/path/to/chrome wins; else the macOS app path; else Playwright's 'chrome' channel
    if (process.env.CHROME) o.executablePath = process.env.CHROME;
    else if (process.platform === 'darwin') o.executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    else o.channel = 'chrome';
  }
  if (aborted) throw new Error('aborted');
  const b = await pw.chromium.launch(o);
  browsers.push(b);
  if (aborted) b.close().catch(() => {});
  return b;
}
function pageUrl() {
  const u = new URL(server.url + '/' + pageRel.split('/').map(encodeURIComponent).join('/'));
  u.searchParams.set('w', W); u.searchParams.set('h', H); u.searchParams.set('render', '1');
  for (const p of flags.param) { const i = p.indexOf('='); u.searchParams.set(i < 0 ? p : p.slice(0, i), i < 0 ? '1' : p.slice(i + 1)); }
  return u.toString();
}

/** Installed in every page after MV.ready: render frame f, then return its pixels as base64 (raw RGBA, or PNG /
 *  JPEG encoded in the renderer process, which spreads the encoding over the workers). Strings live on the V8
 *  heap, where the garbage collector sees their size; an 8 MB Blob per frame did not get collected. */
function installGrab() {
  const b64 = (u8) => {
    if (typeof u8.toBase64 === 'function') return u8.toBase64();
    let s = '';
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(s);
  };
  window.__mvRenderGrab = async (f, enc, quality) => {
    const M = window.MV;
    const t0 = performance.now();
    await M.renderFrame(f);
    const t1 = performance.now();
    const c = M.canvas;
    if (!c) throw new Error('capture canvas needs MV.canvas');
    let d, flip = false;
    if (enc === 'raw') {
      const w = c.width, h = c.height;
      if (c.__mvGL === undefined) c.__mvGL = c.getContext('webgl2') || c.getContext('webgl') || null;
      const gl = c.__mvGL;
      if (gl) {
        const n = w * h * 4;
        const buf = c.__mvBuf && c.__mvBuf.length === n ? c.__mvBuf : (c.__mvBuf = new Uint8Array(n));
        const is2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
        const prev = gl.getParameter(is2 ? gl.READ_FRAMEBUFFER_BINDING : gl.FRAMEBUFFER_BINDING);
        gl.bindFramebuffer(is2 ? gl.READ_FRAMEBUFFER : gl.FRAMEBUFFER, null);
        gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
        gl.bindFramebuffer(is2 ? gl.READ_FRAMEBUFFER : gl.FRAMEBUFFER, prev);
        d = b64(buf); flip = true; // GL rows start at the bottom
      } else {
        const px = c.getContext('2d').getImageData(0, 0, w, h).data;
        d = b64(new Uint8Array(px.buffer, px.byteOffset, px.byteLength));
      }
    } else {
      const url = c.toDataURL('image/' + enc, quality / 100);
      d = url.slice(url.indexOf(',') + 1);
    }
    return { d, flip, tr: t1 - t0, tg: performance.now() - t1 };
  };
}

let meta = null;
const workers = [];
async function openWorker(id, browser) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.setDefaultTimeout(timeoutMs);
  const wk = { id, ctx, page, cdp: null, frame: null, times: { render: [], grab: [], transfer: [], write: [] } };
  const at = () => (wk.frame !== null ? ` (frame ${wk.frame})` : '');
  page.on('pageerror', (e) => problem('pageerror', String(e).split('\n')[0] + at(), id));
  page.on('console', (m) => { if (m.type() === 'error') problem('console.error', m.text().slice(0, 300) + at(), id); else if (flags.verbose) console.log(`  [w${id} console.${m.type()}] ${m.text().slice(0, 200)}`); });
  page.on('requestfailed', (r) => { if (!aborted) problem('requestfailed', r.url().replace(server.url, '') + ' ' + (r.failure()?.errorText || '') + at(), id); });
  page.on('request', (r) => { const u = r.url(); if (!u.startsWith(server.url) && !u.startsWith('data:') && !u.startsWith('blob:')) problem('network', 'blocked request to ' + u + ' (pages must be offline)', id); });
  page.on('crash', () => { problem('crash', 'page crashed' + at(), id); stopRun(`page of worker ${id} crashed${at()}`, 1); });
  await page.goto(pageUrl(), { waitUntil: 'load', timeout: timeoutMs });
  await page.waitForFunction(() => window.MV && window.MV.ready !== undefined && typeof window.MV.renderFrame === 'function', null, { timeout: timeoutMs })
    .catch(() => { throw new Error('page did not define window.MV = {ready, renderFrame, fps, frames, width, height} within ' + timeoutMs / 1000 + ' s'); });
  await page.evaluate(() => Promise.resolve(window.MV.ready).then(() => true));
  const m = await page.evaluate(() => {
    const M = window.MV;
    let renderer = null;
    try { const c = document.createElement('canvas'); const gl = c.getContext('webgl2') || c.getContext('webgl'); const d = gl && gl.getExtension('WEBGL_debug_renderer_info'); renderer = gl ? (d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) : 'no webgl'; } catch (e) { renderer = 'error ' + e; }
    const fonts = []; document.fonts.forEach((f) => fonts.push({ family: f.family, weight: f.weight, style: f.style, status: f.status }));
    return { fps: M.fps, frames: M.frames, width: M.width, height: M.height, warmup: M.warmup || 0,
      hasCanvas: !!M.canvas, title: document.title, renderer, fonts };
  });
  await page.evaluate(installGrab); // after ready, so it never runs before the page's own code
  wk.cdp = await ctx.newCDPSession(page);
  if (!meta) meta = m;
  wk.meta = m;
  return wk;
}

/** Runtime.evaluate in the page's main world, awaiting promises, value returned by value; with a timeout. */
async function cdpEval(wk, expression) {
  const r = await withTimeout(wk.cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }), timeoutMs, `frame ${wk.frame} in worker ${wk.id}`);
  if (r.exceptionDetails) {
    const ex = r.exceptionDetails;
    throw new Error(`frame ${wk.frame}: ` + String((ex.exception && (ex.exception.description || ex.exception.value)) || ex.text).split('\n')[0]);
  }
  return r.result.value;
}
async function renderOnly(wk, f) {
  wk.frame = f;
  await cdpEval(wk, `Promise.resolve(window.MV.renderFrame(${f})).then(() => 0)`);
}
/** Render frame f and return {raw (RGBA Buffer), flip} or {buf (PNG/JPEG file bytes)}. */
async function renderCapture(wk, f, how) {
  wk.frame = f;
  const t0 = performance.now();
  if (how.capture === 'canvas') {
    const r = await cdpEval(wk, `window.__mvRenderGrab(${f}, ${JSON.stringify(how.enc)}, ${how.quality})`);
    const buf = Buffer.from(r.d, 'base64');
    wk.times.render.push(r.tr); wk.times.grab.push(r.tg); wk.times.transfer.push(performance.now() - t0 - r.tr - r.tg);
    if (how.enc !== 'raw') return { buf };
    if (buf.length !== W * H * 4) throw new Error(`frame ${f}: MV.canvas gave ${buf.length} bytes, expected ${W * H * 4} (the canvas must be ${W}x${H})`);
    return { raw: buf, flip: r.flip };
  }
  // screenshot capture: wait two animation frames after renderFrame so DOM changes are committed before the capture
  // (a cheap precaution, not proven necessary). DOM pages also need will-change on animated elements: without it
  // a frame came out different after other frames (measured)
  await cdpEval(wk, `Promise.resolve(window.MV.renderFrame(${f})).then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(0)))))`);
  const t1 = performance.now();
  const shot = await withTimeout(wk.cdp.send('Page.captureScreenshot', how.enc === 'jpeg'
    ? { format: 'jpeg', quality: how.quality, optimizeForSpeed: true, fromSurface: true, captureBeyondViewport: false }
    : { format: 'png', optimizeForSpeed: true, fromSurface: true, captureBeyondViewport: false }), timeoutMs, `screenshot of frame ${f}`);
  const buf = Buffer.from(shot.data, 'base64');
  wk.times.render.push(t1 - t0); wk.times.grab.push(performance.now() - t1);
  return { buf };
}

// ------------------------------------------------------------------ main
let exitCode = 0;
const tStart = performance.now();
try {
  exitCode = await Promise.race([mainRun(), abortPromise]);
} catch (e) {
  console.error('render: ERROR ' + (stopReason || (e && e.message ? e.message : e)));
  exitCode = stopCode || 1;
} finally {
  aborted = true;
  clearInterval(memTimer);
  for (const c of children) { try { c.kill('SIGKILL'); } catch { /* gone */ } }
  const closed = await withTimeout(Promise.all(browsers.map((b) => b.close().catch(() => {}))), 8000, 'closing the browsers').then(() => true, () => false);
  if (!closed) { const left = killDescendantsSync(); console.error(`render: browsers did not close within 8 s; killed ${left.length} processes`); }
  await withTimeout(server.close(), 5000, 'closing the server').catch(() => {});
}
if (stopCode) exitCode = stopCode;
if (problems.length && flags.strict && !exitCode) exitCode = 1;
for (let i = 0; i < 20 && mem.busy; i++) await sleep(100); // let a running memory probe finish
process.exit(exitCode);

/** Everything between start-up and the summary; returns the exit code. */
async function mainRun() {
  let exitCode = 0;
  await memTick();
  if (mem.paused) { log(`waiting for free memory >= ${MEM_PAUSE + 5}% before starting (now ${mem.level}%)`); await memGate(); }
  if (aborted) throw new Error(stopReason);
  // --check compares against a second browser process even with --workers 1 (only an explicit --browsers 1 keeps one)
  const nBrowsersNeeded = mode === 'info' || mode === 'stills' ? 1 : mode === 'check' ? (flags.browsers ? Math.min(2, browsersN) : 2) : browsersN;
  const b0 = await launchBrowser();
  const first = await openWorker(0, b0);
  workers.push(first);
  if (meta.width !== W || meta.height !== H) throw new Error(`page reports MV.width/height ${meta.width}x${meta.height} but the renderer asked for ${W}x${H}: read ?w=&h= from the URL`);
  if (!(meta.fps > 0) || !(meta.frames > 0)) throw new Error('MV.fps and MV.frames must be positive numbers');
  const badFonts = meta.fonts.filter((f) => f.status === 'error');
  for (const f of badFonts) problem('font', `@font-face failed to load: ${f.family} ${f.weight} ${f.style}`);
  if (gpu === 'metal' && !/Metal/i.test(meta.renderer)) throw new Error('expected the Metal GPU but WebGL reports: ' + meta.renderer + ' (use --gpu swiftshader to allow software)');
  const fingerprint = (() => { const h = crypto.createHash('sha256'); for (const f of [...server.served].sort()) { h.update(f); h.update(fs.readFileSync(path.join(root, f))); } return h.digest('hex').slice(0, 16); })();
  const capture = flags.capture || (meta.hasCanvas ? 'canvas' : 'screenshot');
  if (!['canvas', 'screenshot'].includes(capture)) throw new Error('--capture must be canvas or screenshot');
  if (capture === 'canvas' && !meta.hasCanvas) throw new Error('--capture canvas needs MV.canvas');
  log(`page    ${pageRel}  "${meta.title}"  ${meta.width}x${meta.height} @ ${meta.fps} fps, ${meta.frames} frames (${(meta.frames / meta.fps).toFixed(3)} s)`);
  log(`browser ${b0.version()} (${browserKind}), WebGL: ${meta.renderer}`);
  log(`fonts   ${meta.fonts.filter((f) => f.status === 'loaded').length} faces loaded, ${badFonts.length} failed; files ${server.served.size}; fingerprint ${fingerprint}; capture ${capture}`);
  log(`memory  free ${mem.level}% (pause below ${MEM_PAUSE}%, stop below ${MEM_ABORT}%)`);
  vlog(`playwright-core from ${pwFrom}`);

  if (mode === 'info') {
    console.log(JSON.stringify({ ...meta, fingerprint, capture, served: [...server.served].sort() }, null, 1));
  } else if (mode === 'check') {
    exitCode = await runCheck(capture, nBrowsersNeeded);
  } else {
    // ---------------- frame list
    const fps = meta.fps, total = meta.frames;
    let frames = [];
    if (mode === 'stills') {
      if (flags.frames) frames = String(flags.frames).split(',').map((s) => Number(s.trim()));
      else {
        // times are seconds; the last frame starts at (total - 1) / fps, so a time at or past the film length
        // (e.g. the end of a range 0:6 on a 6 s film) is skipped with a note instead of failing the run
        const last = (total - 1) / fps;
        for (const s of String(flags.times).split(',')) {
          const t = Number(s.trim());
          if (!Number.isFinite(t) || t < 0) throw new Error(`time ${s.trim()} s is not a time inside the film (0..${last.toFixed(3)} s)`);
          const f = Math.round(t * fps);
          if (f >= total) { console.log(`note: time ${t.toFixed(3)} s is at or past the end of the film (${(total / fps).toFixed(3)} s long, last frame at ${last.toFixed(3)} s): skipped`); continue; }
          frames.push(f);
        }
      }
      frames = [...new Set(frames)]; // a frame listed twice would be written by two workers at once
    } else if (mode === 'all') {
      for (let f = 0; f < total; f++) frames.push(f);
    } else {
      const a = flags['from-t'] !== undefined ? Math.round(Number(flags['from-t']) * fps) : Number(flags.from ?? 0);
      const b = flags['to-t'] !== undefined ? Math.round(Number(flags['to-t']) * fps) : Number(flags.to ?? total);
      const step = Math.max(1, Number(flags.step || 1));
      for (let f = a; f < b; f += step) frames.push(f);
    }
    if (!frames.length) throw new Error('no frames selected');
    for (const f of frames) if (!Number.isInteger(f) || f < 0 || f >= total) throw new Error(`frame ${f} (${(f / fps).toFixed(3)} s) outside 0..${total - 1} (0..${((total - 1) / fps).toFixed(3)} s)`);
    const format = flags.format || (mode === 'stills' ? 'png' : mode === 'all' ? 'chunks' : 'jpg');
    if (!['png', 'jpg', 'chunks'].includes(format)) throw new Error('--format must be png, jpg or chunks');
    const quality = Number(flags.quality || 92);
    const codec = flags.codec || 'utvideo';
    if (format === 'chunks' && !CODECS[codec]) throw new Error('--codec must be one of ' + Object.keys(CODECS).join(', '));
    const chunkSize = Number(flags.chunk || 300);
    const sub = mode === 'stills' ? 'stills' : format === 'chunks' ? 'chunks' : 'frames';
    const dir = path.join(outDir, sub);
    fs.mkdirSync(dir, { recursive: true });
    takeLock(dir);
    if (format === 'chunks') {
      try { execFileSync(BIN.ffmpeg, ['-hide_banner', '-version'], { stdio: 'ignore', timeout: 15000 }); }
      catch (e) { throw new Error(`chunks need ffmpeg, which could not be run (${BIN.ffmpeg}): ${e.message}`); }
    }
    if (mode === 'all') {
      const sf = songFrames(path.join(root, 'audio', 'mix.wav'), fps);
      if (sf && sf !== total) log(`  WARNING MV.frames is ${total} but audio/mix.wav lasts ${sf} frames at ${fps} fps (the encode uses -shortest)`);
    }

    // ---------------- manifest / resume safety
    const manFile = path.join(outDir, 'render.json');
    const man = { page: pageRel, w: W, h: H, fps, frames: total, capture, format, codec: format === 'chunks' ? codec : undefined, chunk: format === 'chunks' ? chunkSize : undefined, quality: format === 'jpg' ? quality : undefined, params: flags.param, fingerprint };
    if (fs.existsSync(manFile) && mode !== 'stills') {
      const old = JSON.parse(fs.readFileSync(manFile, 'utf8'));
      const keys = ['page', 'w', 'h', 'fps', 'frames', 'format', 'codec', 'chunk', 'capture'];
      const diff = keys.filter((k) => old[k] !== undefined && man[k] !== undefined && String(old[k]) !== String(man[k]));
      if (diff.length && !flags.force) throw new Error(`${outDir} holds a render with different settings (${diff.join(', ')}); use --force to overwrite or --out to pick another folder`);
      if (old.fingerprint && old.fingerprint !== fingerprint && !flags.force && !flags['allow-changed']) throw new Error(`page files changed since the frames in ${outDir} were rendered (fingerprint ${old.fingerprint} -> ${fingerprint}); --force re-renders everything, --allow-changed keeps old frames`);
    }
    if (flags.force && mode !== 'stills') for (const f of fs.readdirSync(dir)) if (f !== '.render.lock') fs.rmSync(path.join(dir, f), { recursive: true, force: true });
    // leftovers of an interrupted run: unfinished chunks and frame temp files
    for (const f of fs.readdirSync(dir)) if (/\.part$|\.tmp\d+$/.test(f)) fs.rmSync(path.join(dir, f), { force: true });
    if (mode !== 'stills') fs.writeFileSync(manFile, JSON.stringify({ ...man, browser: b0.version(), renderer: meta.renderer, updated: new Date().toISOString() }, null, 1));

    // ---------------- work units
    const units = [];
    let skipped = 0;
    const fileOf = (f) => mode === 'stills' ? path.join(dir, `f${pad5(f)}_t${(f / fps).toFixed(3).padStart(8, '0')}.${format}`) : path.join(dir, `${pad5(f)}.${format}`);
    if (format === 'chunks') {
      const set = new Set(frames);
      const lo = Math.min(...frames), hi = Math.max(...frames) + 1;
      for (let a = Math.floor(lo / chunkSize) * chunkSize; a < hi; a += chunkSize) {
        const b = Math.min(a + chunkSize, total);
        const want = []; for (let f = a; f < b; f++) if (set.has(f)) want.push(f);
        if (!want.length) continue;
        if (want.length !== b - a) throw new Error(`chunk mode renders whole chunks of ${chunkSize} frames: use --from/--to on chunk boundaries (or --chunk) or --all`);
        const name = `c${pad5(a)}-${pad5(b)}`;
        const file = path.join(dir, `${name}.${CODECS[codec].ext}`), side = path.join(dir, `${name}.json`);
        if (!flags.force && fs.existsSync(file) && fs.existsSync(side)) {
          try { const s = JSON.parse(fs.readFileSync(side, 'utf8')); if (s.frames === b - a && s.codec === codec && fs.statSync(file).size === s.bytes) { skipped += b - a; continue; } } catch { /* re-render */ }
        }
        units.push({ kind: 'chunk', a, b, frames: want, file, side, name });
      }
    } else {
      const todo = frames.filter((f) => flags.force || !fileComplete(fileOf(f)));
      skipped = frames.length - todo.length;
      const batch = mode === 'stills' ? 1 : Math.max(1, Number(flags.batch || 30));
      for (let i = 0; i < todo.length; i += batch) units.push({ kind: 'files', frames: todo.slice(i, i + batch) });
    }
    const todoFrames = units.reduce((s, u) => s + u.frames.length, 0);
    log(`job     ${mode} ${frames.length} frames -> ${path.relative(root, dir) || dir} (${format}${format === 'chunks' ? ' ' + codec + ', ' + chunkSize + '/chunk' : ''}), ${skipped} already done, ${todoFrames} to render, ${Math.min(workersN, units.length)} workers`);
    if (format === 'chunks' && todoFrames) {
      const need = todoFrames * CODECS[codec].mbPerFrame * 1e6, free = diskFree(dir);
      if (free !== null && free - need < DISK_SPARE) log(`  WARNING disk: up to ${(need / 1e9).toFixed(1)} GB of chunks expected (noisy frames), ${(free / 1e9).toFixed(1)} GB free; the run stops if it would fill the disk`);
    }
    let tRun = performance.now(), loopSeconds = 0;
    if (!todoFrames) { log('nothing to do'); }
    else {
      // ---------------- workers
      const nW = Math.min(workersN, units.length);
      const nB = Math.min(nBrowsersNeeded, nW);
      const bs = [b0];
      while (bs.length < nB) bs.push(await launchBrowser());
      const opened = await Promise.all(Array.from({ length: nW - 1 }, (_, i) => openWorker(i + 1, bs[(i + 1) % nB])));
      workers.push(...opened);
      let done = 0, lastLog = performance.now(), lastDone = 0;
      tRun = performance.now();
      const progress = (force) => {
        const now = performance.now();
        if (!force && now - lastLog < progressEvery) return;
        const el = (now - tRun) / 1000, fpsAll = done / el, fpsNow = (done - lastDone) / ((now - lastLog) / 1000);
        log(`  ${done}/${todoFrames} (${(100 * done / todoFrames).toFixed(1)}%)  ${fpsAll.toFixed(1)} fps (last ${fpsNow.toFixed(1)})  elapsed ${fmtTime(el)}  ETA ${fmtTime((todoFrames - done) / Math.max(fpsAll, 1e-6))}  mem free ${mem.level}%  tree ${(mem.treeMB / 1024).toFixed(2)} GB`);
        lastLog = now; lastDone = done;
      };
      const how = { capture, enc: format === 'png' ? 'png' : format === 'jpg' ? 'jpeg' : capture === 'canvas' ? 'raw' : 'png', quality };
      let next = 0;
      await Promise.all(workers.slice(0, nW).map(async (wk) => {
        let lastRendered = -2;
        try {
          while (!aborted && next < units.length) {
            await memGate();
            if (aborted) break;
            const u = units[next++];
            // sequential pages: render warm-up frames (not captured) when a unit does not continue the previous one
            const warm = meta.warmup || 0;
            if (warm > 0 && u.frames[0] !== lastRendered + 1) for (let f = Math.max(0, u.frames[0] - warm); f < u.frames[0]; f++) await renderOnly(wk, f);
            if (u.kind === 'files') {
              for (const f of u.frames) {
                if (aborted) break;
                await memGate();
                const r = await renderCapture(wk, f, how);
                const t0 = performance.now();
                await writeAtomic(fileOf(f), r.buf);
                wk.times.write.push(performance.now() - t0);
                lastRendered = f; done++; progress(false);
              }
            } else {
              await renderChunk(wk, u, how, codec, () => { done++; progress(false); }, () => todoFrames - done);
              lastRendered = u.b - 1;
            }
          }
        } catch (e) { if (!aborted) aborted = true; throw e; }
      }));
      loopSeconds = (performance.now() - tRun) / 1000;
      progress(true);
    }
    if (aborted) throw new Error(stopReason || 'aborted (' + (problems[problems.length - 1] || 'interrupted') + ')');
    if (format === 'chunks') {
      const chunkFiles = fs.readdirSync(dir).filter((f) => /^c\d{5}-\d{5}\.json$/.test(f)).sort();
      const covered = chunkFiles.reduce((s, f) => s + JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).frames, 0);
      fs.writeFileSync(path.join(dir, 'list.txt'), chunkFiles.map((f) => `file '${f.replace('.json', '.' + CODECS[codec].ext)}'`).join('\n') + '\n');
      log(`chunks  ${chunkFiles.length} files cover ${covered}/${total} frames; concat list ${path.relative(root, path.join(dir, 'list.txt'))}`);
    }
    // ---------------- summary
    await memTick(); // one more sample while the browsers are still open (short runs end before the 2 s timer fires)
    const el = (performance.now() - tStart) / 1000;
    const startup = el - loopSeconds;
    const all = (k) => stats(workers.flatMap((w) => w.times[k]));
    const loopFps = loopSeconds > 0 ? todoFrames / loopSeconds : 0;
    const summary = { page: pageRel, mode, w: W, h: H, format, codec: format === 'chunks' ? codec : undefined, capture, workers: Math.min(workersN, units.length), browsers: browsers.length,
      browser: `${browserKind} ${b0.version()}`, gpu: meta.renderer, framesRendered: todoFrames, framesSkipped: skipped, seconds: +el.toFixed(2), startupSeconds: +startup.toFixed(2),
      loopSeconds: +loopSeconds.toFixed(2), fps: +(todoFrames / el).toFixed(2), loopFps: +loopFps.toFixed(2),
      msPerFrameRender: all('render'), msPerFrameGrab: all('grab'), msPerFrameTransfer: all('transfer'), msPerFrameWrite: all('write'),
      estimateFullFilm: loopFps ? fmtTime(startup + meta.frames / loopFps) : null, peakTreeRSSMB: mem.peakTreeMB, minFreeMemPct: mem.min > 100 ? null : mem.min,
      problems: problems.length, out: dir };
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, `summary-${mode}.json`), JSON.stringify(summary, null, 1));
    if (flags.summary) fs.writeFileSync(path.resolve(flags.summary), JSON.stringify(summary, null, 1));
    log(`done    ${todoFrames} frames in ${fmtTime(el)} (${summary.loopFps} fps after ${fmtTime(startup)} start-up); per frame per worker: render ${summary.msPerFrameRender?.mean ?? '-'} ms, grab ${summary.msPerFrameGrab?.mean ?? '-'} ms, transfer ${summary.msPerFrameTransfer?.mean ?? '-'} ms; peak tree RSS ${(mem.peakTreeMB / 1024).toFixed(2)} GB, lowest free memory ${summary.minFreeMemPct}%; ${problems.length} page problems`);
  }
  return exitCode;
}

// ------------------------------------------------------------------ chunk writer
async function renderChunk(wk, u, how, codec, onFrame, framesLeft) {
  const part = u.file + '.part';
  let ff = null, ffErr = '', ffExit = null, closed = false, stdinErr = null;
  const threads = Math.max(1, Math.min(4, Math.floor(os.cpus().length / Math.max(1, workers.length))));
  const start = (flip) => {
    const input = how.enc === 'raw'
      ? ['-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-framerate', String(meta.fps), '-i', 'pipe:0']
      : ['-f', 'image2pipe', '-framerate', String(meta.fps), '-c:v', how.enc === 'png' ? 'png' : 'mjpeg', '-i', 'pipe:0'];
    // thread counts are capped per worker (filters and encoder) so N workers never start N x 15 threads
    const args = ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-filter_threads', String(threads), ...input,
      ...(flip ? ['-vf', 'vflip'] : []), ...CODECS[codec].args(threads), '-an', '-f', 'matroska', part];
    ff = spawn(BIN.ffmpeg, args, { stdio: ['pipe', 'ignore', 'pipe'] });
    children.add(ff);
    ff.stderr.on('data', (d) => { ffErr += d; });
    ffExit = new Promise((r) => {
      ff.on('close', (code) => { closed = true; children.delete(ff); r(code); });
      // a spawn failure emits 'error' (unhandled, it would crash the process without cleaning up)
      ff.on('error', (e) => { closed = true; stdinErr = stdinErr || e; ffErr += 'ffmpeg ' + e.message; children.delete(ff); r(-1); });
    });
    ff.stdin.on('error', (e) => { stdinErr = e; ffErr += 'stdin ' + e.message; });
  };
  // write with backpressure (at most about one frame waits in the pipe); rejects if ffmpeg dies meanwhile
  const write = (buf) => new Promise((res, rej) => {
    if (stdinErr) return rej(stdinErr);
    if (closed) return rej(new Error('ffmpeg exited: ' + ffErr.slice(0, 300)));
    if (ff.stdin.write(buf)) return res();
    const done = (err) => { ff.stdin.off('drain', onDrain); ff.off('close', onClose); err ? rej(err) : res(); };
    const onDrain = () => done(), onClose = () => done(new Error('ffmpeg exited while writing: ' + ffErr.slice(0, 300)));
    ff.stdin.on('drain', onDrain); ff.on('close', onClose);
  });
  const t0 = performance.now();
  try {
    for (const f of u.frames) {
      if (aborted) break;
      await memGate();
      const r = await renderCapture(wk, f, how);
      if (!ff) start(!!r.flip);
      const tw0 = performance.now();
      await write(r.raw || r.buf);
      wk.times.write.push(performance.now() - tw0);
      onFrame();
    }
  } catch (e) {
    if (ff) ff.kill('SIGKILL');
    throw e;
  }
  if (!ff) return;
  if (aborted) { ff.kill('SIGKILL'); await ffExit; return; }
  ff.stdin.end();
  const code = await ffExit;
  if (aborted) return;
  if (code !== 0) throw new Error(`ffmpeg failed on ${u.name} (exit ${code}): ${ffErr.slice(0, 500)}`);
  fs.renameSync(part, u.file);
  const bytes = fs.statSync(u.file).size;
  fs.writeFileSync(u.side, JSON.stringify({ a: u.a, b: u.b, frames: u.frames.length, codec, w: W, h: H, fps: meta.fps, bytes, seconds: +((performance.now() - t0) / 1000).toFixed(2), worker: wk.id }, null, 1));
  // disk guard: stop before the rest of the job (at this chunk's bytes per frame) would leave less than 2 GB free
  const free = diskFree(path.dirname(u.file)), need = framesLeft() * (bytes / u.frames.length);
  if (free !== null && free - need < DISK_SPARE) stopRun(`disk: about ${(need / 1e9).toFixed(1)} GB more chunks expected but only ${(free / 1e9).toFixed(1)} GB free (2 GB kept spare); free some space or use --codec ffv1`, 3);
}

// ------------------------------------------------------------------ determinism check
async function runCheck(capture, nB) {
  const list = flags.frames ? String(flags.frames).split(',').map(Number) : [0, Math.floor(meta.frames / 3), Math.floor((2 * meta.frames) / 3), meta.frames - 1];
  const other = Math.floor(meta.frames / 2) + 7;
  const b1 = nB > 1 ? await launchBrowser() : browsers[0];
  const second = await openWorker(1, b1);
  workers.push(second);
  const how = { capture, enc: capture === 'canvas' ? 'raw' : 'png', quality: 92 };
  const grab = async (wk, f) => {
    const r = await renderCapture(wk, f, how);
    if (r.raw) return { hash: sha256(r.raw).slice(0, 16), raw: r.raw, flip: r.flip };
    return { hash: sha256(r.buf).slice(0, 16), png: r.buf };
  };
  const pixelStats = (x) => { // on raw rgba: pixels with alpha < 255, single flat colour
    if (!x.raw) return null;
    let trans = 0, uniform = true;
    const r0 = x.raw[0], g0 = x.raw[1], b0 = x.raw[2];
    for (let i = 0; i < x.raw.length; i += 4) { if (x.raw[i + 3] !== 255) trans++; if (uniform && (x.raw[i] !== r0 || x.raw[i + 1] !== g0 || x.raw[i + 2] !== b0)) uniform = false; }
    return { transparentPixels: trans, uniform };
  };
  const diffStats = (a, b) => {
    if (!a.raw || !b.raw) return null;
    let n = 0, mx = 0;
    for (let i = 0; i < a.raw.length; i++) { const d = Math.abs(a.raw[i] - b.raw[i]); if (d) { n++; if (d > mx) mx = d; } }
    return { differingBytes: n, maxAbsDiff: mx };
  };
  let ok = true;
  const rows = [];
  for (const f of list) {
    if (!Number.isInteger(f) || f < 0 || f >= meta.frames) throw new Error(`frame ${f} outside 0..${meta.frames - 1}`);
    const a1 = await grab(workers[0], f);
    await grab(workers[0], other);
    const a2 = await grab(workers[0], f);
    const b = await grab(second, f);
    const st = pixelStats(a1);
    const same1 = a1.hash === a2.hash, same2 = a1.hash === b.hash;
    if (!same1 || !same2) ok = false;
    if (st && (st.uniform || st.transparentPixels)) ok = false;
    rows.push({ frame: f, worker0: a1.hash, worker0Again: a2.hash, worker1: b.hash, repeatSame: same1, crossWorkerSame: same2,
      diffRepeat: same1 ? null : diffStats(a1, a2), diffCross: same2 ? null : diffStats(a1, b), ...(st || {}) });
    if (st && st.uniform) console.log(`  WARNING frame ${f} is a single flat colour (blank?)`);
    if (st && st.transparentPixels) console.log(`  WARNING frame ${f} has ${st.transparentPixels} pixels with alpha < 255 (the delivery is opaque: draw an opaque background)`);
  }
  console.log(JSON.stringify({ capture, browsers: browsers.length, gpu: meta.renderer, frames: rows }, null, 1));
  console.log(ok ? 'DETERMINISTIC: every frame identical on re-render and across browsers, none blank or transparent'
    : 'NOT OK: see rows above (state carried between frames, unseeded randomness, clock, async loading, or a blank/transparent frame)');
  return ok ? 0 : 1;
}
