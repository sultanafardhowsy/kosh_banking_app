"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button, Drawer } from "@heroui/react";
import { Bell, Menu, MoreHorizontal, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/format";
import { Logo } from "@/components/brand/Logo";
import { SimulationNotice } from "@/components/brand/SimulationNotice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectUser } from "@/store/slices/authSlice";
import {
  selectGlobalLoading,
  selectMobileNavOpen,
  selectSidebarCollapsed,
  setMobileNavOpen,
  toggleSidebar,
} from "@/store/slices/uiSlice";
import { CUSTOMER_TABS, isActive, ROLE_LABEL, titleFor } from "./nav";
import { SidebarNav } from "./SidebarNav";
import { ThemeToggle } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";
import { AccountSwitcher } from "./AccountSwitcher";
import { useGetNotificationsQuery } from "@/store/api/notificationsApi";
import type { Role } from "@/types/api";

const HOME: Record<Role, string> = {
  CUSTOMER: "/dashboard",
  STAFF: "/staff/overview",
  ADMIN: "/admin/overview",
};

/**
 * Responsive shell for all three roles.
 * - ≥ lg: collapsible sidebar + topbar
 * - < lg: topbar with drawer; customers also get a bottom tab bar
 */
/** Bell with unread badge; polls every 30 s (RTK Query pollingInterval). */
function NotificationBell({ href }: { href: string }) {
  const { data } = useGetNotificationsQuery({ page: 1 }, { pollingInterval: 30_000 });
  const unread = data?.unread ?? 0;
  return (
    <Link
      href={href}
      aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
      className="relative grid size-9 place-items-center rounded-xl text-kosh-text hover:bg-kosh-subtle"
    >
      <Bell className="size-[18px]" />
      {unread > 0 && (
        <span className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-kosh-accent px-1 text-[10px] font-semibold leading-4 text-kosh-accent-fg">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const user = useAppSelector(selectUser);
  const collapsed = useAppSelector(selectSidebarCollapsed);
  const mobileOpen = useAppSelector(selectMobileNavOpen);
  const busy = useAppSelector(selectGlobalLoading);
  const dispatch = useAppDispatch();
  const pathname = usePathname();

  if (!user) return null;
  const role = user.role;
  const isCustomer = role === "CUSTOMER";

  return (
    <div className="min-h-dvh">
      {/* Global mutation progress bar */}
      <div
        aria-hidden
        className={cn(
          "fixed inset-x-0 top-0 z-50 h-0.5 origin-left bg-kosh-info transition-transform duration-500",
          busy ? "scale-x-100 animate-pulse" : "scale-x-0",
        )}
      />

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-kosh-border bg-kosh-surface transition-[width] duration-200 lg:flex",
          collapsed ? "w-[76px]" : "w-64",
        )}
      >
        <div className={cn("flex h-16 items-center px-5", collapsed && "justify-center px-0")}>
          <Logo href={HOME[role]} compact={collapsed} />
        </div>
        {!collapsed && (
          <p className="mx-5 mb-4 inline-flex w-fit rounded-full bg-kosh-subtle px-2.5 py-1 text-[11px] font-medium text-kosh-muted">
            {ROLE_LABEL[role]}
          </p>
        )}
        <div className="flex-1 overflow-y-auto px-3 pb-4">
          <SidebarNav role={role} collapsed={collapsed} />
        </div>
        <div className={cn("border-t border-kosh-border p-3", collapsed && "flex justify-center")}>
          <Button
            variant="ghost"
            size="sm"
            isIconOnly={collapsed}
            fullWidth={!collapsed}
            onPress={() => dispatch(toggleSidebar())}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(!collapsed && "justify-start text-kosh-muted")}
          >
            {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
            {!collapsed && "Collapse"}
          </Button>
        </div>
      </aside>

      {/* Mobile drawer */}
      <Drawer.Backdrop isOpen={mobileOpen} onOpenChange={(o) => dispatch(setMobileNavOpen(o))}>
        <Drawer.Content placement="left" className="w-[86vw] max-w-xs">
          <Drawer.Dialog aria-label="Navigation" className="h-full">
            <Drawer.Header className="flex flex-row items-center justify-between">
              <Logo href={HOME[role]} />
              <Drawer.CloseTrigger />
            </Drawer.Header>
            <Drawer.Body className="pb-8">
              <SidebarNav role={role} onNavigate={() => dispatch(setMobileNavOpen(false))} />
            </Drawer.Body>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>

      {/* Main column */}
      <div className={cn("flex min-h-dvh flex-col transition-[padding] duration-200", collapsed ? "lg:pl-[76px]" : "lg:pl-64")}>
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-kosh-border bg-kosh-bg/85 px-4 backdrop-blur sm:px-6">
          {!isCustomer && (
            <Button
              isIconOnly
              variant="ghost"
              size="sm"
              className="lg:hidden"
              aria-label="Open navigation"
              onPress={() => dispatch(setMobileNavOpen(true))}
            >
              <Menu className="size-5" />
            </Button>
          )}
          <div className="lg:hidden">
            <Logo href={HOME[role]} compact />
          </div>
          <h1 className="hidden text-lg font-semibold sm:block">{titleFor(role, pathname)}</h1>

          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            {isCustomer && (
              <div className="hidden md:block">
                <AccountSwitcher />
              </div>
            )}
            <ThemeToggle />
            <NotificationBell href={role === "CUSTOMER" ? "/notifications" : `/${role.toLowerCase()}/notifications`} />
            <UserMenu />
          </div>
        </header>

        <main className={cn("mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:py-8", isCustomer && "pb-28 lg:pb-8")}>
          {isCustomer && (
            <div className="mb-4 md:hidden">
              <AccountSwitcher />
            </div>
          )}
          {children}
        </main>

        <footer className={cn("px-6 pb-6", isCustomer && "hidden lg:block")}>
          <SimulationNotice />
        </footer>
      </div>

      {/* Customer bottom tab bar (mobile) */}
      {isCustomer && (
        <nav
          aria-label="Primary"
          className="fixed inset-x-0 bottom-0 z-30 border-t border-kosh-border bg-kosh-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
        >
          <ul className="grid grid-cols-5">
            {CUSTOMER_TABS.map((t) => {
              const active = isActive(pathname, t.href);
              const Icon = t.icon;
              return (
                <li key={t.href}>
                  <Link
                    href={t.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
                      active ? "text-kosh-text" : "text-kosh-muted",
                    )}
                  >
                    <span
                      className={cn(
                        "grid h-7 w-12 place-items-center rounded-full",
                        active && "bg-kosh-accent text-kosh-accent-fg",
                      )}
                    >
                      <Icon className="size-[18px]" />
                    </span>
                    {t.label}
                  </Link>
                </li>
              );
            })}
            <li>
              <button
                type="button"
                onClick={() => dispatch(setMobileNavOpen(true))}
                className="flex w-full flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-kosh-muted"
              >
                <span className="grid h-7 w-12 place-items-center rounded-full">
                  <MoreHorizontal className="size-[18px]" />
                </span>
                More
              </button>
            </li>
          </ul>
        </nav>
      )}
    </div>
  );
}
