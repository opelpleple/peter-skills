# Lessons from finished films

Each lesson came from a real film built with this method (a 42 s kinetic brand film, a 46 s product
commercial, a 32 minute teaching film with clips as 3D textures, and the 6 s dogfood card). Generic: no
client data.

| lesson | what happened | do this |
|---|---|---|
| Write the reference down second by second | The brand film's look held together because one document listed every move of the reference with its time | For a reference you remake the language of, write `docs/reference.md` as a time table before the storyboard |
| Remake the language, never the material | Copy, colours, the shape device and the cards were all new; only rhythm and entrance types were taken | Keep the leave line honest; replace the reference's signature shape with your brand's |
| One field per chapter, tone on tone text | A saturated field with text in the same hue pushed to near black read as designed; white text on every field read as a template | Pick the ink per field, keep white for accents |
| One highlight word, always the same idea | The serif italic word carried the message ("trust", "it") through three chapters | One `*word*` per screen; decide in the brief what it stands for |
| AI music ignores your section plan | The generator phrased every 8 bars, the drop landed off the picture | Measure the take, then splice on bar lines or conform the picture with a CUT table |
| Stills before films | Most fixes were found on contact sheets in seconds, not in full renders | Sheet at 0.25 s steps after every change; full stills only for hero frames |
| Purity is proven, not assumed | Order-dependent colour writes and hidden objects showed up only in `check` and in smeared entrances | `tools/bin/check` after every scene edit |
| Product UI is rebuilt, not screenshotted | Live screenshots carried real data and went soft when scaled | Rebuild screens as HTML/CSS with demo data, capture to PNG with anchors |
| Long films want the HTML route | A 32 minute voice-over film needed video clips as textures and a word-timed timeline | For long VO films use `claude-motion`'s HTML `render(t)` route |
| A 6 s card cannot cut every half second | The fast reference measured 0.57 s shots; at that speed "Seven skills" could not be read | Keep the beat, slow the cuts: one field change, a 2.5 s final hold |
