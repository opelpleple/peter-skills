# Storyboard and frame board

## The grid

Plan on 120 BPM unless the music says otherwise: beat 0.5 s (15 frames at 30 fps), bar 2 s, phrase 8 s.

- Arrivals (the frame a thing lands, not when its move starts) on the 0.125 s grid. A five frame streak that
  lands at 1.25 starts at `1.25 - fr(5)`.
- Chapter changes and camera moves land on bars. In a 6 s card that is 2.0, 4.0 or the half bar 3.0.
- Use whole and half beats when the exact frame matters (0.125 s = 3.75 frames snaps to the nearest frame).
- Readable text holds still at least 1.5 s; the final lockup of a title card at least 2 s.
- Something moves every second (a slow camera push counts), but only one thing leads at a time.

## A shot row

| field | content |
|---|---|
| `id`, `t0`, `t1` | S1, S2 ... and the time range |
| `station` | the colour field it plays on (a `STATION` key in theme.js) |
| `field`, `ink` | hex colours for the board placeholder |
| `copy` | exact words; `*word*` is the serif italic highlight |
| `motion` | verbs and landing times: "streaks in from the left, lands 0.375" |
| `steal` | which reference line it uses ("R1 type: repetition stack") |
| `sound` | music hit or cue, or empty for a silent loop |
| `frame` | a still from `tools/bin/stills` once it exists |

## Frame board loop

1. Write the JSON with no `frame` values: `frameboard.py` draws a placeholder per shot (field colour + copy).
   Review this version before any code: it is the cheapest place to change the film.
2. After the first stills pass, render one still per shot (`tools/bin/stills board 0.6,1.6,...`), point each
   `frame` at `work/render/board/stills/fNNNNN_tTTTT.TTT.png`, run `frameboard.py` again.
3. The board is the hand-off document: send it with the film so a reviewer sees what was intended per shot.

`frameboard.py` embeds every image (shrunk to `--thumb` px, default 360), so the HTML is one file, and warns
when a `frame` path is set but the file is missing (that shot then gets the placeholder). The working board
shows 4 reference frames per reference; 4 per reference plus one frame per shot at `--thumb 320` came to 77 KB
for a 5 shot card. Build any copy that leaves your machine with `--no-source`: it hides channels and URLs and
drops the reference frames, so only your own frames and the measured numbers are published.

## Common motion vocabulary (engine helpers)

| move | helper | use |
|---|---|---|
| streak in or out with real blur | `streak(obj, t, [x, y], {t0, from, dur}, {t1, to, dur})` | words and rows |
| lines fall and stack, bottom first | `dropLines(block, t, t0)` | sentences |
| word by word blur in | `B.blurIn(B.blurText(...), t, t0)` | lockups |
| pop with overshoot | `pop(t, t0)` | shapes, tiles, dots |
| colour sweep through letters | `shine(line, t, t0, base, hot)` | the last beat of a hold (call it every update) |
| letter wave | `wave(line, t, t0)` | life during a hold |
| field change | camera move between stations in `MOVES` | chapter changes |
