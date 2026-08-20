"use client";

import { useState } from "react";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setBusy(true);
    try {
      await fetch("/api/auth/request-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <p className="login-message">
        If <strong>{email}</strong> is on our team list, a sign-in link is on
        its way. It's valid for 15 minutes.
      </p>
    );
  }

  return (
    <form className="login-form" onSubmit={submit}>
      <label>
        Work email
        <input
          type="email"
          required
          value={email}
          onChange={(ev) => setEmail(ev.target.value)}
          placeholder="you@yourcharity.org"
        />
      </label>
      <button className="btn btn--primary" type="submit" disabled={busy}>
        {busy ? "Sending…" : "Send sign-in link"}
      </button>
    </form>
  );
}
