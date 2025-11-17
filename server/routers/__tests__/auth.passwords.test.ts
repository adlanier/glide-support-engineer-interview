import { passwordSchema } from "../auth";

describe("VAL-208: passwordSchema", () => {
  it("accepts a strong, valid password", () => {
    const result = passwordSchema.safeParse("StrongPass1!");
    expect(result.success).toBe(true);
  });

  it.each([
    "Aa1!aaaa",        // exactly 8 chars, minimum boundary
    "Zz9$xxxx",        // another 8-char strong password
    "SuperSafePass9@", // longer, typical strong password
    "BankUser2025$",   // realistic-looking strong password
  ])("accepts multiple strong passwords: %s", (pw) => {
    const result = passwordSchema.safeParse(pw);
    expect(result.success).toBe(true);
  });

  it("rejects passwords shorter than 8 characters", () => {
    const result = passwordSchema.safeParse("Aa1!");
    expect(result.success).toBe(false);

    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain("Password must be at least 8 characters long");
    }
  });

  it("requires at least one uppercase letter", () => {
    const result = passwordSchema.safeParse("weakpass1!");
    expect(result.success).toBe(false);

    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain("Password must contain at least one uppercase letter");
    }
  });

  it("requires at least one lowercase letter", () => {
    const result = passwordSchema.safeParse("WEAKPASS1!");
    expect(result.success).toBe(false);

    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain("Password must contain at least one lowercase letter");
    }
  });

  it("requires at least one number", () => {
    const result = passwordSchema.safeParse("NoNumber!");
    expect(result.success).toBe(false);

    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain("Password must contain at least one number");
    }
  });

  it("requires at least one special character", () => {
    const result = passwordSchema.safeParse("NoSpecial1");
    expect(result.success).toBe(false);

    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toBeDefined();
      expect(messages).toContain("Password must contain at least one special character");
    }
  });

  it("can surface multiple validation errors at once", () => {
    // Missing: uppercase, number, special
    const result = passwordSchema.safeParse("weakpass");

    expect(result.success).toBe(false);

    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain("Password must contain at least one uppercase letter");
      expect(messages).toContain("Password must contain at least one number");
      expect(messages).toContain("Password must contain at least one special character");
    }
  });

  it("rejects common but complex passwords like 'Password123!'", () => {
    const result = passwordSchema.safeParse("Password123!");
    expect(result.success).toBe(false);

    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain("Password is too common");
    }
  });

    it.each([
    "password1!",   // lowercased variants in the denylist
    "password123!",
    "qwerty123!",
    "welcome123!",
    "admin123!",
  ])("rejects any password in our common-password denylist: %s", (pw) => {
    const result = passwordSchema.safeParse(pw);
    expect(result.success).toBe(false);
  });
});
