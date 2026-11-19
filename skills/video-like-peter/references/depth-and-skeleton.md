# Depth and skeleton for video-like-peter

How to read an action clip with a depth pass and a pose pass, what to do with the result, and where it breaks. Scripts live next to this file in `scripts/vision/`. Worked example with all three test clips: https://peterbu.com/showcase/skills/video-like-peter/vision/ (the author's site).

## When to extract them

Extract depth and pose when the clip has bodies that move and the job needs one of these:

- **Control for generation.** A fight or dance that already works and should be regenerated in a new look (pose sequence as the choreography lock, depth as the staging lock).
- **Comp.** Fog, depth of field, relight, a rough matte, a 2.5D push on a still.
- **Choreography QA.** Does the strike land on the beat, does the hand stop on contact, does the staging have depth or two flat cards.
- **Continuity.** Same fighter, same side, same scale across a cut.

Skip it for type, motion graphics, product UI or anything without people: depth alone is cheaper there (run only the depth stage), and pose returns junk on non human shapes.

Clip length: 5 to 8 s is the sweet spot. Depth is the slow stage (about 3 to 4 s per frame at 854 px on MPS with VDA vits), pose is about 5 to 10 s for the whole clip.

## Setup

```
PY="$HOME/vision-venv/bin/python"   # your venv: torch (MPS or CUDA), ultralytics, scipy, opencv-python, pillow
export VDA_ROOT="$HOME/Video-Depth-Anything"   # git clone of Video-Depth-Anything, checkpoints/ holds video_depth_anything_vits.pth
S=~/.claude/skills/video-like-peter
WORK=<film>/work/vision      # intermediate frames and caches, can be large (about 400 MB per 8 s clip)
```

If the venv has no pip, install with `uv pip install --python "$PY" <pkg>`. Pose weights: `$S/scripts/vision/models/yolo11m-pose.pt` is not shipped (about 40 MB). The first `pose` run downloads it through ultralytics into that folder (or into `$VISION_MODELS`); to work offline, copy the file there first.

## Commands

Full run:

```
$PY $S/scripts/vision/video_vision.py all --src clip.mp4 --start 0 --duration 8 \
   --work $WORK/clipN --out <web dir>/clipN
```

Stages run in order and can be run one by one with the same `--work` and `--out`:

| stage | what it does | output |
|---|---|---|
| `prepare` | cut the segment, long side 854, find cuts with ffmpeg `scene > 0.3` | `work/frames/*.jpg`, `clip.json` (shots, cuts) |
| `depth` | Video Depth Anything per shot, 1st to 99th percentile of the shot mapped to 0..1 and fixed for the shot | `depth-raw.npz`, `depth-norm.npy` (float16, N x H x W, 1 = near) |
| `pose` | YOLO11m-pose + ByteTrack per shot, L/R swap repair, partial body filter, One Euro smoothing, identity across cuts | `pose.npz`, `pose-raw.json`, `pose-stats.json` |
| `analyze` | limb speed (px/s and body heights per second), impacts, contact, centre of mass, depth order | `analysis.json`, `timeline.json` |
| `render` | review and web files | `depth.mp4`, `skeleton.mp4`, `skeleton-only.mp4`, `quad.mp4`, `keypoints.json`, 16-bit depth PNGs, `parallax/color.jpg + depth.png`, `work/check-sheet.jpg` |

Useful flags:

- `--reuse-depth file.npz` skips the slow stage when depth already exists for the same frames.
- `--rename s0t1:hero,s0t2:soldier_a` readable ids. Pick them from `work/clipN/check-sheet.jpg` after a first pose run, then rerun `pose analyze render` (seconds).
- `--appearance-k K` links tracks across cuts by trunk colour (Lab median, k-means) into p1..pK, darkest first. Then `--rename p1:suit,p2:coat`. Fails on matching outfits.
- `--masks dir --mask-names 1:fighter,2:giant` per frame instance PNGs (SAM). Best identity and best contact test.
- `--impact-min-bhs 1.2` the speed floor for an impact. `--min-visible-kp 7`, `--min-shot-coverage 0.4` drop weak detections.

Contact audit (CPU, seconds, no lock). Run after `analyze`, every time:

```
$PY -I $S/scripts/vision/contact_audit.py --work $WORK/clipN --out <web dir>/clipN \
   [--masks dir --mask-names 1:fighter,2:giant] \
   --depth-model "Video Depth Anything Small (vits, checkpoint video_depth_anything_vits.pth), input 518"
```

It re-tests every impact and writes into `analysis.json` per impact: `tier` (`touch` = within 6% BH of the target SAM mask, `reach` = pose bbox test only, null = no contact), `contact.contact_test` (mask or bbox), `mask_dist_bh`, `skel_dist_bh` (nearest confident bone of the target), `overlap_iou` (> 0.3 = clinch), `target_pose_at_peak`; plus `contact_audit.counts`, `depth_model` (also into `timeline.json` and `parallax/parallax.json`) and `pose_tracking` (tracker, identity method across cuts, left/right swaps repaired). It rewrites analysis.json in place, so keep a copy if you rerun it by hand.

Web layers for the interactive player (CPU, no lock):

```
$PY -I $S/scripts/vision/web_layers.py --work $WORK/clipN --out <web dir>/clipN
```

writes `source.mp4` and `composite.mp4` (depth fog, far plane blur, warm key on the near plane), H.264, GOP 12, no B-frames, faststart, no audio, so a page can swap Source / Depth / Composite at the same `currentTime`. Draw the skeleton live on a canvas from `keypoints.json` (normalized 0..1 coords, `null` = not visible, skip joints under conf 0.3) instead of shipping the baked `skeleton.mp4` when viewers should toggle bones, joints, ids and trails.

## Heavy job rule

Model stages (`depth`, `pose`) take `/tmp/vision-heavy.lock` (mkdir) and wait while `/tmp/deck-heavy.lock` exists. Never run two model jobs at once; a second run waits on its own. If you call a model outside the script, do the same by hand: `mkdir /tmp/vision-heavy.lock` before, `rmdir` after. `VISION_IGNORE_OTHER_LOCKS=1` only after checking nothing heavy is running.

## Reading the output

- **Speed in BH/s**, not px/s, to compare bodies at different distances. A real strike peaks above about 1.5 BH/s and drops below 55% of the peak within 3 frames.
- **Contact is proximity, not proof.** Only a `touch` (mask test) may be called a hit. A `reach` passes for a fist in the air between two close bodies, because a bbox is a rectangle, and it passes almost by default while two bodies stand chest to chest (clip 3: 6 of its 9 reach contacts fall in the first second of a clinch, with the nearest target bone 0.07 to 0.18 BH away). Across the three test clips: 29 peaks, 16 reach, 1 touch (clip 1, the only clip with masks). Say "within reach" in any write-up unless masks were used.
- Arm pumping and guard resets pass the speed test (clip 2: 16 peaks, 6 within reach).
- `speed_after_px_s = 0` usually means the joint vanished, not that it stopped (NaN is filled with 0 before the drop test). Treat it as a dropout.
- Quote the fastest limb for the whole set, not one clip: compare `summary.*.fastest.bh_s` across all clips (the set maximum was 3.24 BH/s in clip 2, not the 3.11 of clip 3).
- **Depth order**: `front_share` says who owns the foreground. A gap under 0.05 between two bodies means level, so leader changes there are noise (clip 3, shot 3: 4 flips in 26 frames).
- Always look at `work/clipN/check-sheet.jpg` and one frame of `quad.mp4` before trusting numbers.

## Feeding generation

Two different kinds of input, do not mix them up:

- **Control maps** (ControlNet style pose and depth, Wan VACE, Animate style pose driving, other motion transfer): the pose and depth sequences ARE the conditioning input.
- **Reference video** (Seedance): Seedance does not take skeleton or depth control maps. It takes a reference video for motion and camera. Send the source take (or a clean render of it) as the reference and put the new look in the prompt. Use the pose pass afterwards to check the beat survived (compare impact frames of the new take with the old ones).

- **Pose as the choreography lock.** Export `skeleton-only.mp4` (black ground, coloured bones) as the control video for pose conditioned models. Keep the original frame rate and cut points so the beat survives.
- **Depth as the staging lock.** `depth.mp4` (inferno) is for people. For a model, render a grey depth video from `depth-norm.npy` (white = near) per shot; the per shot normalization is what stops the background breathing in the generated take.
- **Reference video for Seedance.** Send the source take as the motion and camera reference and describe the new look in the prompt; write the prompt with `higgsfield-seedance-prompt`. Do not ask the reference to carry identity, only timing and staging.
- Trim to the shot that matters. One shot per control clip, never across a cut.

## Feeding comp

- **Fog and depth of field**: mix towards a haze colour and a blurred copy by `smoothstep(0.62, 0.15, depth)` (far = 1); tune the two edges per shot.
- **Near plane lift**: brighten and warm the near plane with `smoothstep(0.55, 0.9, depth)`. The Composite layer from `web_layers.py` is exactly these three (fog, far blur, warm near lift). Call the lift a stand-in for a relight, not a relight: a real relight needs normals.
- **Rough matte**: threshold the near plane, intersect with the dilated pose bbox, then refine. A start for roto, not a finished matte.
- **2.5D push**: `parallax/color.jpg + depth.png` on a dense plane, displace z by `(d - 0.5) * strength`. Blur the depth about 2 px first. Triangles that span a body edge stretch into streaks: compute the depth jump to the neighbouring grid vertex in the vertex shader, multiply by strength, and discard the fragment above about 0.014 (fade from 0.006), the standard edge cut. Cap strength near 0.4 of the plane height, keep the camera push small (7% of the distance) and the orbit within about 0.3 rad, or the plane edges enter frame. The cut leaves dark holes where a final shot gets a clean plate.

## Pitfalls

- Speeds are screen space. A moving camera adds its motion (clip 3, shot 2 orbits). Read camera moves as context, or stabilise first.
- Depth is relative inverse depth, not metres. Do not compare raw values across shots; compare inside a shot.
- Never normalise depth per frame: temporal flicker. Per shot, fixed.
- YOLO flips left and right on side views and dark suits (64 swaps in one shot of clip 3). The crossing repair is always on; still check wrists on the check sheet.
- Fast blurred arms can drop out for a frame; trails and speed curves will gap there. That is honest, do not interpolate a strike.
- A fully hidden body has no skeleton. Correct, not a bug.
- Bbox contact gives false hits when one body passes in front of another, during a clinch, and for a limb in the air between two bodies. Use SAM masks when contact matters, and always run `contact_audit.py` so the page can say which test was used.
- ByteTrack ids are box overlap and motion only and restart at every cut. Identity across cuts comes from the mask vote or the trunk colour clustering; say which one (`pose_tracking.identity_across_cuts`).
- Record the depth model in the shipped data (`--depth-model`), or a claim like "Video Depth Anything" on a page cannot be checked.
- Web overlays: draw one impact label at a time (the selected or nearest peak) and draw impact rings on the live limb position, or labels stack into noise in dense exchanges. Stack timeline markers into lanes when they are closer than about 18 px, or taps miss on a phone.
- Ship only what the page references: the baked `skeleton.mp4`, per clip `quad.mp4` and 16-bit depth PNGs are review files; keep them in the work dir.
- Partial bodies (cropped at the frame edge) are dropped below 7 confident joints and 3 of 4 torso joints.
- For web delivery, a dev server without HTTP Range support breaks seeking (every seek lands at 0). Test with a Range capable server.
- Do not use client or confidential footage in showcase work.
