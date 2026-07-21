import { mintService, userService } from "@/config";
import { BadRequestError } from "@/errors";
import { normalizeUrl } from "@/utils/utils";
import {
  SetLockQuotesPayload,
  SetMintPayload,
  SetRelaysPayload,
  UserResponse,
} from "npubcash-types";
import { NextFunction, Request, Response } from "express";

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
    const payload: UserResponse = {
      error: false,
      data: { user },
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
    const payload: UserResponse = {
      error: false,
      data: { user },
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

    const payload: UserResponse = {
      error: false,
      data: { user },
    };
    res.json(payload);
  } catch (e) {
    next(e);
  }
}

function validateRelays(relays: unknown): string[] {
  if (!Array.isArray(relays)) {
    throw new BadRequestError("Invalid relays");
  }
  if (relays.length > 20) {
    throw new BadRequestError("Invalid relays");
  }
  const seen = new Set<string>();
  for (const relay of relays) {
    if (typeof relay !== "string") {
      throw new BadRequestError("Invalid relays");
    }
    try {
      const url = new URL(relay);
      if (url.protocol !== "ws:" && url.protocol !== "wss:") {
        throw new BadRequestError("Invalid relays");
      }
    } catch {
      throw new BadRequestError("Invalid relays");
    }
    if (seen.has(relay)) {
      throw new BadRequestError("Invalid relays");
    }
    seen.add(relay);
  }
  return relays;
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
