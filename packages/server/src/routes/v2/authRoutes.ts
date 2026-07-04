import { Router } from "express";
import { isAuthMiddleware } from "@/middleware/auth";
import { getNip98AuthController } from "@/controller/auth";

const authRouter = Router();

/**
 * @openapi
 * /api/v2/auth/nip98:
 *   get:
 *     summary: Authenticate via NIP-98 and receive JWT
 *     tags: [Auth]
 *     security:
 *       - JWT: []
 *     responses:
 *       200:
 *         description: JWT issued
 */
authRouter.get(
  "/nip98",
  isAuthMiddleware("/api/v2/auth/nip98", "GET"),
  getNip98AuthController,
);

export default authRouter;
