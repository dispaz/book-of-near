/** Ink drawing of the wallet chain: words → private key → public key → address. Wide screens only. */
import type { ArtFocus } from "./useWallet";

const INK = "#16141f";

const BOXES = [
  { id: "words", y: 16, label: "12 words", sub: "seed phrase" },
  { id: "private", y: 126, label: "Private key", sub: "secret, signs" },
  { id: "public", y: 236, label: "Public key", sub: "shared, checks" },
  { id: "address", y: 346, label: "Address", sub: "64 hex characters" },
] as const;

const ARROWS = ["SLIP-10 path", "ed25519", "write as hex"];

/** The step-note target each box carries (see StepNote and the manifest's explainAt). */
const EXPLAIN: Record<(typeof BOXES)[number]["id"], string | undefined> = {
  words: "words",
  private: "custody",
  public: undefined,
  address: "address",
};

function hot(focus: ArtFocus): string[] {
  switch (focus) {
    case "words":
      return ["words"];
    case "keys":
      return ["private", "public"];
    case "address":
      return ["address"];
    case "sign":
      return ["private"];
    case "verify":
      return ["public"];
    default:
      return [];
  }
}

function describe(focus: ArtFocus, verdict: "pass" | "fail" | null): string {
  if (focus === "warning") return "A warning sign over an empty wallet: no keys exist yet.";
  if (focus === "gone") return "The wallet is empty: the practice keys were thrown away.";
  const base =
    "A chain of four boxes: 12 words make a private key, the private key makes a public key, the public key becomes an address.";
  if (focus === "sign") return `${base} The private key stamps a message with a signature.`;
  if (focus === "verify")
    return `${base} The public key checks the signature: ${verdict === "fail" ? "it does not match" : verdict === "pass" ? "it matches" : "not checked yet"}.`;
  return base;
}

export function WalletArt({
  focus,
  verdict,
  reducedMotion,
}: {
  focus: ArtFocus;
  verdict: "pass" | "fail" | null;
  reducedMotion: boolean;
}) {
  const empty = focus === "warning" || focus === "gone";
  const lit = hot(focus);
  return (
    <svg
      className={`wallet-art${reducedMotion ? " still" : ""}`}
      viewBox="0 0 360 440"
      role="img"
      aria-label={describe(focus, verdict)}
      data-focus={focus}
    >
      {BOXES.map((b, i) => (
        <g
          key={b.id}
          className="wa-box"
          opacity={focus === "warning" ? 0 : empty ? 0.45 : 1}
          data-explain={empty ? undefined : EXPLAIN[b.id]}
        >
          <rect
            x="40"
            y={b.y}
            width="210"
            height="74"
            rx="14"
            fill={lit.includes(b.id) ? "var(--accent)" : "#fffdf7"}
            stroke={INK}
            strokeWidth="2.5"
            strokeDasharray={empty ? "8 6" : undefined}
          />
          <text
            x="145"
            y={b.y + 34}
            textAnchor="middle"
            fontFamily="Newsreader, serif"
            fontSize="22"
            fontWeight="700"
            fill={INK}
          >
            {b.label}
          </text>
          <text
            x="145"
            y={b.y + 58}
            textAnchor="middle"
            fontFamily="Caveat, cursive"
            fontSize="20"
            fill={INK}
          >
            {b.sub}
          </text>
          {i < ARROWS.length ? (
            <g>
              <path
                d={`M145 ${b.y + 78} v26`}
                stroke={INK}
                strokeWidth="2.5"
                strokeDasharray={empty ? "4 5" : undefined}
              />
              <path d={`M138 ${b.y + 96} l7 9 l7 -9`} fill="none" stroke={INK} strokeWidth="2.5" />
              <text x="158" y={b.y + 98} fontFamily="Caveat, cursive" fontSize="18" fill={INK}>
                {ARROWS[i]}
              </text>
            </g>
          ) : null}
        </g>
      ))}

      {/* Extra note targets: the key pair (at the private key), and the address being compared. */}
      {empty ? null : <rect x="40" y="126" width="210" height="74" fill="none" data-explain="keys" />}
      {focus === "address" ? (
        <rect x="40" y="346" width="210" height="74" fill="none" data-explain="addresses" />
      ) : null}

      {focus === "sign" ? (
        <g className="wa-pop" data-explain="message">
          <path d="M255 163 h28" stroke={INK} strokeWidth="2.5" />
          <rect x="283" y="130" width="70" height="66" rx="8" fill="#fff" stroke={INK} strokeWidth="2.5" />
          <text x="318" y="156" textAnchor="middle" fontFamily="Caveat, cursive" fontSize="18" fill={INK}>
            message
          </text>
          <circle cx="318" cy="176" r="12" fill="var(--accent)" stroke={INK} strokeWidth="2" />
          <text x="318" y="216" textAnchor="middle" fontFamily="Caveat, cursive" fontSize="18" fill={INK}>
            + signature
          </text>
        </g>
      ) : null}

      {focus === "verify" ? (
        <g className="wa-pop" data-explain="check">
          <path d="M255 273 h28" stroke={INK} strokeWidth="2.5" />
          <circle
            cx="318"
            cy="273"
            r="30"
            fill={verdict === "pass" ? "var(--green)" : verdict === "fail" ? "var(--red)" : "#fff"}
            stroke={INK}
            strokeWidth="2.5"
          />
          <text
            x="318"
            y="284"
            textAnchor="middle"
            fontFamily="DM Sans, sans-serif"
            fontSize="30"
            fontWeight="700"
            fill={verdict ? "#fff" : INK}
          >
            {verdict === "pass" ? "✓" : verdict === "fail" ? "✗" : "?"}
          </text>
        </g>
      ) : null}

      {focus === "warning" ? (
        <g className="wa-pop" data-explain="warning">
          <path
            d="M145 120 L250 300 H40 Z"
            fill="var(--accent)"
            stroke={INK}
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <text
            x="145"
            y="270"
            textAnchor="middle"
            fontFamily="Newsreader, serif"
            fontSize="110"
            fontWeight="700"
            fill={INK}
          >
            !
          </text>
          <text x="145" y="345" textAnchor="middle" fontFamily="Caveat, cursive" fontSize="28" fill={INK}>
            no keys yet: read the warning
          </text>
        </g>
      ) : null}
      {focus === "gone" ? (
        <g transform="rotate(-8 145 222)" data-explain="custody">
          <rect x="35" y="196" width="220" height="44" rx="8" fill="#fffdf7" stroke={INK} strokeWidth="2.5" />
          <text x="145" y="229" textAnchor="middle" fontFamily="Caveat, cursive" fontSize="32" fill={INK}>
            keys thrown away
          </text>
        </g>
      ) : null}
    </svg>
  );
}
