import { authRouter } from "../auth";
import { db } from "@/lib/db";
import { sessions } from "@/lib/db/schema";

// Mock db.delete so we don't hit a real DB
const whereMock = jest.fn();
jest.mock("@/lib/db", () => ({
  db: {
    delete: jest.fn(() => ({
      where: whereMock,
    })),
  },
}));

describe("authRouter.logout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("deletes only the current session token and clears cookie when session cookie is present", async () => {
    const setHeader = jest.fn();

    const ctx: any = {
      req: {
        cookies: {
          session: "test-token",
        },
      },
      res: {
        setHeader,
      },
      user: { id: 123 }, // present, but should NOT trigger userId-based delete
    };

    const caller = authRouter.createCaller(ctx);
    const result = await caller.logout();

    // db.delete should be called once with sessions table
    expect((db.delete as any).mock.calls[0][0]).toBe(sessions);
    expect(whereMock).toHaveBeenCalledTimes(1);

    // Cookie cleared
    expect(setHeader).toHaveBeenCalledWith(
      "Set-Cookie",
      expect.stringContaining("session=")
    );
    expect(setHeader).toHaveBeenCalledWith(
      "Set-Cookie",
      expect.stringContaining("Max-Age=0")
    );

    // Response reflects presence of token
    expect(result).toEqual({
      success: true,
      message: "Logged out successfully",
    });
  });

  it("handles missing session cookie gracefully", async () => {
    const setHeader = jest.fn();

    const ctx: any = {
      req: {
        cookies: {}, // no session cookie
      },
      res: {
        setHeader,
      },
      user: null,
    };

    const caller = authRouter.createCaller(ctx);
    const result = await caller.logout();

    // db.delete should not be called because there's no token
    expect(db.delete).not.toHaveBeenCalled();

    // Cookie still cleared
    expect(setHeader).toHaveBeenCalledWith(
      "Set-Cookie",
      expect.stringContaining("Max-Age=0")
    );

    expect(result).toEqual({
      success: false,
      message: "No active session",
    });
  });
});
