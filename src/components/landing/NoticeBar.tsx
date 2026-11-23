"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

/** Dismissible demo notice (remembered per browser; storage can fail, so it's wrapped). */
export function NoticeBar() {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    try {
      if (localStorage.getItem("kosh-notice-dismissed") === "1") setOpen(false);
    } catch {
      /* private mode etc. — just show it */
    }
  }, []);
  if (!open) return null;
  return (
    <div className="relative bg-kosh-navy px-10 py-2.5 text-center text-xs text-white/80 sm:text-sm">
      Kosh is a simulated bank built for an assessment project. Accounts, cards and money here are not real.
      <button
        type="button"
        aria-label="Dismiss notice"
        onClick={() => {
          setOpen(false);
          try { localStorage.setItem("kosh-notice-dismissed", "1"); } catch { /* ignore */ }
        }}
        className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full hover:bg-white/10"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
