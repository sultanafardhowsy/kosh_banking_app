import { RoleLayout } from "@/components/layout/RoleLayout";

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return <RoleLayout roles={["STAFF"]}>{children}</RoleLayout>;
}
