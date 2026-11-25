"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

const LINKS = [
  { label: "Features", href: "#features" },
  { label: "Cards", href: "#cards" },
  { label: "Accounts", href: "#accounts" },
  { label: "Security", href: "#security" },
  { label: "FAQ", href: "/faq" },
  { label: "Contact", href: "/contact" },
] as const;

export function MobileMenu() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative md:hidden">
      <button
        type="button"
        aria-label={open ? "Close navigation menu" : "Open navigation menu"}
        aria-expanded={open}
        aria-controls="mobile-home-menu"
        onClick={() => setOpen((value) => !value)}
        className="grid size-10 place-items-center rounded-xl hover:bg-kosh-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kosh-info"
      >
        {open ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>

      {open && (
        <nav
          id="mobile-home-menu"
          aria-label="Mobile main"
          className="absolute right-0 top-full z-50 mt-2 grid w-64 max-w-[calc(100vw-2rem)] gap-1 rounded-2xl border border-kosh-border bg-kosh-surface p-2 shadow-xl"
        >
          {LINKS.map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className="rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-kosh-subtle"
            >
              {label}
            </Link>
          ))}
          <div className="my-1 border-t border-kosh-border" />
          <Link
            href="/login"
            onClick={() => setOpen(false)}
            className="rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-kosh-subtle"
          >
            Log in
          </Link>
          <Link
            href="/register"
            onClick={() => setOpen(false)}
            className="rounded-xl bg-kosh-navy px-3 py-2.5 text-sm font-medium text-kosh-navy-fg hover:opacity-90"
          >
            Open account
          </Link>
        </nav>
      )}
    </div>
  );
}
