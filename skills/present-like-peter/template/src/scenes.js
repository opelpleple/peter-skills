/* Scenes: canvas 2D set pieces, one per data-scene name.
   frame(ctx, { t, ts, step, w, h, final }) must draw the whole frame from time alone
   (no hidden state), so still, print and reduced motion get the same final picture.
   Optional: init(ctx, { w, h, slide, rng }), until (seconds after a step when the loop may stop). */
(() => {
  const { ease, easeOut, rng } = DECK.util;

  // A field of points that gathers into one line. Replace with your own set piece.
  const R = rng(7), PTS = Array.from({ length: 220 }, () => ({ x: R(), y: R(), r: 1 + R() * 2.4, d: R() }));
  DECK.scene('field', {
    until: 6,
    frame(ctx, { t, step, w, h, final }) {
      const k = final ? 1 : easeOut((t - 0.4) / 2.6);
      const css = getComputedStyle(document.documentElement);
      const ink = css.getPropertyValue('--ink').trim() || '#fff';
      const accent = css.getPropertyValue('--accent').trim() || '#4C6FFF';
      for (const p of PTS) {
        const tx = w * 0.18 + p.d * w * 0.64, ty = h * 0.74;
        const x = p.x * w + (tx - p.x * w) * ease(k), y = p.y * h + (ty - p.y * h) * ease(k);
        ctx.beginPath(); ctx.arc(x, y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = k > 0.98 ? accent : ink; ctx.globalAlpha = 0.25 + 0.75 * k; ctx.fill();
      }
      ctx.globalAlpha = 1;
    },
  });
})();
