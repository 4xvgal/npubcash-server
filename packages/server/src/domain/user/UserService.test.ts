import { describe, test, expect, mock } from "bun:test";
import { UserService } from "./UserService";
import type { UserRepository } from "./userRepository";

const mockUserRepo = (): UserRepository => ({
  getUserByPubkey: mock(async () => null),
  getUserByName: mock(async () => null),
  createUser: mock(async () => {}),
  upsertUsername: mock(async () => ({}) as any),
  upsertLockQuote: mock(async () => {}),
  upsertClaimStorageMode: mock(async () => {}),
  saveUser: mock(async () => {}),
});

describe("UserService claimStorageMode", () => {
  test("createNewUser defaults claimStorageMode to off", () => {
    const service = new UserService(mockUserRepo());
    const user = service.createNewUser("pubkey1");
    expect(user.claimStorageMode).toBe("off");
  });

  test("createNewUser preserves explicit claimStorageMode", () => {
    const service = new UserService(mockUserRepo());
    const user = service.createNewUser(
      "pubkey1",
      "username",
      "https://mint.test",
      false,
      "on_expire",
    );
    expect(user.claimStorageMode).toBe("on_expire");
  });

  test("setClaimStorageMode delegates to repository", async () => {
    const repo = mockUserRepo();
    const service = new UserService(repo);
    await service.setClaimStorageMode("pubkey1", "on_expire");

    expect(repo.upsertClaimStorageMode).toHaveBeenCalledTimes(1);
    expect(repo.upsertClaimStorageMode).toHaveBeenCalledWith("on_expire", "pubkey1");
  });
});
