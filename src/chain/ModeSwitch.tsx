import { useChainMode } from "./ChainContext";
import "./mode.css";

/**
 * The lesson page's network control: a status pill, one button to switch between demo mode and
 * testnet, and a notice when testnet was asked for but the app had to fall back to demo mode.
 */
export function ModeSwitch() {
  const { requested, active, status, notice, setMode } = useChainMode();
  const label =
    status === "connecting" ? "Connecting to testnet…" : active === "demo" ? "Demo mode" : "Testnet";
  const title =
    active === "demo"
      ? "Demo mode: no wallet, no network. Everything runs in your browser."
      : "Testnet: a real NEAR network for practice. Its tokens have no value.";

  return (
    <div className="mode-switch">
      <div className="mode-row">
        <span className="pill" data-testid="mode-pill" title={title} aria-live="polite">
          {label}
        </span>
        {status === "fallback" ? null : (
          <button
            type="button"
            className="mode-toggle"
            data-testid="mode-toggle"
            disabled={status === "connecting"}
            onClick={() => setMode(requested === "demo" ? "testnet" : "demo")}
          >
            {requested === "demo" ? "Use testnet" : "Use demo"}
          </button>
        )}
      </div>
      {status === "fallback" && notice ? (
        <div className="mode-notice" role="status" data-testid="mode-notice">
          <p>{notice}</p>
          <div className="mode-notice-actions">
            <button type="button" className="mode-toggle" onClick={() => setMode("testnet")}>
              Try again
            </button>
            <button type="button" className="mode-toggle" onClick={() => setMode("demo")}>
              Stay in demo
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
