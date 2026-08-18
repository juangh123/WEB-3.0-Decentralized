const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const BASE = __dirname;
const CARDS = path.join(BASE, "cards");
const SHOTS = path.join(BASE, "..", "zk-cid", "docs", "assets");
const SEGS = path.join(BASE, "segments");
const AUDIO = path.join(BASE, "audio");
const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const FPS = 30;
const W = 1920;
const H = 1080;

const SEGMENTS = [
  [path.join(CARDS, "card-01.png"), 15, "in", null],
  [path.join(CARDS, "card-02.png"), 25, "out", null],
  [path.join(CARDS, "card-03.png"), 30, "in", null],
  [path.join(CARDS, "card-04.png"), 5, "out", null],
  [path.join(SHOTS, "demo-00-landing.png"), 12, "in", "left"],
  [path.join(SHOTS, "demo-01-comparison.png"), 12, "out", "right"],
  [path.join(SHOTS, "demo-02-identity.png"), 12, "in", null],
  [path.join(SHOTS, "demo-03-issued.png"), 12, "out", null],
  [path.join(SHOTS, "demo-03-issued-success.png"), 12, "in", null],
  [path.join(CARDS, "card-05.png"), 25, "in", null],
  [path.join(CARDS, "card-06.png"), 30, "out", null],
  [path.join(CARDS, "card-07.png"), 20, "in", null],
];

function run(args, cwd) {
  console.log(">>", args.slice(0, 8).join(" "), "...");
  const p = spawnSync(FFMPEG, args, { cwd, encoding: "utf8" });
  if (p.status !== 0) {
    console.error((p.stderr || "").slice(-4000));
    throw new Error("ffmpeg failed");
  }
}

fs.mkdirSync(SEGS, { recursive: true });
fs.mkdirSync(AUDIO, { recursive: true });

const concatFile = path.join(SEGS, "list.txt");
const lines = [];

SEGMENTS.forEach(([img, dur, mode, pan], i) => {
  const idx = i + 1;
  const out = path.join(SEGS, `seg-${String(idx).padStart(2, "0")}.mp4`);
  const frames = Math.max(2, Math.round(dur * FPS));

  let zexpr;
  if (mode === "in") zexpr = `min(1.0+0.00012*on,1.18)`;
  else zexpr = `max(1.18-0.00012*on,1.0)`;

  let xexpr;
  let yexpr = "ih/2-(ih/zoom/2)";
  if (pan === "left") {
    xexpr = `(iw-iw/zoom)/2-(iw/zoom)*0.035*(on/${frames})`;
  } else if (pan === "right") {
    xexpr = `(iw-iw/zoom)/2+(iw/zoom)*0.035*(on/${frames})`;
  } else {
    xexpr = "iw/2-(iw/zoom/2)";
  }

  const vf = [
    "scale=2560:1440:force_original_aspect_ratio=increase",
    "crop=2560:1440",
    `zoompan=z='${zexpr}':d=${frames}:x='${xexpr}':y='${yexpr}':s=${W}x${H}:fps=${FPS}`,
    "eq=contrast=1.035:saturation=1.05",
    "unsharp=5:5:0.35:5:5:0.0",
    "fade=t=in:st=0:d=0.18",
    "format=yuv420p"
  ].join(",");

  run([
    "-y", "-loop", "1", "-i", img, "-vf", vf,
    "-t", String(dur), "-r", String(FPS),
    "-c:v", "libx264", "-preset", "medium", "-crf", "19",
    out
  ], BASE);

  lines.push(`file '${path.basename(out)}'`);
});

fs.writeFileSync(concatFile, lines.join("\n"), "utf8");
const concatOut = path.join(SEGS, "concat.mp4");
run(["-y", "-f", "concat", "-safe", "0", "-i", concatFile, "-c", "copy", concatOut], SEGS);

function finalize(srtPath, tag, font, subtitleStyle) {
  let vf = null;
  if (srtPath) {
    const subs = path.join(SEGS, "subs.srt");
    fs.copyFileSync(srtPath, subs);
    vf = `subtitles=subs.srt:force_style='FontName=${font},FontSize=30,PrimaryColour=&H00FFFFFF,OutlineColour=&H90000000,BorderStyle=3,Outline=0,Shadow=0,MarginV=48,Bold=1'`;
  }
  const out = path.join(BASE, `zk-cid-pitch-video-${tag}.mp4`);
  const wav = path.join(AUDIO, "ambient.wav");
  const audioFilter = "[1:a]volume=0.22,afade=t=in:st=0:d=2,afade=t=out:st=203:d=7[a]";
  if (!vf) {
    run([
      "-y", "-i", concatOut, "-i", wav,
      "-filter_complex", audioFilter,
      "-map", "0:v", "-map", "[a]",
      "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", out
    ], SEGS);
  } else {
    run([
      "-y", "-i", concatOut, "-i", wav,
      "-filter_complex", `[0:v]${vf}[v];${audioFilter}`,
      "-map", "[v]", "-map", "[a]",
      "-c:v", "libx264", "-preset", "medium", "-crf", "19",
      "-c:a", "aac", "-b:a", "192k", "-shortest", out
    ], SEGS);
  }
  console.log("FINAL:", out, Math.round(fs.statSync(out).size / (1024 * 1024)) + " MB");
}

finalize(path.join(BASE, "subtitles_en.srt"), "en", "Segoe UI");
finalize(null, "nocap", "");