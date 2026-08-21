"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DonorEmailEditor({
  transactionId,
  email,
  phone,
}: {
  transactionId: string;
  email: string | null;
  phone: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(email ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/actions/donor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId, email: value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <div className="donor-email-edit">
        <input
          type="email"
          className="donor-email-input"
          value={value}
          autoFocus
          disabled={busy}
          placeholder="donor@example.com"
          onChange={(ev) => setValue(ev.target.value)}
          onKeyDown={(ev) => {
            if (ev.key === "Enter") {
              ev.preventDefault();
              save();
            }
            if (ev.key === "Escape") {
              setValue(email ?? "");
              setEditing(false);
              setError(null);
            }
          }}
        />
        <div className="donor-email-actions">
          <button type="button" className="btn btn--primary" disabled={busy} onClick={save}>
            {busy ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            className="btn btn--quiet"
            disabled={busy}
            onClick={() => {
              setValue(email ?? "");
              setEditing(false);
              setError(null);
            }}
          >
            Cancel
          </button>
        </div>
        {error && <div className="donor-email-error">{error}</div>}
        {phone ? <div className="donor-contact">{phone}</div> : null}
      </div>
    );
  }

  return (
    <div className="donor-contact">
      <button
        type="button"
        className="donor-email-btn"
        title="Edit email"
        onClick={() => {
          setValue(email ?? "");
          setEditing(true);
          setError(null);
        }}
      >
        {email ?? "no email"}
      </button>
      {phone ? ` · ${phone}` : ""}
    </div>
  );
}
