// Builds contracts/counter/counter.wasm from counter.wat with wabt (no Rust toolchain needed).
// Run: npm run build:counter. The .wasm is committed so tests and lessons need no build step.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import initWabt from "wabt";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "contracts", "counter");
const wabt = await initWabt();
// WebAssembly MVP only: NEAR's runtime rejects bulk memory, sign extension and newer features.
const features = {
  mutable_globals: true,
  sat_float_to_int: false,
  sign_extension: false,
  simd: false,
  threads: false,
  multi_value: false,
  tail_call: false,
  bulk_memory: false,
  reference_types: false,
};
const mod = wabt.parseWat("counter.wat", readFileSync(join(dir, "counter.wat"), "utf8"), features);
mod.validate();
const { buffer } = mod.toBinary({ log: false, write_debug_names: false });
writeFileSync(join(dir, "counter.wasm"), buffer);
console.log(`counter.wasm: ${buffer.length} bytes`);
