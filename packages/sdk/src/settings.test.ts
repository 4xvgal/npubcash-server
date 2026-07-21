import { describe, test, expect, mock } from "bun:test";
import { SettingsManager, type AuthenticatedRequest } from "./settings";
import { NullLogger } from "./logger";
import type { UserResponse } from "npubcash-types";

describe("SettingsManager setRelays", () => {
  test("sends PATCH to /api/v2/user/relays with relays body", async () => {
    const authenticatedRequest = mock(
      async (_path: string, _options?: Record<string, unknown>) => ({
        error: false,
        data: {
          user: {
            pubkey: "pk1",
            mintUrl: "https://mint.test",
            lockQuote: false,
            relays: ["wss://relay.test"],
          },
        },
      }),
    ) as unknown as AuthenticatedRequest;

    const settings = new SettingsManager(authenticatedRequest, new NullLogger());
    const response = (await settings.setRelays(["wss://relay.test"])) as UserResponse;

    expect(authenticatedRequest).toHaveBeenCalledTimes(1);
    expect(authenticatedRequest).toHaveBeenCalledWith("/api/v2/user/relays", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ relays: ["wss://relay.test"] }),
    });
    expect(response).toEqual({
      error: false,
      data: {
        user: {
          pubkey: "pk1",
          mintUrl: "https://mint.test",
          lockQuote: false,
          relays: ["wss://relay.test"],
        },
      },
    });
  });

  test("propagates request errors", async () => {
    const authenticatedRequest = mock(async () => {
      throw new Error("Network failure");
    }) as unknown as AuthenticatedRequest;

    const settings = new SettingsManager(authenticatedRequest, new NullLogger());
    await expect(settings.setRelays(["wss://relay.test"])).rejects.toThrow("Network failure");
  });
});
