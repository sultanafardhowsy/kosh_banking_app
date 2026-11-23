import { BankTransactions } from "@/components/manage/BankTransactions";

export const metadata = { title: "Transactions" };

export default function Page() {
  return <BankTransactions scope="staff" />;
}
