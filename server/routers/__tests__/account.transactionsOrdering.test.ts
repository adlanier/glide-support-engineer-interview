import { db } from "@/lib/db";
import { users, accounts, transactions } from "@/lib/db/schema";
import { appRouter } from "@/server/routers";
import { Context } from "@/server/trpc";

function createCaller(user: { id: number } | null) {
  const ctx: Context = {
    user,
    req: {} as any,
    res: {} as any,
  };
  return appRouter.createCaller(ctx);
}

async function createTestUserAndAccount() {
  const [user] = await db
    .insert(users)
    .values({
      email: `tx-test-${Date.now()}@example.com`,
      password: "hashed-pass",
      firstName: "Tx",
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
  if (!user) throw new Error("Failed to create user");

  const [account] = await db
    .insert(accounts)
    .values({
      userId: user.id,
      accountNumber: "9876543210",
      accountType: "checking",
      balance: 0,
      status: "active",
    })
    .returning();
  if (!account) throw new Error("Failed to create account");

  return { user, account };
}

describe("getTransactions ordering and completeness", () => {
  beforeEach(async () => {
    await db.delete(transactions);
    await db.delete(accounts);
    await db.delete(users);
  });

  it("returns all transactions for the account ordered by createdAt desc", async () => {
    const { user, account } = await createTestUserAndAccount();
    const caller = createCaller(user);

    // Create several funding transactions
    const amounts = [10, 20, 30];
    for (const amount of amounts) {
      await caller.account.fundAccount({
        accountId: account.id,
        amount,
        fundingSource: {
          type: "card",
          accountNumber: "4111111111111111",
        },
      });
    }

    const txs = await caller.account.getTransactions({
      accountId: account.id,
    });

    // 1. All transactions present
    expect(txs.length).toBe(amounts.length);

    const txAmounts = txs.map((t) => t.amount).sort((a, b) => a - b);
    expect(txAmounts).toEqual(amounts.sort((a, b) => a - b));

    // 2. Ordered by createdAt desc
    const times = txs.map((t) => new Date(t.createdAt).getTime());
    const sortedTimes = [...times].sort((a, b) => b - a);
    expect(times).toEqual(sortedTimes);

    // 3. accountType enrichment is consistent
    txs.forEach((t) => {
      expect(t.accountType).toBe("checking");
    });
  });
});
