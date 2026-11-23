"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/format";
import { isActive, NAV } from "./nav";
import type { Role } from "@/types/api";

/** Nav list shared by the desktop sidebar and the mobile drawer. */
export function SidebarNav({
  role,
  collapsed = false,
  onNavigate,
}: {
  role: Role;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className="flex flex-col gap-6">
      {NAV[role].map((section, i) => (
        <div key={i} className="flex flex-col gap-1">
          {section.title && !collapsed && (
            <p className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wider text-kosh-muted">
              {section.title}
            </p>
          )}
          {section.items.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                title={collapsed ? item.label : undefined}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  collapsed && "justify-center px-0",
                  active
                    ? "bg-kosh-navy text-kosh-navy-fg"
                    : "text-kosh-muted hover:bg-kosh-subtle hover:text-kosh-text",
                )}
              >
                <Icon className={cn("size-[18px] shrink-0", active && "text-kosh-accent-soft")} />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
