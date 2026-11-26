"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@heroui/react";
import { FormError, authErrorMessage } from "@/components/ui/FormError";
import { signUp } from "@/lib/auth-client";
import { registerSchema, type RegisterInput } from "@/lib/validators/auth";
import { FormTextField } from "@/components/ui/FormTextField";
import { GoogleButton, OrDivider } from "@/components/brand/GoogleButton";

/**
 * Self sign-up always creates a CUSTOMER (role is server-controlled).
 * The profile starts unverified; staff verify KYC and open bank accounts.
 */
export function RegisterForm({ google = false }: { google?: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  });

  async function onSubmit(v: RegisterInput) {
    setError(null);
    const { error } = await signUp.email({ name: v.name, email: v.email, password: v.password });
    if (error) {
      setError(
        error.code === "USER_ALREADY_EXISTS" || error.status === 422
          ? "An account with this email already exists."
          : authErrorMessage(error, "Couldn't create your account. Please try again.", {
              PASSWORD_TOO_SHORT: "Use a password of at least 8 characters.",
              INVALID_EMAIL: "Enter a valid email address.",
            }),
      );
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold">Open an account</h1>
      <p className="mt-2 text-sm text-kosh-muted">
        Create your login. A Kosh staff member verifies your details and opens your first account.
      </p>

      {error && (
        <FormError className="mt-6" title="Couldn't create your account" message={error} />
      )}

      {google && (
        <div className="mt-6">
          <GoogleButton label="Sign up with Google" />
          <OrDivider />
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className={google ? "space-y-4" : "mt-6 space-y-4"} noValidate>
        <FormTextField control={control} name="name" label="Full name" autoComplete="name" />
        <FormTextField control={control} name="email" label="Email" type="email" autoComplete="email" />
        <FormTextField
          control={control}
          name="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          description="At least 8 characters, with a letter and a number."
        />
        <FormTextField control={control} name="confirmPassword" label="Confirm password" type="password" autoComplete="new-password" />
        <Button type="submit" fullWidth size="lg" isPending={formState.isSubmitting}>
          Create account
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-kosh-muted">
        Already with Kosh?{" "}
        <Link href="/login" className="font-medium text-kosh-info hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
