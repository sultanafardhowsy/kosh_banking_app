import { Suspense } from "react";
import { LoginForm } from "./LoginForm";
import { googleEnabled } from "@/server/auth/auth";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm google={googleEnabled()} />
    </Suspense>
  );
}
