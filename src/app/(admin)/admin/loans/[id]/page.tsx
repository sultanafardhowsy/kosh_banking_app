import { LoanReview } from "@/components/review/LoanReview";

export const metadata = { title: "Loan review" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LoanReview id={id} scope="admin" />;
}
