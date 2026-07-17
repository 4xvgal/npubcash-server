import { getBalance, getClaim } from "@/controller/claimController";
import { isAuthMiddleware } from "@/middleware/auth";
import { Router } from "express";

const claimRouter = Router();

/**
 * @openapi
 * /api/v2/claim:
 *   get:
 *     summary: Withdraw ready fallback claims as a Cashu token
 *     tags: [Claim]
 *     security:
 *       - JWT: []
 *     responses:
 *       200:
 *         description: Cashu tokens grouped by mint
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
 *                     tokens:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           mint:
 *                             type: string
 *                           token:
 *                             type: string
 *                           count:
 *                             type: integer
 *                     totalCount:
 *                       type: integer
 */
claimRouter.get(
  "/claim",
  isAuthMiddleware("/api/v2/claim", "GET"),
  getClaim,
);

/**
 * @openapi
 * /api/v2/balance:
 *   get:
 *     summary: Get total amount of unclaimed fallback storage
 *     tags: [Claim]
 *     security:
 *       - JWT: []
 *     responses:
 *       200:
 *         description: Total amount in satoshis
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: boolean
 *                 data:
 *                   type: integer
 */
claimRouter.get(
  "/balance",
  isAuthMiddleware("/api/v2/balance", "GET"),
  getBalance,
);

export default claimRouter;
