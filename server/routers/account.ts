import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../trpc";
import { db } from "@/lib/db";
import { accounts, transactions } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { randomInt } from "crypto";


export const fundAccountInputSchema = z.object({
  accountId: z.number(),
  amount: z.number().positive(),
  fundingSource: z
    .object({
      type: z.enum(["card", "bank"]),
      accountNumber: z.string(),
      routingNumber: z.string().optional(),
    })
    .superRefine((val, ctx) => {
      if (val.type === "card") {
        const digits = val.accountNumber.replace(/\D/g, "");
        if (digits.length < 13 || digits.length > 19) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["accountNumber"],
            message: "Card number is not the right amount of digits.",
          });
          return;
        }
          if (!isValidCardNumber(digits)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["accountNumber"],
            message: "Invalid card number",
          });
        }
      }

      if (val.type === "bank") {
        if (!val.routingNumber) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["routingNumber"],
            message: "Routing number is required for bank transfers",
          });
          return;
        }

        const routingDigits = val.routingNumber.replace(/\D/g, "");
        if (!/^\d{9}$/.test(routingDigits)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["routingNumber"],
            message: "Routing number must be 9 digits",
          });
        }
      }
    }),
});


export function generateAccountNumber(): string {
  const num = randomInt(0, 10_000_000_000);
  return num.toString().padStart(10, "0");
}


function isValidCardNumber(cardNumber: string): boolean {
  const digits = cardNumber.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) {
      return false;
    }

  let sum = 0;
  let shouldDouble = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits[i], 10);
    if (Number.isNaN(digit)) return false;

    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
}

export const accountRouter = router({
  createAccount: protectedProcedure
    .input(
      z.object({
        accountType: z.enum(["checking", "savings"]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Check if user already has an account of this type
      const existingAccount = await db
        .select()
        .from(accounts)
        .where(and(eq(accounts.userId, ctx.user.id), eq(accounts.accountType, input.accountType)))
        .get();

      if (existingAccount) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `You already have a ${input.accountType} account`,
        });
      }

      let accountNumber;
      let isUnique = false;

      // Generate unique account number
      while (!isUnique) {
        accountNumber = generateAccountNumber();
        const existing = await db.select().from(accounts).where(eq(accounts.accountNumber, accountNumber)).get();
        isUnique = !existing;
      }

      await db.insert(accounts).values({
        userId: ctx.user.id,
        accountNumber: accountNumber!,
        accountType: input.accountType,
        balance: 0,
        status: "active",
      });

      // Fetch the created account
    //   const account = await db.select().from(accounts).where(eq(accounts.accountNumber, accountNumber!)).get();

    //   return (
    //     account || {
    //       id: 0,
    //       userId: ctx.user.id,
    //       accountNumber: accountNumber!,
    //       accountType: input.accountType,
    //       balance: 100,
    //       status: "pending",
    //       createdAt: new Date().toISOString(),
    //     }
    //   );
    // }),
    
    // Fetch the created account
    const account = await db
      .select()
      .from(accounts)
      .where(eq(accounts.accountNumber, accountNumber!))
      .get();

    // If we couldn't read back the account we just inserted, treat as a failure
    if (!account) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create account",
      });
    }

    return account;
  }),



  getAccounts: protectedProcedure.query(async ({ ctx }) => {
    const userAccounts = await db.select().from(accounts).where(eq(accounts.userId, ctx.user.id));

    return userAccounts;
  }),

  fundAccount: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        amount: z.number().positive(),
        fundingSource: z.object({
          type: z.enum(["card", "bank"]),
          accountNumber: z.string(),
          routingNumber: z.string().optional(),
        })
        .superRefine((val, ctx) => {
          if (val.type === "card") {
            const digits = val.accountNumber.replace(/\D/g, "");

            if (digits.length < 13 || digits.length > 19) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["accountNumber"],
                message: "Card number is not the right amount of digits.",
              });
              return;
            }
            if (!isValidCardNumber(digits)) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["accountNumber"],
                message: "Invalid card number",
              });
            }
          }
           if (val.type === "bank") {
            if (!val.routingNumber) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["routingNumber"],
                message: "Routing number is required for bank transfers",
              });
              return;
            }

            const routingDigits = val.routingNumber.replace(/\D/g, "");

            if (!/^\d{9}$/.test(routingDigits)) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["routingNumber"],
                message: "Routing number must be 9 digits",
              });
            }
          }
        }),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const amount = parseFloat(input.amount.toString());

      // Verify account belongs to user
      const account = await db
        .select()
        .from(accounts)
        .where(and(eq(accounts.id, input.accountId), eq(accounts.userId, ctx.user.id)))
        .get();

      if (!account) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Account not found",
        });
      }

      if (account.status !== "active") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Account is not active",
        });
      }

      // Create transaction
      await db.insert(transactions).values({
        accountId: input.accountId,
        type: "deposit",
        amount,
        description: `Funding from ${input.fundingSource.type}`,
        status: "completed",
        processedAt: new Date().toISOString(),
      });

      // Fetch the most recent transaction for this account
      const transaction = await db
        .select()
        .from(transactions)
        .where(eq(transactions.accountId, input.accountId))
        .orderBy(desc(transactions.createdAt))
        .limit(1)
        .get();


      // Update account balance
      await db
        .update(accounts)
        .set({
          balance: account.balance + amount,
        })
        .where(eq(accounts.id, input.accountId));

      // Read back the updated balance so the API response matches the DB
      const updatedAccount = await db
        .select()
        .from(accounts)
        .where(eq(accounts.id, input.accountId))
        .get();

      if (!updatedAccount) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update account balance",
        });
      }

      return {
        transaction,
        newBalance: updatedAccount.balance,
      };

      // let finalBalance = account.balance;
      // for (let i = 0; i < 100; i++) {
      //   finalBalance = finalBalance + amount / 100;
      // }

      // return {
      //   transaction,
      //   newBalance: finalBalance, // This will be slightly off due to float precision
      // };
    }),

  getTransactions: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
      })
    )
    .query(async ({ input, ctx }) => {
      // Verify account belongs to user
      const account = await db
        .select()
        .from(accounts)
        .where(and(eq(accounts.id, input.accountId), eq(accounts.userId, ctx.user.id)))
        .get();

      if (!account) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Account not found",
        });
      }

      const accountTransactions = await db
        .select()
        .from(transactions)
        .where(eq(transactions.accountId, input.accountId))
        .orderBy(desc(transactions.createdAt));


      // const enrichedTransactions = [];
      // for (const transaction of accountTransactions) {
      //   const accountDetails = await db.select().from(accounts).where(eq(accounts.id, transaction.accountId)).get();

      //   enrichedTransactions.push({
      //     ...transaction,
      //     accountType: accountDetails?.accountType,
      //   });
      // }

        const enrichedTransactions = accountTransactions.map((transaction) => ({
      ...transaction,
      accountType: account.accountType,
    }));

      return enrichedTransactions;
    }),
});
