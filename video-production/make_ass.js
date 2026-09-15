// Convert an SRT file into an ASS file with an explicit 1920x1080 coordinate
// space. FFmpeg's SRT->ASS path uses PlayResY=288, which scales font sizes by
// 3.75x on a 1080p canvas and makes burned subtitles far larger than intended.
const fs = require("fs");
const path = require("path");

const PLAY_RES_X = 1920;
const PLAY_RES_Y = 1080;

const FONTS = {
  en: "Segoe UI",
  zh: "Microsoft YaHei",
};

function parseSrt(text) {
  const blocks = text.replace(/\r/g, "").split(/\n{2,}/);
  const cues = [];
  for (const block of blocks) {
    const lines = block.split("\n").filter((l) => l.trim() !== "");
    if (lines.length < 3) continue;
    const timeLine = lines.find((l) => l.includes("-->"));
    if (!timeLine) continue;
    const m = timeLine.match(
      /(\d+):(\d+):(\d+)[,.](\d+)\s*-->\s*(\d+):(\d+):(\d+)[,.](\d+)/
    );
    if (!m) continue;
    const start = toAssTime(+m[1], +m[2], +m[3], +m[4]);
    const end = toAssTime(+m[5], +m[6], +m[7], +m[8]);
    const body = lines
      .slice(lines.indexOf(timeLine) + 1)
      .join("\\N")
      .replace(/[{}]/g, "");
    cues.push({ start, end, body });
  }
  return cues;
}

function toAssTime(h, m, s, ms) {
  const cs = Math.round(ms / 10);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

function buildAss(cues, font) {
  const header = [
    "[Script Info]",
    "ScriptType: v4.00+",
    `PlayResX: ${PLAY_RES_X}`,
    `PlayResY: ${PLAY_RES_Y}`,
    "WrapStyle: 0",
    "ScaledBorderAndShadow: yes",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    `Style: Sub,${font},42,&H00FFFFFF,&H00FFFFFF,&H55000000,&H55000000,-1,0,0,0,100,100,0,0,3,12,0,2,160,160,42,1`,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ];
  const events = cues.map(
    (c) => `Dialogue: 0,${c.start},${c.end},Sub,,0,0,0,,${c.body}`
  );
  return header.concat(events).join("\n") + "\n";
}

function main() {
  const [, , srtArg, assArg] = process.argv;
  if (!srtArg || !assArg) {
    console.error("usage: node make_ass.js <input.srt> <output.ass>");
    process.exit(1);
  }
  const srtPath = path.resolve(srtArg);
  const assPath = path.resolve(assArg);
  const cues = parseSrt(fs.readFileSync(srtPath, "utf8"));
  const base = path.basename(srtPath).toLowerCase();
  const font = base.includes("zh") ? FONTS.zh : FONTS.en;
  fs.writeFileSync(assPath, buildAss(cues, font), "utf8");
  console.log(`wrote ${assPath} (${cues.length} cues, font=${font})`);
}

main();
