"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const STATUSES = ["NEW", "CONTACTED", "RECOVERED", "CLOSED"] as const;

export function StatusSelect({
  transactionId,
  status,
  amount,
  currency,
}: {
  transactionId: string;
  status: string;
  amount: number;
  currency: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function changeStatus(next: string) {
    let recoveredAmountCents: number | undefined;

    if (next === "RECOVERED") {
      const defaultDollars = (amount / 100).toFixed(2);
      const input = window.prompt(
        `Recovered amount in ${currency.toUpperCase()} (dollars):`,
        defaultDollars
      );
      if (input === null) return; // cancelled, leave status unchanged
      const dollars = Number(input);
      if (!Number.isFinite(dollars) || dollars <= 0) {
        window.alert("Enter a valid positive amount.");
        return;
      }
      recoveredAmountCents = Math.round(dollars * 100);
    }

    setBusy(true);
    try {
      const res = await fetch("/api/actions/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId, status: next, recoveredAmountCents }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Update failed");
      router.refresh();
    } catch (err) {
      window.alert((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <select
      className="status-select"
      value={status}
      disabled={busy}
      onChange={(ev) => changeStatus(ev.target.value)}
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}
