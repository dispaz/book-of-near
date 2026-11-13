import { Link } from "react-router";
import { ENABLE_MAINNET } from "../app/flags";
import { FundsNotice, WalletPanel } from "../chain/mainnet";
import { parseNear } from "../chain/units";

const pageStyle = {
  maxWidth: 560,
  margin: "0 auto",
  padding: "24px 16px",
  display: "grid",
  gap: 16,
} as const;

/** The mainnet wallet on its own page: connect, see the balance, see the funds check. Demo wallet by default. */
export function WalletPage() {
  if (!ENABLE_MAINNET) {
    return (
      <main style={pageStyle}>
        <h1 style={{ margin: 0 }}>Testnet-only build</h1>
        <p style={{ margin: 0 }} data-testid="testnet-only">
          This build is testnet only: the mainnet wallet is switched off. Every lesson works in demo mode or
          on testnet.
        </p>
        <Link to="/">Back to the contents</Link>
      </main>
    );
  }
  return (
    <main style={pageStyle}>
      <h1 style={{ margin: 0 }}>Mainnet wallet</h1>
      <p style={{ margin: 0 }}>
        The final badge and the optional swap use your own wallet on NEAR mainnet. Nothing is sent unless you
        confirm the amount first. No wallet? You can use the simulated one, or the free testnet edition.
      </p>
      <WalletPanel />
      <h2 style={{ margin: 0, fontSize: 18 }}>Can you afford the optional swap (0.1 NEAR)?</h2>
      <FundsNotice amount={parseNear("0.1")} />
      <Link to="/">Back to the contents</Link>
    </main>
  );
}
