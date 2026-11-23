"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Button, InputOTP, Modal } from "@heroui/react";
import { MailCheck, ShieldCheck } from "lucide-react";
import {
  useRequestOtpMutation,
  type OtpChallenge,
  type OtpProof,
  type OtpRequestBody,
} from "@/store/api/securityApi";
import { errorCode, errorDetails, errorMessage } from "@/lib/client";

const RETRYABLE = new Set([
  "OTP_INVALID",
  "OTP_EXPIRED",
  "OTP_LOCKED",
  "OTP_REQUIRED",
]);

type Pending = {
  request: OtpRequestBody;
  perform: (otp: OtpProof) => Promise<unknown>;
  resolve: (v: unknown) => void;
  reject: (e: unknown) => void;
};

/**
 * Two-factor step for sensitive operations.
 *
 *   const twoFactor = useTwoFactor();
 *   await twoFactor.run({ purpose: "REVERSAL", transactionId }, (otp) => reverse({ id, reason, otp }).unwrap());
 *   …
 *   {twoFactor.dialog}
 *
 * `run` emails a code, asks for it, then calls `perform(otp)`. A wrong or expired code is
 * handled inside the dialog; any other error (e.g. wrong PIN) closes it and is rethrown
 * so the caller's normal error handling applies. Cancelling rejects with `TwoFactorCancelled`.
 */
export class TwoFactorCancelled extends Error {
  constructor() {
    super("Cancelled");
  }
}

export function useTwoFactor() {
  const [pending, setPending] = useState<Pending | null>(null);
  // Re-use a still-valid code for the SAME operation (e.g. after a wrong PIN) instead of emailing a new one.
  const last = useRef<{ key: string; challenge: OtpChallenge } | null>(null);
  const run = useCallback(
    <T,>(request: OtpRequestBody, perform: (otp: OtpProof) => Promise<T>) =>
      new Promise<T>((resolve, reject) =>
        setPending({
          request,
          perform,
          resolve: resolve as (v: unknown) => void,
          reject,
        }),
      ),
    [],
  );
  const key = pending ? JSON.stringify(pending.request) : "";
  const reusable =
    last.current &&
    last.current.key === key &&
    new Date(last.current.challenge.expiresAt).getTime() - Date.now() > 20_000
      ? last.current.challenge
      : null;
  const dialog: ReactNode = pending ? (
    <TwoFactorDialog
      key={key}
      pending={pending}
      initial={reusable}
      onChallenge={(challenge) =>
        (last.current = challenge ? { key, challenge } : null)
      }
      onDone={() => setPending(null)}
    />
  ) : null;
  return { run, dialog };
}

function TwoFactorDialog({
  pending,
  initial,
  onChallenge,
  onDone,
}: {
  pending: Pending;
  initial: OtpChallenge | null;
  onChallenge: (c: OtpChallenge | null) => void;
  onDone: () => void;
}) {
  const [requestOtp, requestState] = useRequestOtpMutation();
  const [challenge, setChallenge] = useState<OtpChallenge | null>(initial);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [needsNewCode, setNeedsNewCode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const sent = useRef(false);
  const boxes = useRef<HTMLDivElement>(null);

  // Put the cursor back in the code boxes when a code arrives or after a wrong code.
  useEffect(() => {
    if (!challenge || needsNewCode || submitting) return;
    const t = setTimeout(
      () => boxes.current?.querySelector("input")?.focus(),
      50,
    );
    return () => clearTimeout(t);
  }, [challenge, error, needsNewCode, submitting]);

  const send = useCallback(async () => {
    setError(null);
    setCode("");
    try {
      const c = await requestOtp(pending.request).unwrap();
      setChallenge(c);
      onChallenge(c);
      setNeedsNewCode(false);
      setCooldown(30);
    } catch (e) {
      const wait = errorDetails<{ retryAfter?: number }>(e)?.retryAfter;
      if (wait) setCooldown(wait);
      setError(errorMessage(e));
    }
  }, [pending.request, requestOtp, onChallenge]);

  useEffect(() => {
    if (sent.current) return; // StrictMode runs effects twice; email only once
    sent.current = true;
    if (!initial) void send();
  }, [send, initial]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function confirm(value = code) {
    if (!challenge || value.length !== 6 || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await pending.perform({
        challengeId: challenge.challengeId,
        code: value,
      });
      onChallenge(null); // used up
      pending.resolve(result);
      onDone();
    } catch (e) {
      const c = errorCode(e);
      if (c && RETRYABLE.has(c)) {
        setError(errorMessage(e));
        setCode("");
        if (c !== "OTP_INVALID" || /new one/i.test(errorMessage(e))) {
          setNeedsNewCode(true);
          onChallenge(null);
        }
      } else {
        pending.reject(e);
        onDone();
      }
    } finally {
      setSubmitting(false);
    }
  }

  function cancel() {
    pending.reject(new TwoFactorCancelled());
    onDone();
  }

  return (
    <Modal.Backdrop isOpen onOpenChange={(o) => !o && cancel()}>
      <Modal.Container size="sm" placement="center">
        <Modal.Dialog aria-label="Confirm with a security code">
          <Modal.Header>
            <span className="mb-2 grid size-10 place-items-center rounded-xl bg-kosh-subtle text-kosh-info">
              <ShieldCheck className="size-5" />
            </span>
            <Modal.Heading>Confirm it&apos;s you</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="space-y-4">
            <p className="text-sm text-kosh-muted">
              {challenge ? (
                <>
                  We emailed a 6-digit code to{" "}
                  <strong className="text-foreground">
                    {challenge.sentTo}
                  </strong>
                  . It expires in 5 minutes.
                </>
              ) : requestState.isLoading ? (
                "Sending a code to your email…"
              ) : (
                "This action needs a code sent to your email."
              )}
            </p>

            {challenge?.demoCode && (
              <div className="flex items-start gap-2.5 rounded-xl border border-dashed border-kosh-border bg-kosh-subtle p-3 text-sm">
                <MailCheck className="mt-0.5 size-4 shrink-0 text-kosh-muted" />
                <p>
                  Demo mode: email isn&apos;t set up on this server, so here is
                  your code:{" "}
                  <strong className="amount tracking-[0.2em]">
                    {challenge.demoCode}
                  </strong>
                </p>
              </div>
            )}

            <div ref={boxes} className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={code}
                onChange={(v: string) => setCode(v.replace(/\D/g, ""))}
                onComplete={(v: string) => void confirm(v)}
                inputMode="numeric"
                pattern="^[0-9]*$"
                autoFocus
                aria-label="Security code"
                isInvalid={Boolean(error) && !needsNewCode}
                isDisabled={needsNewCode || submitting}
              >
                <InputOTP.Group>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <InputOTP.Slot
                      key={i}
                      index={i}
                      className="size-11 text-lg"
                    />
                  ))}
                </InputOTP.Group>
              </InputOTP>
            </div>

            {error && (
              <p className="text-center text-sm text-danger" role="alert">
                {error}
              </p>
            )}

            <p className="text-center text-sm text-kosh-muted">
              Didn&apos;t get it?{" "}
              <button
                type="button"
                className="font-medium text-kosh-info disabled:cursor-not-allowed disabled:text-kosh-muted"
                disabled={cooldown > 0 || requestState.isLoading}
                onClick={() => void send()}
              >
                {cooldown > 0
                  ? `Send a new code in ${cooldown} s`
                  : "Send a new code"}
              </button>
            </p>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="tertiary" onPress={cancel}>
              Cancel
            </Button>
            <Button
              onPress={() => void confirm()}
              isPending={submitting}
              isDisabled={!challenge || code.length !== 6 || needsNewCode}
            >
              Confirm
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
