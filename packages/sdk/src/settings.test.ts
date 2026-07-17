import { describe, test, expect, mock } from "bun:test";
import { SettingsManager } from "./settings";
import { NullLogger } from "./logger";
import type { UserResponse } from "npubcash-types";

describe("SettingsManager", () => {
  const makeMockRequest = () =>
    mock(async (_path: string, _options?: Record<string, unknown>) => ({
      error: false,
      data: {},
    })) as unknown as <T>(_path: string, _options?: Record<string, unknown>) => Promise<T>;

  test("setClaimStorageMode sends PATCH to /api/v2/user/claim-storage with mode body", async () => {
    const authenticatedRequest = mock(
      async (_path: string, _options?: Record<string, unknown>) => ({
        error: false,
        data: { user: { claimStorageMode: "on_expire" }, claimBalance: 0 },
      }),
    ) as unknown as <T>(_path: string, _options?: Record<string, unknown>) => Promise<T>;

    const settings = new SettingsManager(authenticatedRequest, new NullLogger());
    const response = (await settings.setClaimStorageMode("on_expire")) as UserResponse;

    expect(authenticatedRequest).toHaveBeenCalledTimes(1);
    expect(authenticatedRequest).toHaveBeenCalledWith("/api/v2/user/claim-storage", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "on_expire" }),
    });
    expect(response).toEqual({ error: false, data: { user: { claimStorageMode: "on_expire" }, claimBalance: 0 } });
  });

  test("setClaimStorageMode with off sends correct body", async () => {
    const authenticatedRequest = mock(
      async (_path: string, _options?: Record<string, unknown>) => ({
        error: false,
        data: { user: { claimStorageMode: "off" }, claimBalance: 0 },
      }),
    ) as unknown as <T>(_path: string, _options?: Record<string, unknown>) => Promise<T>;

    const settings = new SettingsManager(authenticatedRequest, new NullLogger());
    await settings.setClaimStorageMode("off");

    expect(authenticatedRequest).toHaveBeenCalledWith("/api/v2/user/claim-storage", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "off" }),
    });
  });

  test("getClaimStorageMode sends GET to /api/v2/user/claim-storage and returns mode", async () => {
    const authenticatedRequest = mock(
      async (_path: string, _options?: Record<string, unknown>) => ({
        error: false,
        data: { mode: "off" },
      }),
    ) as unknown as <T>(_path: string, _options?: Record<string, unknown>) => Promise<T>;

    const settings = new SettingsManager(authenticatedRequest, new NullLogger());
    const result = await settings.getClaimStorageMode();

    expect(authenticatedRequest).toHaveBeenCalledTimes(1);
    expect(authenticatedRequest).toHaveBeenCalledWith("/api/v2/user/claim-storage");
    expect(result).toEqual({ mode: "off" });
  });

  test("setClaimStorageMode propagates request errors", async () => {
    const authenticatedRequest = mock(async () => {
      throw new Error("Network failure");
    }) as unknown as <T>(_path: string, _options?: Record<string, unknown>) => Promise<T>;

    const settings = new SettingsManager(authenticatedRequest, new NullLogger());

    await expect(settings.setClaimStorageMode("on_expire")).rejects.toThrow("Network failure");
  });

  test("getClaimStorageMode propagates request errors", async () => {
    const authenticatedRequest = mock(async () => {
      throw new Error("Network failure");
    }) as unknown as <T>(_path: string, _options?: Record<string, unknown>) => Promise<T>;

    const settings = new SettingsManager(authenticatedRequest, new NullLogger());

    await expect(settings.getClaimStorageMode()).rejects.toThrow("Network failure");
  });

  test("logger methods are invoked on success and error", async () => {
    const info = mock(() => {});
    const error = mock(() => {});
    const logger = {
      info,
      error,
      warn: () => {},
      debug: () => {},
    };

    const successRequest = mock(async () => ({
      error: false,
      data: { user: { claimStorageMode: "on_expire" }, claimBalance: 0 },
    })) as unknown as <T>(_path: string, _options?: Record<string, unknown>) => Promise<T>;

    const settings = new SettingsManager(successRequest, logger);
    await settings.setClaimStorageMode("on_expire");
    expect(info).toHaveBeenCalledTimes(1);

    const failingRequest = mock(async () => {
      throw new Error("fail");
    }) as unknown as <T>(_path: string, _options?: Record<string, unknown>) => Promise<T>;
    const failingSettings = new SettingsManager(failingRequest, logger);
    await expect(failingSettings.setClaimStorageMode("on_expire")).rejects.toThrow();
    expect(error).toHaveBeenCalled();
  });
});
