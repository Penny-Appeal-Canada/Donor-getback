"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ActionButtons({
  transactionId,
  status,
  email,
  phone,
}: {
  transactionId: string;
  status: string;
  email: string | null;
  phone: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (status === "RECOVERED" || status === "CLOSED") {
    return <span className="dash">—</span>;
  }

  async function post(url: string, body: object, label: string) {
    setBusy(label);
    setMessage(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      setMessage(label === "email" ? "Email sent" : label === "text" ? "Text sent" : "Logged");
      router.refresh();
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="actions">
      <button
        className="btn"
        disabled={!email || busy !== null}
        title={email ? `Email ${email} a fresh checkout link` : "No email on file"}
        onClick={() => post("/api/actions/email", { transactionId }, "email")}
      >
        {busy === "email" ? "Sending…" : "Email link"}
      </button>

      <a
        className={`btn ${!phone ? "btn--disabled" : ""}`}
        href={phone ? `tel:${phone}` : undefined}
        title={phone ? `Call ${phone}` : "No phone on file"}
        onClick={() => {
          if (phone) post("/api/actions/contact", { transactionId, method: "CALL" }, "call");
        }}
      >
        Call
      </a>

      <button
        className="btn"
        disabled={!phone || busy !== null}
        title={phone ? `Text ${phone} a fresh checkout link` : "No phone on file"}
        onClick={() => post("/api/actions/text", { transactionId }, "text")}
      >
        {busy === "text" ? "Sending…" : "Text link"}
      </button>

      <button
        className="btn btn--quiet"
        disabled={busy !== null}
        title="Stop pursuing this transaction"
        onClick={() => post("/api/actions/contact", { transactionId, close: true }, "close")}
      >
        Close
      </button>

      {message && <span className="action-msg">{message}</span>}
    </div>
  );
}
