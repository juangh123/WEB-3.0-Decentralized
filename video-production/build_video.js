// Build the ZK-CID pitch video.
//
// Why this exists alongside build_video.js: the original pipeline burned
// subtitles converted from SRT, and FFmpeg's SRT path assumes a 384x288
// PlayRes. On a 1080p canvas that multiplied every FontSize by 3.75, so a
// "FontSize=30" caption rendered ~112px tall and covered the artwork. It also
// ran Ken Burns up to z=1.18, which crops 144px from each side and sliced the
// first letter off every card heading (their margins are only ~104px).
//
// This version renders captions from ASS with an explicit 1920x1080 PlayRes,
// caps the zoom at 1.04, and adds a fade-out per segment.
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const BASE = __dirname;
const CARDS = path.join(BASE, "cards");
const SEGS = path.join(BASE, "segments");
const AUDIO = path.join(BASE, "audio");
const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const FPS = 30;
const W = 1920;
const H = 1080;
const MAX_ZOOM = 1.04;
const CRF_MASTER = "19";
const CRF_FINAL = "22";
const FADE_IN = 0.18;
const FADE_OUT = 0.3;

const SEGMENTS = [
  [path.join(CARDS, "card-01.png"), 15, "in"],
  [path.join(CARDS, "card-02.png"), 25, "out"],
  [path.join(CARDS, "card-03.png"), 30, "in"],
  [path.join(CARDS, "card-04.png"), 5, "out"],
  [path.join(BASE, "recordings", "combined-demo-60s.mp4"), 60, "video"],
  [path.join(CARDS, "card-05.png"), 25, "in"],
  [path.join(CARDS, "card-06.png"), 30, "out"],
  [path.join(CARDS, "card-07.png"), 20, "in"],
];

const VARIANTS = [
  { tag: "en-v2", srt: path.join(BASE, "subtitles_en.srt") },
  { tag: "zh-v2", srt: path.join(BASE, "subtitles_zh.srt") },
];

function run(args, cwd) {
  console.log(">>", args.slice(0, 6).join(" "), "...");
  const p = spawnSync(FFMPEG, args, { cwd, encoding: "utf8" });
  if (p.status !== 0) {
    console.error((p.stderr || "").slice(-4000));
    throw new Error("ffmpeg failed");
  }
}

function renderSegments() {
  fs.mkdirSync(SEGS, { recursive: true });
  const lines = [];

  SEGMENTS.forEach(([src, dur, mode], i) => {
    const out = path.join(SEGS, "v2-" + String(i + 1).padStart(2, "0") + ".mp4");
    const frames = Math.max(2, Math.round(dur * FPS));
    let vf;

    if (mode === "video") {
      vf = [
        "scale=1920:1080:force_original_aspect_ratio=decrease",
        "pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x050914",
        "fps=" + FPS,
        "fade=t=in:st=0:d=" + FADE_IN,
        "fade=t=out:st=" + (dur - FADE_OUT).toFixed(2) + ":d=" + FADE_OUT,
        "format=yuv420p",
      ].join(",");
      run([
        "-y", "-i", src, "-vf", vf,
        "-t", String(dur), "-r", String(FPS), "-an",
        "-c:v", "libx264", "-preset", "medium", "-crf", CRF_MASTER, out,
      ], BASE);
    } else {
      const step = (MAX_ZOOM - 1) / frames;
      const zexpr = mode === "in"
        ? "min(1.0+" + step.toFixed(8) + "*on," + MAX_ZOOM + ")"
        : "max(" + MAX_ZOOM + "-" + step.toFixed(8) + "*on,1.0)";
      const xexpr = "iw/2-(iw/zoom/2)";
      const yexpr = "ih/2-(ih/zoom/2)";
      vf = [
        "zoompan=z='" + zexpr + "':d=" + frames + ":x='" + xexpr + "':y='" + yexpr + "':s=" + W + "x" + H + ":fps=" + FPS,
        "eq=contrast=1.035:saturation=1.05",
        "unsharp=5:5:0.35:5:5:0.0",
        "fade=t=in:st=0:d=" + FADE_IN,
        "fade=t=out:st=" + (dur - FADE_OUT).toFixed(2) + ":d=" + FADE_OUT,
        "format=yuv420p",
      ].join(",");
      run([
        "-y", "-loop", "1", "-i", src, "-vf", vf,
        "-t", String(dur), "-r", String(FPS),
        "-c:v", "libx264", "-preset", "medium", "-crf", CRF_MASTER, out,
      ], BASE);
    }

    lines.push("file '" + path.basename(out) + "'");
  });

  const listFile = path.join(SEGS, "v2-list.txt");
  fs.writeFileSync(listFile, lines.join("\n"), "utf8");
  const concatOut = path.join(SEGS, "v2-concat.mp4");
  run(["-y", "-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", concatOut], SEGS);
  return concatOut;
}

function buildAss(srt, tag) {
  const ass = path.join(SEGS, "subs-" + tag + ".ass");
  const p = spawnSync(
    process.execPath,
    [path.join(BASE, "make_ass.js"), srt, ass],
    { encoding: "utf8" }
  );
  if (p.status !== 0) {
    console.error(p.stderr || "");
    throw new Error("subtitle conversion failed");
  }
  return ass;
}

function finalize(concatOut, srt, tag) {
  const ass = buildAss(srt, tag);
  const out = path.join(BASE, "zk-cid-pitch-video-" + tag + ".mp4");
  const wav = path.join(AUDIO, "ambient.wav");
  run([
    "-y", "-i", concatOut, "-i", wav,
    "-filter_complex",
    "[0:v]ass=" + path.basename(ass) + "[v];[1:a]volume=0.22,afade=t=in:st=0:d=2,afade=t=out:st=203:d=7[a]",
    "-map", "[v]", "-map", "[a]",
    "-c:v", "libx264", "-preset", "slow", "-crf", CRF_FINAL,
    "-pix_fmt", "yuv420p", "-movflags", "+faststart",
    "-c:a", "aac", "-b:a", "160k", "-shortest", out,
  ], SEGS);
  const mb = (fs.statSync(out).size / (1024 * 1024)).toFixed(1);
  console.log("FINAL:", out, mb, "MB");
}

const concatOut = renderSegments();
for (const variant of VARIANTS) {
  finalize(concatOut, variant.srt, variant.tag);
}