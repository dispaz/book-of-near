import { describe, expect, it } from "vitest";
import {
  accountIdProblem,
  isDirectSubAccount,
  isEthImplicitAccountId,
  isImplicitAccountId,
  isValidAccountId,
  parentAccountId,
} from "./accountId";

describe("account ids (docs.near.org/protocol/account-id)", () => {
  it.each(["ok", "alice.testnet", "a-b_c.near", "kid.alice.testnet", "0x" + "a".repeat(40), "f".repeat(64)])(
    "accepts %s",
    (id) => expect(isValidAccountId(id)).toBe(true),
  );

  it.each([
    "a",
    "Alice.testnet",
    "-alice.near",
    "alice-.near",
    "a..b",
    "alice.",
    "a b",
    "a@b",
    "x".repeat(65),
  ])("rejects %s", (id) => {
    expect(isValidAccountId(id)).toBe(false);
    expect(accountIdProblem(id)).toBeTruthy();
  });

  it("explains problems in plain English", () => {
    expect(accountIdProblem("Bob")).toMatch(/lowercase/);
    expect(accountIdProblem("bob.testnet")).toBeNull();
  });

  it("knows implicit accounts and parents", () => {
    expect(isImplicitAccountId("cf4342372b583606057805490c97d4778bc4ac444a76f32154634558ab57c3c5")).toBe(
      true,
    );
    expect(isImplicitAccountId("alice.testnet")).toBe(false);
    expect(isEthImplicitAccountId("0x" + "ab".repeat(20))).toBe(true);
    expect(isDirectSubAccount("kid.alice.testnet", "alice.testnet")).toBe(true);
    expect(isDirectSubAccount("a.kid.alice.testnet", "alice.testnet")).toBe(false);
    expect(isDirectSubAccount("alice.testnet", "testnet")).toBe(true);
    expect(parentAccountId("kid.alice.testnet")).toBe("alice.testnet");
    expect(parentAccountId("testnet")).toBeNull();
  });
});
