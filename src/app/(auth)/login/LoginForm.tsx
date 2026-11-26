"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@heroui/react";
import { FormError, authErrorMessage } from "@/components/ui/FormError";
import { Eye, EyeOff } from "lucide-react";
import { signIn } from "@/lib/auth-client";
import { loginSchema, type LoginInput } from "@/lib/validators/auth";
import { FormTextField } from "@/components/ui/FormTextField";
import { DEMO_PASSWORD, DEMO_USERS } from "@/lib/demo-accounts";
import { ROLE_HOME, type AppRole } from "@/lib/constants";
import { GoogleButton, OrDivider } from "@/components/brand/GoogleButton";

/** Better Auth redirects back with ?error=… when the Google flow fails or the user is blocked. */
function googleErrorMessage(code: string | null, description: string | null) {
  const text = `${code ?? ""} ${description ?? ""}`.toLowerCase();
  if (text.includes("blocked") || text.includes("inactive") || text.includes("user_blocked") || text.includes("forbidden")) return "Your profile is not active. Contact the bank.";
  if (text.includes("account_not_linked") || text.includes("not_linked")) return "An account with this email already exists. Sign in with your password.";
  return "Google sign-in didn't complete. Please try again.";
}

export function LoginForm({ google = false }: { google?: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(
    params.get("blocked")
      ? "Your profile is not active. Contact the bank."
      : params.get("error")
        ? googleErrorMessage(params.get("error"), params.get("error_description"))
        : null,
  );

  const { control, handleSubmit, setValue, formState } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginInput) {
    setError(null);
    const { data, error } = await signIn.email({ email: values.email, password: values.password });
    if (error) {
      setError(
        error.status === 401
          ? "Incorrect email or password."
          : authErrorMessage(error, "Couldn't sign you in. Please try again.", {
              INVALID_EMAIL_OR_PASSWORD: "Incorrect email or password.",
            }),
      );
      return;
    }
    const role = (data?.user as { role?: AppRole } | undefined)?.role ?? "CUSTOMER";
    const next = params.get("next");
    // only follow same-site relative paths
    const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
    router.replace(safeNext ?? ROLE_HOME[role]);
    router.refresh();
  }

  function fillDemo(email: string) {
    setValue("email", email, { shouldValidate: true });
    setValue("password", DEMO_PASSWORD, { shouldValidate: true });
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold">Welcome back</h1>
      <p className="mt-2 text-sm text-kosh-muted">Sign in to your Kosh account.</p>

      {error && (
        <FormError className="mt-6" title="Couldn't sign in" message={error} />
      )}

      {google && (
        <div className="mt-6">
          <GoogleButton />
          <OrDivider />
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className={google ? "space-y-4" : "mt-6 space-y-4"} noValidate>
        <FormTextField control={control} name="email" label="Email" type="email" autoComplete="email" placeholder="you@example.com" />
        <FormTextField
          control={control}
          name="password"
          label="Password"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          endContent={
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onPress={() => setShowPassword((s) => !s)}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </Button>
          }
        />
        <Button type="submit" fullWidth size="lg" isPending={formState.isSubmitting}>
          Sign in
        </Button>
      </form>

      <div className="mt-8 rounded-2xl border border-dashed border-kosh-border p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-kosh-muted">Demo logins</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {DEMO_USERS.map((u) => (
            <Button key={u.email} size="sm" variant="outline" fullWidth onPress={() => fillDemo(u.email)}>
              {u.label}
            </Button>
          ))}
        </div>
        <p className="mt-3 text-xs text-kosh-muted">
          Password for all: <code className="font-mono text-kosh-text">{DEMO_PASSWORD}</code>
        </p>
      </div>

      <p className="mt-6 text-center text-sm text-kosh-muted">
        New to Kosh?{" "}
        <Link href="/register" className="font-medium text-kosh-info hover:underline">
          Open an account
        </Link>
      </p>
    </div>
  );
}
