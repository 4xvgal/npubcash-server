export type ClaimStorageMode = "off" | "on_expire";

export interface UserCofig {
  pubkey: string;
  name?: string;
  mintUrl: string;
  lockQuote: boolean;
  claimStorageMode?: ClaimStorageMode;
  relays?: string[];
}

export class User {
  pubkey: string;
  name?: string;
  mintUrl: string;
  //TODO: Make sure casing is consistent
  lockQuote: boolean;
  claimStorageMode: ClaimStorageMode;
  relays: string[];

  constructor(config: UserCofig) {
    this.pubkey = config.pubkey;
    this.mintUrl = config.mintUrl;
    this.name = config.name;
    this.lockQuote = config.lockQuote;
    this.claimStorageMode = config.claimStorageMode ?? "off";
    this.relays = config.relays ?? [];
  }

  setQuoteLocking(shouldLock: boolean) {
    this.lockQuote = shouldLock;
  }

  setPreferredMint(mintUrl: string) {
    this.mintUrl = mintUrl;
  }

  setClaimStorageMode(mode: ClaimStorageMode) {
    this.claimStorageMode = mode;
  }

  setRelays(urls: string[]) {
    this.relays = urls;
  }
}

export class UserWithName extends User {
  name: string;

  constructor(config: UserCofig & { name: string }) {
    super(config);
    this.name = config.name;
  }
}
