"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DateRangePicker({
  start,
  end,
  status,
}: {
  start: string;
  end: string;
  status: string;
}) {
  const router = useRouter();
  const [s, setS] = useState(start);
  const [e, setE] = useState(end);
  const [st, setSt] = useState(status);

  function apply(next: { start?: string; end?: string; status?: string } = {}) {
    const params = new URLSearchParams({
      start: next.start ?? s,
      end: next.end ?? e,
      status: next.status ?? st,
    });
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
      <button className="btn btn--primary" onClick={() => apply()}>
        Apply
      </button>
    </div>
  );
}
