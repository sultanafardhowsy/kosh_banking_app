import { AccountsList } from "@/components/manage/AccountsList";

export const metadata = { title: "Accounts" };

export default function Page() {
  return <AccountsList scope="staff" />;
}
