/**
 * Demo logins shown on the login page and in the README.
 * Same values are created by `prisma/seed.ts`. Fake, simulated users only.
 */
export const DEMO_PASSWORD = "Demo@1234";

export const DEMO_USERS = [
  { role: "CUSTOMER", label: "Customer", name: "Nusrat Jahan", email: "customer@kosh.demo" },
  { role: "STAFF", label: "Staff", name: "Tanvir Ahmed", email: "staff@kosh.demo" },
  { role: "ADMIN", label: "Admin", name: "Farhana Islam", email: "admin@kosh.demo" },
] as const;
