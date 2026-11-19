# Style recipe: Riso Print (three spot inks, overprint, grain, wobbly registration)

Live demo: `https://peterbu.com/showcase/skills/video-like-peter/styles/riso-print/` (`index.html` + `riso.js`, built on
the shared `_engine/stage.js` and `_engine/scene.js`). Poster: `poster.png` (t = 2.8: the title plates flying into register
letter by letter, the hero on the slab looking up; captured headless at 1280x720 with `?ui=0&play=0&dpr=1` and
`window.__render(2.8)`). Reduced motion holds `keyTime: 3.45` (full title, hero settled).

## 1. What defines the style

A frame reads as "risograph" at first glance because of five things together:

1. **Two to three flat spot inks, never full colour.** Every shape belongs to exactly one ink plate.
2. **Inks multiply.** Where plates overlap they make new colours (pink x blue = deep violet, pink x yellow = hot orange,
   blue x yellow = green). Those overlaps are the richest colours in the picture, so design for them.
3. **Tone is a dot screen in fixed steps** (20, 40, 60, 80, 100 percent). No gradients, no alpha fades.
4. **Imperfect press.** Plates are slightly out of register (colour fringes on every edge), and the registration
   wobbles from sheet to sheet. Ink has pin holes, uneven density and faint roller streaks.
5. **It is a printed sheet.** Warm off white fibre paper, a margin the ink never reaches, registration targets, a colour
   bar and a slug line in the margins.

### Palette

| Role | Hex | Notes |
|---|---|---|
| Paper | `#f2ebdb` | warm cream with fibres and tooth speckle; never pure white |
| Fluoro Pink | `#ff48b0` | the hero ink; hot, slightly cool pink |
| Medium Blue | `#0078bf` | key lines, floor, eyes; the darkest ink on its own |
| Yellow | `#ffe800` | light ink, carries the body, sun and highlights of the shading |
| pink x blue | about `#002284` | overprint: deep navy violet; use it for eyes, mouth, the title body |
| pink x yellow | about `#ff4100` | overprint: hot orange; shading on a yellow body, slab top |
| blue x yellow | about `#006d00` | overprint: green; leaves, key line on yellow |
| Page behind stage | `#2a2522` | dark kraft so the sheet glows |

Rule: no black ink. The darkest value is the pink x blue overprint.

### Shape language

Simple, chunky, cut paper shapes: circles, rounded lozenge clouds, triangles, crosses, squiggles, slab boxes. Flat
silhouettes, no outlines except one deliberate key line plate (blue) that sits a few pixels off the body. Type is a
heavy grotesk (Arial Black / Helvetica Neue 900) printed in two solid plates plus a halftone shadow plate.

### Line

One weight per job, round caps. Key line about 5.5 percent of the character radius, in blue only, deliberately offset
from the yellow fill. Mouth and eyes print solid in both pink and blue and are knocked out of the yellow plate (eyes
as ellipses, the mouth as the same arc stroked about 1.6 px wider as a trap), so they become navy on paper with thin
pink and blue fringes. Without the yellow knockout the misregistered pink and blue split over solid yellow into a red
and a green line.

### Texture

- Paper: fibres (short low alpha strokes, brown and white), tooth speckle, a faint warm vignette. Static.
- Ink grain per plate: thousands of 1 to 3 px pin holes, about 70 soft radial blotches (density variation) and 20 to 30
  faint horizontal roller streaks. The grain texture is overscanned and shifted per frame.
- Halftone screens rotated per ink (yellow 0 deg, blue 15 deg, pink 75 deg) so tints of different inks never align.

### Lighting

There is no lighting model. "Light" is paper showing through (a knocked out highlight on the body), and "shade" is an
extra plate printed on top (pink 40 percent crescent on yellow = orange dot shading). Sun = yellow 40 percent disc with a
solid core and 40 percent rays that the pink plate overprints at 20 percent, so the rays print orange and read as an
object (yellow 20 alone vanishes on cream paper).

### Frame rate and stepping

Step at **12 fps** (`fps: 12`). Each step is a new "sheet": new registration offsets, new grain position. Smooth 60 fps
looks like a digital filter; 12 fps reads as a printed flipbook.

### Timing and easing

- Keep the shared beats exactly. Squash, hops and spin come from `pose(t)`.
- Title reveal = **plates flying into register**: per letter (`letterReveal`, spread 0.55), the pink plate drops from
  above left, the blue from below right, the yellow shadow from far below, all with `ease.outBack(u, 2.2)` and a scale
  from 0.6. Tone builds in steps 20, 40, 60, 80, 100 as the letter lands.
- Title exit: never alpha. Tone steps down 100, 80, 60, 40, 20, 0 while the plates drift apart (`ease.inCubic(outP)`).
- Confetti after the spin landing: each piece is one ink, falls ballistically, and fades by tonal steps.
- Small type (set line under the title) cannot step tone, so it types on letter by letter in solid blue and types off
  on exit; its pink rule grows and shrinks in steps.
- Impacts: misregistration amplitude kicks from about 1 px to 4.5 px for 0.2 s (`impactPulse`), as if the press shook.
  Impact dots and the contact shadow print solid (a thin solid blue ellipse), never as a small screen.

### Camera

Locked off, flat, front on. The camera is the sheet. Motion lives inside the print area.

## 2. Technique (Canvas 2D, no WebGL)

Everything is 2D canvas. Cost per frame: three plate redraws, three grain punches, one paper blit, three multiply blits.
Runs well under a frame on a laptop at `maxDpr: 1.5`.

### 2.1 One offscreen canvas per ink plate, built per size

```js
for (const ink of INKS) {
  const c = makeCanvas(ctx.pw, ctx.ph), pg = c.getContext('2d');
  const tones = {};
  for (const s of [0.2, 0.4, 0.6, 0.8]) {
    const pat = pg.createPattern(makeTile(ink.hex, s, n), 'repeat');      // n = cell in device px
    pat.setTransform(new DOMMatrix().rotateSelf(ink.angle).scaleSelf(S / n, S / n)); // S = cell in css px
    tones[s] = pat;
  }
  plates[ink.name] = { ink, c, g: pg, tones, grain: makeGrain(ctx.pw, ctx.ph, seed, dpr) };
}
```

`makeTile` draws one dot of area `cov` (radius `n * sqrt(cov / PI)`); above 75 percent it fills the tile and punches a
paper hole instead. Rebuild everything when `ctx.pw` or `ctx.ph` change.

Store `pat._dev = new DOMMatrix([dpr, 0, 0, dpr, 0, 0]).multiplySelf(base)` (the screen as it sits on the sheet in
device pixels) next to each pattern.

### 2.2 Paint each plate with solids or screens, screens anchored to the sheet

A canvas pattern is mapped through the current transform at fill time, so a letter drawn under
`translate / rotate / scale` would carry its own dot grid, and the 0.6 to 1 title scale would resize the dots. `tone()`
re anchors the pattern every time it hands one out:

```js
function tone(pl, v, g = pl.g) {
  if (v >= 0.9) return pl.ink.hex;
  const pat = pl.tones[nearestStep(v)];
  pat.setTransform(g.getTransform().invertSelf().multiplySelf(pat._dev)); // inverse(CTM) x (dpr x base)
  return pat;
}
g.fillStyle = tone(plates.blue, 0.4); g.fillRect(0, groundY, W, H - groundY); // floor
```

Call `tone()` after the transform is set and right before the fill (patterns are shared, the matrix is read at fill
time). This also works for `fillText`, where you cannot fall back to building the path and resetting the transform.

Every element is assigned to plates on purpose: a slab top is pink solid plus yellow 60 (orange), the slab face blue 60
plus pink 40 stripes (violet bands), the body yellow solid plus pink 40 crescent.

### 2.3 Knockout vs overprint

Background art is cleared under the character on every plate, with a tiny trap (yellow keeps full size, others shrink by
0.8 px):

```js
g.save(); g.globalCompositeOperation = 'destination-out';
charSilhouette(g, s, name === 'yellow' ? 0 : -0.8 * U);
g.restore();
```

Draw order per plate: inside the margin clip background, title, contact shadow; then the print furniture; then the
character with no clip (its knockout also clears the title, so the hero stays in front, and on entry and exit it bleeds
off the sheet edge instead of being sliced flat at the margin line); then effects, clipped again. The title itself
overprints the background on purpose. Eyes and mouth are knocked out of the yellow plate so pink + blue print navy on
paper rather than red and green.

### 2.4 Grain per plate, shifted per frame

```js
g.setTransform(1, 0, 0, 1, 0, 0);
g.globalCompositeOperation = 'destination-out';
g.drawImage(pl.grain, -Math.floor(hash(frame, seed) * GPAD), -Math.floor(hash(frame, seed + 7) * GPAD));
```

### 2.5 The press: multiply plates onto paper with jittering registration

```js
main.drawImage(paper, 0, 0);
main.globalCompositeOperation = 'multiply';
for (const ink of INKS) {
  const amp = 1.1 + impactPulse(t, 0.2) * 3.5;
  const ox = (ink.base[0] + (hash(frame, ink.seed + 1) - 0.5) * 2 * amp) * U * dpr;
  const oy = (ink.base[1] + (hash(frame, ink.seed + 2) - 0.5) * 2 * amp) * U * dpr;
  const rot = (hash(frame, ink.seed + 3) - 0.5) * 0.0016;           // sheets skew a hair
  main.setTransform(cos(rot), sin(rot), -sin(rot), cos(rot), pw / 2 + ox, ph / 2 + oy);
  main.drawImage(plates[ink.name].c, -pw / 2, -ph / 2);
}
```

`ink.base` is the constant misregistration of each plate (pink `[2.6, -1.2]`, blue `[-1.8, 1.7]`, yellow `[0.9, 1.3]` css
px at 720p, scaled by `U = H / 720`). All jitter uses `hash(frame, ...)`, never `Math.random()`, so `?t=`, `__render(t)`
and playback match, and t = 0 equals t = 6.

### 2.6 Print furniture

Margin `m = 0.045 H`; background art is clipped to the inner rect (the hero may bleed). Registration targets are drawn
identically on every plate (misregistration then shows as colour fringes on them). The colour bar shows each ink at
100/60/20 plus the overprint pairs, cells `0.55 m` square with a gutter of 0.2 cell so it reads as separate patches
(smaller 20 percent cells hold only one or two dots and smudge). The monospace slug line prints in solid blue.

### 2.7 Composition notes from the demo

- Keep the top of the sheet alive before the title arrives: one big mid weight sky shape (pink 20 cloud lumps over a
  blue 20 belly, overlap prints violet) balances the hills, slab and floor in the bottom half.
- The floor is a blue 40 field with only two yellow 20 bands, narrow near the horizon and wide near the viewer.
  Four flat yellow 60 bands of equal spacing read as a digital moire pattern and compete with the hero.

## 3. Applying it to any storyboard

1. Pick 2 or 3 inks. Decide the overprint colours you want (the darkest must come from an overlap).
2. Separate every storyboard element into plates: write a small table "element: plate + tone". A character needs a light
   body ink, a shade plate on top and a dark feature pair (two inks overprinted).
3. Knock the hero out of the background plates; let type and decoration overprint.
4. Replace every fade with tonal steps; replace every gradient with a screen or a stack of solid bands.
5. Step at 12 fps (8 for a rougher zine feel). Jitter registration per step; kick it on impacts.
6. Keep anything that moves in the background periodic in the loop (`sin(2 PI t / DURATION + phase)`, ray rotations by
   one ray spacing per loop).
7. Frame it as a sheet: margin, marks, colour bar. Cheap and it sells the medium instantly.

## 4. Common failure modes

- **Using alpha for tone or fades.** Looks like a screen overlay, not print. Quantise to steps.
- **Too many inks or a black ink.** Becomes CMYK comic or flat vector. Two or three spot inks, darkest from overlap.
- **Source over instead of multiply.** Overlaps stop producing new colours; the whole look collapses.
- **No knockouts.** The hero turns into a muddy overprint of the hills and floor behind it.
- **Halftone screens moving with objects.** Real screens are fixed to the sheet. A pattern filled under translate,
  rotate or scale rides along with the object and changes dot size with its scale; re anchor it per fill (2.2).
- **Screening small type or thin marks.** An 80 percent screen on 10 px text or a 3 px dash breaks the glyphs
  (SEVEN reads SEVFN). Print anything smaller than about 14 px solid; build it in by typing on, not by tone.
- **Knocking out only part of a dark feature.** Every pink + blue feature over a yellow body needs a yellow knockout
  with a trap, or the misregistration splits it into red and green.
- **Same screen angle for every ink.** Dots stack into a grid; rotate per ink.
- **Misregistration that is too large or too smooth.** 1 to 3 px, stepped, kicked on impacts only. Smooth sliding offsets
  read as a chromatic aberration filter.
- **Random noise per frame with `Math.random()`.** Breaks determinism and the seamless loop; use `hash(frame, seed)`.
- **Grain textures rebuilt per frame.** Expensive; build once per size, shift per frame.
- **Title plates flying too far.** Neighbouring letters pile into an unreadable mess mid reveal; keep travel to about
  5 percent of width sideways and 10 to 20 percent of height vertically.
- **Full bleed art.** Risographs rarely print to the edge; leave the paper margin.

## 5. Reference searches (YouTube / Vimeo)

1. `risograph animation loop`
2. `riso print motion design misregistration`
3. `risograph flipbook animation printed frames`
4. `two color riso zine animation`
5. `risograph printing process fluorescent pink overprint`
