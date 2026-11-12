// Builds contracts/badge/target/badge.wasm: cargo (Rust 1.86 pinned by rust-toolchain.toml), then
// binaryen's wasm-opt lowers sign-extension ops, which NEAR's runtime rejects.
// Run: npm run build:badge. Needs Rust (https://rustup.rs); the wasm target installs on first build.
import { execFileSync } from "node:child_process";
import { statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "contracts", "badge");
const cargo = process.env.CARGO || "cargo";
execFileSync(cargo, ["build", "--release", "--target", "wasm32-unknown-unknown"], {
  cwd: dir,
  stdio: "inherit",
});
const input = join(dir, "target", "wasm32-unknown-unknown", "release", "book_of_near_badge.wasm");
const output = join(dir, "target", "badge.wasm");
execFileSync(
  join(root, "node_modules", ".bin", "wasm-opt"),
  [
    "-Oz",
    "--enable-sign-ext",
    "--signext-lowering",
    "--strip-debug",
    "--strip-producers",
    input,
    "-o",
    output,
  ],
  { stdio: "inherit" },
);
console.log(`badge.wasm: ${statSync(output).size} bytes`);
