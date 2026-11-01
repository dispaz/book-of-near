import type { ChainErrorKind, InvalidTxReason } from "./types";

/** The one error type Chain methods reject with. `kind` says what went wrong; `message` is plain English. */
export class ChainError extends Error {
  readonly kind: ChainErrorKind;
  /** Set when kind is "InvalidTransaction". */
  readonly reason?: InvalidTxReason;

  constructor(kind: ChainErrorKind, message: string, reason?: InvalidTxReason) {
    super(message);
    this.name = "ChainError";
    this.kind = kind;
    this.reason = reason;
  }
}

export function isChainError(e: unknown): e is ChainError {
  return e instanceof ChainError;
}
