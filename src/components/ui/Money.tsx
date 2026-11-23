import { formatMoney, toBigInt, type MoneyInput } from "@/lib/money";
import { cn } from "@/lib/format";

/**
 * Renders paisa as ৳ with tabular numbers.
 * `direction` colours incoming money green and prefixes +/−.
 */
export function Money({
  value,
  direction,
  decimals = true,
  className,
}: {
  value: MoneyInput;
  direction?: "in" | "out";
  decimals?: boolean;
  className?: string;
}) {
  const v = toBigInt(value);
  const signed = direction === "out" ? -v : v;
  return (
    <span
      className={cn(
        "amount whitespace-nowrap",
        direction === "in" && "text-kosh-money-in",
        className,
      )}
    >
      {formatMoney(signed, { decimals, sign: Boolean(direction) })}
    </span>
  );
}
