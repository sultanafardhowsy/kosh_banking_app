import Link from "next/link";
import { ArrowLeftRight, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { CoinStream } from "./CoinStream";

/**
 * Landing hero: a digital vault with money flowing into it.
 *
 * The vault is SVG + CSS 3D (the door is a real 3D-rotated, layered disc), so it renders
 * on the server, needs no WebGL and never "fails to load". The coins are drawn on one
 * <canvas> by <CoinStream>, which aims at the element marked [data-vault-core].
 * Colours are fixed (a dark panel), so the hero reads the same in light and dark themes.
 */
export function VaultHero() {
  return (
    <section className="px-3 sm:px-6">
      <div className="vault-hero relative isolate mx-auto max-w-7xl overflow-hidden rounded-[32px] text-white ring-1 ring-white/5 dark:ring-white/10">
        {/* Coins + dust: above the vault (so they visibly fly in), below the text */}
        <CoinStream className="pointer-events-none absolute inset-0 z-10 size-full" />

        <div className="grid items-center gap-6 px-6 pb-10 pt-12 sm:px-12 sm:pt-16 lg:grid-cols-[1fr_1.05fr] lg:gap-4 lg:pb-16 lg:pt-14">
          <div data-hero-copy className="relative z-20 max-w-xl">
            <h1 className="font-display text-[40px] font-semibold leading-[1.04] tracking-[-0.025em] sm:text-6xl lg:text-[68px]">
              <span className="block">Your Money.</span>
              <span className="block">Your Future.</span>
              <span className="block text-[#F3D68C]">Your Digital Vault.</span>
            </h1>
            <p className="mt-6 max-w-md text-base leading-relaxed text-[#C9D3EA] sm:text-lg">
              Experience smarter banking with secure transactions, effortless
              money management, and complete control over your finances.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                href="/register"
                className="inline-flex items-center rounded-full bg-[#F2C86A] px-6 py-3 text-sm font-semibold text-[#0B1533] shadow-[0_10px_30px_-10px_rgba(242,200,106,0.55)] transition-colors hover:bg-[#F7D88E] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F2C86A]"
              >
                Open Your Account
              </Link>
              <a
                href="#features"
                className="inline-flex items-center rounded-full border border-white/25 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Explore Banking
              </a>
            </div>
            <ul
              aria-label="Why Kosh"
              className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[#AEB9D4]"
            >
              {[
                { icon: ShieldCheck, label: "Secure Banking" },
                { icon: ArrowLeftRight, label: "Smart Transactions" },
                { icon: SlidersHorizontal, label: "Total Control" },
              ].map(({ icon: Icon, label }, i) => (
                <li key={label} className="flex items-center gap-2">
                  {i > 0 && (
                    <span
                      aria-hidden
                      className="mr-3 hidden h-4 w-px bg-white/15 sm:inline-block"
                    />
                  )}
                  <Icon aria-hidden className="size-4 text-[#7FA2FF]" />
                  {label}
                </li>
              ))}
            </ul>
          </div>

          <Vault />
        </div>
      </div>
    </section>
  );
}

/** Bolts around the door rim. */
const BOLTS = Array.from({ length: 16 }, (_, i) => {
  const a = (i / 16) * Math.PI * 2;
  return { x: 200 + Math.cos(a) * 178, y: 200 + Math.sin(a) * 178 };
});

function Vault() {
  return (
    <div
      className="vault relative mx-auto aspect-square w-full max-w-[340px] sm:max-w-[460px] lg:max-w-[560px]"
      aria-hidden
    >
      {/* Light on the floor + halo behind */}
      <div className="absolute inset-x-[8%] bottom-[4%] h-[16%] rounded-[50%] bg-[radial-gradient(closest-side,rgba(242,200,106,0.28),rgba(47,107,255,0.12)_55%,transparent)] blur-md" />
      <div className="absolute inset-[6%] rounded-full bg-[radial-gradient(closest-side,rgba(47,107,255,0.22),transparent_70%)]" />

      {/* Holographic rings — tilted planes, slowly turning */}
      <div className="vault-rings absolute inset-0">
        <div className="vault-ring vault-ring-a" />
        <div className="vault-ring vault-ring-b" />
      </div>

      {/* Housing: brushed steel frame with a glass inner ring and an edge light */}
      <svg
        viewBox="0 0 400 400"
        className="absolute inset-[11%] size-[78%] overflow-visible"
      >
        <defs>
          <linearGradient id="v-steel" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#3E4D7A" />
            <stop offset="0.35" stopColor="#18234A" />
            <stop offset="0.7" stopColor="#0B1330" />
            <stop offset="1" stopColor="#2B3A6C" />
          </linearGradient>
          <linearGradient id="v-steel-hi" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#A9B8E0" stopOpacity="0.4" />
            <stop offset="0.5" stopColor="#A9B8E0" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="v-core" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#FFF3CF" />
            <stop offset="0.28" stopColor="#F6D27E" />
            <stop offset="0.62" stopColor="#C88A2B" />
            <stop offset="1" stopColor="#3A2508" />
          </radialGradient>
          <linearGradient id="v-edge" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#7FA2FF" stopOpacity="0.9" />
            <stop offset="0.5" stopColor="#2F6BFF" stopOpacity="0.15" />
            <stop offset="1" stopColor="#7FA2FF" stopOpacity="0.7" />
          </linearGradient>
        </defs>
        {/* frame */}
        <rect
          x="6"
          y="6"
          width="388"
          height="388"
          rx="92"
          fill="url(#v-steel)"
        />
        <rect
          x="6"
          y="6"
          width="388"
          height="388"
          rx="92"
          fill="url(#v-steel-hi)"
        />
        <rect
          x="6.5"
          y="6.5"
          width="387"
          height="387"
          rx="91.5"
          fill="none"
          stroke="url(#v-edge)"
          strokeWidth="1.5"
        />
        {/* recessed opening */}
        <circle cx="200" cy="200" r="168" fill="#050A1A" />
        <circle
          cx="200"
          cy="200"
          r="168"
          fill="none"
          stroke="#2F6BFF"
          strokeOpacity="0.45"
          strokeWidth="2"
          className="vault-edge"
        />
        {/* the gold interior */}
        <circle
          cx="200"
          cy="200"
          r="150"
          fill="url(#v-core)"
          className="vault-core"
        />
        {[118, 90, 62].map((r) => (
          <circle
            key={r}
            cx="200"
            cy="200"
            r={r}
            fill="none"
            stroke="#FFF3CF"
            strokeOpacity="0.18"
          />
        ))}
        {/* corner indicator lights */}
        {[
          [52, 52],
          [348, 52],
          [52, 348],
          [348, 348],
        ].map(([x, y]) => (
          <circle
            key={`${x}${y}`}
            cx={x}
            cy={y}
            r="4"
            fill="#7FA2FF"
            fillOpacity="0.7"
          />
        ))}
      </svg>

      {/* Coin target: the visible part of the opening (CoinStream measures this element) */}
      <div
        data-vault-core
        className="absolute left-[64%] top-[50%] size-[18%] -translate-x-1/2 -translate-y-1/2"
      />

      {/* The door: a layered disc hinged on the left, standing ajar in real 3D */}
      <div className="vault-door-scene absolute inset-[11%] size-[78%]">
        <div className="vault-door absolute left-[8%] top-[8%] size-[84%]">
          {[14, 11, 8, 5, 2].map((z) => (
            <div
              key={z}
              className="absolute inset-0 rounded-full bg-[#0A1230]"
              style={{ transform: `translateZ(-${z}px)` }}
            />
          ))}
          <svg viewBox="0 0 400 400" className="absolute inset-0 size-full">
            <defs>
              <radialGradient id="d-face" cx="0.38" cy="0.32" r="0.8">
                <stop offset="0" stopColor="#56679A" />
                <stop offset="0.45" stopColor="#223262" />
                <stop offset="1" stopColor="#0C1533" />
              </radialGradient>
              <linearGradient id="d-glass" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#9DB6FF" stopOpacity="0.35" />
                <stop offset="0.5" stopColor="#2F6BFF" stopOpacity="0.06" />
                <stop offset="1" stopColor="#9DB6FF" stopOpacity="0.22" />
              </linearGradient>
            </defs>
            <circle cx="200" cy="200" r="196" fill="url(#d-face)" />
            <circle
              cx="200"
              cy="200"
              r="195"
              fill="none"
              stroke="#B9C7EE"
              strokeOpacity="0.35"
              strokeWidth="2"
            />
            {BOLTS.map((b, i) => (
              <circle
                key={i}
                cx={b.x}
                cy={b.y}
                r="6"
                fill="#0B1533"
                stroke="#8FA3D6"
                strokeOpacity="0.5"
              />
            ))}
            {/* glass ring with a blue status arc */}
            <circle
              cx="200"
              cy="200"
              r="138"
              fill="url(#d-glass)"
              stroke="#9DB6FF"
              strokeOpacity="0.3"
            />
            <circle
              cx="200"
              cy="200"
              r="138"
              fill="none"
              stroke="#5B8CFF"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="120 747"
              transform="rotate(-120 200 200)"
            />
            {/* handle wheel */}
            <g stroke="#C8D4F5" strokeOpacity="0.75" strokeLinecap="round">
              {[0, 60, 120].map((a) => (
                <line
                  key={a}
                  x1="200"
                  y1="112"
                  x2="200"
                  y2="288"
                  strokeWidth="10"
                  transform={`rotate(${a} 200 200)`}
                />
              ))}
            </g>
            <circle
              cx="200"
              cy="200"
              r="34"
              fill="#16234A"
              stroke="#C8D4F5"
              strokeOpacity="0.6"
              strokeWidth="3"
            />
            <circle cx="200" cy="200" r="12" fill="#F2C86A" />
          </svg>
        </div>
      </div>
      {/* Gold light spilling out of the gap between door and frame */}
      <div className="vault-spill absolute left-[52%] top-[22%] h-[56%] w-[34%] rounded-[50%] bg-[radial-gradient(closest-side,rgba(255,226,150,0.55),rgba(242,200,106,0.18)_55%,transparent)] mix-blend-screen blur-xl" />
    </div>
  );
}
