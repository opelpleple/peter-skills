// Demo scene 1, dark station, 0.0 to 4.0: a headline that blurs in word by word with one serif highlight word,
// a sub line that streaks up into place, a pill whose outline draws itself while its label types, and a slow
// camera push. Everything is built once in build(); update(t) only sets transforms and uniforms from t.
//
//   0.25   headline words blur in, 4 frames apart (sharp by about 1.15)
//   1.5    sub line streaks up from below (lands 1.5 + 5 frames)
//   2.0    pill rim draws, 2.25 label types
//   3.25   headline blurs out, the camera has already started its slow push
//   3.75   the director pans the camera to the light station (lands 4.0)
import { layer } from '../engine/core.js';
import { makeText } from '../engine/type.js';
import * as B from '../engine/brand.js';
import { M, fr, streak } from '../engine/moves.js';
import { C, T, TYPE } from '../engine/theme.js';

const AT = {
  head: T.intro + 0.25,
  sub: T.intro + 1.5,
  pill: T.intro + 2.0,
  label: T.intro + 2.25,
  out: T.intro + 3.25,
};

export default {
  id: 'headline',
  station: 'dark',
  t0: T.intro, t1: T.card,          // visible while the camera pans away
  async build({ root }) {
    const head = B.blurText('Make the frame *move*', { size: TYPE.headline, weight: 700, color: C.white, hiColor: C.accentSoft, align: 'center' });
    head.group.position.set(0, 40, 0);
    root.add(head.group);
    layer(head.group, 20);

    const sub = makeText('Every frame a pure function of time', { size: TYPE.sub, weight: 500, color: C.faint, align: 'center' });
    root.add(sub.group);
    layer(sub.group, 20);

    const pill = B.pill('render.mjs --all', { variant: 'dark', size: 30 });
    pill.group.position.set(0, -260, 0);
    root.add(pill.group);
    layer(pill.group, 22);

    const glow = B.glow(700, C.accent, { opacity: 0.35 });
    glow.position.set(0, 20, -50);
    root.add(glow);
    layer(glow, 5);

    return {
      update(t) {
        B.blurIn(head, t, AT.head, { perWord: fr(4), out: AT.out });
        streak(sub.group, t, [0, -110], { t0: AT.sub - fr(5), from: [0, -160] }, { t1: AT.out + fr(4), to: [0, -900], dur: fr(6) });
        // pill: pops with its rim drawing, then the label types; leaves with the headline
        const k = M.segment(t, AT.pill, fr(10), M.outCubic);
        pill.group.visible = t >= AT.pill && t < AT.out + fr(10);
        pill.bg.material.uniforms.opacity.value = M.smoothstep(0, 0.5, k) * (1 - M.segment(t, AT.out, fr(8), M.inQuad));
        pill.outline.setProgress(0, k);
        B.typeOn(pill.text, t, AT.label, 22, { caretFrom: AT.label, caretUntil: AT.out });
        pill.text.group.visible = t < AT.out + fr(2);
        glow.material.uniforms.opacity.value = 0.35 * M.segment(t, 0, 1.0, M.outCubic);
      },
      // a slow push in (zoom 1 to 1.06) from the first frame: something is alive in every second
      cam(t) { return { zoom: 1 + 0.06 * M.segment(t, T.intro, T.card - T.intro, M.inOutSine) }; },
    };
  },
};
