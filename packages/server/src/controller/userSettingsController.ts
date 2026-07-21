import { claimRepository, mintService, userService } from "@/config";
import { BadRequestError } from "@/errors";
import { normalizeUrl } from "@/utils/utils";
import {
  SetClaimStoragePayload,
  SetLockQuotesPayload,
  SetMintPayload,
  SetRelaysPayload,
  UserResponse,
} from "npubcash-types";
import { NextFunction, Request, Response } from "express";

interface ClaimStorageResponse {
  error: false;
  data: { mode: "off" | "on_expire" };
}

export async function getUserSettings(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const {
      data: { pubkey },
    } = req.authData!;
    let user = await userService.getUserByPubkey(pubkey);
    if (!user) {
      user = userService.createNewUser(pubkey);
    }

    const readyClaims = await claimRepository.getReadyByUserPubkey(pubkey);
    const claimBalance = readyClaims.reduce(
      (sum, claim) => sum + claim.proof.amount,
      0,
    );

    const payload: UserResponse = {
      error: false,
      data: { user, claimBalance },
    };
    res.json(payload);
  } catch (e) {
    next(e);
  }
}

export async function updateUserSettingLock(
  req: Request<unknown, unknown, SetLockQuotesPayload>,
  res: Response,
  next: NextFunction,
) {
  try {
    const {
      data: { pubkey },
    } = req.authData!;
    const { lockQuotes } = req.body;
    let user = await userService.getUserByPubkey(pubkey);
    if (!user) {
      user = userService.createNewUser(pubkey);
    }
    if (typeof lockQuotes !== "boolean") {
      throw new BadRequestError("Missing parameters");
    }
    //TODO: Reword function
    await mintService.checkMintUrl(user.mintUrl, lockQuotes);
    user.setQuoteLocking(lockQuotes);
    await userService.saveUser(user);

    const readyClaims = await claimRepository.getReadyByUserPubkey(pubkey);
    const claimBalance = readyClaims.reduce(
      (sum, claim) => sum + claim.proof.amount,
      0,
    );

    const payload: UserResponse = {
      error: false,
      data: { user, claimBalance },
    };
    res.json(payload);
  } catch (e) {
    next(e);
  }
}

export async function updateUserMintSetting(
  req: Request<unknown, unknown, SetMintPayload>,
  res: Response,
  next: NextFunction,
) {
  try {
    const authData = req.authData!;
    //WARNING: Inconsistent casing!!
    const { mint_url } = req.body;
    if (!mint_url) {
      throw new BadRequestError("Missing parameters!");
    }
    const parsedUrl = normalizeUrl(mint_url);
    let user = await userService.getUserByPubkey(authData.data.pubkey);
    await mintService.checkMintUrl(parsedUrl, user ? user.lockQuote : false);
    if (!user) {
      user = userService.createNewUser(authData.data.pubkey);
    }
    user.setPreferredMint(mint_url);
    await userService.saveUser(user);

    const readyClaims = await claimRepository.getReadyByUserPubkey(
      authData.data.pubkey,
    );
    const claimBalance = readyClaims.reduce(
      (sum, claim) => sum + claim.proof.amount,
      0,
    );

    const payload: UserResponse = {
      error: false,
      data: { user, claimBalance },
    };
    res.json(payload);
  } catch (e) {
    next(e);
  }
}

<<<<<<< HEAD
export async function getClaimStorageSetting(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const {
      data: { pubkey },
    } = req.authData!;
    let user = await userService.getUserByPubkey(pubkey);
    if (!user) {
      user = userService.createNewUser(pubkey);
    }
    const response: ClaimStorageResponse = {
      error: false,
      data: { mode: user.claimStorageMode },
    };
    res.json(response);
  } catch (e) {
    next(e);
  }
}

export async function updateClaimStorageSetting(
  req: Request<unknown, unknown, SetClaimStoragePayload>,
  res: Response,
  next: NextFunction,
) {
  try {
    const {
      data: { pubkey },
    } = req.authData!;
    const { mode } = req.body;
    if (mode !== "off" && mode !== "on_expire") {
      throw new BadRequestError("Invalid claim storage mode");
    }
    let user = await userService.getUserByPubkey(pubkey);
    if (!user) {
      user = userService.createNewUser(pubkey);
    }
    user.setClaimStorageMode(mode);
    await userService.saveUser(user);
    const response: ClaimStorageResponse = {
      error: false,
      data: { mode: user.claimStorageMode },
    };
    res.json(response);
  } catch (e) {
    next(e);
  }
}

function normalizeRelayUrl(url: URL): string {
  const pathname = url.pathname === "/" ? "" : url.pathname;
  return `${url.protocol}//${url.host}${pathname}`;
>>>>>>> 5fbe699 (fix(server): normalize relay urls and improve validation messages)
}

function validateRelays(relays: unknown): string[] {
  if (!Array.isArray(relays)) {
    throw new BadRequestError("relays must be an array");
  }
  if (relays.length > 20) {
    throw new BadRequestError("relays must contain at most 20 items");
  }
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const relay of relays) {
    if (typeof relay !== "string") {
      throw new BadRequestError("each relay must be a string");
    }
    let url: URL;
    try {
      url = new URL(relay);
    } catch {
      throw new BadRequestError("each relay must be a valid ws:// or wss:// URL");
    }
    if (url.protocol !== "ws:" && url.protocol !== "wss:") {
      throw new BadRequestError("each relay must use ws:// or wss://");
    }
    const normalizedUrl = normalizeRelayUrl(url);
    if (seen.has(normalizedUrl)) {
      throw new BadRequestError("relays must not contain duplicates");
    }
    seen.add(normalizedUrl);
    normalized.push(normalizedUrl);
  }
  return normalized;
}

export async function updateUserRelays(
  req: Request<unknown, unknown, SetRelaysPayload>,
  res: Response,
  next: NextFunction,
) {
  try {
    const {
      data: { pubkey },
    } = req.authData!;
    if (!req.body || typeof req.body !== "object") {
      throw new BadRequestError("Invalid request body");
    }
    const relays = validateRelays(req.body.relays);
    let user = await userService.getUserByPubkey(pubkey);
    if (!user) {
      user = userService.createNewUser(pubkey);
    }
    user.setRelays(relays);
    await userService.saveUser(user);
    const payload: UserResponse = {
      error: false,
      data: { user },
    };
    res.json(payload);
  } catch (e) {
    next(e);
  }
}
