import { describe, test, expect, mock, beforeEach, afterEach } from "bun:test";
import { NPCClient } from "./client";
import type { AuthProvider } from "./types";

const baseUrl = "https://api.npubcash.test";

const createMockAuthProvider = (): AuthProvider => ({
  getAuthToken: mock(async () => "Bearer test-token"),
  getNostrToken: mock(async () => "nostr-token"),
});

describe("NPCClient claim and balance APIs", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("getClaim sends GET to /api/v2/claim and returns token data", async () => {
    const mockFetch = mock(async () =>
      Response.json({
        error: false,
        data: {
          tokens: [{ mint: "https://mint.test", token: "cashuAey...", count: 2 }],
          totalCount: 2,
        },
      }),
    );
    globalThis.fetch = mockFetch as unknown as typeof globalThis.fetch;

    const client = new NPCClient(baseUrl, createMockAuthProvider());
    const result = await client.getClaim();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const requestUrl = mockFetch.mock.calls[0][0] as string;
    expect(requestUrl).toBe(`${baseUrl}/api/v2/claim`);

    const requestInit = mockFetch.mock.calls[0][1] as RequestInit;
    expect(requestInit.method).toBeUndefined();
    expect(requestInit.headers).toMatchObject({ Authorization: "Bearer test-token" });

    expect(result).toEqual({
      tokens: [{ mint: "https://mint.test", token: "cashuAey...", count: 2 }],
      totalCount: 2,
    });
  });

  test("getClaim returns empty tokens when no ready claims", async () => {
    globalThis.fetch = mock(async () =>
      Response.json({
        error: false,
        data: { tokens: [], totalCount: 0 },
      }),
    ) as unknown as typeof globalThis.fetch;

    const client = new NPCClient(baseUrl, createMockAuthProvider());
    const result = await client.getClaim();

    expect(result).toEqual({ tokens: [], totalCount: 0 });
  });

  test("getBalance sends GET to /api/v2/balance and returns number", async () => {
    const mockFetch = mock(async () =>
      Response.json({
        error: false,
        data: 1500,
      }),
    );
    globalThis.fetch = mockFetch as unknown as typeof globalThis.fetch;

    const client = new NPCClient(baseUrl, createMockAuthProvider());
    const result = await client.getBalance();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const requestUrl = mockFetch.mock.calls[0][0] as string;
    expect(requestUrl).toBe(`${baseUrl}/api/v2/balance`);

    const requestInit = mockFetch.mock.calls[0][1] as RequestInit;
    expect(requestInit.method).toBeUndefined();
    expect(requestInit.headers).toMatchObject({ Authorization: "Bearer test-token" });

    expect(result).toBe(1500);
  });

  test("getClaim propagates API errors", async () => {
    globalThis.fetch = mock(async () =>
      Response.json({ message: "Unauthorized" }, { status: 401 }),
    ) as unknown as typeof globalThis.fetch;

    const client = new NPCClient(baseUrl, createMockAuthProvider());

    await expect(client.getClaim()).rejects.toThrow("Unauthorized");
  });

  test("getBalance propagates API errors", async () => {
    globalThis.fetch = mock(async () =>
      Response.json({ message: "Server error" }, { status: 500 }),
    ) as unknown as typeof globalThis.fetch;

    const client = new NPCClient(baseUrl, createMockAuthProvider());

    await expect(client.getBalance()).rejects.toThrow("Server error");
  });
});
