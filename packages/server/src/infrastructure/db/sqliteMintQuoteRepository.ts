import {
  MintQuote,
  MintQuoteState,
  CreateMintQuoteInput,
} from "@/domain/mintQuote/MintQuote";
import {
  MintQuoteRepository,
  UserMintHistoryResult,
} from "@/domain/mintQuote/MintQuoteRepository";
import { queryWrapper } from "@/utils/database";

type MintQuoteRow = {
  id: number;
  created_at: string;
  unit: string;
  mint_url: string;
  payment_request: string;
  quote_id: string;
  expires_at: string;
  amount: number;
  pubkey: string;
  state: MintQuoteState;
  paid_at: string | null;
  serialized_zap_request: string | null;
  locked: number;
  auto_stored_at: string | null;
  auto_store_attempts: number;
  last_auto_store_attempt_at: string | null;
  claim_id: number | null;
};

export class SqliteMintQuoteRepository implements MintQuoteRepository {
  async create(input: CreateMintQuoteInput): Promise<MintQuote> {
    const query = `
INSERT INTO mint_quotes (mint_url, payment_request, unit, quote_id, expires_at, amount, pubkey, state, serialized_zap_request, locked)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
RETURNING *`;
    const res = await queryWrapper<MintQuoteRow>(query, [
      input.mintUrl,
      input.paymentRequest,
      input.unit,
      input.quoteId,
      input.expiresAt.toISOString(),
      input.amount,
      input.pubkey,
      "UNPAID",
      input.serializedZapRequest ?? null,
      input.locked ? 1 : 0,
    ]);
    if (res.rowCount === 0) {
      throw new Error("Failed to create new mint quote");
    }
    return this.castRowToQuote(res.rows[0]);
  }

  async updateState(id: number, state: MintQuoteState): Promise<void> {
    const query = `UPDATE mint_quotes SET state = ? WHERE id = ?`;
    const res = await queryWrapper(query, [state, id]);
    if (res.rowCount === 0) {
      throw new Error("Failed to update state");
    }
  }

  async setPaid(id: number, paidAt: Date = new Date()): Promise<void> {
    const query = `UPDATE mint_quotes SET state = 'PAID', paid_at = ? WHERE id = ?`;
    const res = await queryWrapper(query, [paidAt.toISOString(), id]);
    if (res.rowCount === 0) {
      throw new Error("Failed to update state");
    }
  }

  async getExpiredUnpaid(): Promise<MintQuote[]> {
    const res = await queryWrapper<MintQuoteRow>(
      `SELECT * FROM mint_quotes WHERE expires_at <= datetime('now') AND state = 'UNPAID'`,
      []
    );
    return res.rows.map((r) => this.castRowToQuote(r));
  }

  async getPending(): Promise<MintQuote[]> {
    const res = await queryWrapper<MintQuoteRow>(
      `SELECT * FROM mint_quotes WHERE state = 'UNPAID'`,
      []
    );
    return res.rows.map((r) => this.castRowToQuote(r));
  }

  async getUserHistory(
    pubkey: string,
    limit = 50,
    offset = 0,
    since?: Date
  ): Promise<UserMintHistoryResult> {
    const cappedLimit = Math.min(limit, 50);

    // Build WHERE clause
    const conditions = ["pubkey = ?", "state IN ('PAID', 'ISSUED', 'INFLIGHT')"];
    const params: unknown[] = [pubkey];

    if (since) {
      conditions.push("paid_at > ?");
    }

    const whereClause = conditions.join(" AND ");

    // Get total count
    const countParams = since ? [pubkey, since.toISOString()] : [pubkey];
    const countRes = await queryWrapper<{ count: number }>(
      `SELECT COUNT(*) as count FROM mint_quotes WHERE ${whereClause}`,
      countParams
    );
    const total = countRes.rows[0]?.count ?? 0;

    // Get paginated results
    const queryParams = since
      ? [pubkey, since.toISOString(), cappedLimit, offset]
      : [pubkey, cappedLimit, offset];

    const dataRes = await queryWrapper<MintQuoteRow>(
      `SELECT * FROM mint_quotes WHERE ${whereClause} ORDER BY paid_at DESC LIMIT ? OFFSET ?`,
      queryParams
    );

    return {
      total,
      quotes: dataRes.rows.map((r) => this.castRowToQuote(r)),
    };
  }

  async bulkUpdateState(state: MintQuoteState, ids: number[]): Promise<void> {
    if (ids.length === 0) return;

    const placeholders = ids.map(() => "?").join(",");
    const query = `UPDATE mint_quotes SET state = ? WHERE id IN (${placeholders})`;
    await queryWrapper(query, [state, ...ids]);
  }

  async getAutoStoreCandidates(
    beforeExpiryMs: number,
    maxAttempts: number,
    retryDelayMs: number,
    limit: number,
  ): Promise<MintQuote[]> {
    const cutoff = new Date(Date.now() + beforeExpiryMs).toISOString();
    const retryCutoff = new Date(Date.now() - retryDelayMs).toISOString();
    const res = await queryWrapper<MintQuoteRow>(
      `SELECT * FROM mint_quotes
       WHERE (state = 'PAID' OR state = 'ISSUED')
         AND auto_stored_at IS NULL
         AND auto_store_attempts < ?
         AND expires_at <= ?
         AND (
           last_auto_store_attempt_at IS NULL
           OR last_auto_store_attempt_at <= ?
         )
       ORDER BY expires_at ASC
       LIMIT ?`,
      [maxAttempts, cutoff, retryCutoff, limit],
    );
    return res.rows.map((r) => this.castRowToQuote(r));
  }

  async recordAutoStoreAttempt(
    id: number,
    attempts: number,
    claimId?: number,
  ): Promise<void> {
    if (claimId) {
      const query = `
        UPDATE mint_quotes
        SET auto_store_attempts = ?,
            auto_stored_at = datetime('now'),
            last_auto_store_attempt_at = datetime('now'),
            claim_id = ?
        WHERE id = ?`;
      const res = await queryWrapper(query, [attempts, claimId, id]);
      if (res.rowCount === 0) {
        throw new Error("Failed to record auto-store attempt");
      }
      return;
    }

    const query = `
      UPDATE mint_quotes
      SET auto_store_attempts = ?,
          last_auto_store_attempt_at = datetime('now')
      WHERE id = ?`;
    const res = await queryWrapper(query, [attempts, id]);
    if (res.rowCount === 0) {
      throw new Error("Failed to record auto-store attempt");
    }
  }

  private castRowToQuote(row: MintQuoteRow): MintQuote {
    return new MintQuote({
      id: row.id,
      createdAt: new Date(row.created_at),
      mintUrl: row.mint_url,
      unit: row.unit,
      paymentRequest: row.payment_request,
      quoteId: row.quote_id,
      expiresAt: new Date(row.expires_at),
      amount: row.amount,
      pubkey: row.pubkey,
      state: row.state,
      paidAt: row.paid_at ? new Date(row.paid_at) : undefined,
      serializedZapRequest: row.serialized_zap_request ?? undefined,
      locked: Boolean(row.locked),
      autoStoredAt: row.auto_stored_at ? new Date(row.auto_stored_at) : undefined,
      autoStoreAttempts: row.auto_store_attempts,
      lastAutoStoreAttemptAt: row.last_auto_store_attempt_at
        ? new Date(row.last_auto_store_attempt_at)
        : undefined,
      claimId: row.claim_id ?? undefined,
    });
  }
}
