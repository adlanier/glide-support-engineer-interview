// server/routers/__tests__/account.generateAccountNumber.test.ts

import { generateAccountNumber } from "../account";

describe("SEC-302: generateAccountNumber", () => {
  it("returns a 10-digit numeric string", () => {
    const accountNumber = generateAccountNumber();

    expect(accountNumber).toMatch(/^\d{10}$/);
  });

  it("produces multiple distinct values across calls", () => {
    const values = new Set<string>();

    for (let i = 0; i < 50; i++) {
      values.add(generateAccountNumber());
    }

    // With a secure RNG this should not all collide
    expect(values.size).toBeGreaterThan(1);
  });
});
