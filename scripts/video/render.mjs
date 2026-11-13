// Cuts the recorded shots into the demo video (issue #65). Run after record.mjs (`npm run video` runs both).
// Needs ffmpeg with libx264 and libass: FFMPEG=/path/to/ffmpeg, else `ffmpeg` on PATH. The voice-over uses
// macOS `say` (VOICE, default Daniel; VOICE_RATE, default 180 words a minute).
// Writes:
//   video/book-of-near-demo.mp4                 captions and voice-over
//   video/book-of-near-demo-captions-only.mp4   captions, silent audio track (for your own voice)
//   video/book-of-near-demo.srt                 the captions with their times
//   video/voiceover.txt                         the voice-over script with times, to read your own
// Layout: the app at 1600×900 on an ink frame, captions in the band under it, so they never cover the UI.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";

const ROOT = new URL("../../", import.meta.url).pathname;
const VIDEO = `${ROOT}video`;
const CLIPS = `${VIDEO}/clips`;
const BUILD = `${VIDEO}/build`;
const FFMPEG = process.env.FFMPEG || "ffmpeg";
const VOICE = process.env.VOICE || "Daniel";
const RATE = Number(process.env.VOICE_RATE || 180);
const FPS = 25;
const W = 1920;
const H = 1080;
// The app inside the frame, and the caption band under it.
const IN = { w: 1600, h: 900, x: 160, y: 20 };
const BAND_Y = (IN.y + IN.h + H) / 2;
const VOICE_LEAD = 0.3; // seconds into a shot before its voice starts
const FONTS = process.env.VIDEO_FONTS_DIR || "/System/Library/Fonts/Supplemental";
const INK = "1b1a17";
const PAPER = "f3efe4";

const narration = JSON.parse(readFileSync(new URL("./narration.json", import.meta.url), "utf8")).shots;
const index = JSON.parse(readFileSync(`${CLIPS}/shots.json`, "utf8"));

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 64 << 20, ...opts });
  if (r.error)
    throw new Error(`${cmd}: ${r.error.message}${cmd === FFMPEG ? " (set FFMPEG, see README)" : ""}`);
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")}\n${(r.stderr || "").slice(-3000)}`);
  return r;
}
const ff = (args, opts) => run(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", ...args], opts);

/** Duration in seconds of a media file, read from ffmpeg's banner. */
function durationOf(file) {
  const r = spawnSync(FFMPEG, ["-hide_banner", "-i", file], { encoding: "utf8" });
  const m = /Duration: (\d+):(\d+):(\d+\.\d+)/.exec(r.stderr);
  if (!m) throw new Error(`no duration for ${file}`);
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

const pad2 = (n, w = 2) => String(n).padStart(w, "0");
function stamp(t, sep) {
  const ms = Math.round(t * 1000);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor(ms / 60000) % 60;
  const s = Math.floor(ms / 1000) % 60;
  return sep === "srt"
    ? `${pad2(h)}:${pad2(m)}:${pad2(s)},${pad2(ms % 1000, 3)}`
    : `${h}:${pad2(m)}:${pad2(s)}.${pad2(Math.floor((ms % 1000) / 10))}`;
}

const mmss = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")}`;

/** Splits a caption into chunks of at most `max` characters (two lines in the band), at sentence ends first. */
function chunks(text, max = 92) {
  const out = [];
  // Sentence ends: "." or ";" followed by a space or the end (so a URL such as a.b.dev stays whole).
  for (const sentence of text
    .split(/(?<=[.;])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)) {
    const last = out.length ? out[out.length - 1] : null;
    if (last && last.length + 1 + sentence.length <= max * 0.75) out[out.length - 1] = `${last} ${sentence}`;
    else if (sentence.length <= max) out.push(sentence);
    else {
      // A long sentence: break at the comma nearest its middle.
      const mid = sentence.length / 2;
      const commas = [...sentence.matchAll(/, /g)].map((m) => m.index);
      const at =
        commas.sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid))[0] ?? sentence.lastIndexOf(" ", mid);
      out.push(sentence.slice(0, at + 1).trim(), sentence.slice(at + 1).trim());
    }
  }
  return out;
}

// ---------- 1. voice-over, one file per shot ----------

rmSync(BUILD, { recursive: true, force: true });
mkdirSync(BUILD, { recursive: true });
let t = 0;
const plan = narration.map((shot) => {
  const file = `${BUILD}/${shot.id}.aiff`;
  const room = shot.length - VOICE_LEAD - 0.4;
  let rate = RATE;
  run("say", ["-v", VOICE, "-r", String(rate), "-o", file, shot.voice]);
  let voice = durationOf(file);
  if (voice > room) {
    rate = Math.min(230, Math.ceil((rate * voice) / room));
    run("say", ["-v", VOICE, "-r", String(rate), "-o", file, shot.voice]);
    voice = durationOf(file);
  }
  if (voice > room)
    console.warn(`video: ${shot.id} voice ${voice.toFixed(1)} s is longer than its shot allows`);
  const entry = { ...shot, at: t, voiceFile: file, voiceSec: voice, rate };
  t += shot.length;
  return entry;
});
const TOTAL = t;
if (TOTAL > 140) throw new Error(`the cut is ${TOTAL} s; X allows 140 s`);

// ---------- 2. captions (.ass for the burn-in, .srt to ship) ----------

const cues = [];
for (const s of plan) {
  const parts = chunks(s.caption);
  const from = s.at + VOICE_LEAD - 0.1;
  const span = Math.max(s.voiceSec + 0.3, 1);
  const chars = parts.reduce((n, p) => n + p.length, 0);
  let c = from;
  parts.forEach((text, i) => {
    const end = i === parts.length - 1 ? s.at + s.length - 0.08 : c + (span * text.length) / chars;
    cues.push({ start: c, end, text });
    c = end;
  });
}

const assColor = (hex) => `&H00${hex.slice(4, 6)}${hex.slice(2, 4)}${hex.slice(0, 2)}`.toUpperCase();
const end = plan.find((s) => s.id === "10-end");
const cx = IN.x + IN.w / 2;
const cardLines = [
  ["Title", 330, "Book of NEAR"],
  ["Sub", 440, "Learn how NEAR works by doing it, in a pop-up book you can touch."],
  ["Url", 560, "book-of-near.pages.dev"],
  ["Small", 640, "github.com/dispaz/book-of-near"],
  ["Small", 720, "Built for the NEAR Hackathon 2026. Testnet only. Demo mode needs no wallet."],
];
const ass = [
  "[Script Info]",
  "ScriptType: v4.00+",
  `PlayResX: ${W}`,
  `PlayResY: ${H}`,
  "WrapStyle: 0",
  "ScaledBorderAndShadow: yes",
  "",
  "[V4+ Styles]",
  "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
  `Style: Caption,Arial,50,${assColor(PAPER)},${assColor(PAPER)},${assColor(INK)},${assColor(INK)},0,0,0,0,100,100,0,0,1,0,0,5,170,170,0,1`,
  `Style: Title,Georgia,120,${assColor(INK)},${assColor(INK)},${assColor(PAPER)},${assColor(PAPER)},1,0,0,0,100,100,0,0,1,0,0,5,0,0,0,1`,
  `Style: Sub,Georgia,44,${assColor(INK)},${assColor(INK)},${assColor(PAPER)},${assColor(PAPER)},0,1,0,0,100,100,0,0,1,0,0,5,0,0,0,1`,
  `Style: Url,Arial,64,${assColor("e5671e")},${assColor("e5671e")},${assColor(PAPER)},${assColor(PAPER)},1,0,0,0,100,100,0,0,1,0,0,5,0,0,0,1`,
  `Style: Small,Arial,36,${assColor(INK)},${assColor(INK)},${assColor(PAPER)},${assColor(PAPER)},0,0,0,0,100,100,0,0,1,0,0,5,0,0,0,1`,
  "",
  "[Events]",
  "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ...cues.map(
    (c) =>
      `Dialogue: 0,${stamp(c.start)},${stamp(c.end)},Caption,,0,0,0,,{\\pos(${W / 2},${BAND_Y})}${c.text}`,
  ),
  ...(end
    ? cardLines.map(
        ([style, y, text]) =>
          `Dialogue: 1,${stamp(end.at)},${stamp(TOTAL)},${style},,0,0,0,,{\\pos(${cx},${IN.y + (y * IN.h) / H})\\fad(250,0)}${text}`,
      )
    : []),
  "",
].join("\n");
writeFileSync(`${BUILD}/captions.ass`, ass);
writeFileSync(
  `${VIDEO}/book-of-near-demo.srt`,
  cues.map((c, i) => `${i + 1}\n${stamp(c.start, "srt")} --> ${stamp(c.end, "srt")}\n${c.text}\n`).join("\n"),
);
writeFileSync(
  `${VIDEO}/voiceover.txt`,
  [
    "Book of NEAR demo video: voice-over script (generated by scripts/video/render.mjs from narration.json).",
    `Total ${TOTAL} s. Each line starts ${VOICE_LEAD} s into its shot. Read it over book-of-near-demo-captions-only.mp4 to record your own voice.`,
    "",
    ...plan.map((s) => `[${mmss(s.at + VOICE_LEAD)} ${s.id}, ${s.length} s]\n${s.voice}\n`),
  ].join("\n"),
);

// ---------- 3. picture: trim, fit and join the clips, frame them, burn the captions ----------

const inputs = [];
const filters = [];
plan.forEach((s, i) => {
  const clip = index[s.id];
  if (clip) {
    if (!existsSync(`${CLIPS}/${clip.file}`)) throw new Error(`missing clip ${clip.file}: run record.mjs`);
    const speed = Math.min(2, Math.max(1, clip.action / s.length));
    s.speed = speed;
    inputs.push("-ss", String(clip.start), "-t", String(s.length * speed + 1), "-i", `${CLIPS}/${clip.file}`);
    filters.push(
      `[${i}:v]setpts=(PTS-STARTPTS)/${speed.toFixed(4)},fps=${FPS},tpad=stop_mode=clone:stop_duration=${s.length},trim=duration=${s.length},setpts=PTS-STARTPTS,scale=${W}:${H},setsar=1,format=yuv420p[v${i}]`,
    );
  } else {
    // A card (the end card): plain paper, the text comes from the captions file.
    inputs.push("-f", "lavfi", "-t", String(s.length), "-i", `color=c=0x${PAPER}:s=${W}x${H}:r=${FPS}`);
    filters.push(`[${i}:v]setsar=1,format=yuv420p[v${i}]`);
  }
});
filters.push(
  `${plan.map((_, i) => `[v${i}]`).join("")}concat=n=${plan.length}:v=1:a=0[cat]`,
  `[cat]scale=${IN.w}:${IN.h}:flags=lanczos,pad=${W}:${H}:${IN.x}:${IN.y}:color=0x${INK},ass=captions.ass:fontsdir=${FONTS},fade=t=in:st=0:d=0.4,fade=t=out:st=${TOTAL - 0.6}:d=0.6[out]`,
);
console.log(`video: encoding ${TOTAL} s of picture`);
ff(
  [
    ...inputs,
    "-filter_complex",
    filters.join(";"),
    "-map",
    "[out]",
    "-t",
    String(TOTAL),
    "-r",
    String(FPS),
    "-c:v",
    "libx264",
    "-preset",
    "slow",
    "-profile:v",
    "high",
    "-level",
    "4.1",
    "-crf",
    "21",
    "-maxrate",
    "3500k",
    "-bufsize",
    "7000k",
    "-g",
    String(FPS * 2),
    "-pix_fmt",
    "yuv420p",
    "-an",
    "picture.mp4",
  ],
  { cwd: BUILD },
);

// ---------- 4. sound: the voice lines at their times, loudness-normalised ----------

const aIn = plan.flatMap((s) => ["-i", s.voiceFile]);
const aFilters = plan.map(
  (s, i) =>
    `[${i}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,adelay=${Math.round((s.at + VOICE_LEAD) * 1000)}:all=1[a${i}]`,
);
aFilters.push(
  `${plan.map((_, i) => `[a${i}]`).join("")}amix=inputs=${plan.length}:normalize=0:duration=longest,apad=whole_dur=${TOTAL},atrim=0:${TOTAL},loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000,aformat=sample_fmts=s16:channel_layouts=stereo[aout]`,
);
ff([...aIn, "-filter_complex", aFilters.join(";"), "-map", "[aout]", "-ar", "48000", "voice.wav"], {
  cwd: BUILD,
});

// ---------- 5. the two MP4s ----------

const mux = [
  "-c:v",
  "copy",
  "-c:a",
  "aac",
  "-b:a",
  "160k",
  "-ar",
  "48000",
  "-ac",
  "2",
  "-movflags",
  "+faststart",
];
ff(
  [
    "-i",
    "picture.mp4",
    "-i",
    "voice.wav",
    "-map",
    "0:v",
    "-map",
    "1:a",
    ...mux,
    "-t",
    String(TOTAL),
    `${VIDEO}/book-of-near-demo.mp4`,
  ],
  {
    cwd: BUILD,
  },
);
ff(
  [
    "-i",
    "picture.mp4",
    "-f",
    "lavfi",
    "-i",
    "anullsrc=r=48000:cl=stereo",
    "-map",
    "0:v",
    "-map",
    "1:a",
    ...mux,
    "-t",
    String(TOTAL),
    `${VIDEO}/book-of-near-demo-captions-only.mp4`,
  ],
  { cwd: BUILD },
);

for (const name of ["book-of-near-demo.mp4", "book-of-near-demo-captions-only.mp4"]) {
  const f = `${VIDEO}/${name}`;
  console.log(`video: ${f}  ${durationOf(f).toFixed(2)} s, ${(statSync(f).size / 1e6).toFixed(1)} MB`);
}
console.log(`video: voice ${VOICE}; shots:`);
for (const s of plan)
  console.log(
    `  ${mmss(s.at).padStart(6)}  ${s.id.padEnd(20)} ${String(s.length).padStart(2)} s  voice ${s.voiceSec.toFixed(1)} s @${s.rate}${s.speed > 1.001 ? `  clip x${s.speed.toFixed(2)}` : ""}`,
  );
