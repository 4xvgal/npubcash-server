import { Claim, ClaimStatus, ProofJson } from "./Claim";

export interface ClaimRepository {
  create(
    userPubkey: string,
    mintUrl: string,
    proof: ProofJson,
    quoteId?: string,
  ): Promise<Claim>;
  getById(id: number): Promise<Claim | null>;
  getReadyByUserPubkey(userPubkey: string): Promise<Claim[]>;
  markSpent(id: number): Promise<void>;
  updateStatus(id: number, status: ClaimStatus): Promise<void>;
}
