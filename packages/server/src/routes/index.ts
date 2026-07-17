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
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         pubkey:
 *           type: string
 *         name:
 *           type: string
 *           nullable: true
 *         mintUrl:
 *           type: string
 *         lockQuote:
 *           type: boolean
 *         claimStorageMode:
 *           type: string
 *           enum: [off, on_expire]
 *     UserResponse:
 *       type: object
 *       properties:
 *         error:
 *           type: boolean
 *         data:
 *           type: object
 *           properties:
 *             user:
 *               $ref: '#/components/schemas/User'
 *             claimBalance:
 *               type: integer
 *               description: Total amount of unclaimed fallback storage in satoshis
 *     Quote:
 *       type: object
 *       properties:
 *         createdAt:
 *           type: integer
 *         paidAt:
 *           type: integer
 *         expiresAt:
 *           type: integer
 *         mintUrl:
 *           type: string
 *         quoteId:
 *           type: string
 *         request:
 *           type: string
 *         amount:
 *           type: integer
 *         state:
 *           type: string
 *           enum: [PAID, UNPAID, INFLIGHT, ISSUED, EXPIRED]
 *         locked:
 *           type: boolean
 *         zapRequest:
 *           type: string
 *         autoStoredAt:
 *           type: integer
 *           description: Unix timestamp when the quote was auto-stored as a claim
 *         claimId:
 *           type: integer
 *           description: ID of the first created claim for this quote
 *     QuotesResponse:
 *       type: object
 *       properties:
 *         error:
 *           type: boolean
 *         data:
 *           type: object
 *           properties:
 *             quotes:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Quote'
 *         metadata:
 *           type: object
 *           properties:
 *             since:
 *               type: integer
 *             offset:
 *               type: integer
 *             total:
 *               type: integer
 *             limit:
 *               type: integer
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
