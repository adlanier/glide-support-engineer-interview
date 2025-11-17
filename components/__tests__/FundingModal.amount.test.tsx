import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FundingModal } from "@/components/FundingModal"; 

const mutateAsync = jest.fn();

jest.mock("@/lib/trpc/client", () => ({
  trpc: {
    account: {
      fundAccount: {
        useMutation: () => ({
          mutateAsync,
          isPending: false,
        }),
      },
    },
  },
}));

describe("VAL-205: FundingModal amount validation", () => {
  const defaultProps = {
    accountId: 1,
    onClose: jest.fn(),
    onSuccess: jest.fn(),
  };

  beforeEach(() => {
    mutateAsync.mockReset();
  });

  it("shows an error and does not submit when amount is zero", async () => {
    const user = userEvent.setup();

    render(<FundingModal {...defaultProps} />);

    await user.type(screen.getByLabelText(/amount/i), "0.00");
    await user.type(screen.getByLabelText(/card number/i), "4111111111111111");

    await user.click(screen.getByRole("button", { name: /fund account/i }));

    expect(
      await screen.findByText(/amount must be greater than \$0\.00/i)
    ).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("calls the mutation for a valid positive amount", async () => {
    const user = userEvent.setup();

    render(<FundingModal {...defaultProps} />);

    await user.type(screen.getByLabelText(/amount/i), "100");
    await user.type(screen.getByLabelText(/card number/i), "4111111111111111");

    await user.click(screen.getByRole("button", { name: /fund account/i }));

    expect(mutateAsync).toHaveBeenCalledTimes(1);
    expect(mutateAsync).toHaveBeenCalledWith({
      accountId: 1,
      amount: 100,
      fundingSource: {
        type: "card",
        accountNumber: "4111111111111111",
        routingNumber: undefined,
      },
    });
  });
});
