import { claimRepository, communicatorService } from "@/config";
import { Claim, ProofJson } from "@/domain/claim/Claim";
import { getEncodedToken, hashToCurve } from "@cashu/cashu-ts";
import { NextFunction, Request, Response } from "express";
import { logger } from "@/utils/logger";

interface ClaimTokenGroup {
  mint: string;
  token: string;
  count: number;
}

interface ClaimResponse {
  error: false;
  data: { tokens: ClaimTokenGroup[]; totalCount: number };
}

interface BalanceResponse {
  error: false;
  data: number;
}

export async function getClaim(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const {
      data: { pubkey },
    } = req.authData!;

    const readyClaims = await claimRepository.getReadyByUserPubkey(pubkey);

    logger.info("[Claim] Claim endpoint accessed", {
      pubkey,
      reqId: req.reqId,
      readyClaimCount: readyClaims.length,
    });

    const grouped = groupClaimsByMint(readyClaims);

    const tokens: ClaimTokenGroup[] = [];
    let totalCount = 0;

    for (const [mintUrl, claims] of grouped.entries()) {
      const spendableClaims = await filterSpendableClaims(claims, mintUrl);
      if (spendableClaims.length === 0) continue;

      await Promise.all(
        spendableClaims.map((claim) => claimRepository.markSpent(claim.id)),
      );

      const token = buildTokenFromClaims(spendableClaims);
      tokens.push({
        mint: mintUrl,
        token,
        count: spendableClaims.length,
      });
      totalCount += spendableClaims.length;
      const totalAmount = spendableClaims.reduce(
        (sum, c) => sum + c.proof.amount,
        0,
      );

      logger.info("[Claim] User claimed fallback ecash", {
        pubkey,
        mint: mintUrl,
        proofCount: spendableClaims.length,
        totalAmount,
      });
    }

    const response: ClaimResponse = {
      error: false,
      data: { tokens, totalCount },
    };

    logger.info("[Claim] Returned fallback tokens", {
      pubkey,
      reqId: req.reqId,
      tokenGroupCount: tokens.length,
      totalCount,
    });

    res.json(response);
  } catch (e) {
    next(e);
  }
}

export async function getBalance(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const {
      data: { pubkey },
    } = req.authData!;

    logger.info("[Claim] Balance endpoint accessed", {
      pubkey,
      reqId: req.reqId,
    });

    const readyClaims = await claimRepository.getReadyByUserPubkey(pubkey);
    const total = readyClaims.reduce((sum, claim) => sum + claim.proof.amount, 0);

    logger.info("[Claim] Returned fallback balance", {
      pubkey,
      reqId: req.reqId,
      balance: total,
      readyClaimCount: readyClaims.length,
    });

    const response: BalanceResponse = { error: false, data: total };
    res.json(response);
  } catch (e) {
    next(e);
  }
}

function groupClaimsByMint(claims: Claim[]): Map<string, Claim[]> {
  const grouped = new Map<string, Claim[]>();
  for (const claim of claims) {
    const list = grouped.get(claim.mintUrl) ?? [];
    list.push(claim);
    grouped.set(claim.mintUrl, list);
  }
  return grouped;
}

async function filterSpendableClaims(
  claims: Claim[],
  mintUrl: string,
): Promise<Claim[]> {
  if (claims.length === 0) return [];

  try {
    const wallet = await communicatorService.getWallet(mintUrl);
    const Ys = claims.map((claim) => {
      const secretBytes = new TextEncoder().encode(claim.proof.secret);
      return hashToCurve(secretBytes).toHex(true);
    });

    const checkResult = await wallet.mint.check({ Ys });
    const spendableClaims: Claim[] = [];

    for (let i = 0; i < claims.length; i++) {
      const state = checkResult.states[i];
      if (state && state.state === "UNSPENT") {
        spendableClaims.push(claims[i]!);
      }
    }

    return spendableClaims;
  } catch (err) {
    return [];
  }
}

export function buildTokenFromClaims(claims: Claim[]): string {
  if (claims.length === 0) {
    throw new Error("Cannot build token from empty claims");
  }

  const mintUrl = claims[0].mintUrl;
  if (claims.some((claim) => claim.mintUrl !== mintUrl)) {
    throw new Error("Cannot build token from claims of different mints");
  }

  const proofs = claims.map((claim) => claim.proof);

  return getEncodedToken({
    mint: mintUrl,
    proofs,
    unit: "sat",
    memo: "npubcash fallback claim",
  } as any);
}
