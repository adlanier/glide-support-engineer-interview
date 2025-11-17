// server/routers/__tests__/account.balance.test.ts

import { db } from "@/lib/db";
import { users, accounts, transactions, sessions } from "@/lib/db/schema";
import { appRouter } from "@/server/routers";
import { Context } from "@/server/trpc";
import { eq } from "drizzle-orm";

function createCaller(user: { id: number } | null) {
  const ctx: Context = {
    user,
    req: {} as any,
    res: {} as any,
  };
  return appRouter.createCaller(ctx);
}

async function createTestUser() {
  const [user] = await db
    .insert(users)
    .values({
      email: `balance-test-${Date.now()}@example.com`,
      password: "hashed-pass",
      firstName: "Test",
      lastName: "User",
      phoneNumber: "9195551234",
      dateOfBirth: "1990-01-01",
      ssn: "hashed-ssn",
      address: "123 Test St",
      city: "Chapel Hill",
      state: "NC",
      zipCode: "27514",
    })
    .returning();

  if (!user) throw new Error("Failed to create test user");
  return user;
}

async function createTestAccount(userId: number) {
  const [account] = await db
    .insert(accounts)
    .values({
      userId,
      accountNumber: "1234567890",
      accountType: "checking",
      balance: 0,
      status: "active",
    })
    .returning();

  if (!account) throw new Error("Failed to create test account");
  return account;
}

describe("Account funding balance correctness", () => {
  beforeEach(async () => {
    // Delete children first, then parents (to satisfy FKs)
    await db.delete(transactions);
    await db.delete(accounts);
    await db.delete(sessions);
    await db.delete(users);
  });

  it("keeps balance correct over multiple deposits", async () => {
    const user = await createTestUser();
    const account = await createTestAccount(user.id);
    const caller = createCaller(user);

    const deposits = [10, 2.5, 100.01, 7.49];
    let expectedBalance = 0;

    for (const amount of deposits) {
      const result = await caller.account.fundAccount({
        accountId: account.id,
        amount,
        fundingSource: {
          type: "card",
          accountNumber: "4111111111111111", // valid Luhn
        },
      });

      expectedBalance += amount;

      // Returned balance matches expected
      expect(result.newBalance).toBeCloseTo(expectedBalance, 5);

      // DB balance matches expected
      const updatedAccount = await db
        .select()
        .from(accounts)
        .where(eq(accounts.id, account.id))
        .get();

      expect(updatedAccount).toBeTruthy();
      expect(updatedAccount!.balance).toBeCloseTo(expectedBalance, 5);
    }
  });
});
