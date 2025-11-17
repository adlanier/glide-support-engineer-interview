import { fundAccountInputSchema } from "../account";

describe("VAL-207: Routing Number Validation", () => {
  test("rejects bank transfer with missing routing number", () => {
    const result = fundAccountInputSchema.safeParse({
      accountId: 1,
      amount: 50,
      fundingSource: {
        type: "bank",
        accountNumber: "12345678",
        // routingNumber missing
      },
    });
    if (result.success) {
      throw new Error("Expected validation to fail, but it succeeded");
    }

    expect(result.error.issues[0].message).toMatch("Routing number is required");
  });

  test("rejects routing number shorter than 9 digits", () => {
    const result = fundAccountInputSchema.safeParse({
      accountId: 1,
      amount: 50,
      fundingSource: {
        type: "bank",
        accountNumber: "12345678",
        routingNumber: "12345",
      },
    });

    if (result.success) {
      throw new Error("Expected validation to fail, but it succeeded");
    }

    expect(result.error.issues[0].message).toMatch(
      "Routing number must be 9 digits"
    );
  });

  test("accepts valid 9-digit routing number", () => {
    const result = fundAccountInputSchema.safeParse({
      accountId: 1,
      amount: 50,
      fundingSource: {
        type: "bank",
        accountNumber: "12345678",
        routingNumber: "123456789",
      },
    });

    expect(result.success).toBe(true);
  });
});

describe("VAL-206: Card Number Validation", () => {
  test("rejects card number with wrong length", () => {
    const result = fundAccountInputSchema.safeParse({
      accountId: 1,
      amount: 50,
      fundingSource: {
        type: "card",
        accountNumber: "1234abcd5678zzzz", // bad length + non-digits
      },
    });

    if (result.success) {
      throw new Error("Expected validation to fail, but it succeeded");
    }

    expect(result.error.issues[0].message).toMatch(
      "Card number is not the right amount of digits."
    );
  });

  test("rejects card number that fails Luhn but has valid length", () => {
    const result = fundAccountInputSchema.safeParse({
      accountId: 1,
      amount: 50,
      fundingSource: {
        type: "card",
        // 16 digits, but tweak last digit to break Luhn
        accountNumber: "4111111111111112",
      },
    });

    if (result.success) {
      throw new Error("Expected validation to fail, but it succeeded");
    }

    expect(result.error.issues[0].message).toMatch("Invalid card number");
  });

  test("accepts valid card number", () => {
    // Valid Luhn card: 4111111111111111
    const result = fundAccountInputSchema.safeParse({
      accountId: 1,
      amount: 50,
      fundingSource: {
        type: "card",
        accountNumber: "4111111111111111",
      },
    });

    expect(result.success).toBe(true);
  });
});
