import { ClaimRepository } from "@/domain/claim/ClaimRepository";
import { MintQuote } from "@/domain/mintQuote/MintQuote";
import { MintQuoteRepository } from "@/domain/mintQuote/MintQuoteRepository";
import { UserRepository } from "@/domain/user/userRepository";
import { eventBus } from "@/events";
import { logger } from "@/utils/logger";
import { handleZapRequest } from "@/utils/nostr";
import { normalizeUrl } from "@/utils/utils";
import { Mint, Wallet, type Token } from "@cashu/cashu-ts";
import { MintCommunicator } from "almnd";
import { Logger } from "winston";
import {
  HybridSubscriptionManager,
  MintQuotePayload,
  UnsubscribeHandler,
} from "./infra";

const AUTO_STORE_BEFORE_EXPIRY_MS = 3 * 60 * 60 * 1000; // 3 hours
const AUTO_STORE_MAX_ATTEMPTS = 3;
const AUTO_STORE_BATCH_SIZE = 5;
const AUTO_STORE_RETRY_DELAY_MS = 5 * 60 * 1000; // 5 minutes
const AUTO_STORE_INTERVAL_MS = 60 * 1000; // 1 minute

export class CommunicatorService {
  private communicators: { [mintUrl: string]: MintCommunicator } = {};
  private subscriptionManager: HybridSubscriptionManager;
  private activeSubscriptions: Map<string, UnsubscribeHandler> = new Map();
  private mintQuoteRepository: MintQuoteRepository;
  private claimRepository: ClaimRepository;
  private userRepository: UserRepository;
  private walletCache = new Map<string, any>();
  private autoStoreInProgress = new Set<string>();
  private autoStoreTimer?: ReturnType<typeof setInterval>;

  constructor(
    mintQuoteRepository: MintQuoteRepository,
    claimRepository: ClaimRepository,
    userRepository: UserRepository,
  ) {
    this.mintQuoteRepository = mintQuoteRepository;
    this.claimRepository = claimRepository;
    this.userRepository = userRepository;
    this.subscriptionManager = new HybridSubscriptionManager({
      slowPollingIntervalMs: 20000,
      fastPollingIntervalMs: 5000,
      periodicReconnectMs: 180000, // 3 minutes
      logger,
    });
  }

  async getWallet(mintUrl: string) {
    const cached = this.walletCache.get(mintUrl);
    if (cached) return cached;

    const mint = new Mint(mintUrl);
    const [mintInfo, { keysets: rawKeysets }] = await Promise.all([
      mint.getInfo(),
      mint.getKeys(),
    ]);
    const keysetCache = await Promise.all(
      rawKeysets.map(async (ks: any) => {
        const { keysets: [keyset] } = await mint.getKeys(ks.id) as any;
        return { id: ks.id, unit: ks.unit, active: ks.active ?? true, keys: keyset.keys };
      }),
    );
    const wallet = new Wallet(mint);
    wallet.loadMintFromCache(mintInfo as any, {
      mintUrl,
      unit: "sat",
      keysets: keysetCache as any,
    });
    this.walletCache.set(mintUrl, wallet);
    return wallet;
  }

  async redeemToken(token: Token, logger?: Logger) {
    logger?.info(`Receiving proofs on mint ${token.mint}`);
    const wallet = await this.getWallet(token.mint);
    return wallet.receive(token);
  }

  async createMintQuote(
    amount: number,
    userData: { pubkey: string; lockQuote: boolean },
    mintUrl: string,
  ) {
    if (userData.lockQuote) {
      const res = await this.getCommunicator(mintUrl).getLockedMintQuote(
        amount,
        userData.pubkey,
      );
      return { locked: true, ...res };
    } else {
      const res = await this.getCommunicator(mintUrl).getMintQuote(amount);
      return { locked: false, ...res };
    }
  }

  createQuoteSubscription(quote: MintQuote, reqLogger: Logger) {
    const mintUrl = normalizeUrl(quote.mintUrl);
    const quoteId = quote.quoteId;

    // Check if already subscribed
    if (this.activeSubscriptions.has(quoteId)) {
      reqLogger.debug("[CommSvc] Already subscribed to quote", { quoteId });
      return;
    }

    reqLogger.info("[CommSvc] Creating hybrid subscription for quote", {
      mintUrl,
      quoteId,
    });

    const { subId, unsubscribe } = this.subscriptionManager.subscribe(
      mintUrl,
      quoteId,
      (payload: MintQuotePayload) => {
        this.handleQuoteUpdate(quote, payload, reqLogger, unsubscribe);
      },
    );

    this.activeSubscriptions.set(quoteId, unsubscribe);

    reqLogger.debug("[CommSvc] Subscribed to quote", {
      mintUrl,
      quoteId,
      subId,
    });
  }

  private async handleQuoteUpdate(
    quote: MintQuote,
    payload: MintQuotePayload,
    reqLogger: Logger,
    unsubscribe: UnsubscribeHandler,
  ) {
    reqLogger.debug("[CommSvc] Received quote update", {
      state: payload.state,
      quoteId: quote.quoteId,
    });

    if (payload.state === "PAID") {
      reqLogger.info("[CommSvc] Mint quote got paid", { quoteId: quote.quoteId });
      eventBus.emit("quotePaid", quote);
      await this.mintQuoteRepository.setPaid(quote.id);
      quote.state = "PAID";

      if (quote.serializedZapRequest) {
        try {
          const { config } = await import("@/config/index");
          if (config.nostr.nostrEnabled) {
            const zapRequest = JSON.parse(quote.serializedZapRequest);
            handleZapRequest(quote.quoteId, zapRequest, quote.paymentRequest);
          }
        } catch (e) {
          reqLogger.error("[CommSvc] Failed to handle zap request", { quoteId: quote.quoteId });
        }
      }

      await this.maybeAutoStoreOnIssued(quote, reqLogger);
      this.cleanupSubscription(quote.quoteId, unsubscribe);
    } else if (payload.state === "ISSUED") {
      reqLogger.debug("[CommSvc] Quote already issued", { quoteId: quote.quoteId });
      await this.maybeAutoStoreOnIssued(quote, reqLogger);
      this.cleanupSubscription(quote.quoteId, unsubscribe);
    } else if (this.isExpired(payload.expiry)) {
      reqLogger.debug("[CommSvc] Mint quote expired", { quoteId: quote.quoteId });
      await this.mintQuoteRepository.updateState(quote.id, "EXPIRED");
      this.cleanupSubscription(quote.quoteId, unsubscribe);
    }
  }

  private async maybeAutoStoreOnIssued(quote: MintQuote, reqLogger: Logger) {
    try {
      const user = await this.userRepository.getUserByPubkey(quote.pubkey);
      if (!user || user.claimStorageMode !== "on_expire") return;
      if (this.shouldAutoStore(quote)) {
        const timeUntilExpiry = Math.round(
          (quote.expiresAt.getTime() - Date.now()) / 1000 / 60,
        );
        reqLogger.info("[CommSvc] Quote expiring soon, triggering auto-store", {
          quoteId: quote.quoteId,
          mintUrl: quote.mintUrl,
          pubkey: quote.pubkey,
          amount: quote.amount,
          expiresAt: quote.expiresAt.toISOString(),
          expiresInMin: timeUntilExpiry,
        });
        await this.attemptAutoStore(quote, user.claimStorageMode);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err ?? "unknown");
      reqLogger.error("[CommSvc] Auto-store check failed", {
        quoteId: quote.quoteId,
        error: errMsg,
      });
    }
  }

  private shouldAutoStore(quote: MintQuote): boolean {
    const timeUntilExpiry = quote.expiresAt.getTime() - Date.now();
    return (
      (quote.state === "PAID" || quote.state === "ISSUED") &&
      !quote.autoStoredAt &&
      quote.autoStoreAttempts < AUTO_STORE_MAX_ATTEMPTS &&
      timeUntilExpiry <= AUTO_STORE_BEFORE_EXPIRY_MS
    );
  }

  async receiveEcashForUser(
    pubkey: string,
    quote: MintQuote,
    reqLogger?: Logger,
  ): Promise<{ proofs: any[] }> {
    reqLogger?.info("[CommSvc] Receiving ecash from mint for user", {
      quoteId: quote.quoteId,
      pubkey,
    });
    const wallet = await this.getWallet(quote.mintUrl);
    const proofs = await wallet.mintProofs(quote.amount, quote.quoteId);
    return { proofs };
  }

  private async attemptAutoStore(
    quote: MintQuote,
    _mode: "on_expire",
  ): Promise<void> {
    if (quote.autoStoreAttempts >= AUTO_STORE_MAX_ATTEMPTS) return;
    if (this.autoStoreInProgress.has(quote.quoteId)) return;
    this.autoStoreInProgress.add(quote.quoteId);

    const nextAttempts = quote.autoStoreAttempts + 1;
    await this.mintQuoteRepository.recordAutoStoreAttempt(
      quote.id,
      nextAttempts,
    );
    quote.autoStoreAttempts = nextAttempts;

    try {
      const { proofs } = await this.receiveEcashForUser(
        quote.pubkey,
        quote,
        logger,
      );
      if (!proofs || proofs.length === 0) {
        throw new Error("Mint returned no proofs");
      }
      let firstClaimId: number | undefined;
      for (const proof of proofs) {
        const claim = await this.claimRepository.create(
          quote.pubkey,
          quote.mintUrl,
          proof,
          quote.quoteId,
        );
        if (firstClaimId === undefined) {
          firstClaimId = claim.id;
        }
      }
      await this.mintQuoteRepository.recordAutoStoreAttempt(
        quote.id,
        nextAttempts,
        firstClaimId,
      );
      quote.autoStoredAt = new Date();
      quote.claimId = firstClaimId;
      logger.info("[CommSvc] Auto-stored ecash for user", {
        quoteId: quote.quoteId,
        claimId: firstClaimId,
        proofCount: proofs.length,
        amount: quote.amount,
        pubkey: quote.pubkey,
        mintUrl: quote.mintUrl,
        expiresAt: quote.expiresAt.toISOString(),
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err ?? "unknown");
      const errStack = err instanceof Error ? err.stack : undefined;
      logger.error("[CommSvc] Auto-store attempt failed", {
        quoteId: quote.quoteId,
        attempts: nextAttempts,
        error: errMsg,
        stack: errStack,
      });
    } finally {
      this.autoStoreInProgress.delete(quote.quoteId);
    }
  }

  private async processAutoStoreCandidates(): Promise<void> {
    const candidates = await this.mintQuoteRepository.getAutoStoreCandidates(
      AUTO_STORE_BEFORE_EXPIRY_MS,
      AUTO_STORE_MAX_ATTEMPTS,
      AUTO_STORE_RETRY_DELAY_MS,
      AUTO_STORE_BATCH_SIZE,
    );
    if (candidates.length === 0) return;

    logger.debug("[CommSvc] Processing auto-store candidates", {
      count: candidates.length,
    });

    for (const quote of candidates) {
      const user = await this.userRepository.getUserByPubkey(quote.pubkey);
      if (!user || user.claimStorageMode !== "on_expire") continue;

      const timeUntilExpiry = Math.round(
        (quote.expiresAt.getTime() - Date.now()) / 1000 / 60,
      );
      logger.info(
        "[CommSvc] Background auto-store: quote expiring soon",
        {
          quoteId: quote.quoteId,
          mintUrl: quote.mintUrl,
          amount: quote.amount,
          expiresAt: quote.expiresAt.toISOString(),
          expiresInMin: timeUntilExpiry,
          attempt: quote.autoStoreAttempts + 1,
        },
      );

      await this.attemptAutoStore(quote, user.claimStorageMode);

      // Throttle: 1 second between sequential attempts
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  private startAutoStoreLoop(): void {
    if (this.autoStoreTimer) return;
    this.autoStoreTimer = setInterval(() => {
      void this.processAutoStoreCandidates();
    }, AUTO_STORE_INTERVAL_MS);
  }

  private isExpired(expiry: number): boolean {
    return expiry > 0 && Date.now() / 1000 > expiry;
  }

  private cleanupSubscription(
    quoteId: string,
    unsubscribe: UnsubscribeHandler,
  ) {
    unsubscribe();
    this.activeSubscriptions.delete(quoteId);
  }

  async setupPoller() {
    const pendingSubs = await this.mintQuoteRepository.getPending();
    logger.info("[CommSvc] Setup: Retrieved pending subscriptions from DB", {
      count: pendingSubs.length,
    });
    pendingSubs.forEach((quote) => {
      this.createQuoteSubscription(quote, logger);
    });
    this.startAutoStoreLoop();
  }

  shutdown() {
    logger.info("[CommSvc] Shutting down");
    if (this.autoStoreTimer) {
      clearInterval(this.autoStoreTimer);
      this.autoStoreTimer = undefined;
    }
    this.subscriptionManager.closeAll();
    this.activeSubscriptions.clear();
  }

  getCommunicator(mintUrl: string) {
    const parsedUrl = normalizeUrl(mintUrl);
    if (this.communicators[parsedUrl]) {
      return this.communicators[parsedUrl];
    }
    const comm = new MintCommunicator(parsedUrl, {
      initialPollingTimeout: { mint: 10000, melt: 10000, proof: 10000 },
      backoffFunction: (r) => Math.min(5000 * Math.pow(2, r), 600000),
      throttleCapacity: 10,
      throttleTimeout: 3500,
    });
    this.communicators[parsedUrl] = comm;
    return comm;
  }
}
