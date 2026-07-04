import { usernameController } from "@/controller/username";
import {
  getUserSettings,
  updateUserMintSetting,
  updateUserSettingLock,
} from "@/controller/userSettingsController";
import { isAuthMiddleware } from "@/middleware/auth";
import { Router } from "express";

const userRouter = Router();

/**
 * @openapi
 * /api/v2/user/info:
 *   get:
 *     summary: Get user settings
 *     tags: [User]
 *     security:
 *       - JWT: []
 *     responses:
 *       200:
 *         description: User settings
 */
userRouter.get(
  "/info",
  isAuthMiddleware("/api/v2/user/info", "GET"),
  getUserSettings,
);

/**
 * @openapi
 * /api/v2/user/username:
 *   post:
 *     summary: Purchase a username with a Cashu token
 *     tags: [User]
 *     security:
 *       - JWT: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *     responses:
 *       201:
 *         description: Username created
 *       402:
 *         description: Payment required
 */
userRouter.post(
  "/username",
  isAuthMiddleware("/api/v2/user/username", "POST"),
  usernameController,
);

/**
 * @openapi
 * /api/v2/user/lock:
 *   patch:
 *     summary: Toggle NUT-20 quote locking
 *     tags: [User]
 *     security:
 *       - JWT: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               lockQuotes:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Updated
 */
userRouter.patch(
  "/lock",
  isAuthMiddleware("/api/v2/user/lock", "PATCH"),
  updateUserSettingLock,
);

/**
 * @openapi
 * /api/v2/user/mint:
 *   patch:
 *     summary: Change preferred mint URL
 *     tags: [User]
 *     security:
 *       - JWT: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               mint_url:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated
 */
userRouter.patch(
  "/mint",
  isAuthMiddleware("/api/v2/user/mint", "PATCH"),
  updateUserMintSetting,
);

export default userRouter;
