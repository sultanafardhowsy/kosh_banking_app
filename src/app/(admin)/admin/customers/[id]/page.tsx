import { CustomerProfile } from "@/components/manage/CustomerProfile";

export const metadata = { title: "Customer" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CustomerProfile id={id} scope="admin" />;
}
