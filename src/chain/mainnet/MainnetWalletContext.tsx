import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { DemoWallet } from "./DemoWallet";
import { checkFunds } from "./funds";
import { signWithConfirmation, type SigningOutcome } from "./signing";
import type { FundsRequirement, MainnetWallet, SigningPreview, SigningRequest, WalletState } from "./types";
import { formatNear } from "../units";
import "./wallet.css";

/** Loads the real wallet (NEAR Connect) only when the learner asks for it. Replaceable in tests. */
export type MainnetWalletLoader = () => Promise<MainnetWallet>;
const loadReal: MainnetWalletLoader = async () =>
  (await import("./NearConnectWallet")).createNearConnectWallet();

interface MainnetWalletApi {
  wallet: MainnetWallet;
  state: WalletState;
  /** True once the learner chose their own wallet (and it loaded). */
  usingReal: boolean;
  loading: boolean;
  /** Why the real wallet is not in use, in plain English. */
  notice: string | null;
  setUseReal(on: boolean): void;
  connect(): Promise<WalletState>;
  disconnect(): Promise<void>;
  /**
   * The only way a lesson signs: shows what it does and the amount, waits for "Confirm", and only
   * then asks the wallet. Resolves with the outcome; never throws for a refusal.
   */
  sign(request: SigningRequest): Promise<SigningOutcome>;
}

const Ctx = createContext<MainnetWalletApi | null>(null);

export function useMainnetWallet(): MainnetWalletApi {
  const api = useContext(Ctx);
  if (!api) throw new Error("useMainnetWallet needs a MainnetWalletProvider above it.");
  return api;
}

/**
 * Gives lessons the mainnet wallet. Demo wallet by default: no wallet app, no network. The real
 * wallet is loaded only after the learner chooses "Use my own wallet".
 */
export function MainnetWalletProvider({
  children,
  demoWallet,
  loadMainnetWallet = loadReal,
}: {
  children: ReactNode;
  demoWallet?: MainnetWallet;
  loadMainnetWallet?: MainnetWalletLoader;
}) {
  const [demo] = useState<MainnetWallet>(() => demoWallet ?? new DemoWallet());
  const [real, setReal] = useState<MainnetWallet | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const wallet = real ?? demo;
  const [state, setState] = useState<WalletState>(wallet.state());
  const [pending, setPending] = useState<{ preview: SigningPreview; resolve: (ok: boolean) => void } | null>(
    null,
  );

  useEffect(() => {
    setState(wallet.state());
    return wallet.subscribe(setState);
  }, [wallet]);

  const setUseReal = useCallback(
    (on: boolean) => {
      setNotice(null);
      if (!on) {
        void real?.disconnect();
        setReal(null);
        return;
      }
      setLoading(true);
      loadMainnetWallet().then(
        (w) => {
          setReal(w);
          setLoading(false);
        },
        () => {
          setLoading(false);
          setNotice(
            "The wallet connector could not load, so the app is still using the simulated demo wallet.",
          );
        },
      );
    },
    [real, loadMainnetWallet],
  );

  const walletRef = useRef(wallet);
  walletRef.current = wallet;

  const sign = useCallback(
    (request: SigningRequest) =>
      signWithConfirmation(
        walletRef.current,
        request,
        (preview) => new Promise<boolean>((resolve) => setPending({ preview, resolve })),
      ),
    [],
  );

  const api = useMemo<MainnetWalletApi>(
    () => ({
      wallet,
      state,
      usingReal: real !== null,
      loading,
      notice,
      setUseReal,
      connect: () => wallet.connect(),
      disconnect: () => wallet.disconnect(),
      sign,
    }),
    [wallet, state, real, loading, notice, setUseReal, sign],
  );

  const answer = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
  };

  return (
    <Ctx.Provider value={api}>
      {children}
      {pending ? <SigningConfirm preview={pending.preview} onAnswer={answer} /> : null}
    </Ctx.Provider>
  );
}

/** The confirmation every signing request goes through. The wallet is asked only after "Confirm". */
function SigningConfirm({ preview, onAnswer }: { preview: SigningPreview; onAnswer: (ok: boolean) => void }) {
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => cancel.current?.focus(), []);
  return (
    <div className="wallet-backdrop">
      <div
        className="wallet-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wallet-dialog-title"
        onKeyDown={(e) => e.key === "Escape" && onAnswer(false)}
      >
        <h2 id="wallet-dialog-title">Please check this before you continue</h2>
        <p>{preview.summary}</p>
        <p className="wallet-amount" data-testid="signing-amount">
          <strong>{preview.amountNear} NEAR</strong> to <code>{preview.receiverId}</code>
        </p>
        <ul>
          {preview.lines.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
        <p className="wallet-warning">{preview.warning}</p>
        <div className="wallet-actions">
          <button type="button" ref={cancel} onClick={() => onAnswer(false)}>
            Cancel
          </button>
          <button type="button" className="wallet-confirm" onClick={() => onAnswer(true)}>
            Confirm and open my wallet
          </button>
        </div>
      </div>
    </div>
  );
}

/** Connect / disconnect, the account and its balance. Works in demo mode with no wallet and no network. */
export function WalletPanel() {
  const { state, usingReal, loading, notice, setUseReal, connect, disconnect } = useMainnetWallet();
  const simulated = !usingReal;
  return (
    <section className="wallet-panel" aria-label="Mainnet wallet">
      <p className="wallet-status" data-testid="wallet-status">
        {state.status === "connected"
          ? simulated
            ? "Connected (simulated demo wallet, no real money)."
            : "Connected to NEAR mainnet."
          : state.status === "connecting"
            ? "Connecting…"
            : "Not connected."}
      </p>
      {state.status === "connected" ? (
        <>
          <p>
            Account: <code data-testid="wallet-account">{state.accountId}</code>
          </p>
          <p>
            Balance: <strong data-testid="wallet-balance">{formatNear(state.balance, 4)} NEAR</strong>
          </p>
          <button type="button" onClick={() => void disconnect()}>
            Disconnect
          </button>
        </>
      ) : (
        <button
          type="button"
          disabled={state.status === "connecting" || loading}
          onClick={() => void connect()}
        >
          {simulated ? "Connect demo wallet" : "Connect wallet"}
        </button>
      )}
      {state.status === "error" ? (
        <p className="wallet-warning" role="alert">
          {state.message}
        </p>
      ) : null}
      {notice ? <p role="status">{notice}</p> : null}
      <button type="button" className="wallet-link" disabled={loading} onClick={() => setUseReal(simulated)}>
        {loading ? "Loading…" : simulated ? "Use my own wallet" : "Back to the demo wallet"}
      </button>
    </section>
  );
}

/** Says whether the connected account can afford `amount` (plus the fee reserve), and offers the fallback. */
export function FundsNotice({
  amount,
  feeReserve,
  fallbackHref = "/",
}: FundsRequirement & { fallbackHref?: string }) {
  const { state } = useMainnetWallet();
  const r = checkFunds(state, { amount, feeReserve });
  const id =
    r.kind === "enough" ? "funds-enough" : r.kind === "not-enough" ? "funds-not-enough" : "funds-no-wallet";
  return (
    <div className={`wallet-funds wallet-funds-${r.kind}`} data-testid={id} role="status">
      <p>{r.message}</p>
      {r.fallback ? (
        <p>
          <a href={fallbackHref}>Continue with the testnet edition</a>
        </p>
      ) : null}
    </div>
  );
}
