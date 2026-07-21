import { describe, test, expect, mock, beforeAll } from "bun:test";
import { UserWithName } from "@/domain/user/user";
import type { Request, Response } from "express";

let getUserByNameImpl: (name: string) => Promise<UserWithName | null> = async () => null;

const mockUserService = {
  getUserByName: mock(async (name: string) => getUserByNameImpl(name)),
};

mock.module("@/config", () => ({
  userService: mockUserService,
}));

let nip05Controller: typeof import("@/controller/nip05Controller").nip05Controller;

beforeAll(async () => {
  const mod = await import("@/controller/nip05Controller");
  nip05Controller = mod.nip05Controller;
});

describe("nip05Controller", () => {
  const makeRequest = (name: string) =>
    ({ query: { name } }) as unknown as Request;

  const makeResponse = () => {
    const res: any = {};
    res.json = mock((data: unknown) => {
      res._json = data;
      return res;
    });
    return res as unknown as Response;
  };

  test("returns empty relays when name is missing", async () => {
    const req = { query: {} } as unknown as Request;
    const res = makeResponse();
    await nip05Controller(req, res, () => {});
    expect(res.json).toHaveBeenCalledWith({ names: {}, relays: {} });
  });

  test("returns empty relays when user not found", async () => {
    getUserByNameImpl = async () => null;
    const req = makeRequest("alice");
    const res = makeResponse();
    await nip05Controller(req, res, () => {});
    expect(res.json).toHaveBeenCalledWith({ names: {}, relays: {} });
  });

  test("returns user relays in nip05 response", async () => {
    getUserByNameImpl = async () =>
      new UserWithName({
        pubkey: "pk1",
        name: "alice",
        mintUrl: "https://mint.test",
        lockQuote: false,
        relays: ["wss://relay.test"],
      });
    const req = makeRequest("alice");
    const res = makeResponse();
    await nip05Controller(req, res, () => {});
    expect(res.json).toHaveBeenCalledWith({
      names: { alice: "pk1" },
      relays: { pk1: ["wss://relay.test"] },
    });
  });

  test("returns empty relays object when user has no relays", async () => {
    getUserByNameImpl = async () =>
      new UserWithName({
        pubkey: "pk1",
        name: "alice",
        mintUrl: "https://mint.test",
        lockQuote: false,
      });
    const req = makeRequest("alice");
    const res = makeResponse();
    await nip05Controller(req, res, () => {});
    expect(res.json).toHaveBeenCalledWith({
      names: { alice: "pk1" },
      relays: {},
    });
  });
});
