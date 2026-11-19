# Reference hunt

## Queries

Search for the motion, not the subject. A finance film is not found by searching "finance".

| want | query patterns |
|---|---|
| kinetic type | "kinetic typography title card", "type animation brand film", "text animation motion design reel" |
| title sequences | "<film name> title sequence", "main title design", "opening titles motion design" |
| brand films | "brand film motion design 30 seconds", "<brand you admire> brand film" |
| product commercials | "product launch film motion graphics", "app promo motion design" |
| transitions | "seamless transitions motion design", "camera move between colour fields" |
| a specific move | describe it: "word repeated into a column", "letters replaced by shapes" |

`hunt.sh` searches YouTube only (`ytsearchN:`). Other sources that `grab.sh` also reads through yt-dlp: Vimeo
pages, direct MP4 links, a local file path. Studio pages (Behance, a motion studio's site, Awwwards for web
motion) are found with a web search; open them, then grab the embedded video URL.

## Picking 2 or 3

- Short over long: a 20 to 60 s piece gives the whole language; for a long one, `--from/--to` the best 15 s.
- One fast, one slow is a good pair: the fast one teaches entrances and rhythm, the slow one teaches holds and
  lockups. The dogfood card took cut rhythm from a 15.8 cuts per 10 s piece and hold length from a 5.5 one.
- Template promos and student projects are fine for moves; studio and title-sequence work for taste.
- Skip a reference whose energy comes from footage (city shots inside letters): you cannot take it with code.

## What grab.sh measures

- `cuts.txt`: scene-change cuts (ffmpeg score above 0.3), mean and median shot length, cuts per 10 s. Kinetic
  type that changes inside one shot can count as a cut: read it with the sheet.
- `palette.txt`: the 8 most frequent colours on a 4 bit grid. A near-black share of 50 to 80% means one dark
  field carries the piece; two or three strong entries mean a field flip system.
- `frames/tNNN.NN.jpg` at `--fps` and `sheet_01.jpg`, `sheet_02.jpg`, ... (6x8 tiles, 48 frames per sheet, time
  code). Read every sheet, not only the first. Pick 4 frames per reference for the board: one per idea you steal.
- Times in file names, sheets and `cuts.txt` are times of the original video, also after `--from/--to` (a URL
  section download records its offset in `info.txt`).

## Steal and leave

For each reference write four steal lines and one leave line:

| line | answer this |
|---|---|
| pacing | shot length, words per beat, how long a lockup holds |
| transitions | how one idea hands over: cut, field flip, camera move, a word that stays |
| type | how words enter, stack, change weight, leave; the highlight move |
| color | number of fields, how text colour relates to the field, where the accent is used |
| leave | the face, texture, footage, copy, logo, music, and any move that fights your brand |

A steal line must be specific enough to storyboard ("one row of a repeated column turns the accent"), not a
mood ("clean and modern").

## Rights

Study copies only. The downloaded video is deleted by `grab.sh` (pass `--keep` only for a reference you own).
Frames you keep are small study thumbnails for your board; do not publish a reference's frames as your work.
In a public copy of the board use `frameboard.py --no-source` (it also drops the reference frames) and give
references neutral titles.
