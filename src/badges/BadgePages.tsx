import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router";
import { useChain } from "../chain/ChainContext";
import { isValidAccountId } from "../chain/accountId";
import type { StageBadge } from "../chain/types";
import { BadgeShelf } from "./BadgeShelf";
import { STAGE_BADGES } from "./config";
import "./badges.css";

type Load = { s: "loading" } | { s: "done"; badges: StageBadge[] } | { s: "error"; text: string };

/** My book: the learner's own shelf, one slot per stage. */
export function MyBookPage() {
  const chain = useChain();
  const [account, setAccount] = useState<string | null>(null);
  const [load, setLoad] = useState<Load>({ s: "loading" });

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const me = (await chain.practiceAccount()).accountId;
        const badges = await chain.badgesOf(me);
        if (live) {
          setAccount(me);
          setLoad({ s: "done", badges });
        }
      } catch {
        if (live) setLoad({ s: "error", text: "Your badges could not be read. Try again in a minute." });
      }
    })();
    return () => {
      live = false;
    };
  }, [chain]);

  const count = load.s === "done" ? load.badges.length : 0;
  return (
    <main className="page badge-page">
      <div className="page-inner">
        <p className="eyebrow">My book</p>
        <h1>Your badges</h1>
        <p className="lede">
          You get one badge for each stage you finish. A badge is a token on the badge contract: it cannot be
          sold or sent to anyone else.
          {chain.network === "demo"
            ? " You are in demo mode, so these badges live in this browser only."
            : ""}
        </p>
        {load.s === "loading" ? <p role="status">Reading your badges…</p> : null}
        {load.s === "error" ? <p role="alert">{load.text}</p> : null}
        {load.s === "done" ? (
          <>
            <p className="badge-count">
              {count === 0
                ? "No badges yet. Finish stage 0 to claim the first."
                : `${count} of ${STAGE_BADGES} claimed.`}
            </p>
            <BadgeShelf badges={load.badges} label="My badges" dates={chain.network === "testnet"} />
            {account ? (
              <p className="badge-account">
                Held by <code>{account}</code>.{" "}
                <Link to={`/check?account=${encodeURIComponent(account)}`}>Open in the badge checker</Link>
              </p>
            ) : null}
          </>
        ) : null}
        <p>
          <Link className="btn" to="/">
            Back to contents
          </Link>
        </p>
      </div>
    </main>
  );
}

/** The checker: anyone's badges, no login. Reads the badge contract with view calls only. */
export function CheckerPage() {
  const chain = useChain();
  const [params, setParams] = useSearchParams();
  const asked = params.get("account")?.trim() ?? "";
  const [input, setInput] = useState(asked);
  const [load, setLoad] = useState<Load | null>(null);

  useEffect(() => {
    if (!asked) return setLoad(null);
    if (!isValidAccountId(asked)) return setLoad({ s: "error", text: "That is not a NEAR account name." });
    let live = true;
    setLoad({ s: "loading" });
    chain
      .badgesOf(asked)
      .then((badges) => live && setLoad({ s: "done", badges }))
      .catch(
        () =>
          live &&
          setLoad({ s: "error", text: "The badge contract could not be read. Try again in a minute." }),
      );
    return () => {
      live = false;
    };
  }, [asked, chain]);

  function submit(e: FormEvent) {
    e.preventDefault();
    setParams(input.trim() ? { account: input.trim() } : {});
  }

  return (
    <main className="page badge-page">
      <div className="page-inner">
        <p className="eyebrow">Badge checker</p>
        <h1>Check anyone's badges</h1>
        <p className="lede">
          Enter a NEAR account name. The checker reads the badge contract, which anyone can read without
          logging in.
          {chain.network === "demo"
            ? " Demo mode reads the demo contract in this browser."
            : " Testnet mode reads the testnet contract."}
        </p>
        <form className="checker-form" onSubmit={submit}>
          <label htmlFor="checker-account">Account</label>
          <input
            id="checker-account"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="name.testnet"
            autoComplete="off"
            spellCheck={false}
          />
          <button className="btn primary" type="submit">
            Check
          </button>
        </form>
        {load?.s === "loading" ? <p role="status">Reading badges…</p> : null}
        {load?.s === "error" ? <p role="alert">{load.text}</p> : null}
        {load?.s === "done" ? (
          <>
            <p className="badge-count">
              <code>{asked}</code> holds{" "}
              {load.badges.length === 0 ? "no badges" : `${load.badges.length} of ${STAGE_BADGES} badges`}.
            </p>
            <BadgeShelf
              badges={load.badges}
              label={`Badges of ${asked}`}
              dates={chain.network === "testnet"}
            />
          </>
        ) : null}
        <p>
          <Link className="btn" to="/">
            Back to contents
          </Link>
        </p>
      </div>
    </main>
  );
}
