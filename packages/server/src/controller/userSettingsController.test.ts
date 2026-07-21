import { describe, test, expect, mock, beforeAll } from "bun:test";
import { User } from "@/domain/user/user";
import { Claim } from "@/domain/claim/Claim";
import type { Request, Response, NextFunction } from "express";

const makeUser = (mode: "off" | "on_expire" = "off") =>
  new User({
    pubkey: "pk1",
    mintUrl: "https://mint.test",
    lockQuote: false,
    claimStorageMode: mode,
  });

let getUserByPubkeyImpl: (pubkey: string) => Promise<User | null> = async () => null;
let createNewUserImpl: (pubkey: string) => User = (pubkey: string) =>
  new User({ pubkey, mintUrl: "https://mint.test", lockQuote: false });
let saveUserImpl: (user: User) => Promise<void> = async () => {};
let getReadyClaimsImpl: (pubkey: string) => Promise<Claim[]> = async () => [];

const makeClaim = (id: number, amount: number): Claim =>
  new Claim({
    id,
    userPubkey: "pk1",
    mintUrl: "https://mint.test",
    proof: { amount, id: `proof-${id}`, secret: `secret-${id}`, C: `C-${id}` },
    status: "ready",
    quoteId: "quote-1",
    createdAt: new Date(),
  });

const mockUserService = {
  getUserByPubkey: mock(async (pubkey: string) => getUserByPubkeyImpl(pubkey)),
  createNewUser: mock((pubkey: string) => createNewUserImpl(pubkey)),
  saveUser: mock(async (user: User) => saveUserImpl(user)),
};

const mockMintService = {};

const mockClaimRepository = {
  getReadyByUserPubkey: mock(async (pubkey: string) => getReadyClaimsImpl(pubkey)),
};

mock.module("@/config", () => ({
  userService: mockUserService,
  mintService: mockMintService,
  claimRepository: mockClaimRepository,
  communicatorService: {},
  proofService: {},
  userRepository: {},
  mintQuoteRepository: {},
  nostrPool: {},
  subManager: {},
}));

let controller: typeof import("@/controller/userSettingsController");

beforeAll(async () => {
  controller = await import("@/controller/userSettingsController");
});

describe("userSettingsController getUserSettings", () => {
  const makeRequest = (authPubkey: string = "pk1") =>
    ({
      authData: { data: { pubkey: authPubkey } },
    }) as unknown as Request;

  const makeResponse = () => {
    const res: any = {};
    res.json = mock((data: unknown) => {
      res._json = data;
      return res;
    });
    return res as unknown as Response;
  };

  const makeNext = () => mock((e: unknown) => {}) as unknown as NextFunction;

  test("includes claimBalance in user info response", async () => {
    getUserByPubkeyImpl = async () => makeUser("on_expire");
    getReadyClaimsImpl = async () => [makeClaim(1, 100), makeClaim(2, 250)];
    const req = makeRequest();
    const res = makeResponse();
    const next = makeNext();

    await controller.getUserSettings(req, res, next);

    expect(res.json).toHaveBeenCalledWith({
      error: false,
      data: {
        user: makeUser("on_expire"),
        claimBalance: 350,
      },
    });
  });

  test("claimBalance is 0 when no ready claims", async () => {
    getUserByPubkeyImpl = async () => makeUser("off");
    getReadyClaimsImpl = async () => [];
    const req = makeRequest();
    const res = makeResponse();
    const next = makeNext();

    await controller.getUserSettings(req, res, next);

    expect(res.json).toHaveBeenCalledWith({
      error: false,
      data: {
        user: makeUser("off"),
        claimBalance: 0,
      },
    });
  });

  test("creates new user and returns 0 claimBalance when not found", async () => {
    getUserByPubkeyImpl = async () => null;
    mockUserService.createNewUser.mockClear?.();
    const req = makeRequest();
    const res = makeResponse();
    const next = makeNext();

    await controller.getUserSettings(req, res, next);

    expect(mockUserService.createNewUser).toHaveBeenCalledWith("pk1");
    const jsonCall = (res.json as any).mock.calls[0][0];
    expect(jsonCall.error).toBe(false);
    expect(jsonCall.data.claimBalance).toBe(0);
  });
});

describe("userSettingsController claim storage", () => {
  const makeRequest = (body: unknown, authPubkey: string = "pk1") =>
    ({
      authData: { data: { pubkey: authPubkey } },
      body,
    }) as unknown as Request;

  const makeResponse = () => {
    const res: any = {};
    res.json = mock((data: unknown) => {
      res._json = data;
      return res;
    });
    res.status = mock((code: number) => {
      res._status = code;
      return res;
    });
    return res as unknown as Response;
  };

  const makeNext = () => mock((e: unknown) => {}) as unknown as NextFunction;

  test("getClaimStorageSetting returns existing user mode", async () => {
    getUserByPubkeyImpl = async () => makeUser("on_expire");
    const req = makeRequest({});
    const res = makeResponse();
    const next = makeNext();

    await controller.getClaimStorageSetting(req, res, next);

    expect(res.json).toHaveBeenCalledWith({
      error: false,
      data: { mode: "on_expire" },
    });
  });

  test("getClaimStorageSetting creates new user with off mode when not found", async () => {
    getUserByPubkeyImpl = async () => null;
    mockUserService.createNewUser.mockClear?.();
    const req = makeRequest({});
    const res = makeResponse();
    const next = makeNext();

    await controller.getClaimStorageSetting(req, res, next);

    expect(mockUserService.createNewUser).toHaveBeenCalledWith("pk1");
    expect(res.json).toHaveBeenCalledWith({
      error: false,
      data: { mode: "off" },
    });
  });

  test("updateClaimStorageSetting updates existing user mode", async () => {
    const user = makeUser("off");
    getUserByPubkeyImpl = async () => user;
    saveUserImpl = async () => {};
    mockUserService.saveUser.mockClear?.();
    const req = makeRequest({ mode: "on_expire" });
    const res = makeResponse();
    const next = makeNext();

    await controller.updateClaimStorageSetting(req, res, next);

    expect(user.claimStorageMode).toBe("on_expire");
    expect(mockUserService.saveUser).toHaveBeenCalledWith(user);
    expect(res.json).toHaveBeenCalledWith({
      error: false,
      data: { mode: "on_expire" },
    });
  });

  test("updateClaimStorageSetting creates new user when not found", async () => {
    getUserByPubkeyImpl = async () => null;
    const createdUser = makeUser("off");
    createNewUserImpl = () => createdUser;
    saveUserImpl = async () => {};
    mockUserService.createNewUser.mockClear?.();
    mockUserService.saveUser.mockClear?.();
    const req = makeRequest({ mode: "on_expire" });
    const res = makeResponse();
    const next = makeNext();

    await controller.updateClaimStorageSetting(req, res, next);

    expect(mockUserService.createNewUser).toHaveBeenCalledWith("pk1");
    expect(mockUserService.saveUser).toHaveBeenCalledWith(createdUser);
    expect(createdUser.claimStorageMode).toBe("on_expire");
    expect(res.json).toHaveBeenCalledWith({
      error: false,
      data: { mode: "on_expire" },
    });
  });

  test("updateClaimStorageSetting rejects invalid mode", async () => {
    const req = makeRequest({ mode: "invalid" });
    const res = makeResponse();
    const next = makeNext();

    await controller.updateClaimStorageSetting(req, res, next);

    expect(next).toHaveBeenCalled();
    const error = (next as any).mock.calls[0][0];
    expect(error.message).toBe("Invalid claim storage mode");
  });
});

describe("updateUserRelays", () => {
  const makeRequest = (body: unknown, authPubkey: string = "pk1") =>
    ({
      authData: { data: { pubkey: authPubkey } },
      body,
    }) as unknown as Request;

  const makeResponse = () => {
    const res: any = {};
    res.json = mock((data: unknown) => {
      res._json = data;
      return res;
    });
    res.status = mock((code: number) => {
      res._status = code;
      return res;
    });
    return res as unknown as Response;
  };

  const makeNext = () => mock((e: unknown) => {}) as unknown as NextFunction;

  test("updates existing user relays", async () => {
    const user = makeUser();
    getUserByPubkeyImpl = async () => user;
    saveUserImpl = async () => {};
    mockUserService.saveUser.mockClear?.();
    const req = makeRequest({ relays: ["wss://relay.test"] });
    const res = makeResponse();
    const next = makeNext();

    await controller.updateUserRelays(req, res, next);

    expect(user.relays).toEqual(["wss://relay.test"]);
    expect(mockUserService.saveUser).toHaveBeenCalledWith(user);
    const jsonCall = (res.json as any).mock.calls[0][0];
    expect(jsonCall.error).toBe(false);
    expect(jsonCall.data.user.relays).toEqual(["wss://relay.test"]);
  });

  test("creates new user with relays when not found", async () => {
    getUserByPubkeyImpl = async () => null;
    const createdUser = makeUser();
    createNewUserImpl = () => createdUser;
    saveUserImpl = async () => {};
    mockUserService.createNewUser.mockClear?.();
    mockUserService.saveUser.mockClear?.();
    const req = makeRequest({ relays: ["wss://relay.test"] });
    const res = makeResponse();
    const next = makeNext();

    await controller.updateUserRelays(req, res, next);

    expect(mockUserService.createNewUser).toHaveBeenCalledWith("pk1");
    expect(mockUserService.saveUser).toHaveBeenCalledWith(createdUser);
    expect(createdUser.relays).toEqual(["wss://relay.test"]);
  });

  test("rejects undefined request body", async () => {
    const req = makeRequest(undefined);
    const res = makeResponse();
    const next = makeNext();

    await controller.updateUserRelays(req, res, next);

    expect(next).toHaveBeenCalled();
    const error = (next as any).mock.calls[0][0];
    expect(error.message).toBe("Invalid request body");
  });

  test("rejects non-array relays", async () => {
    const req = makeRequest({ relays: "wss://relay.test" });
    const res = makeResponse();
    const next = makeNext();

    await controller.updateUserRelays(req, res, next);

    expect(next).toHaveBeenCalled();
    const error = (next as any).mock.calls[0][0];
    expect(error.message).toBe("relays must be an array");
  });

  test("rejects too many relays", async () => {
    const req = makeRequest({ relays: Array(21).fill("wss://relay.test") });
    const res = makeResponse();
    const next = makeNext();

    await controller.updateUserRelays(req, res, next);

    expect(next).toHaveBeenCalled();
    const error = (next as any).mock.calls[0][0];
    expect(error.message).toBe("relays must contain at most 20 items");
  });

  test("rejects non-string relay items", async () => {
    const req = makeRequest({ relays: [123] });
    const res = makeResponse();
    const next = makeNext();

    await controller.updateUserRelays(req, res, next);

    expect(next).toHaveBeenCalled();
    const error = (next as any).mock.calls[0][0];
    expect(error.message).toBe("each relay must be a string");
  });

  test("rejects invalid relay URL", async () => {
    const req = makeRequest({ relays: ["not a url"] });
    const res = makeResponse();
    const next = makeNext();

    await controller.updateUserRelays(req, res, next);

    expect(next).toHaveBeenCalled();
    const error = (next as any).mock.calls[0][0];
    expect(error.message).toBe("each relay must be a valid ws:// or wss:// URL");
  });

  test("rejects invalid relay protocol", async () => {
    const req = makeRequest({ relays: ["https://relay.test"] });
    const res = makeResponse();
    const next = makeNext();

    await controller.updateUserRelays(req, res, next);

    expect(next).toHaveBeenCalled();
    const error = (next as any).mock.calls[0][0];
    expect(error.message).toBe("each relay must use ws:// or wss://");
  });

  test("rejects duplicate relays", async () => {
    const req = makeRequest({ relays: ["wss://relay.test", "wss://relay.test"] });
    const res = makeResponse();
    const next = makeNext();

    await controller.updateUserRelays(req, res, next);

    expect(next).toHaveBeenCalled();
    const error = (next as any).mock.calls[0][0];
    expect(error.message).toBe("relays must not contain duplicates");
  });

  test("rejects duplicates after normalizing trailing slashes", async () => {
    const req = makeRequest({ relays: ["wss://relay.test", "wss://relay.test/"] });
    const res = makeResponse();
    const next = makeNext();

    await controller.updateUserRelays(req, res, next);

    expect(next).toHaveBeenCalled();
    const error = (next as any).mock.calls[0][0];
    expect(error.message).toBe("relays must not contain duplicates");
  });

  test("normalizes relay URLs by stripping trailing slash", async () => {
    const user = makeUser();
    getUserByPubkeyImpl = async () => user;
    saveUserImpl = async () => {};
    const req = makeRequest({ relays: ["wss://relay.test/"] });
    const res = makeResponse();
    const next = makeNext();

    await controller.updateUserRelays(req, res, next);

    expect(user.relays).toEqual(["wss://relay.test"]);
  });

  test("returns a defensive copy of relays array", async () => {
    const user = makeUser();
    getUserByPubkeyImpl = async () => user;
    saveUserImpl = async () => {};
    const relays = ["wss://relay.test"];
    const req = makeRequest({ relays });
    const res = makeResponse();
    const next = makeNext();

    await controller.updateUserRelays(req, res, next);
    relays.push("wss://relay2.test");

    expect(user.relays).toEqual(["wss://relay.test"]);
  });
});
