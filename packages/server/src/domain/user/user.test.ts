import { describe, test, expect } from "bun:test";
import { User } from "./user";

describe("User claimStorageMode", () => {
  const baseConfig = {
    pubkey: "pubkey1",
    mintUrl: "https://mint.test",
    lockQuote: false,
  };

  test("defaults to off when claimStorageMode is undefined", () => {
    const user = new User({ ...baseConfig });
    expect(user.claimStorageMode).toBe("off");
  });

  test("preserves explicit on_expire value", () => {
    const user = new User({ ...baseConfig, claimStorageMode: "on_expire" });
    expect(user.claimStorageMode).toBe("on_expire");
  });

  test("preserves explicit off value", () => {
    const user = new User({ ...baseConfig, claimStorageMode: "off" });
    expect(user.claimStorageMode).toBe("off");
  });

  test("setClaimStorageMode updates the mode", () => {
    const user = new User({ ...baseConfig });
    user.setClaimStorageMode("on_expire");
    expect(user.claimStorageMode).toBe("on_expire");

    user.setClaimStorageMode("off");
    expect(user.claimStorageMode).toBe("off");
  });
});

describe("User relays", () => {
  const baseConfig = {
    pubkey: "pubkey1",
    mintUrl: "https://mint.test",
    lockQuote: false,
  };

  test("defaults to empty array when relays is undefined", () => {
    const user = new User({ ...baseConfig });
    expect(user.relays).toEqual([]);
  });

  test("preserves provided relays", () => {
    const user = new User({ ...baseConfig, relays: ["wss://relay.test"] });
    expect(user.relays).toEqual(["wss://relay.test"]);
  });

  test("setRelays updates relays", () => {
    const user = new User({ ...baseConfig });
    user.setRelays(["wss://a.com", "wss://b.com"]);
    expect(user.relays).toEqual(["wss://a.com", "wss://b.com"]);
  });

  test("setRelays can clear relays", () => {
    const user = new User({ ...baseConfig, relays: ["wss://relay.test"] });
    user.setRelays([]);
    expect(user.relays).toEqual([]);
  });
});
