import "server-only";
import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { otpProofSchema } from "@/lib/validators/money";
import { AppError, isAppError } from "./errors";

/**
 * The ONE place BigInt is serialized. BigInt → string (exact, no precision loss).
 * The client converts with `BigInt(value)` / formats with `formatMoney`.
 */
export function serialize<T>(data: T): unknown {
  return JSON.parse(
    JSON.stringify(data, (_key, value) => (typeof value === "bigint" ? value.toString() : value)),
  );
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(serialize(data), init);
}

export function errorResponse(err: unknown) {
  if (isAppError(err)) {
    return NextResponse.json(
      { error: { code: err.code, message: err.message, details: err.details ?? null } },
      { status: err.status },
    );
  }
  if (err instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: err.issues[0]?.message ?? "Invalid input",
          details: err.flatten(),
        },
      },
      { status: 422 },
    );
  }
  console.error("[api] unhandled error", err);
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "Something went wrong" } },
    { status: 500 },
  );
}

type RouteCtx<P> = { params: Promise<P> };

/**
 * Wrap a route handler so thrown AppError / ZodError become typed JSON errors.
 *
 *   export const GET = handler(async (req) => { const s = await requireRole("ADMIN"); ... return ok(x) })
 */
export function handler<P = Record<string, string>>(
  fn: (req: Request, ctx: RouteCtx<P>) => Promise<Response>,
) {
  return async (req: Request, ctx: RouteCtx<P>) => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      return errorResponse(err);
    }
  };
}

/** Parse + validate a JSON body with a Zod schema. */
export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new AppError("VALIDATION_ERROR", "Request body must be valid JSON");
  }
  return schema.parse(json);
}

/** The optional `otp` proof sent alongside a body (read from a clone, so parseBody still works). */
export async function readOtp(req: Request) {
  const json = (await req.clone().json().catch(() => null)) as { otp?: unknown } | null;
  if (!json?.otp) return undefined;
  return otpProofSchema.parse(json.otp);
}

/** Parse + validate URL search params with a Zod schema. */
export function parseQuery<T>(req: Request, schema: ZodType<T>): T {
  const params = Object.fromEntries(new URL(req.url).searchParams.entries());
  return schema.parse(params);
}
