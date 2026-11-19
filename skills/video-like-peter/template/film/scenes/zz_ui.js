// Test scene (devOnly: shown only with ?only=ui or `tools/bin/stills ui 1,2.5,4 ui`): the captured UI component
// 'card-demo' from ui/components.html as a 3D card, a counter filled into its empty text slot, and the cursor
// clicking the component's 'button' anchor. Needs tools/ui/capture.sh to have run once.
//   0.0    card pops in, tilted, and settles by 0.75
//   0.5    the counter in slot 'value' runs to 3,215 (done 1.75)
//   1.25   cursor appears, reaches the button at 2.25, clicks at 2.5
import * as THREE from 'three';
import { layer } from '../engine/core.js';
import * as B from '../engine/brand.js';
import { M, pop } from '../engine/moves.js';
import { C } from '../engine/theme.js';

export default {
  id: 'ui',
  station: 'lab',
  devOnly: true,
  t0: 0, t1: 8,
  async build({ root, assets }) {
    const card = await assets.ui('card-demo', { scale: 1.6, shadow: { alpha: 0.12 } });
    const s = B.slot(card, 'value');
    const n = B.counter({ size: s.size, weight: s.weight, color: s.color, sample: '00,000' });
    B.fillSlot(card, 'value', n);
    root.add(card.group);
    layer(card.group, 10);                      // after all nesting and filling

    // where the button is in root space: pose the card at rest once, then map the anchor
    const btn = card.a('button');
    card.group.rotation.set(0, 0, 0); card.group.scale.setScalar(1);
    root.updateMatrixWorld(true);
    const v = card.group.localToWorld(new THREE.Vector3(btn.x + btn.w * 0.3, btn.y, 0));
    root.worldToLocal(v);
    const cur = await B.cursor({ scale: 1.3, ring: C.accent });
    root.add(cur.group);
    layer(cur.group, 40);
    const path = [[1.25, 700, -420], [2.25, v.x, v.y, M.inOutCubic]];

    return {
      update(t) {
        const k = 1 - M.segment(t, 0, 0.75, M.outCubic);
        card.group.scale.setScalar(Math.max(1e-4, pop(t, 0)));
        card.group.rotation.set(0.35 * k, -0.3 * k, 0);
        B.count(n, t, 0.5, 1.25, 0, 3215);
        cur.update(t, { path, clicks: [2.5], show: 1.25 });
      },
    };
  },
};
