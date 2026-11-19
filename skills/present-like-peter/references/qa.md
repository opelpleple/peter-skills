# QA

## Automated: scripts/check.cjs

```sh
node <skill>/scripts/check.cjs dist/deck.html qa/                    # 1920 x 1080, final step of every slide
VW=1280 VH=720 node <skill>/scripts/check.cjs dist/deck.html qa-720/  # small screen
STEPS=all node <skill>/scripts/check.cjs dist/deck.html qa-steps/     # every build step
LANG_=th node <skill>/scripts/check.cjs dist/deck.html qa-th/         # one language of a bilingual deck
```

Errors (exit 1):
- text beyond the stage edge
- overflow inside `.box`, `.card` or `[data-qa="box"]`, or a child sticking out of one
- box over box, or text over text (inline elements are clipped to their em box first, so a large serif italic word does not false-alarm). Mark an intended overlap with `data-allow-overlap`.
- console errors or warnings, page errors
- any network request that is not `file:`, `data:` or `blob:`

Warnings:
- text under 20 px outside `.micro` or `[data-small]`
- text in the HUD corner
- more than 60 words on screen
- a slide without notes

Outputs: one PNG per slide, `contact.png` (4 across), `report.json`.

## By eye (the script cannot see these)

Open `contact.png` and each slide PNG with the Read tool. Look for:
- canvas drawings colliding with text (particles under a headline, a chart behind a caption)
- contrast that is legal but weak, an accent used twice on one slide
- a slide whose final state does not say its job on its own
- the cold open and the end slide reading as a pair
- Thai or other non-Latin text with clipped marks or tight line height

## Controls checklist (by hand, once per deck)

Arrows, space, click left and right, Home, End, N, P (autoplay loops from last to first), F, L, H, `?slide=N&step=M` on a middle slide, `?motion=reduced`, `?print=1` shows every slide, a hidden tab stops the animation (no CPU), the file opened offline with networking off.

## Stills and posters

`?still=1&slide=N&step=final` renders any frame without HUD for posters or social cards. With system Chrome:

```sh
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars \
  --window-size=1920,1080 --virtual-time-budget=6000 --screenshot=poster.png "file:///abs/path/deck.html?still=1&slide=2"
```

Run one headless browser at a time on a laptop; parallel Chrome instances plus a dev server can freeze the machine.
