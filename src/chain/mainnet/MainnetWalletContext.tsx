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
  // The wallet itself is deliberately not exposed: lessons can only sign through `sign`.
  state: WalletState;
  /** True from "Confirm" until the wallet answers. Show it and disable your own buttons. */
  waiting: boolean;
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

  const [waiting, setWaiting] = useState(false);

  // signWithConfirmation holds a per-wallet lock, so a second call while a dialog is open or the
  // wallet is answering resolves as "busy" and never overwrites `pending`.
  const sign = useCallback(async (request: SigningRequest) => {
    let outcome: SigningOutcome | undefined;
    try {
      outcome = await signWithConfirmation(
        walletRef.current,
        request,
        (preview) =>
          new Promise<boolean>((resolve) =>
            setPending({
              preview,
              resolve: (ok) => {
                setPending(null);
                if (ok) setWaiting(true);
                resolve(ok);
              },
            }),
          ),
      );
      return outcome;
    } finally {
      // A refused "busy" call is not the signing that is waiting; leave its state alone.
      if (!(outcome && !outcome.ok && outcome.reason === "busy")) setWaiting(false);
    }
  }, []);

  const api = useMemo<MainnetWalletApi>(
    () => ({
      state,
      waiting,
      usingReal: real !== null,
      loading,
      notice,
      setUseReal,
      connect: () => wallet.connect(),
      disconnect: () => wallet.disconnect(),
      sign,
    }),
    [wallet, state, waiting, real, loading, notice, setUseReal, sign],
  );

  return (
    <Ctx.Provider value={api}>
      {children}
      {pending ? <SigningConfirm preview={pending.preview} onAnswer={pending.resolve} /> : null}
      {waiting ? (
        <div className="wallet-backdrop">
          <p className="wallet-dialog" role="status" data-testid="wallet-waiting">
            Waiting for your wallet. Finish or close the wallet window to continue. Please do not send this
            twice.
          </p>
        </div>
      ) : null}
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
          <strong>{preview.amountText}</strong> to <code>{preview.receiverId}</code>
        </p>
        <ul>
          {preview.lines.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
        <p>{preview.feeNote}</p>
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
