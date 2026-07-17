import { claimRepository, mintService, userService } from "@/config";
import { BadRequestError } from "@/errors";
import { normalizeUrl } from "@/utils/utils";
import {
  SetClaimStoragePayload,
  SetLockQuotesPayload,
  SetMintPayload,
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
