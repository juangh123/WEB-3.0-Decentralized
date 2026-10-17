"""Build a short strict-mode acceptance clip from captured evidence."""

import os
import shutil
import subprocess

BASE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(BASE)
REC = os.path.join(BASE, "recordings")
TMP = os.path.join(BASE, "tmp", "acceptance")
SEGS = os.path.join(TMP, "segments")
PUBLIC = os.path.join(ROOT, "zk-cid", "packages", "nextjs", "public", "demo")
DELIVERABLES = os.path.join(ROOT, "zk-cid", "deliverables", "videos")

FFMPEG = "ffmpeg"
FPS = 30
W, H = 1920, 1080

TITLE = os.path.join(REC, "acceptance-title.png")
UI = os.path.join(REC, "acceptance-ui.webm")
MINT = os.path.join(REC, "mint-tx-blockscout.png")
BUIDL = os.path.join(ROOT, "zk-cid", "deliverables", "media", "buidl-live-mint-2026-10-17.png")
CLOSING = os.path.join(BASE, "cards", "card-07.png")
VO_DEMO = os.path.join(BASE, "audio", "voiceover", "demo-3.mp3")
VO_IMPACT = os.path.join(BASE, "audio", "voiceover", "impact.mp3")
AMBIENT = os.path.join(BASE, "audio", "ambient.wav")


def run(cmd, cwd=None):
    print(">>", " ".join(cmd[:8]), "...")
    proc = subprocess.run(cmd, capture_output=True, text=True, cwd=cwd)
    if proc.returncode != 0:
        print(proc.stderr[-4000:])
        raise SystemExit("ffmpeg failed")
    return proc


def render_still(image, duration, out, zoom=0.0006):
    frames = int(duration * FPS)
    vf = (
        "scale=2560:1440:force_original_aspect_ratio=increase,"
        "crop=2560:1440,"
        "zoompan=z='min(zoom+{zoom},1.12)':d={frames}:"
        "x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s={w}x{h}:fps={fps},"
        "format=yuv420p,"
        "fade=t=in:st=0:d=0.35,fade=t=out:st={fade_out:.2f}:d=0.5"
    ).format(
        zoom=zoom,
        frames=frames,
        w=W,
        h=H,
        fps=FPS,
        fade_out=max(0.0, duration - 0.5),
    )
    run(
        [
            FFMPEG, "-y", "-loop", "1", "-i", image,
            "-vf", vf, "-t", str(duration), "-r", str(FPS),
            "-c:v", "libx264", "-preset", "medium", "-crf", "19", out,
        ]
    )


def render_ui_clip(out):
    run(
        [
            FFMPEG, "-y", "-ss", "4.5", "-t", "16", "-i", UI,
            "-vf",
            "scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},"
            "fps={fps},format=yuv420p,fade=t=in:st=0:d=0.35,fade=t=out:st=15.5:d=0.5".format(
                w=W, h=H, fps=FPS
            ),
            "-r", str(FPS), "-c:v", "libx264", "-preset", "medium", "-crf", "19", out,
        ]
    )


def main():
    for path in [TITLE, UI, MINT, BUIDL, CLOSING, VO_DEMO, VO_IMPACT, AMBIENT]:
        if not os.path.exists(path):
            raise SystemExit("missing input: " + path)

    os.makedirs(SEGS, exist_ok=True)
    os.makedirs(PUBLIC, exist_ok=True)
    os.makedirs(DELIVERABLES, exist_ok=True)

    render_still(TITLE, 2.5, os.path.join(SEGS, "seg-01-title.mp4"), zoom=0.0002)
    render_ui_clip(os.path.join(SEGS, "seg-02-ui.mp4"))
    render_still(MINT, 6.0, os.path.join(SEGS, "seg-03-mint.mp4"))
    render_still(BUIDL, 6.0, os.path.join(SEGS, "seg-04-buidl.mp4"))
    render_still(CLOSING, 3.5, os.path.join(SEGS, "seg-05-closing.mp4"), zoom=0.0002)

    concat_list = os.path.join(SEGS, "list.txt")
    with open(concat_list, "w", encoding="utf-8") as handle:
        for name in [
            "seg-01-title.mp4",
            "seg-02-ui.mp4",
            "seg-03-mint.mp4",
            "seg-04-buidl.mp4",
            "seg-05-closing.mp4",
        ]:
            handle.write("file '{}'\n".format(name))

    concat_out = os.path.join(TMP, "concat.mp4")
    run(
        [
            FFMPEG, "-y", "-f", "concat", "-safe", "0", "-i", concat_list,
            "-c", "copy", concat_out,
        ]
    )

    srt = os.path.join(TMP, "acceptance.srt")
    with open(srt, "w", encoding="utf-8") as handle:
        handle.write(
            "1\n00:00:00,000 --> 00:00:02,500\n"
            "ZK-CID  |  Strict-mode live acceptance\n\n"
            "2\n00:00:02,500 --> 00:00:12,000\n"
            "Anonymous identity, generated locally\n\n"
            "3\n00:00:12,000 --> 00:00:18,500\n"
            "Demo issuance -> local proof -> AccessNFT mint\n\n"
            "4\n00:00:18,500 --> 00:00:24,500\n"
            "Sepolia transaction confirmed: AccessNFT token 0\n\n"
            "5\n00:00:24,500 --> 00:00:30,500\n"
            "Throwaway credential revoked; member set restored\n\n"
            "6\n00:00:30,500 --> 00:00:34,000\n"
            "Reproducible: scripts/sepoliaLiveMint.ts\n"
        )

    final = os.path.join(TMP, "zk-cid-strict-mode-acceptance.mp4")
    filter_complex = (
        "[0:v]subtitles=acceptance.srt:force_style="
        "'FontName=Segoe UI,FontSize=24,PrimaryColour=&H00FFFFFF,"
        "OutlineColour=&H90000000,BorderStyle=1,Outline=1.4,Shadow=0.5,MarginV=36'[v];"
        "[1:a]atrim=0:15.7,asetpts=PTS-STARTPTS,adelay=2500|2500[vo1];"
        "[2:a]atrim=0:15.5,asetpts=PTS-STARTPTS,adelay=18500|18500[vo2];"
        "[3:a]atrim=0:34,volume=0.10,afade=t=in:st=0:d=1,afade=t=out:st=32:d=2[amb];"
        "[vo1][vo2][amb]amix=inputs=3:duration=longest:normalize=0[a]"
    )
    run(
        [
            FFMPEG, "-y", "-i", concat_out, "-i", VO_DEMO, "-i", VO_IMPACT, "-i", AMBIENT,
            "-filter_complex", filter_complex,
            "-map", "[v]", "-map", "[a]",
            "-c:v", "libx264", "-preset", "medium", "-crf", "19",
            "-c:a", "aac", "-b:a", "192k", "-shortest", final,
        ],
        cwd=TMP,
    )

    public_out = os.path.join(PUBLIC, "zk-cid-strict-mode-acceptance.mp4")
    deliverable_out = os.path.join(DELIVERABLES, "zk-cid-strict-mode-acceptance.mp4")
    shutil.copyfile(final, public_out)
    shutil.copyfile(final, deliverable_out)
    print("FINAL:", deliverable_out, os.path.getsize(deliverable_out) // 1024, "KB")


if __name__ == "__main__":
    main()
