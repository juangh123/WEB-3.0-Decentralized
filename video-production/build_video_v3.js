// Build the hackathon submission cut for ZK-CID.
//
// The final video is intentionally capped below three minutes, uses one real
// voiceover clip per section, and exposes both English and Chinese caption
// variants. Demo footage is cropped and enlarged so judges can read the live UI
// without pausing the video.
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const BASE = __dirname;
const CARDS = path.join(BASE, "cards");
const SEGS = path.join(BASE, "segments");
const AUDIO = path.join(BASE, "audio");
const VO_DIR = path.join(AUDIO, "voiceover");
const RECORDING = path.join(BASE, "recordings", "combined-demo-60s.mp4");
const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const FPS = 30;
const W = 1920;
const H = 1080;
const MAX_ZOOM = 1.035;
const CRF_MASTER = "18";
const CRF_FINAL = "20";
const FADE = 0.22;
const FONT_BOLD = "C\\:/Windows/Fonts/segoeuib.ttf";
const MUSIC_VOLUME = 0.11;
const REUSE_SEGMENTS = process.argv.includes("--reuse-segments");

function run(args, cwd) {
  const p = spawnSync(FFMPEG, args, { cwd: cwd || BASE, encoding: "utf8" });
  if (p.status !== 0) {
    console.error((p.stderr || "").slice(-5000));
    throw new Error("ffmpeg failed: " + args.slice(0, 8).join(" "));
  }
}

function probeDuration(file) {
  const p = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1", file], { encoding: "utf8" });
  return Number.parseFloat((p.stdout || "").trim());
}

function parseCues(file) {
  const text = fs.readFileSync(file, "utf8").replace(/\r/g, "");
  const cues = [];
  for (const block of text.split(/\n{2,}/)) {
    const lines = block.split("\n").filter(Boolean);
    const timeLine = lines.find((line) => line.includes("-->"));
    if (!timeLine) continue;
    const match = timeLine.match(
      /(\d+):(\d+):(\d+)[,.](\d+)\s*-->\s*(\d+):(\d+):(\d+)[,.](\d+)/
    );
    if (!match) continue;
    const toSec = (h, m, s, ms) => +h * 3600 + +m * 60 + +s + +ms / 1000;
    cues.push({
      start: toSec(match[1], match[2], match[3], match[4]),
      end: toSec(match[5], match[6], match[7], match[8]),
      text: lines.slice(lines.indexOf(timeLine) + 1).join(" ").trim(),
    });
  }
  return cues;
}

function srtTime(sec) {
  const totalMs = Math.max(0, Math.round(sec * 1000));
  const h = Math.floor(totalMs / 3600000);
  const m = Math.floor((totalMs % 3600000) / 60000);
  const s = Math.floor((totalMs % 60000) / 1000);
  const ms = totalMs % 1000;
  const pad = (n, width) => String(n).padStart(width, "0");
  return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)},${pad(ms, 3)}`;
}

function buildSubtitles(sections, language, translatedText) {
  const cues = [];
  for (const section of sections) {
    const sourceCues = parseCues(path.join(VO_DIR, section.id + ".vtt"));
    sourceCues.forEach((cue, index) => {
      const text = language === "zh"
        ? translatedText[section.id] && translatedText[section.id][index]
        : cue.text;
      if (!text) throw new Error(`missing ${language} caption ${section.id}[${index}]`);
      const start = section.start + section.lead + cue.start;
      const end = Math.min(
        section.start + section.duration - 0.04,
        section.start + section.lead + cue.end + 0.18
      );
      cues.push({ start, end: Math.max(end, start + 0.55), text });
    });
  }
  return cues;
}

function writeSrt(file, cues) {
  fs.writeFileSync(file, cues.map((cue, index) =>
    `${index + 1}\n${srtTime(cue.start)} --> ${srtTime(cue.end)}\n${cue.text}\n`
  ).join("\n"), "utf8");
}

function buildAss(srt, tag) {
  const ass = path.join(SEGS, `v3-subs-${tag}.ass`);
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

// ---------------------------------------------------------------- schedule
const config = JSON.parse(fs.readFileSync(path.join(BASE, "narration.json"), "utf8"));
const translatedText = JSON.parse(
  fs.readFileSync(path.join(BASE, "captions_zh.json"), "utf8")
);
const manifest = JSON.parse(fs.readFileSync(path.join(VO_DIR, "manifest.json"), "utf8"));
const voById = new Map(manifest.map((item) => [item.id, item]));

const DEMO_MINIMUMS = {
  "demo-1": 10.0,
  "demo-2": 10.0,
  "demo-3": 17.0,
  "demo-4": 12.0,
};

const sections = config.sections.map((section) => {
  const vo = voById.get(section.id);
  if (!vo) throw new Error("missing voiceover for " + section.id);
  const minimum = section.visual.kind === "card"
    ? 3.5
    : (DEMO_MINIMUMS[section.id] || 5.0);
  return Object.assign({}, section, {
    vo,
    lead: config.leadIn,
    duration: Math.max(minimum, config.leadIn + vo.duration + config.tail),
  });
});

let cursor = 0;
for (const section of sections) {
  section.start = cursor;
  cursor += section.duration;
}
const TOTAL = cursor;
console.log("sections", sections.length, "total", TOTAL.toFixed(2) + "s");
if (TOTAL > 180) throw new Error(`submission cut is too long: ${TOTAL.toFixed(2)}s`);

// ---------------------------------------------------------------- captions
fs.mkdirSync(SEGS, { recursive: true });
const subVariants = [
  { tag: "en", srt: path.join(BASE, "subtitles_en.srt") },
  { tag: "zh", srt: path.join(BASE, "subtitles_zh.srt") },
];
for (const variant of subVariants) {
  const cues = buildSubtitles(sections, variant.tag, translatedText);
  writeSrt(variant.srt, cues);
  variant.ass = buildAss(variant.srt, variant.tag);
  console.log("captions", variant.tag, cues.length);
}

// ---------------------------------------------------------------- segments
const listLines = [];
sections.forEach((section, index) => {
  const out = path.join(SEGS, "v3-" + String(index + 1).padStart(2, "0") + ".mp4");
  if (REUSE_SEGMENTS && fs.existsSync(out) && fs.statSync(out).size > 10000) {
    console.log("cached segment", section.id);
    listLines.push("file '" + path.basename(out) + "'");
    return;
  }
  const frames = Math.max(2, Math.round(section.duration * FPS));
  const fadeOutStart = Math.max(0, section.duration - FADE);
  const common = [
    "eq=contrast=1.035:saturation=1.04",
    "unsharp=5:5:0.30:5:5:0.0",
    "fade=t=in:st=0:d=" + FADE,
    "fade=t=out:st=" + fadeOutStart.toFixed(2) + ":d=" + FADE,
    "format=yuv420p",
  ];

  if (section.visual.kind === "card") {
    const step = (MAX_ZOOM - 1) / frames;
    const zoomExpression = section.visual.mode === "in"
      ? "min(1.0+" + step.toFixed(8) + "*on," + MAX_ZOOM + ")"
      : "max(" + MAX_ZOOM + "-" + step.toFixed(8) + "*on,1.0)";
    const filters = [
      "zoompan=z='" + zoomExpression + "':d=" + frames +
        ":x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=" + W + "x" + H + ":fps=" + FPS,
    ].concat(common).join(",");
    run([
      "-y", "-loop", "1", "-i", path.join(CARDS, section.visual.src),
      "-vf", filters, "-t", section.duration.toFixed(3), "-r", String(FPS),
      "-c:v", "libx264", "-preset", "medium", "-crf", CRF_MASTER, out,
    ]);
  } else {
    const sourceStart = Math.max(0, section.visual.start);
    const sourceEnd = Math.min(probeDuration(RECORDING), section.visual.end);
    const available = Math.max(1, sourceEnd - sourceStart);
    // A value below one slows the source down; above one speeds it up.
    const playbackRate = available / section.duration;
    const filters = [
      "crop=1600:900:(iw-1600)/2:(ih-900)/2",
      "scale=" + W + ":" + H + ":flags=lanczos",
      "setpts=(PTS-STARTPTS)/" + playbackRate.toFixed(6),
      "fps=" + FPS,
      "drawtext=fontfile='" + FONT_BOLD + "':text='" +
        section.badge.replace(/'/g, "") + "'" +
        ":fontcolor=0xFFFFFF:fontsize=31:x=64:y=50:box=1:boxcolor=0x050914@0.86:boxborderw=18",
      "drawtext=fontfile='" + FONT_BOLD + "':text='" +
        String(index + 1).padStart(2, "0") + " / " +
        String(sections.length).padStart(2, "0") + "'" +
        ":fontcolor=0xBAE6FD:fontsize=26:x=w-tw-64:y=58:box=1:boxcolor=0x050914@0.72:boxborderw=14",
    ].concat(common).join(",");
    run([
      "-y", "-ss", sourceStart.toFixed(3), "-i", RECORDING,
      "-vf", filters, "-t", section.duration.toFixed(3), "-r", String(FPS), "-an",
      "-c:v", "libx264", "-preset", "medium", "-crf", CRF_MASTER, out,
    ]);
  }
  console.log("segment", section.id, section.duration.toFixed(2) + "s");
  listLines.push("file '" + path.basename(out) + "'");
});

const listFile = path.join(SEGS, "v3-list.txt");
fs.writeFileSync(listFile, listLines.join("\n"), "utf8");
const videoOnly = path.join(SEGS, "v3-video.mp4");
run(["-y", "-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", videoOnly], SEGS);

// ---------------------------------------------------------------- audio mix
const inputs = [];
const filters = [];
sections.forEach((section, index) => {
  inputs.push("-i", path.join(BASE, section.vo.media));
  const delayMs = Math.round((section.start + section.lead) * 1000);
  filters.push(
    `[${index + 1}:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,` +
    `adelay=${delayMs}|${delayMs}[v${index}]`
  );
});
filters.push(
  sections.map((_, index) => `[v${index}]`).join("") +
  `amix=inputs=${sections.length}:normalize=0:duration=longest[voice]`
);

inputs.push("-i", path.join(AUDIO, "ambient.wav"));
const musicIndex = sections.length;
filters.push(
  `[${musicIndex}:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,` +
  `atrim=0:${TOTAL.toFixed(3)},volume=${MUSIC_VOLUME},` +
  `afade=t=in:st=0:d=1.2,afade=t=out:st=${Math.max(0, TOTAL - 4).toFixed(2)}:d=4[music]`
);
filters.push("[music][voice]sidechaincompress=threshold=0.055:ratio=7:attack=18:release=380[ducked]");
filters.push("[ducked][voice]amix=inputs=2:normalize=0:duration=longest[premix]");
filters.push(
  "[premix]volume=4.0dB,alimiter=limit=0.80:level=false," +
  "aresample=48000[aout]"
);

const mixedAudio = path.join(SEGS, "v3-mixed.wav");
run([
  "-y",
].concat(inputs, [
  "-filter_complex", filters.join(";"),
  "-map", "[aout]", "-c:a", "pcm_s16le", mixedAudio,
]));

// ---------------------------------------------------------------- final cuts
for (const variant of subVariants) {
  const finalOut = path.join(BASE, `zk-cid-pitch-video-${variant.tag}.mp4`);
  const subtitleFilter =
    "[0:v]ass=" + path.basename(variant.ass) + ",format=yuv420p[v]";
  run([
    "-y", "-i", videoOnly, "-i", mixedAudio,
    "-filter_complex", subtitleFilter,
    "-map", "[v]", "-map", "1:a",
    "-c:v", "libx264", "-preset", "slow", "-crf", CRF_FINAL,
    "-c:a", "aac", "-b:a", "192k",
    "-movflags", "+faststart", "-t", TOTAL.toFixed(3), finalOut,
  ], SEGS);
  console.log(
    "FINAL",
    finalOut,
    (fs.statSync(finalOut).size / 1048576).toFixed(1) + " MB",
    probeDuration(finalOut).toFixed(2) + "s"
  );
}
