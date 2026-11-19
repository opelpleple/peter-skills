#!/usr/bin/env python3
"""Contact sheets: tile one frame every N seconds of a video (or a rendered frames folder) with the
time code and frame number burned into each tile, using the film's own open licensed font.

usage: python3 tools/qa/contact_sheet.py <video.mp4 | frames-dir> [--every 5] [--cols 6] [--rows 5]
          [--width 320] [--start 0] [--end SECONDS] [--fps 30] [--out work/qa/contact] [--title TEXT]
writes <out>_01.png, <out>_02.png, ... (cols x rows tiles each) and prints the list.
Frames are picked exactly: frame index = start*fps + k*every*fps (every*fps must be a whole number).
"""
import argparse, glob, os, subprocess, sys
os.environ['PATH'] = os.environ.get('PATH', '/usr/bin:/bin') + ':/opt/homebrew/bin:/usr/local/bin'  # ffmpeg from a minimal shell too

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
FONT = 'film/fonts/Poppins-SemiBold.ttf'  # relative to ROOT: no spaces inside the filtergraph

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('src')
    ap.add_argument('--every', type=float, default=5.0, help='seconds between tiles')
    ap.add_argument('--cols', type=int, default=6)
    ap.add_argument('--rows', type=int, default=5)
    ap.add_argument('--width', type=int, default=320, help='tile width in px')
    ap.add_argument('--start', type=float, default=0.0)
    ap.add_argument('--end', type=float, default=None)
    ap.add_argument('--fps', type=int, default=30)
    ap.add_argument('--out', default='work/qa/contact')
    ap.add_argument('--title', default=None)
    A = ap.parse_args()
    src = os.path.abspath(A.src)
    step = A.every * A.fps
    if abs(step - round(step)) > 1e-6:
        sys.exit('every * fps must be a whole number of frames')
    step = int(round(step))
    first = int(round(A.start * A.fps))
    if os.path.isdir(src):
        ext = next((e for e in ('png', 'jpg') if os.path.exists(os.path.join(src, f'00000.{e}'))), None)
        if not ext:
            sys.exit('folder has no 00000.png / 00000.jpg')
        inp = ['-framerate', str(A.fps), '-start_number', '0', '-i', os.path.join(src, f'%05d.{ext}')]
    else:
        inp = ['-i', src]
    last = f'*lte(n\\,{int(round(A.end * A.fps))})' if A.end is not None else ''
    title = (A.title or os.path.basename(src.rstrip('/'))).replace(':', '\\:').replace("'", '')
    out = os.path.abspath(A.out)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    for old in glob.glob(out + '_*.png'):
        os.remove(old)
    fs = max(12, A.width // 18)
    vf = (f"select='gte(n\\,{first})*not(mod(n-{first}\\,{step})){last}',"
          f"scale={A.width}:-2:flags=area,"
          f"drawtext=fontfile={FONT}:text='%{{pts\\:hms}}  f%{{eif\\:t*{A.fps}+0.5\\:d}}':fontsize={fs}:fontcolor=white:"
          f"box=1:boxcolor=black@0.65:boxborderw=4:x=6:y=6,"
          f"tile={A.cols}x{A.rows}:padding=4:margin=4:color=0x101014,"
          f"pad=iw:ih+{fs * 2 + 8}:0:{fs * 2 + 8}:color=0x101014,"
          f"drawtext=fontfile={FONT}:text='{title}   every {A.every:g} s   sheet %{{eif\\:n+1\\:d}}':fontsize={int(fs * 1.2)}:fontcolor=0xf4d58d:x=8:y=6")
    cmd = ['ffmpeg', '-v', 'error', '-y', *inp, '-vf', vf, '-fps_mode', 'vfr', '-start_number', '1', out + '_%02d.png']
    r = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True)
    if r.returncode:
        sys.exit('ffmpeg failed: ' + r.stderr[-800:])
    sheets = sorted(glob.glob(out + '_*.png'))
    print(f'{len(sheets)} sheet(s), one tile every {A.every:g} s ({step} frames) from frame {first}:')
    for s in sheets:
        print('  ' + os.path.relpath(s, os.getcwd()))

if __name__ == '__main__':
    main()
