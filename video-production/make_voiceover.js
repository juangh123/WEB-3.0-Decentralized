// Generate the per-section voiceover for the ZK-CID pitch video.
//
// Each narration section becomes its own audio file plus a word-level VTT, so
// the cut can be timed to the actual spoken length instead of guessing.
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const BASE = __dirname;
const VO_DIR = path.join(BASE, "audio", "voiceover");
const TMP_DIR = path.join(BASE, "tmp", "voiceover");
const PYTHON =
  process.env.PYTHON_PATH ||
  "C:\\Users\\Administrator\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\python\\python.exe";
const FORCE = process.argv.includes("--force");

function run(cmd, args) {
  const p = spawnSync(cmd, args, { encoding: "utf8" });
  if (p.status !== 0) {
    throw new Error(cmd + " failed: " + (p.stderr || "").slice(-2000));
  }
  return p.stdout + p.stderr;
}

function mediaDuration(file) {
  const out = run("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    file,
  ]);
  return Number.parseFloat(out.trim());
}

function main() {
  const config = JSON.parse(fs.readFileSync(path.join(BASE, "narration.json"), "utf8"));
  fs.mkdirSync(VO_DIR, { recursive: true });
  fs.mkdirSync(TMP_DIR, { recursive: true });

  const manifest = [];
  for (const section of config.sections) {
    const text = section.sentences.join(" ");
    const mp3 = path.join(VO_DIR, section.id + ".mp3");
    const vtt = path.join(VO_DIR, section.id + ".vtt");
    const txt = path.join(TMP_DIR, section.id + ".txt");
    fs.writeFileSync(txt, text, "utf8");

    const fresh = fs.existsSync(mp3) && fs.statSync(mp3).size > 2000;
    if (!fresh || FORCE) {
      run(PYTHON, [
        "-m", "edge_tts",
        "--voice=" + config.voice,
        "--rate=" + config.rate,
        "--volume=" + config.volume,
        "--pitch=" + config.pitch,
        "--file=" + txt,
        "--write-media=" + mp3,
        "--write-subtitles=" + vtt,
      ]);
      console.log("voiced", section.id);
    } else {
      console.log("cached", section.id);
    }

    const duration = mediaDuration(mp3);
    manifest.push({
      id: section.id,
      text,
      sentences: section.sentences,
      duration,
      media: path.relative(BASE, mp3).replace(/\\/g, "/"),
      subtitles: path.relative(BASE, vtt).replace(/\\/g, "/"),
    });
  }

  fs.writeFileSync(
    path.join(VO_DIR, "manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf8"
  );

  let total = 0;
  for (const m of manifest) {
    total += m.duration;
    console.log(m.id.padEnd(12), m.duration.toFixed(2) + "s");
  }
  console.log("narration total", total.toFixed(2) + "s");
}

main();