import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { SimulationNotice } from "@/components/brand/SimulationNotice";
import { getSessionUser } from "@/server/auth/guards";
import { ROLE_HOME } from "@/lib/constants";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  // Already signed in → straight to the right home.
  const user = await getSessionUser();
  if (user && user.status === "ACTIVE") redirect(ROLE_HOME[user.role]);

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.05fr]">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Logo />
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">{children}</div>
        <SimulationNotice />
      </div>

      <aside className="relative hidden overflow-hidden bg-[#0B1533] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div aria-hidden className="absolute -right-24 -top-24 size-[28rem] rounded-full bg-[#2F6BFF]/25 blur-3xl" />
        <div aria-hidden className="absolute -bottom-32 -left-20 size-[26rem] rounded-full bg-[#3557F5]/25 blur-3xl" />
        <p className="relative inline-flex w-fit rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/80">
          Demo bank · simulated money
        </p>
        <div className="relative">
          <h2 className="max-w-md text-5xl font-semibold leading-[1.05]">
            Banking that keeps <span className="text-[#8EB1FF]">every paisa</span> accounted for.
          </h2>
          <p className="mt-5 max-w-md text-white/70">
            Atomic transfers, a full ledger, staff approvals and loans with EMI schedules — all in one place.
          </p>
        </div>
        <div className="relative grid max-w-md grid-cols-3 gap-3 text-sm">
          {[
            ["3", "roles"],
            ["100%", "server-validated"],
            ["0", "real money"],
          ].map(([k, v]) => (
            <div key={v} className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
              <p className="font-display text-2xl font-semibold text-white">{k}</p>
              <p className="text-white/60">{v}</p>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
