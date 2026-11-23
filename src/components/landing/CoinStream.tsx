"use client";

import { useEffect, useRef } from "react";

/**
 * Coins and digital tokens drifting into the vault, on ONE canvas.
 *
 * - Each coin follows a quadratic Bézier from an edge of the hero to the vault opening,
 *   speeding up and shrinking as it goes deeper, then fades into the light.
 * - Every coin has its own speed, size, spin and flip and respawns on its own, so the
 *   loop never visibly resets.
 * - Sparks and a soft pulse mark each arrival; slow dust drifts around the vault.
 * - No React state: nothing re-renders. The loop pauses off-screen and in hidden tabs,
 *   uses fewer coins on small screens, and is not started for prefers-reduced-motion.
 */

type Coin = {
  x0: number;
  y0: number;
  cx: number;
  cy: number; // start + Bézier control (target is live)
  t: number;
  dur: number;
  size: number;
  spin: number;
  spinV: number;
  flip: number;
  flipV: number;
  kind: 0 | 1 | 2; // 0 gold ৳ · 1 gold plain · 2 glass token
  delay: number;
};
type Spark = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  r: number;
};
type Dust = {
  x: number;
  y: number;
  r: number;
  vy: number;
  vx: number;
  phase: number;
  speed: number;
};

const GOLD_LIGHT = "#FFF1C7";
const GOLD = "#F2C86A";
const GOLD_DEEP = "#B47A22";

function makeSprite(kind: Coin["kind"], px: number) {
  const c = document.createElement("canvas");
  c.width = c.height = px;
  const g = c.getContext("2d")!;
  const r = px / 2;
  g.translate(r, r);

  if (kind === 2) {
    // digital token: dark glass disc, gold rim, ৳ in light gold
    const face = g.createRadialGradient(-r * 0.3, -r * 0.4, r * 0.1, 0, 0, r);
    face.addColorStop(0, "rgba(120,150,230,0.55)");
    face.addColorStop(1, "rgba(12,22,56,0.85)");
    g.fillStyle = face;
    g.beginPath();
    g.arc(0, 0, r * 0.94, 0, Math.PI * 2);
    g.fill();
    g.lineWidth = r * 0.1;
    g.strokeStyle = GOLD;
    g.beginPath();
    g.arc(0, 0, r * 0.88, 0, Math.PI * 2);
    g.stroke();
    g.lineWidth = r * 0.03;
    g.strokeStyle = "rgba(255,241,199,0.5)";
    g.beginPath();
    g.arc(0, 0, r * 0.66, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = GOLD_LIGHT;
  } else {
    // minted gold: rim, reeded edge, raised inner field
    const rim = g.createLinearGradient(-r, -r, r, r);
    rim.addColorStop(0, GOLD_LIGHT);
    rim.addColorStop(0.45, GOLD);
    rim.addColorStop(1, GOLD_DEEP);
    g.fillStyle = rim;
    g.beginPath();
    g.arc(0, 0, r * 0.96, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "rgba(120,78,20,0.45)";
    g.lineWidth = Math.max(1, r * 0.03);
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      g.beginPath();
      g.moveTo(Math.cos(a) * r * 0.86, Math.sin(a) * r * 0.86);
      g.lineTo(Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.95);
      g.stroke();
    }
    const field = g.createRadialGradient(
      -r * 0.25,
      -r * 0.3,
      r * 0.05,
      0,
      0,
      r * 0.8,
    );
    field.addColorStop(0, "#FFE9A8");
    field.addColorStop(0.6, "#E2AE48");
    field.addColorStop(1, "#A86E1C");
    g.fillStyle = field;
    g.beginPath();
    g.arc(0, 0, r * 0.76, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "rgba(255,246,214,0.55)";
    g.lineWidth = r * 0.035;
    g.beginPath();
    g.arc(0, 0, r * 0.76, Math.PI * 1.05, Math.PI * 1.7);
    g.stroke();
    g.fillStyle = "rgba(110,70,15,0.8)";
  }
  if (kind !== 1) {
    g.font = `600 ${r * 0.95}px "Inter Variable", system-ui, sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("৳", 0, r * 0.06);
  } else {
    // plain coin: a small engraved star instead of a symbol
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5,
        rr = i % 2 ? r * 0.14 : r * 0.32;
      g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    g.closePath();
    g.fill();
  }
  return c;
}

export function CoinStream({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return; // no canvas → the static vault still stands on its own

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sprites = [makeSprite(0, 96), makeSprite(1, 96), makeSprite(2, 96)];

    let w = 0,
      h = 0,
      dpr = 1;
    let tx = 0,
      ty = 0,
      tr = 40; // vault opening: centre + radius (CSS px)
    let copy = { l: 0, t: 0, r: 0, b: 0 }; // the text block, which coins fade around
    let coins: Coin[] = [];
    let sparks: Spark[] = [];
    let dust: Dust[] = [];
    let pulse = 0;
    let raf = 0,
      last = 0,
      visible = true;

    const rand = (a: number, b: number) => a + Math.random() * (b - a);

    function measure() {
      const box = canvas!.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = box.width;
      h = box.height;
      canvas!.width = Math.round(w * dpr);
      canvas!.height = Math.round(h * dpr);
      const core =
        canvas!.parentElement?.querySelector<HTMLElement>("[data-vault-core]");
      if (core) {
        const c = core.getBoundingClientRect();
        tx = c.left - box.left + c.width / 2;
        ty = c.top - box.top + c.height / 2;
        tr = c.width / 2;
      } else {
        tx = w * 0.72;
        ty = h * 0.5;
        tr = 40;
      }
      const text = canvas!.parentElement
        ?.querySelector<HTMLElement>("[data-hero-copy]")
        ?.getBoundingClientRect();
      copy = text
        ? {
            l: text.left - box.left - 20,
            t: text.top - box.top - 20,
            r: text.right - box.left + 20,
            b: text.bottom - box.top + 20,
          }
        : { l: 0, t: 0, r: 0, b: 0 };
      const n = w < 640 ? 7 : w < 1024 ? 11 : 16;
      const d = w < 640 ? 12 : 26;
      if (coins.length !== n)
        coins = Array.from({ length: n }, () => spawn(true));
      dust = Array.from({ length: d }, () => ({
        x: tx + rand(-1, 1) * tr * 5,
        y: ty + rand(-1, 1) * tr * 4,
        r: rand(0.6, 1.8),
        vy: rand(-6, -2),
        vx: rand(-2, 2),
        phase: rand(0, Math.PI * 2),
        speed: rand(0.6, 1.6),
      }));
    }

    /** New coin entering from a random side, curving towards the vault. */
    function spawn(prefill = false): Coin {
      const narrow = w < 1024;
      // left entries are rarer on desktop so coins don't crowd the headline
      const side =
        Math.random() < (narrow ? 0.25 : 0.12)
          ? 0
          : 1 + Math.floor(Math.random() * 3); // 0 L · 1 R · 2 T · 3 B
      const pad = 40;
      let x0: number, y0: number;
      if (side === 0) {
        x0 = -pad;
        y0 = narrow ? rand(h * 0.55, h + pad) : rand(h * 0.84, h + pad);
      } else if (side === 1) {
        x0 = w + pad;
        y0 = rand(-pad, h + pad);
      } else if (side === 2) {
        x0 = rand(narrow ? 0 : w * 0.45, w);
        y0 = -pad;
      } else {
        x0 = rand(narrow ? 0 : w * 0.45, w);
        y0 = h + pad;
      }
      // control point: off to one side of the straight line → a gentle arc
      const mx = (x0 + tx) / 2,
        my = (y0 + ty) / 2;
      const dx = tx - x0,
        dy = ty - y0,
        len = Math.hypot(dx, dy) || 1;
      const bend = rand(0.18, 0.42) * (Math.random() < 0.5 ? -1 : 1) * len;
      const kindRoll = Math.random();
      return {
        x0,
        y0,
        cx: mx + (-dy / len) * bend,
        cy: my + (dx / len) * bend,
        t: prefill ? rand(0, 0.85) : 0,
        dur: rand(3.8, 7.2),
        size: rand(30, 52) * (w < 640 ? 0.72 : 1),
        spin: rand(0, Math.PI * 2),
        spinV: rand(-0.9, 0.9),
        flip: rand(0, Math.PI * 2),
        flipV: rand(0.5, 1.4) * (Math.random() < 0.5 ? -1 : 1),
        kind: kindRoll < 0.55 ? 0 : kindRoll < 0.8 ? 1 : 2,
        delay: prefill ? 0 : rand(0, 0.8),
      };
    }

    /** 0 inside the text block, rising to 1 within 70px outside it — copy stays readable. */
    function clearOfText(x: number, y: number) {
      const dx = Math.max(copy.l - x, 0, x - copy.r);
      const dy = Math.max(copy.t - y, 0, y - copy.b);
      return Math.min(1, Math.hypot(dx, dy) / 70);
    }

    function arrive() {
      pulse = Math.min(1, pulse + 0.35);
      const n = 5 + Math.floor(Math.random() * 4);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2,
          s = rand(14, 46);
        sparks.push({
          x: tx + rand(-0.25, 0.25) * tr,
          y: ty + rand(-0.25, 0.25) * tr,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s - 8,
          life: 0,
          max: rand(0.45, 0.9),
          r: rand(0.8, 1.8),
        });
      }
    }

    function frame(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000 || 0);
      last = now;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.clearRect(0, 0, w, h);

      // soft glow at the opening, brighter for a moment after each arrival
      pulse = Math.max(0, pulse - dt * 0.9);
      const glow = ctx!.createRadialGradient(tx, ty, 0, tx, ty, tr * 2.6);
      glow.addColorStop(0, `rgba(255,232,170,${0.16 + pulse * 0.28})`);
      glow.addColorStop(1, "rgba(255,232,170,0)");
      ctx!.fillStyle = glow;
      ctx!.fillRect(tx - tr * 3, ty - tr * 3, tr * 6, tr * 6);

      // ambient dust
      for (const p of dust) {
        p.y += p.vy * dt;
        p.x += p.vx * dt;
        p.phase += dt * p.speed;
        if (p.y < ty - tr * 5) {
          p.y = ty + tr * 4;
          p.x = tx + rand(-1, 1) * tr * 5;
        }
        ctx!.globalAlpha = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(p.phase));
        ctx!.fillStyle = "#BFD0FF";
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx!.fill();
      }

      // coins
      for (let i = 0; i < coins.length; i++) {
        const c = coins[i]!;
        if (c.delay > 0) {
          c.delay -= dt;
          continue;
        }
        c.t += dt / c.dur;
        if (c.t >= 1) {
          arrive();
          coins[i] = spawn();
          continue;
        }
        const u = Math.pow(c.t, 1.45); // drawn in: slow at the edge, faster near the vault
        const iu = 1 - u;
        const x = iu * iu * c.x0 + 2 * iu * u * c.cx + u * u * tx;
        const y = iu * iu * c.y0 + 2 * iu * u * c.cy + u * u * ty;
        const depth = 1 - 0.86 * Math.pow(u, 1.15); // farther in → smaller
        const s = c.size * depth;
        const alpha =
          Math.min(1, c.t / 0.12) *
          (u > 0.86 ? Math.max(0, (1 - u) / 0.14) : 1) *
          clearOfText(x, y);
        c.spin += c.spinV * dt;
        c.flip += c.flipV * dt;
        // a gentle tumble: the face tilts but never turns edge-on into a sliver
        const sx = 0.42 + 0.58 * Math.abs(Math.cos(c.flip));
        ctx!.save();
        ctx!.globalAlpha = alpha * (0.55 + 0.45 * depth);
        ctx!.translate(x, y);
        ctx!.rotate(c.spin);
        ctx!.scale(sx, 1);
        ctx!.drawImage(sprites[c.kind]!, -s / 2, -s / 2, s, s);
        ctx!.restore();
      }

      // arrival sparks
      sparks = sparks.filter((p) => (p.life += dt) < p.max);
      for (const p of sparks) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.96;
        p.vy *= 0.96;
        ctx!.globalAlpha = 1 - p.life / p.max;
        ctx!.fillStyle = GOLD_LIGHT;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx!.fill();
      }
      ctx!.globalAlpha = 1;

      raf = requestAnimationFrame(frame);
    }

    function start() {
      if (raf || motion.matches || !visible || document.hidden) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
    function stop() {
      cancelAnimationFrame(raf);
      raf = 0;
    }
    function onMotionChange() {
      if (motion.matches) {
        stop();
        ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
      } else start();
    }
    const onVisibility = () => (document.hidden ? stop() : start());

    measure();
    const ro = new ResizeObserver(() => measure());
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => {
      visible = Boolean(e?.isIntersecting);
      if (visible) start();
      else stop();
    });
    io.observe(canvas);
    document.addEventListener("visibilitychange", onVisibility);
    motion.addEventListener("change", onMotionChange);
    start();

    return () => {
      stop();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      motion.removeEventListener("change", onMotionChange);
    };
  }, []);

  return <canvas ref={ref} className={className} aria-hidden />;
}
