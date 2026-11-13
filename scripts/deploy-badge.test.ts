import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EXAM_ROUTE_INFO, EXAM_ROUTES } from "../src/exam/routes";

describe("deploy-badge.mjs routes", () => {
  it("sets the same stages per exam route as the app's exam gate (src/exam/routes.ts)", () => {
    const src = readFileSync(join(__dirname, "deploy-badge.mjs"), "utf8");
    const literal = /const ROUTES = (\{[^}]*\});/.exec(src)?.[1];
    expect(literal).toBeDefined();
    const routes = JSON.parse(literal!.replace(/(\w+):/g, '"$1":')) as Record<string, number[]>;
    expect(routes).toEqual(
      Object.fromEntries(EXAM_ROUTES.map((r) => [r, EXAM_ROUTE_INFO[r].requiredBadges])),
    );
  });

  it("imports no .ts file (Node before 22.18 cannot run one)", () => {
    const src = readFileSync(join(__dirname, "deploy-badge.mjs"), "utf8");
    expect(src).not.toMatch(/from "[^"]+\.ts"/);
  });
});
