"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "../primitives/Button";
import { Field } from "../primitives/Field";
import { NotYetWired } from "../primitives/NotYetWired";

/** Request → check-your-email. The send itself waits on live services. */
export function LoginForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <div className="flex flex-col items-start gap-tight rounded-card bg-mint p-loose" aria-live="polite">
        <h2 className="font-display text-display-s font-bold tracking-[-0.02em] text-ink">Check your email</h2>
        <p className="text-body text-ink-2">
          We sent a sign-in link to <strong className="text-ink">{email}</strong>. It works for 15 minutes.
        </p>
        <p className="text-body-s text-ink-3">Nothing arriving? Check spam, or try again with the address you signed up with.</p>
        <button type="button" onClick={() => setSent(false)} className="text-body-s text-ink-2 underline">
          Use a different email
        </button>
        {/* Offline preview: follow the link flow without an inbox. */}
        <Link href="/auth/callback" className="text-body-s text-ink-2 underline">
          Preview: open the sign-in link
        </Link>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col items-start gap-gap"
      onSubmit={(e) => {
        e.preventDefault();
        if (email.includes("@")) setSent(true);
      }}
    >
      <div className="w-full max-w-sm">
        <Field
          label="Email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </div>
      <Button type="submit">Email me a sign-in link</Button>
      <NotYetWired stubId="auth" />
    </form>
  );
}
