import { CustomersList } from "@/components/manage/CustomersList";

export const metadata = { title: "Customers" };

export default function Page() {
  return <CustomersList scope="staff" />;
}
