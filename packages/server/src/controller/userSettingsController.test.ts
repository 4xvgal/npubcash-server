import { describe, test, expect, mock, beforeAll } from "bun:test";
import { User } from "@/domain/user/user";
import type { Request, Response, NextFunction } from "express";

const makeUser = () =>
  new User({
    pubkey: "pk1",
    mintUrl: "https://mint.test",
    lockQuote: false,
  });

let getUserByPubkeyImpl: (pubkey: string) => Promise<User | null> = async () => null;
let createNewUserImpl: (pubkey: string) => User = (pubkey: string) =>
  new User({ pubkey, mintUrl: "https://mint.test", lockQuote: false });
let saveUserImpl: (user: User) => Promise<void> = async () => {};

const mockUserService = {
  getUserByPubkey: mock(async (pubkey: string) => getUserByPubkeyImpl(pubkey)),
  createNewUser: mock((pubkey: string) => createNewUserImpl(pubkey)),
  saveUser: mock(async (user: User) => saveUserImpl(user)),
};

mock.module("@/config", () => ({
  userService: mockUserService,
  mintService: {},
}));

let controller: typeof import("@/controller/userSettingsController");

beforeAll(async () => {
  controller = await import("@/controller/userSettingsController");
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
