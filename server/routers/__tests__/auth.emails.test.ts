import { emailSchema } from "../auth";

describe("VAL-201: emailSchema validation", () => {
  it("accepts a valid email and normalizes to lowercase", () => {
    const result = emailSchema.safeParse("TEST@Example.com");

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data).toBe("test@example.com");
    }
  });

  it("rejects emails with common '.con' typo", () => {
    const result = emailSchema.safeParse("user@example.con");

    expect(result.success).toBe(false);

    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain(
        "Email domain looks incorrect. Did you mean '.com'?"
      );
    }
  });

  it("rejects emails missing a proper TLD", () => {
    const result = emailSchema.safeParse("user@example");

    expect(result.success).toBe(false);

    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain("Invalid email address");
    }
  });

  it("rejects clearly malformed emails", () => {
    const cases = ["plainstring", "user@@example.com", "@example.com", "user@.com"];

    for (const email of cases) {
      const result = emailSchema.safeParse(email);
      expect(result.success).toBe(false);
    }
  });
});
