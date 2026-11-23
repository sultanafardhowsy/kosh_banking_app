import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** "101234567890" → "1012 3456 7890" */
export function formatAccountNumber(n: string) {
  return n.replace(/(\d{4})(?=\d)/g, "$1 ");
}

/** "101234567890" → "•••• 7890" */
export function maskAccountNumber(n: string) {
  return `•••• ${n.slice(-4)}`;
}

export function formatDate(d: string | Date, opts: Intl.DateTimeFormatOptions = {}) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Dhaka",
    ...opts,
  }).format(new Date(d));
}

export function formatDateTime(d: string | Date) {
  return formatDate(d, { hour: "2-digit", minute: "2-digit" });
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function titleCase(s: string) {
  return s
    .toLowerCase()
    .split("_")
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");
}
