import { ShieldAlert } from "lucide-react";
import { SIMULATION_NOTICE } from "@/lib/constants";
import { cn } from "@/lib/format";

export function SimulationNotice({ className }: { className?: string }) {
  return (
    <p className={cn("flex items-center justify-center gap-1.5 text-xs text-kosh-muted", className)}>
      <ShieldAlert className="size-3.5" aria-hidden />
      {SIMULATION_NOTICE}
    </p>
  );
}
