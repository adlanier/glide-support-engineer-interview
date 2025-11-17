import { isValidCardNumber, detectCardType } from "../FundingModal";

describe("card validation helpers", () => {
  describe("isValidCardNumber (Luhn + length)", () => {
    it("accepts a valid Visa number", () => {
      expect(isValidCardNumber("4111 1111 1111 1111")).toBe(true);
    });

    it("accepts a valid Mastercard number", () => {
      expect(isValidCardNumber("5555-5555-5555-4444")).toBe(true);
    });

    it("accepts a valid American Express number (15 digits)", () => {
      expect(isValidCardNumber("378282246310005")).toBe(true);
    });

    it("accepts a valid Discover number", () => {
      expect(isValidCardNumber("6011111111111117")).toBe(true);
    });

    it("rejects numbers that are too short", () => {
      expect(isValidCardNumber("4111111")).toBe(false);
    });

    it("rejects numbers that are too long", () => {
      expect(isValidCardNumber("41111111111111111111")).toBe(false);
    });

    it("rejects clearly invalid numbers that fail Luhn", () => {
      // tweak the last digit of a valid card number to break Luhn
      expect(isValidCardNumber("4111111111111112")).toBe(false);
    });
  });

  describe("detectCardType", () => {
    it("detects Visa", () => {
      expect(detectCardType("4111 1111 1111 1111")).toBe("visa");
    });

    it("detects Mastercard", () => {
      expect(detectCardType("5555-5555-5555-4444")).toBe("mastercard");
    });

    it("detects American Express", () => {
      expect(detectCardType("378282246310005")).toBe("amex");
    });

    it("detects Discover", () => {
      expect(detectCardType("6011111111111117")).toBe("discover");
    });

    it("returns null for unsupported but numeric card ranges", () => {
      // Luhn-valid but not in our BIN ranges
      expect(detectCardType("1234567812345670")).toBeNull();
    });

    it("returns null for non-numeric / invalid input", () => {
      expect(detectCardType("abcd-efgh")).toBeNull();
    });
  });
});
