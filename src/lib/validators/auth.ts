import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("Enter a valid email").trim().toLowerCase(),
  password: z.string().min(1, "Password is required"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Enter your full name").max(80),
    email: z.email("Enter a valid email").trim().toLowerCase(),
    password: z
      .string()
      .min(8, "At least 8 characters")
      .regex(/[A-Za-z]/, "Include a letter")
      .regex(/\d/, "Include a number"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords don't match",
  });
export type RegisterInput = z.infer<typeof registerSchema>;

/** 4-digit transaction PIN. */
export const pinSchema = z.string().regex(/^\d{4}$/, "PIN must be 4 digits");
