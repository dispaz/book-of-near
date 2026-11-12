import { describe, expect, it } from "vitest";
import { parseNear } from "../chain/units";
import { nearAmount, shortId } from "./format";

describe("shortId", () => {
  it("keeps the head and tail of a long id", () => {
    expect(shortId("cf4342a8b9e0d1c2f3a4b5c6d7e8f9a0b1c2c3c5")).toBe("cf4342…c3c5");
    expect(shortId("ed25519:AbCdEfGhIjKlMnOpQrStUvWx", 12, 4)).toBe("ed25519:AbCd…UvWx");
  });

  it("leaves a short id as it is", () => {
    expect(shortId("bob.testnet")).toBe("bob.testnet");
    expect(shortId("abcdefghijk")).toBe("abcdefghijk");
  });

  it("can leave ids up to a minimum length alone", () => {
    expect(shortId("guestbook.testnet", 6, 4, 24)).toBe("guestbook.testnet");
    expect(shortId("guestbook-of-many-names.testnet", 6, 4, 24)).toBe("guestb…tnet");
  });
});

describe("nearAmount", () => {
  it("shows up to 4 decimals by default, cut and with no trailing zeros", () => {
    expect(nearAmount(parseNear("0.09876"))).toBe("0.0987");
    expect(nearAmount(parseNear("0.1"))).toBe("0.1");
    expect(nearAmount(parseNear("2"))).toBe("2");
  });

  it("takes another number of decimals", () => {
    expect(nearAmount(parseNear("0.000045"), 6)).toBe("0.000045");
  });
});
