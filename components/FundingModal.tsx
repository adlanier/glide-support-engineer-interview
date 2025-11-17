"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { trpc } from "@/lib/trpc/client";

function isValidCardNumber(cardNumber: string): boolean {
  const digits = cardNumber.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;

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


interface FundingModalProps {
  accountId: number;
  onClose: () => void;
  onSuccess: () => void;
}

type FundingFormData = {
  amount: string;
  fundingType: "card" | "bank";
  accountNumber: string;
  routingNumber?: string;
};

type CardType = "visa" | "mastercard" | "amex" | "discover";

function detectCardType(cardNumber: string): CardType | null {
  const sanitized = cardNumber.replace(/[\s-]/g, "");

  // Must be all digits and between 13–19 digits (typical card lengths)
  if (!/^\d{13,19}$/.test(sanitized)) {
    return null;
  }

  // Visa: 4xxx, length 13/16/19
  if (/^4\d{12}(\d{3})?(\d{3})?$/.test(sanitized)) {
    return "visa";
  }

  // Mastercard (51–55 or 2221–2720)
if (
  /^5[1-5]\d{14}$/.test(sanitized) ||
  /^(2221|222[2-9]|22[3-9]\d|2[3-6]\d{2}|27[01]\d|2720)\d{12}$/.test(sanitized)
) {
  return "mastercard";
}

  // American Express: 34 or 37, length 15
  if (/^3[47]\d{13}$/.test(sanitized)) {
    return "amex";
  }

  // Discover: 6011, 65, 644–649, length 16
  if (/^6(?:011|5\d{2}|4[4-9]\d)\d{12}$/.test(sanitized)) {
    return "discover";
  }

  return null;
}


export function FundingModal({ accountId, onClose, onSuccess }: FundingModalProps) {
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FundingFormData>({
    defaultValues: {
      fundingType: "card",
    },
  });

  const fundingType = watch("fundingType");
  const fundAccountMutation = trpc.account.fundAccount.useMutation();

  const onSubmit = async (data: FundingFormData) => {
    setError("");

    try {
      const amount = parseFloat(data.amount);

      if (!Number.isFinite(amount) || amount <= 0) {
        setError("Amount must be greater than $0.00");
        return;
      }

      await fundAccountMutation.mutateAsync({
        accountId,
        amount,
        fundingSource: {
          type: data.fundingType,
          accountNumber: data.accountNumber,
          routingNumber: data.routingNumber,
        },
      });

      onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to fund account");
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4">
      <div className="bg-background rounded-lg max-w-md w-full p-6">
        <h3 className="text-lg font-medium text-foreground mb-4">Fund Your Account</h3>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label  htmlFor="amount" className="block text-sm font-medium text-foreground">Amount</label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-gray-500 sm:text-sm">$</span>
              </div>
              <input
                id="amount"
                {...register("amount", {
                  required: "Amount is required",
                  pattern: {
                    value: /^(0|[1-9]\d*)(\.\d{1,2})?$/,
                    message: "Invalid amount format",
                  },
                   validate: {
                    greaterThanZero: (value) =>
                      parseFloat(value) > 0 || "Amount must be greater than $0.00",
                  },
                })}
                type="text"
                className="pl-7 block w-full rounded-md border-gray-300 focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-2 border"
                placeholder="0.00"
              />
            </div>
            {errors.amount && <p className="mt-1 text-sm text-red-600">{errors.amount.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Funding Source</label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input {...register("fundingType")} type="radio" value="card" className="mr-2" />
                <span>Credit/Debit Card</span>
              </label>
              <label className="flex items-center">
                <input {...register("fundingType")} type="radio" value="bank" className="mr-2" />
                <span>Bank Account</span>
              </label>
            </div>
          </div>

          <div>
            <label htmlFor="accountNumber" className="block text-sm font-medium text-foreground">
              {fundingType === "card" ? "Card Number" : "Account Number"}
            </label>

            {/* <input
              {...register("accountNumber", {
                required: `${fundingType === "card" ? "Card" : "Account"} number is required`,

                pattern: {
                  value: fundingType === "card" ? /^\d{16}$/ : /^\d+$/,
                  message: fundingType === "card" ? "Card number must be 16 digits" : "Invalid account number",
                },
                validate: {
                  validCard: (value) => {
                    if (fundingType !== "card") return true;
                    return value.startsWith("4") || value.startsWith("5") || "Invalid card number";
                  },
                },

              })}
              type="text"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
              placeholder={fundingType === "card" ? "1234567812345678" : "123456789"}
            /> */}

            <input
            id="accountNumber"
            {...register("accountNumber", {
              required: `${fundingType === "card" ? "Card" : "Account"} number is required`,
              validate: (value) => {
                if (fundingType !== "card") {
                  // Bank account: just require digits
                  return /^\d+$/.test(value) || "Invalid account number";
                }

                const digits = value.replace(/\D/g, "");

                if (digits.length < 13 || digits.length > 19) {
                  return "Card number is not the right amount of digits.";
                }

                const cardType = detectCardType(value);

                if (!cardType) {
                  return "Unsupported card type. Please use a valid Visa, Mastercard, AmEx, or Discover card number.";
                }

                if (!isValidCardNumber(digits)) {
                  return "Invalid card number";
                }

                return true;
              },
            })}
            type="text"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
            placeholder={fundingType === "card" ? "1234567812345678" : "123456789"}
          />


            {errors.accountNumber && <p className="mt-1 text-sm text-red-600">{errors.accountNumber.message}</p>}
          </div>

          {fundingType === "bank" && (
            <div>
              <label className="block text-sm font-medium text-foreground">Routing Number</label>
              <input
                {...register("routingNumber", {
                  required: "Routing number is required",
                  pattern: {
                    value: /^\d{9}$/,
                    message: "Routing number must be 9 digits",
                  },
                })}
                type="text"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                placeholder="123456789"
              />
              {errors.routingNumber && <p className="mt-1 text-sm text-red-600">{errors.routingNumber.message}</p>}
            </div>
          )}

          {error && <div className="text-sm text-red-600">{error}</div>}

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-foreground bg-background border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={fundAccountMutation.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {fundAccountMutation.isPending ? "Processing..." : "Fund Account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export { isValidCardNumber, detectCardType };

