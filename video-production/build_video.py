# -*- coding: utf-8 -*-
"""Build the ZK-CID hackathon pitch video:
1) generate ambient background music (numpy)
2) render each segment (card/screenshot) with Ken Burns + fades via ffmpeg
3) concat segments
4) burn subtitles + mix audio -> final MP4
"""
import os, subprocess, shutil
import numpy as np

BASE = r"E:\AI WORK\WEB 3.0 Decentralized\video-production"
CARDS = os.path.join(BASE, "cards")
SHOTS = r"E:\AI WORK\WEB 3.0 Decentralized\zk-cid\docs\assets"
SEGS = os.path.join(BASE, "segments")
AUDIO = os.path.join(BASE, "audio")

FFMPEG = r"C:\Users\Administrator\ffmpeg-extract\ffmpeg-9.0-essentials_build\bin\ffmpeg.exe"
FPS = 30
W, H = 1920, 1080

SEGMENTS = [
    (os.path.join(CARDS, "card-01.png"), 15, "in",  None),
    (os.path.join(CARDS, "card-02.png"), 25, "out", None),
    (os.path.join(CARDS, "card-03.png"), 30, "in",  None),
    (os.path.join(CARDS, "card-04.png"),  5, "out", None),
    (os.path.join(SHOTS, "demo-00-landing.png"),        12, "in",  "left"),
    (os.path.join(SHOTS, "demo-01-comparison.png"),     12, "out", "right"),
    (os.path.join(SHOTS, "demo-02-identity.png"),       12, "in",  None),
    (os.path.join(SHOTS, "demo-03-issued.png"),         12, "out", None),
    (os.path.join(SHOTS, "demo-03-issued-success.png"), 12, "in",  None),
    (os.path.join(CARDS, "card-05.png"), 25, "in",  None),
    (os.path.join(CARDS, "card-06.png"), 30, "out", None),
    (os.path.join(CARDS, "card-07.png"), 20, "in",  None),
]

def run(cmd, cwd=None):
    print(">>", " ".join(cmd[:7]), "...")
    p = subprocess.run(cmd, capture_output=True, text=True, cwd=cwd)
    if p.returncode != 0:
        print(p.stderr[-4000:])
        raise SystemExit("ffmpeg failed")
    return p

# ---------- 1. ambient music ----------
def make_music(path, total=216.0, sr=44100):
    rng = np.random.default_rng(7)
    n = int(total * sr)
    t = np.arange(n) / sr
    mix = np.zeros(n)
    chords = [
        [130.81, 164.81, 196.00, 246.94, 293.66],
        [110.00, 130.81, 164.81, 220.00, 246.94],
        [ 87.31, 130.81, 174.61, 220.00, 261.63],
        [ 98.00, 123.47, 146.83, 196.00, 246.94],
    ]
    seg = 8.0
    pos = 0.0
    while pos < total:
        chord = chords[int(pos // seg) % len(chords)]
        d = min(seg, total - pos)
        m = int(d * sr)
        tt = np.arange(m) / sr
        env = np.minimum(tt / 2.5, 1.0) * np.minimum((d - tt) / 1.5, 1.0)
        env = np.clip(env, 0, 1)
        acc = np.zeros(m)
        for f in chord:
            detune = 1 + rng.uniform(-0.0015, 0.0015)
            vib = 1 + 0.0015 * np.sin(2 * np.pi * 0.15 * tt)
            acc += np.sin(2 * np.pi * f * detune * vib * tt) * 0.5
            acc += 0.25 * np.sin(2 * np.pi * f * 2 * tt)
        acc += np.sin(2 * np.pi * (chord[0] / 2) * tt) * 0.9
        lfo = 0.5 + 0.5 * np.sin(2 * np.pi * 0.05 * tt)
        acc *= (0.25 + 0.75 * lfo)
        mix[int(pos * sr):int(pos * sr) + m] += acc * env
        pos += seg
    noise = rng.normal(0, 1, n)
    nf = np.convolve(noise, np.ones(512) / 512, mode="same")
    nenv = 0.5 + 0.5 * np.sin(2 * np.pi * 0.02 * t + 1.0)
    mix += nf * 0.05 * nenv
    mix = np.tanh(mix * 1.2)
    mix = mix / (np.max(np.abs(mix)) + 1e-9) * 0.35
    delay = int(0.012 * sr)
    right = np.roll(mix, delay)
    stereo = np.stack([mix, right], axis=1)
    pcm = (stereo * 32767).astype(np.int16)
    import wave
    with wave.open(path, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes(pcm.tobytes())
    print("music:", path, os.path.getsize(path) // 1024, "KB")

make_music(os.path.join(AUDIO, "ambient.wav"))

# ---------- 2. render segments ----------
concat_file = os.path.join(SEGS, "list.txt")
with open(concat_file, "w", encoding="utf-8") as f:
    for i, (img, dur, mode, pan) in enumerate(SEGMENTS, 1):
        out = os.path.join(SEGS, f"seg-{i:02d}.mp4")
        frames = int(dur * FPS)
        if mode == "in":
            zexpr = "min(zoom+0.0008,1.18)"
        else:
            zexpr = "max(1.15-0.0008*on,1.0)"
        if pan == "left":
            xexpr = "(iw-iw/zoom)/2-(iw/zoom)*0.04*(on/{})".format(frames)
            yexpr = "ih/2-(ih/zoom/2)"
        elif pan == "right":
            xexpr = "(iw-iw/zoom)/2+(iw/zoom)*0.04*(on/{})".format(frames)
            yexpr = "ih/2-(ih/zoom/2)"
        else:
            xexpr = "iw/2-(iw/zoom/2)"
            yexpr = "ih/2-(ih/zoom/2)"
        vf = (
            "scale=2560:1440:force_original_aspect_ratio=increase,"
            "crop=2560:1440,"
            "zoompan=z='{}':d={}:x={}:y={}:s={}x{}:fps={},"
            "format=yuv420p,"
            "fade=t=in:st=0:d=0.4,fade=t=out:st={:.1f}:d=0.5"
        ).format(zexpr, frames, xexpr, yexpr, W, H, FPS, dur - 0.5)
        cmd = [FFMPEG, "-y", "-loop", "1", "-i", img, "-vf", vf,
               "-t", str(dur), "-r", str(FPS),
               "-c:v", "libx264", "-preset", "medium", "-crf", "20", out]
        run(cmd)
        f.write("file '{}'\n".format(os.path.basename(out)))

concat_out = os.path.join(SEGS, "concat.mp4")
run([FFMPEG, "-y", "-f", "concat", "-safe", "0", "-i", concat_file,
     "-c", "copy", concat_out])

# ---------- 3. finalize variants ----------
def finalize(srt_abs, tag, font):
    if srt_abs is None:
        vf = None
    else:
        shutil.copyfile(srt_abs, os.path.join(SEGS, "subs.srt"))
        vf = ("subtitles=subs.srt:force_style="
              "'FontName={},FontSize=21,PrimaryColour=&H00FFFFFF,"
              "OutlineColour=&H80101420,BorderStyle=1,Outline=1.2,Shadow=0.6,MarginV=42'").format(font)
    out = os.path.join(BASE, "zk-cid-pitch-video-{}.mp4".format(tag))
    wav = os.path.join(AUDIO, "ambient.wav")
    if vf is None:
        run([FFMPEG, "-y", "-i", concat_out, "-i", wav,
             "-filter_complex",
             "[1:a]volume=0.30,afade=t=in:st=0:d=2,afade=t=out:st=208:d=6[a]",
             "-map", "0:v", "-map", "[a]",
             "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", out],
            cwd=SEGS)
    else:
        run([FFMPEG, "-y", "-i", concat_out, "-i", wav,
             "-filter_complex",
             "[0:v]{}[v];[1:a]volume=0.30,afade=t=in:st=0:d=2,afade=t=out:st=208:d=6[a]".format(vf),
             "-map", "[v]", "-map", "[a]",
             "-c:v", "libx264", "-preset", "medium", "-crf", "19",
             "-c:a", "aac", "-b:a", "192k", "-shortest", out],
            cwd=SEGS)
    print("FINAL:", out, os.path.getsize(out) // (1024 * 1024), "MB")

finalize(os.path.join(BASE, "subtitles_en.srt"), "en", "Segoe UI")
finalize(os.path.join(BASE, "subtitles_zh.srt"), "zh", "Microsoft YaHei")
finalize(None, "nocap", "")
