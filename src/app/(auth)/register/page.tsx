import { RegisterForm } from "./RegisterForm";
import { googleEnabled } from "@/server/auth/auth";

export const metadata = { title: "Open an account" };

export default function RegisterPage() {
  return <RegisterForm google={googleEnabled()} />;
}
