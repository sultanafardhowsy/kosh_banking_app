import { randomInt } from "node:crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

function randomCode(len: number) {
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

/** TXN-20261121-8F3K2A */
export function generateTxnReference(prefix = "TXN", date = new Date()) {
  const ymd = date.toISOString().slice(0, 10).replace(/-/g, "");
  return `${prefix}-${ymd}-${randomCode(6)}`;
}

/**
 * 12-digit account number: 3-digit branch/type prefix + 8 random digits + Luhn check digit.
 * Uniqueness is enforced by the DB unique index; callers retry on collision.
 */
export function generateAccountNumber(type: "SAVINGS" | "CURRENT" | "BUSINESS") {
  const prefix = { SAVINGS: "101", CURRENT: "201", BUSINESS: "301" }[type];
  let body = prefix;
  for (let i = 0; i < 8; i++) body += randomInt(10).toString();
  return body + luhnCheckDigit(body);
}

function luhnCheckDigit(digits: string) {
  let sum = 0;
  let double = true;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return ((10 - (sum % 10)) % 10).toString();
}

export function isValidAccountNumber(n: string) {
  return /^\d{12}$/.test(n) && luhnCheckDigit(n.slice(0, 11)) === n[11];
}
