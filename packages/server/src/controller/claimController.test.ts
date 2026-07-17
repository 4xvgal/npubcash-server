import { describe, test, expect, mock, beforeAll } from "bun:test";
import { Claim } from "@/domain/claim/Claim";
import { getDecodedToken } from "@cashu/cashu-ts";
import type { Request, Response, NextFunction } from "express";

const makeClaim = (
  id: number,
  mintUrl: string,
  amount: number,
  secret: string,
): Claim =>
  new Claim({
    id,
    userPubkey: "pk1",
    mintUrl,
    proof: {
      amount,
      id: `proof-${id}`,
      secret,
      C: `C-${id}`,
    },
    status: "ready",
    quoteId: "quote-1",
    createdAt: new Date(),
  });

let getReadyByUserPubkeyImpl: (pubkey: string) => Promise<Claim[]> = async () => [];

const mockClaimRepository = {
  getReadyByUserPubkey: mock(async (pubkey: string) => getReadyByUserPubkeyImpl(pubkey)),
  markSpent: mock(async (_id: number) => {}),
  create: mock(async () => ({}) as any),
  getById: mock(async () => null),
  updateStatus: mock(async () => {}),
};

let checkStatesImpl: { state: string }[] = [];

const mockCommunicatorService = {
  getWallet: mock(
    async (_mintUrl: string) => ({
      mint: {
        check: mock(async () => ({ states: checkStatesImpl })),
      },
    }),
  ),
};

mock.module("@/config", () => ({
  claimRepository: mockClaimRepository,
  communicatorService: mockCommunicatorService,
  userService: {},
  mintService: {},
  proofService: {},
  userRepository: {},
  mintQuoteRepository: {},
  nostrPool: {},
  subManager: {},
}));

let controller: typeof import("@/controller/claimController");

beforeAll(async () => {
  controller = await import("@/controller/claimController");
});

describe("claimController", () => {
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
    res.status = mock((code: number) => {
      res._status = code;
      return res;
    });
    return res as unknown as Response;
  };

  const makeNext = () => mock((e: unknown) => {}) as unknown as NextFunction;

  describe("buildTokenFromClaims", () => {
    test("single claim produces valid token", () => {
      const claim = makeClaim(1, "https://mint.test", 100, "secret-1");
      const token = controller.buildTokenFromClaims([claim]);
      const decoded = getDecodedToken(token);

      expect(decoded.unit).toBe("sat");
      expect(decoded.memo).toBe("npubcash fallback claim");
      expect(decoded.mint).toBe("https://mint.test");
      expect(decoded.proofs).toHaveLength(1);
      expect(decoded.proofs[0]).toMatchObject({
        amount: 100,
        id: "proof-1",
        secret: "secret-1",
        C: "C-1",
      });
    });

    test("multiple proofs for same mint are included", () => {
      const claims = [
        makeClaim(1, "https://mint.test", 100, "secret-1"),
        makeClaim(2, "https://mint.test", 200, "secret-2"),
      ];
      const token = controller.buildTokenFromClaims(claims);
      const decoded = getDecodedToken(token);

      expect(decoded.mint).toBe("https://mint.test");
      expect(decoded.proofs).toHaveLength(2);
      expect(decoded.proofs.reduce((sum, p) => sum + p.amount, 0)).toBe(300);
    });

    test("throws when claims array is empty", () => {
      expect(() => controller.buildTokenFromClaims([])).toThrow("Cannot build token from empty claims");
    });
  });

  describe("getClaim", () => {
    test("returns empty tokens and totalCount 0 when no ready claims", async () => {
      getReadyByUserPubkeyImpl = async () => [];
      const req = makeRequest();
      const res = makeResponse();
      const next = makeNext();

      await controller.getClaim(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        error: false,
        data: { tokens: [], totalCount: 0 },
      });
    });

    test("returns empty tokens when no claims are spendable", async () => {
      const claims = [makeClaim(1, "https://mint.test", 100, "secret-1")];
      getReadyByUserPubkeyImpl = async () => claims;
      checkStatesImpl = [{ state: "SPENT" }];
      const req = makeRequest();
      const res = makeResponse();
      const next = makeNext();

      await controller.getClaim(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        error: false,
        data: { tokens: [], totalCount: 0 },
      });
      expect(mockClaimRepository.markSpent).not.toHaveBeenCalled();
    });

    test("marks spendable claims spent and returns token", async () => {
      const claims = [
        makeClaim(1, "https://mint.test", 100, "secret-1"),
        makeClaim(2, "https://mint.test", 200, "secret-2"),
      ];
      getReadyByUserPubkeyImpl = async () => claims;
      checkStatesImpl = [{ state: "UNSPENT" }, { state: "UNSPENT" }];
      mockClaimRepository.markSpent.mockClear?.();
      const req = makeRequest();
      const res = makeResponse();
      const next = makeNext();

      await controller.getClaim(req, res, next);

      expect(mockClaimRepository.markSpent).toHaveBeenCalledTimes(2);
      expect(mockClaimRepository.markSpent).toHaveBeenCalledWith(1);
      expect(mockClaimRepository.markSpent).toHaveBeenCalledWith(2);

      const jsonCall = (res.json as any).mock.calls[0][0];
      expect(jsonCall.error).toBe(false);
      expect(jsonCall.data.totalCount).toBe(2);
      expect(jsonCall.data.tokens).toHaveLength(1);
      expect(jsonCall.data.tokens[0].mint).toBe("https://mint.test");
      expect(jsonCall.data.tokens[0].count).toBe(2);
      expect(jsonCall.data.tokens[0].token).toBeString();
      const decoded = getDecodedToken(jsonCall.data.tokens[0].token);
      expect(decoded.proofs).toHaveLength(2);
    });

    test("groups claims by mint and returns separate tokens", async () => {
      const claims = [
        makeClaim(1, "https://mint-a.test", 100, "secret-a1"),
        makeClaim(2, "https://mint-b.test", 200, "secret-b1"),
        makeClaim(3, "https://mint-a.test", 50, "secret-a2"),
      ];
      getReadyByUserPubkeyImpl = async () => claims;
      checkStatesImpl = [
        { state: "UNSPENT" },
        { state: "UNSPENT" },
        { state: "UNSPENT" },
      ];
      mockClaimRepository.markSpent.mockClear?.();
      const req = makeRequest();
      const res = makeResponse();
      const next = makeNext();

      await controller.getClaim(req, res, next);

      expect(mockCommunicatorService.getWallet).toHaveBeenCalledWith(
        "https://mint-a.test",
      );
      expect(mockCommunicatorService.getWallet).toHaveBeenCalledWith(
        "https://mint-b.test",
      );

      const jsonCall = (res.json as any).mock.calls[0][0];
      expect(jsonCall.data.totalCount).toBe(3);
      expect(jsonCall.data.tokens).toHaveLength(2);

      const tokenA = jsonCall.data.tokens.find(
        (t: any) => t.mint === "https://mint-a.test",
      );
      const tokenB = jsonCall.data.tokens.find(
        (t: any) => t.mint === "https://mint-b.test",
      );

      expect(tokenA).toBeDefined();
      expect(tokenA.count).toBe(2);
      expect(getDecodedToken(tokenA.token).proofs).toHaveLength(2);

      expect(tokenB).toBeDefined();
      expect(tokenB.count).toBe(1);
      expect(getDecodedToken(tokenB.token).proofs).toHaveLength(1);
    });

    test("propagates errors to next middleware", async () => {
      getReadyByUserPubkeyImpl = async () => {
        throw new Error("DB failure");
      };
      const req = makeRequest();
      const res = makeResponse();
      const next = makeNext();

      await controller.getClaim(req, res, next);

      expect(next).toHaveBeenCalled();
      expect((next as any).mock.calls[0][0].message).toBe("DB failure");
    });
  });

  describe("getBalance", () => {
    test("returns sum of ready claim amounts", async () => {
      const claims = [
        makeClaim(1, "https://mint.test", 100, "secret-1"),
        makeClaim(2, "https://mint.test", 250, "secret-2"),
      ];
      getReadyByUserPubkeyImpl = async () => claims;
      const req = makeRequest();
      const res = makeResponse();
      const next = makeNext();

      await controller.getBalance(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        error: false,
        data: 350,
      });
    });

    test("returns 0 when no ready claims", async () => {
      getReadyByUserPubkeyImpl = async () => [];
      const req = makeRequest();
      const res = makeResponse();
      const next = makeNext();

      await controller.getBalance(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        error: false,
        data: 0,
      });
    });
  });
});
