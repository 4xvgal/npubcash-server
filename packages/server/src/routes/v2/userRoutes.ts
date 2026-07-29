import { usernameController } from "@/controller/username";
import {
  getClaimStorageSetting,
  getUserSettings,
  updateClaimStorageSetting,
  updateUserMintSetting,
  updateUserRelays,
  updateUserSettingLock,
} from "@/controller/userSettingsController";
import { isAuthMiddleware } from "@/middleware/auth";
import { Router } from "express";

const userRouter = Router();

/**
 * @openapi
 * /api/v2/user/info:
 *   get:
 *     summary: Get user settings and claim balance
 *     tags: [User]
 *     security:
 *       - JWT: []
 *     responses:
 *       200:
 *         description: User settings and claim balance
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserResponse'
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
 *         description: Updated user settings with claim balance
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserResponse'
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
 *         description: Updated user settings with claim balance
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserResponse'
 */
userRouter.patch(
  "/mint",
  isAuthMiddleware("/api/v2/user/mint", "PATCH"),
  updateUserMintSetting,
);

/**
 * @openapi
 * /api/v2/user/claim-storage:
 *   get:
 *     summary: Get the current fallback claim storage mode
 *     tags: [User]
 *     security:
 *       - JWT: []
 *     responses:
 *       200:
 *         description: Current mode
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     mode:
 *                       type: string
 *                       enum: [off, on_expire]
 */
userRouter.get(
  "/claim-storage",
  isAuthMiddleware("/api/v2/user/claim-storage", "GET"),
  getClaimStorageSetting,
);

/**
 * @openapi
 * /api/v2/user/claim-storage:
 *   patch:
 *     summary: Set the fallback claim storage mode
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
 *               mode:
 *                 type: string
 *                 enum: [off, on_expire]
 *     responses:
 *       200:
 *         description: Updated claim storage mode
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     mode:
 *                       type: string
 *                       enum: [off, on_expire]
 */
userRouter.patch(
  "/claim-storage",
  isAuthMiddleware("/api/v2/user/claim-storage", "PATCH"),
  updateClaimStorageSetting,
);

/**
 * @openapi
 * /api/v2/user/relays:
 *   patch:
 *     summary: Set preferred Nostr relays
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
 *               relays:
 *                 type: array
 *                 items:
 *                   type: string
 *                 maxItems: 20
 *                 description: Array of ws:// or wss:// relay URLs
 *     responses:
 *       200:
 *         description: Updated user settings
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserResponse'
 */
userRouter.patch(
  "/relays",
  isAuthMiddleware("/api/v2/user/relays", "PATCH"),
  updateUserRelays,
);

export default userRouter;
