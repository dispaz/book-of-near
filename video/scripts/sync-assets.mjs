// Copies the app's badge art into the video's public folder, so the video always shows the current
// collection art (the app's public/badges is the source of truth; scripts/badges-art.mjs makes it).
import { cpSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const from = join(here, "..", "..", "public", "badges");
const to = join(here, "..", "public", "badges");
mkdirSync(to, { recursive: true });
cpSync(from, to, { recursive: true, filter: (p) => !p.endsWith(".json") });
mkdirSync(join(here, "..", "public", "clips"), { recursive: true });
console.log("video: badge art synced from public/badges");
