import { dateOfBirthSchema } from "../auth";

describe("dateOfBirthSchema (VAL-202)", () => {
  // Fix "today" so tests are stable.
  // Let's pretend today is 2025-11-16.
  const FIXED_TODAY = new Date("2025-11-16T00:00:00");

  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(FIXED_TODAY);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  const pass = (value: string) => dateOfBirthSchema.safeParse(value);
  const fail = (value: string) => dateOfBirthSchema.safeParse(value);

  it("accepts a clearly adult DOB (over 18)", () => {
    const result = pass("1990-05-10");
    expect(result.success).toBe(true);
  });

  it("accepts exactly 18 years old on today's date", () => {
    // Today is fixed to 2025-11-16, so 2007-11-16 is exactly 18
    const result = pass("2007-11-16");
    expect(result.success).toBe(true);
  });

  it("rejects someone who turns 18 tomorrow (off-by-one check)", () => {
    // Still under 18 on 2025-11-16
    const result = fail("2007-11-17");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain("18");
    }
  });

  it("rejects a future date of birth", () => {
    const result = fail("2027-01-01");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain("future");
    }
  });

  it("rejects an invalid date string", () => {
    const result = fail("banana");
    expect(result.success).toBe(false);
  });

  it("rejects impossible dates (e.g., 2025-13-40)", () => {
    const result = fail("2025-13-40");
    expect(result.success).toBe(false);
  });
});
