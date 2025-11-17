import { z } from "zod";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { TRPCError } from "@trpc/server";
import { publicProcedure, router } from "../trpc";
import { db } from "@/lib/db";
import { users, sessions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const commonPasswords = [
  "password1!",
  "password123!",
  "qwerty123!",
  "welcome123!",
  "admin123!",
];

export const emailSchema = z
  .string()
  .trim()
  .email("Invalid email address")
  .transform((val) => val.toLowerCase())
  .refine(
    (email) => !email.endsWith(".con"),
    {
      message: "Email domain looks incorrect. Did you mean '.com'?",
    }
  );

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters long")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/\d/, "Password must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character")
  .refine((value) => !commonPasswords.includes(value.toLowerCase()), {
    message: "Password is too common",
  });

export const dateOfBirthSchema = z.string().refine((value) => {
  const [yearStr, monthStr, dayStr] = value.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  if (!year || !month || !day) {
    return false;
  }

  const dob = new Date(year, month - 1, day);
  const today = new Date();

  dob.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  // Ensure date is valid
  if (
    dob.getFullYear() !== year ||
    dob.getMonth() !== month - 1 ||
    dob.getDate() !== day
  ) {
    return false;
  }

  if (dob > today) {
    return false;
  }

  let age = today.getFullYear() - year;
  if (
    today.getMonth() < dob.getMonth() ||
    (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())
  ) {
    age--;
  }

  return age >= 18;
}, {
  message: "You must be at least 18 years old and date of birth cannot be in the future",
});

export const authRouter = router({
  signup: publicProcedure
    .input(
      z.object({
        email: emailSchema,
        password: passwordSchema,
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        phoneNumber: z.string().regex(/^[2-9]\d{2}[2-9]\d{2}\d{4}$/, "Phone number must follow NXX-NXX-XXXX format"),
        dateOfBirth: dateOfBirthSchema,
        ssn: z.string().regex(/^\d{9}$/),
        address: z.string().min(1),
        city: z.string().min(1),
        state: z.string().length(2).toUpperCase(),
        zipCode: z.string().regex(/^\d{5}$/),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const existingUser = await db.select().from(users).where(eq(users.email, input.email)).get();

      if (existingUser) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "User already exists",
        });
      }

      // const hashedPassword = await bcrypt.hash(input.password, 10);

      // await db.insert(users).values({
      //   ...input,
      //   password: hashedPassword,
      // });

      // Destructure to avoid spreading raw SSN or raw password
      const { password, ssn, ...rest } = input;

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Hash SSN
      const hashedSSN = await bcrypt.hash(ssn, 10);

      const [user] = await db
        .insert(users)
        .values({
          ...rest,
          password: hashedPassword,
          ssn: hashedSSN, // Never store raw SSN
        })
        .returning();

      // Fetch the created user
      // const user = await db.select().from(users).where(eq(users.email, input.email)).get();

      if (!user) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create user",
        });
      }

      // Create session
      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || "temporary-secret-for-interview", {
        expiresIn: "7d",
      });

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await db.insert(sessions).values({
        userId: user.id,
        token,
        expiresAt: expiresAt.toISOString(),
      });

      // Set cookie
      if ("setHeader" in ctx.res) {
        ctx.res.setHeader("Set-Cookie", `session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800`);
      } else {
        (ctx.res as Headers).set("Set-Cookie", `session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800`);
      }

      // return { user: { ...user, password: undefined }, token };
      const { password: _pw, ssn: _ssn, ...safeUser } = user;
      return { user: safeUser, token };

    }),

  login: publicProcedure
    .input(
      z.object({
        email: emailSchema,
        password: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const user = await db.select().from(users).where(eq(users.email, input.email)).get();

      if (!user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid credentials",
        });
      }

      const validPassword = await bcrypt.compare(input.password, user.password);

      if (!validPassword) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid credentials",
        });
      }

      await db.delete(sessions).where(eq(sessions.userId, user.id));

      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || "temporary-secret-for-interview", {
        expiresIn: "7d",
      });

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await db.insert(sessions).values({
        userId: user.id,
        token,
        expiresAt: expiresAt.toISOString(),
      });

      if ("setHeader" in ctx.res) {
        ctx.res.setHeader("Set-Cookie", `session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800`);
      } else {
        (ctx.res as Headers).set("Set-Cookie", `session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800`);
      }

      // return { user: { ...user, password: undefined }, token };
      const { password: _pw, ssn: _ssn, ...safeUser } = user;
      return { user: safeUser, token };

    }),

  logout: publicProcedure.mutation(async ({ ctx }) => {
    
      // Delete session from database
      let token: string | undefined;
      if ("cookies" in ctx.req) {
        token = (ctx.req as any).cookies.session;
      } else {
        const cookieHeader = ctx.req.headers.get?.("cookie") || (ctx.req.headers as any).cookie;
        token = cookieHeader
          ?.split("; ")
          .find((c: string) => c.startsWith("session="))
          ?.split("=")[1];
      }

      if (token) {
        await db.delete(sessions).where(eq(sessions.token, token));
      }

      // if (ctx.user) {
      //   await db.delete(sessions).where(eq(sessions.userId, ctx.user.id));
      // }

       // Clear the cookie regardless
    const cookieHeaderValue = "session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0";

     if ("setHeader" in ctx.res) {
      ctx.res.setHeader("Set-Cookie", cookieHeaderValue);
    } else {
      (ctx.res as Headers).set("Set-Cookie", cookieHeaderValue);
    }

    
    // if ("setHeader" in ctx.res) {
    //   ctx.res.setHeader("Set-Cookie", `session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`);
    // } else {
    //   (ctx.res as Headers).set("Set-Cookie", `session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`);
    // }

    // return { success: true, message: ctx.user ? "Logged out successfully" : "No active session" };
    return {
      success: !!token,
      message: token ? "Logged out successfully" : "No active session",
    };
  }),
});
