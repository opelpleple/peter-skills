// Demo scene 2, light station, 3.75 to 8.0: a card (rounded rect + soft shadow, tilted a little in 3D) pops in,
// a counter on it runs up, the cursor glides to the button and clicks, a check pops, then the card streaks
// out. The camera leans in while the counter runs. The card is drawn with kit shapes here; a captured UI
// component (tools/ui/capture.sh, then B.uiCard('card-demo')) drops into the same place.
//
//   4.0     card pops (scale 0.2 to 1 with one overshoot, 9 frames)
//   4.25    title streaks in from the left, cursor appears bottom right
//   4.5     counter runs 0 to 12,480 (done 5.75)
//   5.5     cursor arrives on the button, clicks at 6.0 (press, ring), button flashes
//   6.125   check pops on the button
//   7.5     card streaks up and out (gone by about 7.7)
import * as THREE from 'three';
import { layer } from '../engine/core.js';
import { makeText } from '../engine/type.js';
import * as K from '../engine/kit.js';
import * as B from '../engine/brand.js';
import { M, fr, pop, streak, drift } from '../engine/moves.js';
import { C, T, TYPE } from '../engine/theme.js';

const T0 = T.card;                 // 4.0
const AT = {
  card: T0, title: T0 + 0.25, curShow: T0 + 0.25,
  count: T0 + 0.5, counted: T0 + 1.75,
  curAt: T0 + 1.5, click: T0 + 2.0, check: T0 + 2.125,
  exit: T0 + 3.5,
};
const CW = 640, CH = 420, R = 28;  // card size in design px
const BTN = { x: 0, y: -120, w: CW - 96, h: 76 };

export default {
  id: 'card',
  station: 'light',
  t0: T.move, t1: T.end,
  async build({ root }) {
    const card = new THREE.Group();             // moved and scaled as one
    root.add(card);

    const sh = K.shadow(CW, CH, R, { blur: 40, alpha: 0.18 });
    sh.position.set(0, -24, -1);
    const face = K.rect(CW, CH, C.white, R);
    const rim = K.rrOutline(CW, CH, R, 1.5, C.line);
    card.add(sh, face, rim);

    const title = makeText('Weekly *signups*', { size: TYPE.card, weight: 600, color: C.muted, hiColor: C.ink });
    title.group.position.set(-CW / 2 + 48, CH / 2 - 78, 0);
    card.add(title.group);

    const num = B.counter({ size: TYPE.counter, weight: 700, color: C.ink, sample: '00,000' });
    num.group.position.set(-CW / 2 + 48 - TYPE.counter * 0.2, 20, 0);
    card.add(num.group);

    const btn = K.rect(BTN.w, BTN.h, C.accent, 16);
    btn.position.set(BTN.x, BTN.y, 0);
    const flash = K.rect(BTN.w, BTN.h, C.white, 16);
    flash.position.set(BTN.x, BTN.y, 0.1);
    const label = makeText('Open report', { size: 28, weight: 600, color: C.white, align: 'center' });
    label.group.position.set(BTN.x, BTN.y - label.cap / 2, 0.2);
    const tick = new THREE.Group();
    const tickDisc = K.circle(26, C.success);
    const tickMark = K.check(30, C.white, 6);
    tick.add(tickDisc, tickMark);
    tick.position.set(BTN.x + BTN.w / 2 - 50, BTN.y, 0.3);
    card.add(btn, flash, label.group, tick);

    // draw order inside the card: shadow, face, rim, content (call layer after every child is added)
    layer(sh, 10); layer(face, 11); layer(rim, 12); layer(title.group, 20); layer(num.group, 20);
    layer(btn, 13); layer(flash, 14); layer(label.group, 21); layer(tick, 22);

    const cur = await B.cursor({ scale: 1.3, ring: C.accent });
    root.add(cur.group);
    layer(cur.group, 40);
    const path = [[AT.curShow, 620, -380], [AT.curAt, BTN.x + 120, BTN.y + 30, M.inOutCubic]];   // the button centre in root space (card sits at y 30)

    return {
      update(t) {
        // card: pop, idle drift, a small 3D tilt that settles, then a fast exit upward (motion blur does the rest)
        const s = pop(t, AT.card);
        const d = drift(t, 3, 5);
        const settle = 1 - M.segment(t, AT.card, 0.75, M.outCubic);
        card.scale.setScalar(Math.max(1e-4, s));
        card.rotation.set(0.18 * settle, -0.22 * settle, d.r);
        streak(card, t, [d.x, 30 + d.y], null, { t1: AT.exit, to: [0, 1500], dur: fr(6) });
        card.visible = card.visible && s > 0;

        streak(title.group, t, [-CW / 2 + 48, CH / 2 - 78], { t0: AT.title - fr(5), from: [-260, 0] });
        B.count(num, t, AT.count, AT.counted - AT.count, 0, 12480);
        num.group.visible = t >= AT.count;

        const f = t >= AT.click ? 1 - M.segment(t, AT.click, fr(9), M.outQuad) : 0;
        flash.material.opacity = 0.45 * f;
        flash.visible = f > 0.002;
        tick.scale.setScalar(Math.max(1e-4, pop(t, AT.check)));
        tick.visible = t >= AT.check;

        cur.update(t, { path, clicks: [AT.click], show: AT.curShow, hide: AT.exit - fr(4) });
      },
      cam(t) {
        // lean in on the number while it counts, back out for the click
        const k = M.segment(t, AT.count, 0.75, M.inOutCubic) - M.segment(t, AT.curAt - 0.25, 0.5, M.inOutCubic);
        return { x: -60 * k, y: 30 * k, zoom: 1 + 0.08 * k };
      },
    };
  },
};
