// Tiny static HTTP server for the project folder (ES modules, fetch() of JSON, fonts and media need
// http://, not file://). Used by render.mjs; can also run alone for previewing a page in a browser:
//   node tools/render/server.mjs [--port 8123] [--root <dir>]   then open http://127.0.0.1:8123/<path>
// GET and HEAD only, Range requests supported (audio seeking), no caching, directory listings.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.map': 'application/json', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.csv': 'text/csv',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.gif': 'image/gif', '.avif': 'image/avif', '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4',
  '.aac': 'audio/aac', '.ogg': 'audio/ogg', '.mp4': 'video/mp4', '.webm': 'video/webm', '.wasm': 'application/wasm',
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream', '.ktx2': 'image/ktx2',
  '.exr': 'application/octet-stream', '.hdr': 'application/octet-stream',
};

/**
 * startServer({root, port, host, onEvent}) -> Promise<{port, url, root, served:Set, close()}>
 * onEvent({type:'404'|'error', path, detail}) is called for anything a page asked for and did not get.
 * `served` collects every file sent (render.mjs fingerprints them to detect page changes between runs).
 */
export function startServer({ root = PROJECT_ROOT, port = 0, host = '127.0.0.1', onEvent = () => {} } = {}) {
  root = path.resolve(root);
  const served = new Set();
  const server = http.createServer(async (req, res) => {
    let urlPath;
    try {
      const u = new URL(req.url, 'http://x');
      urlPath = decodeURIComponent(u.pathname);
      if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return; }
      let file = path.join(root, urlPath);
      if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
      let st = await fs.promises.stat(file).catch(() => null);
      if (st && st.isDirectory()) {
        const idx = path.join(file, 'index.html');
        const ist = await fs.promises.stat(idx).catch(() => null);
        if (ist) { file = idx; st = ist; }
        else {
          const names = (await fs.promises.readdir(file)).sort();
          const base = urlPath.endsWith('/') ? urlPath : urlPath + '/';
          const html = `<!doctype html><meta charset=utf-8><title>${base}</title><pre>` +
            names.map((n) => `<a href="${encodeURI(base + n)}">${n}</a>`).join('\n') + '</pre>';
          res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-cache' }); res.end(html); return;
        }
      }
      if (!st) { onEvent({ type: '404', path: urlPath }); res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('not found: ' + urlPath); return; }
      served.add(path.relative(root, file));
      const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
      const headers = { 'Content-Type': type, 'Cache-Control': 'no-cache', 'Last-Modified': st.mtime.toUTCString(), 'Accept-Ranges': 'bytes', 'Access-Control-Allow-Origin': '*' };
      if (req.headers['if-modified-since'] && new Date(req.headers['if-modified-since']) >= new Date(st.mtime.toUTCString())) { res.writeHead(304, headers); res.end(); return; }
      const range = req.headers.range && /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      if (range) {
        const start = range[1] === '' ? st.size - Number(range[2]) : Number(range[1]);
        let end = range[1] !== '' && range[2] !== '' ? Number(range[2]) : st.size - 1;
        if (start < 0 || start >= st.size || end < start) { res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }); res.end(); return; }
        end = Math.min(end, st.size - 1);
        res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Content-Length': end - start + 1 });
        if (req.method === 'HEAD') { res.end(); return; }
        fs.createReadStream(file, { start, end }).pipe(res);
        return;
      }
      res.writeHead(200, { ...headers, 'Content-Length': st.size });
      if (req.method === 'HEAD') { res.end(); return; }
      fs.createReadStream(file).pipe(res);
    } catch (e) {
      onEvent({ type: 'error', path: urlPath || req.url, detail: String(e) });
      if (!res.headersSent) res.writeHead(500);
      res.end();
    }
  });
  server.keepAliveTimeout = 60000;
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      const p = server.address().port;
      const close = () => new Promise((r) => { server.close(() => r()); server.closeAllConnections(); });
      resolve({ port: p, url: `http://${host}:${p}`, root, served, close, server });
    });
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2);
  const opt = (k, d) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : d; };
  const s = await startServer({ root: opt('--root', PROJECT_ROOT), port: Number(opt('--port', 8123)),
    onEvent: (e) => console.log(`[${e.type}] ${e.path}${e.detail ? ' ' + e.detail : ''}`) });
  console.log(`serving ${s.root}\n  at ${s.url}/   (Ctrl+C to stop)`);
}
