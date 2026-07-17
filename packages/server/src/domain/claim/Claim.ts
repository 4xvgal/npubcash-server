export type ClaimStatus = "ready" | "spent";

export type ClaimStorageMode = "off" | "on_expire";

export interface ClaimConfig {
  id: number;
  userPubkey: string;
  mintUrl: string;
  proof: ProofJson;
  status: ClaimStatus;
  quoteId?: string;
  createdAt: Date;
  claimedAt?: Date;
}

export type ProofJson = {
  amount: number;
  id: string;
  secret: string;
  C: string;
};

export type CreateClaimInput = Omit<
  ClaimConfig,
  "id" | "createdAt" | "claimedAt" | "status"
> & {
  status?: ClaimStatus;
};

export class Claim implements ClaimConfig {
  id: number;
  userPubkey: string;
  mintUrl: string;
  proof: ProofJson;
  status: ClaimStatus;
  quoteId?: string;
  createdAt: Date;
  claimedAt?: Date;

  constructor(config: ClaimConfig) {
    this.id = config.id;
    this.userPubkey = config.userPubkey;
    this.mintUrl = config.mintUrl;
    this.proof = config.proof;
    this.status = config.status;
    this.quoteId = config.quoteId;
    this.createdAt = config.createdAt;
    this.claimedAt = config.claimedAt;
  }

  markSpent() {
    this.status = "spent";
    this.claimedAt = new Date();
  }
}
