"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DateRangePicker({
  start,
  end,
  status,
  email = "",
}: {
  start: string;
  end: string;
  status: string;
  email?: string;
}) {
  const router = useRouter();
  const [s, setS] = useState(start);
  const [e, setE] = useState(end);
  const [st, setSt] = useState(status);
  const [em, setEm] = useState(email);

  function apply(next: { start?: string; end?: string; status?: string; email?: string } = {}) {
    const params = new URLSearchParams({
      start: next.start ?? s,
      end: next.end ?? e,
      status: next.status ?? st,
    });
    const emailQ = (next.email ?? em).trim();
    if (emailQ) params.set("email", emailQ);
    router.push(`/?${params.toString()}`);
  }

  return (
    <div className="filters">
      <label>
        From
        <input
          type="date"
          value={s}
          onChange={(ev) => {
            setS(ev.target.value);
            apply({ start: ev.target.value });
          }}
        />
      </label>
      <label>
        To
        <input
          type="date"
          value={e}
          onChange={(ev) => {
            setE(ev.target.value);
            apply({ end: ev.target.value });
          }}
        />
      </label>
      <label>
        Status
        <select
          value={st}
          onChange={(ev) => {
            setSt(ev.target.value);
            apply({ status: ev.target.value });
          }}
        >
          <option value="ALL">All</option>
          <option value="NEW">New</option>
          <option value="CONTACTED">Contacted</option>
          <option value="RECOVERED">Recovered</option>
          <option value="CLOSED">Closed</option>
        </select>
      </label>
      <label className="filters-email">
        Email
        <input
          type="search"
          value={em}
          placeholder="contains…"
          onChange={(ev) => setEm(ev.target.value)}
          onKeyDown={(ev) => {
            if (ev.key === "Enter") {
              ev.preventDefault();
              apply({ email: em });
            }
          }}
        />
      </label>
      <button className="btn btn--primary" onClick={() => apply()}>
        Apply
      </button>
    </div>
  );
}
