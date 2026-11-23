import { formatMoney, toBigInt, type MoneyInput } from "@/lib/money";

export { formatAccountNumber, formatDate, formatDateTime, maskAccountNumber, titleCase } from "@/lib/format";

/** ৳2.5L / ৳1.2Cr style for compact table cells and chart axes (display only). */
export function formatMoneyShort(paisa: MoneyInput) {
  const taka = Number(toBigInt(paisa) / BigInt(100));
  if (Math.abs(taka) >= 1e7) return `৳${(taka / 1e7).toFixed(taka % 1e7 === 0 ? 0 : 1)}Cr`;
  if (Math.abs(taka) >= 1e5) return `৳${(taka / 1e5).toFixed(taka % 1e5 === 0 ? 0 : 1)}L`;
  if (Math.abs(taka) >= 1e3) return `৳${(taka / 1e3).toFixed(taka % 1e3 === 0 ? 0 : 1)}K`;
  return formatMoney(paisa, { decimals: false });
}
