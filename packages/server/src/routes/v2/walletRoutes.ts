import { getMintQuotes } from "@/controller/wallet";
import { isAuthMiddleware } from "@/middleware/auth";
import { Router } from "express";

const walletRouter = Router();

/**
 * @openapi
 * /api/v2/wallet/quotes:
 *   get:
 *     summary: Get paid mint quotes for the authenticated user
 *     tags: [Wallet]
 *     security:
 *       - JWT: []
 *     parameters:
 *       - in: query
 *         name: since
 *         schema: { type: integer }
 *         description: Unix timestamp filter
 *       - in: query
 *         name: limit
 *         schema: { type: integer, maximum: 1000 }
 *       - in: query
 *         name: offset
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Paginated list of mint quotes
 */
walletRouter.get(
  "/quotes",
  isAuthMiddleware("/api/v2/wallet/quotes", "GET"),
  getMintQuotes,
);

export default walletRouter;
