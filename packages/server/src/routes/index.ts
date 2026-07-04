import { Router } from "express";
import v2Router from "./v2";
import { nip05Controller } from "@/controller/nip05Controller";
import { lnurlController } from "@/controller/lnurlController";

const baseRouter = Router();

/**
 * @openapi
 * components:
 *   securitySchemes:
 *     JWT:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

/**
 * @openapi
 * /.well-known/lnurlp/{user}:
 *   get:
 *     summary: Create a mint quote or return LNURL metadata
 *     tags: [LNURL]
 *     parameters:
 *       - in: path
 *         name: user
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: amount
 *         schema: { type: integer, description: millisatoshis }
 *       - in: query
 *         name: nostr
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: LNURL-pay response or Bolt11 invoice
 * /.well-known/nostr.json:
 *   get:
 *     summary: NIP-05 identity
 *     tags: [Nostr]
 *     parameters:
 *       - in: query
 *         name: name
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: NIP-05 response
 */
baseRouter.get("/.well-known/lnurlp/:user", lnurlController);
baseRouter.get("/.well-known/nostr.json", nip05Controller);
baseRouter.use("/api/v2", v2Router);

export default baseRouter;
