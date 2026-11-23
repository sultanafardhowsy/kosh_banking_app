import "server-only";

/**
 * One branded, table-based HTML layout (renders in Gmail/Outlook) + a plain-text part.
 * Inline styles only — email clients ignore <style> blocks unreliably.
 */
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function appUrl(path = "") {
  const base = (process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL || "http://localhost:3000").replace(/\/$/, "");
  return path.startsWith("http") ? path : `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function renderEmail(opts: { name: string; title: string; body: string; ctaLabel?: string; ctaPath?: string | null }) {
  const firstName = opts.name.split(" ")[0] ?? opts.name;
  const cta = opts.ctaPath ? appUrl(opts.ctaPath) : null;
  const label = opts.ctaLabel ?? "Open Kosh";

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(opts.title)}</title></head>
<body style="margin:0;padding:0;background:#F5F6FA;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;color:#0B1533;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F5F6FA;padding:32px 12px;">
<tr><td align="center">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#FFFFFF;border:1px solid #E4E7EF;border-radius:20px;overflow:hidden;">
    <tr><td style="background:#0B1533;padding:22px 28px;">
      <span style="font-size:20px;font-weight:700;color:#FFFFFF;letter-spacing:-0.02em;">Kosh<span style="color:#2F6BFF;">.</span></span>
    </td></tr>
    <tr><td style="padding:28px 28px 8px;">
      <p style="margin:0 0 6px;font-size:14px;color:#5B6478;">Hi ${esc(firstName)},</p>
      <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:#0B1533;">${esc(opts.title)}</h1>
      <p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#33406A;">${esc(opts.body)}</p>
      ${cta ? `<a href="${esc(cta)}" style="display:inline-block;background:#2F6BFF;color:#FFFFFF;text-decoration:none;font-weight:600;font-size:14px;padding:12px 20px;border-radius:12px;">${esc(label)}</a>` : ""}
    </td></tr>
    <tr><td style="padding:24px 28px 26px;">
      <p style="margin:0;font-size:12px;line-height:1.6;color:#5B6478;">You're receiving this because email notifications are on for your Kosh profile. Turn them off any time on the Notifications page.<br>Kosh is a simulated bank built for an assessment project — no real money is involved.</p>
    </td></tr>
  </table>
</td></tr>
</table>
</body></html>`;

  const text = `Hi ${firstName},\n\n${opts.title}\n\n${opts.body}\n${cta ? `\n${label}: ${cta}\n` : ""}\n—\nKosh (simulated bank, no real money). Turn email notifications off on the Notifications page.`;
  return { html, text };
}
