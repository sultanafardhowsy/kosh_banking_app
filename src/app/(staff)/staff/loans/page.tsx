import { LoanQueue } from "@/components/review/LoanQueue";

export const metadata = { title: "Loans" };

export default function Page() {
  return <LoanQueue scope="staff" />;
}
