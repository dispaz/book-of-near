import { registry } from "../app/registry";
import { badgeArtUrl } from "./BadgeShelf";
import { STAGE_BADGES } from "./config";

const STAGES = [...Array(STAGE_BADGES).keys()];

/**
 * Dev-only preview of the badge art (`npm run badges:art`), at 64 px and full size, on a light and a
 * dark background, for the owner to approve from screenshots. Route `/badges-preview` exists only in
 * `npm run dev`.
 */
export default function ArtPreviewPage() {
  return (
    <main style={{ padding: "24px 16px", fontFamily: "var(--ui)" }}>
      <h1 style={{ fontFamily: "var(--serif)", margin: "0 0 16px" }}>Badge art preview</h1>
      {(["light", "dark"] as const).map((scheme) => (
        <section
          key={scheme}
          aria-label={`${scheme} background`}
          style={{
            background: scheme === "light" ? "var(--paper)" : "var(--ink)",
            color: scheme === "light" ? "var(--ink)" : "var(--paper)",
            border: "2px solid var(--ink)",
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <h2 style={{ margin: "0 0 12px", fontSize: 18 }}>On {scheme}</h2>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 16 }}>
            {STAGES.map((n) => (
              <figure key={n} style={{ margin: 0, textAlign: "center" }}>
                <img src={badgeArtUrl(n)} width={64} height={64} alt={`Stage ${n} badge, 64 px`} />
                <figcaption style={{ fontSize: 12 }}>64 px</figcaption>
              </figure>
            ))}
          </div>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            {STAGES.map((n) => (
              <figure key={n} style={{ margin: 0, textAlign: "center" }}>
                <img src={badgeArtUrl(n)} width={256} height={256} alt={`Stage ${n} badge`} />
                <figcaption>
                  Stage {n}: {registry.stages.find((s) => s.id === n)?.name}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
