import {
  ArrowLeftRight,
  Banknote,
  Bell,
  CreditCard,

  Flag,
  HandCoins,
  Home,
  Landmark,
  LayoutDashboard,
  Mail,
  ListChecks,
  ReceiptText,
  ScrollText,
  Settings,
  UserRound,
  Users,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/types/api";

export type NavItem = { label: string; href: string; icon: LucideIcon };
export type NavSection = { title?: string; items: NavItem[] };

export const NAV: Record<Role, NavSection[]> = {
  CUSTOMER: [
    {
      items: [
        { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { label: "Accounts", href: "/accounts", icon: WalletCards },
        { label: "Transfer", href: "/transfer", icon: ArrowLeftRight },
        { label: "Transactions", href: "/transactions", icon: ReceiptText },
      ],
    },
    {
      title: "Services",
      items: [
        { label: "Deposit & withdraw", href: "/requests", icon: Banknote },
        { label: "Loans", href: "/loans", icon: HandCoins },
        { label: "Cards", href: "/cards", icon: CreditCard },
      ],
    },
    {
      title: "You",
      items: [
        { label: "Notifications", href: "/notifications", icon: Bell },
        { label: "Profile & PIN", href: "/profile", icon: UserRound },
      ],
    },
  ],
  STAFF: [
    {
      items: [
        { label: "Overview", href: "/staff/overview", icon: LayoutDashboard },
        { label: "Customers", href: "/staff/customers", icon: Users },
        { label: "Accounts", href: "/staff/accounts", icon: Landmark },
        { label: "Transactions", href: "/staff/transactions", icon: ReceiptText },
      ],
    },
    {
      title: "Review queues",
      items: [
        { label: "Requests", href: "/staff/requests", icon: ListChecks },
        { label: "Loans", href: "/staff/loans", icon: HandCoins },
        { label: "Card requests", href: "/staff/cards", icon: CreditCard },
      ],
    },
    { title: "You", items: [{ label: "Notifications", href: "/staff/notifications", icon: Bell }] },
  ],
  ADMIN: [
    {
      items: [
        { label: "Overview", href: "/admin/overview", icon: LayoutDashboard },
        { label: "Customers", href: "/admin/customers", icon: Users },
        { label: "Accounts", href: "/admin/accounts", icon: Landmark },
        { label: "Transactions", href: "/admin/transactions", icon: ReceiptText },
        { label: "Flagged", href: "/admin/flagged", icon: Flag },
      ],
    },
    {
      title: "Operations",
      items: [
        { label: "Loans", href: "/admin/loans", icon: HandCoins },
        { label: "Requests", href: "/admin/requests", icon: ListChecks },
        { label: "Cards", href: "/admin/cards", icon: CreditCard },
      ],
    },
    {
      title: "System",
      items: [
        { label: "Bank settings", href: "/admin/settings", icon: Settings },
        { label: "Audit log", href: "/admin/audit", icon: ScrollText },
        { label: "Email log", href: "/admin/emails", icon: Mail },
        { label: "Notifications", href: "/admin/notifications", icon: Bell },
      ],
    },
  ],
};

/** Customer bottom tab bar (mobile). "More" opens the drawer. */
export const CUSTOMER_TABS: NavItem[] = [
  { label: "Home", href: "/dashboard", icon: Home },
  { label: "Transfer", href: "/transfer", icon: ArrowLeftRight },
  { label: "Cards", href: "/cards", icon: CreditCard },
  { label: "Loans", href: "/loans", icon: HandCoins },
];

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Administrator",
  STAFF: "Bank staff",
  CUSTOMER: "Personal banking",
};

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Title for the topbar, from the deepest matching nav item. */
export function titleFor(role: Role, pathname: string) {
  const items = NAV[role].flatMap((s) => s.items);
  const match = items
    .filter((i) => isActive(pathname, i.href))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return match?.label ?? "Kosh";
}

