// Send a one-off SMTP test email using the same settings as the Kosh backend.
// Run with: node --env-file=.env scripts/test-email.mjs [recipient@example.com]
import nodemailer from "nodemailer";

const env = (name) => process.env[name]?.trim() ?? "";
const host = env("SMTP_HOST");
const port = Number(env("SMTP_PORT") || 587);
const secure = env("SMTP_SECURE") ? env("SMTP_SECURE") === "true" : port === 465;
const user = process.env.SMTP_USER || "";
const pass = process.env.SMTP_PASS || "";
const from = env("EMAIL_FROM") || (user ? `Kosh <${user}>` : "Kosh <no-reply@kosh.local>");
const to = process.argv[2] || env("EMAIL_DEMO_RECIPIENT") || user;

if (!host) {
  console.error("SMTP_HOST is not set. Kosh will log emails instead of sending them.");
  process.exit(1);
}

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error("SMTP_PORT must be a valid port number.");
  process.exit(1);
}

if (!to) {
  console.error("No recipient. Pass one as an argument or set EMAIL_DEMO_RECIPIENT.");
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host,
  port,
  secure,
  auth: user && pass ? { user, pass } : undefined,
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 15_000,
});

try {
  console.log(`Checking SMTP connection to ${host}:${port} (secure=${secure})...`);
  await transporter.verify();
  console.log("SMTP connection verified. Sending test email...");

  const info = await transporter.sendMail({
    from,
    to,
    subject: "Kosh SMTP test",
    text: "Your SMTP configuration is working.",
  });

  console.log("Email accepted by SMTP server.");
  console.log("Message ID:", info.messageId);
  console.log("Accepted:", info.accepted);
  console.log("Rejected:", info.rejected);
} catch (error) {
  const smtpError = typeof error === "object" && error !== null ? error : {};
  const message = error instanceof Error ? error.message : String(error);
  console.error("SMTP test failed:", smtpError.code ?? "", smtpError.responseCode ?? "", message);
  process.exitCode = 1;
} finally {
  transporter.close();
}
