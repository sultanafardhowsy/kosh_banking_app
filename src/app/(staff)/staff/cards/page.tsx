import { CardQueue } from "@/components/review/CardQueue";

export const metadata = { title: "Cards" };

export default function Page() {
  return <CardQueue scope="staff" />;
}
