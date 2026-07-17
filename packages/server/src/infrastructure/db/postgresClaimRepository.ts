import { Claim, ClaimStatus, ProofJson } from "@/domain/claim/Claim";
import { ClaimRepository } from "@/domain/claim/ClaimRepository";
import { queryWrapper } from "@/utils/database";

type ClaimRow = {
  id: number;
  user_pubkey: string;
  mint_url: string;
  proof: string | ProofJson;
  status: ClaimStatus;
  quote_id: string | null;
  created_at: Date;
  claimed_at: Date | null;
};

export class PostgresClaimRepository implements ClaimRepository {
  async create(
    userPubkey: string,
    mintUrl: string,
    proof: ProofJson,
    quoteId?: string,
  ): Promise<Claim> {
    const query = `
INSERT INTO l_claims (user_pubkey, mint_url, proof, status, quote_id)
VALUES ($1, $2, $3, 'ready', $4)
RETURNING *`;
    const res = await queryWrapper<ClaimRow>(query, [
      userPubkey,
      mintUrl,
      JSON.stringify(proof),
      quoteId ?? null,
    ]);
    if (res.rowCount === 0) {
      throw new Error("Failed to create claim");
    }
    return this.castRowToClaim(res.rows[0]);
  }

  async getById(id: number): Promise<Claim | null> {
    const res = await queryWrapper<ClaimRow>(
      `SELECT * FROM l_claims WHERE id = $1`,
      [id],
    );
    if (res.rowCount === 0) {
      return null;
    }
    return this.castRowToClaim(res.rows[0]);
  }

  async getReadyByUserPubkey(userPubkey: string): Promise<Claim[]> {
    const res = await queryWrapper<ClaimRow>(
      `SELECT * FROM l_claims WHERE user_pubkey = $1 AND status = 'ready'`,
      [userPubkey],
    );
    return res.rows.map((r) => this.castRowToClaim(r));
  }

  async markSpent(id: number): Promise<void> {
    const query = `UPDATE l_claims SET status = 'spent', claimed_at = NOW() WHERE id = $1`;
    const res = await queryWrapper(query, [id]);
    if (res.rowCount === 0) {
      throw new Error("Failed to mark claim as spent");
    }
  }

  async updateStatus(id: number, status: ClaimStatus): Promise<void> {
    const query = `UPDATE l_claims SET status = $1 WHERE id = $2`;
    const res = await queryWrapper(query, [status, id]);
    if (res.rowCount === 0) {
      throw new Error("Failed to update claim status");
    }
  }

  private castRowToClaim(row: ClaimRow): Claim {
    const proof =
      typeof row.proof === "string" ? JSON.parse(row.proof) : row.proof;
    return new Claim({
      id: row.id,
      userPubkey: row.user_pubkey,
      mintUrl: row.mint_url,
      proof: proof as ProofJson,
      status: row.status,
      quoteId: row.quote_id ?? undefined,
      createdAt: new Date(row.created_at),
      claimedAt: row.claimed_at ? new Date(row.claimed_at) : undefined,
    });
  }
}
