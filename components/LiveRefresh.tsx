"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const REFRESH_MS = 15_000;

/**
 * Keeps the dashboard current for the selected date range while Stripe
 * webhooks (or backfill) write new rows in the background.
 */
export function LiveRefresh() {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => {
      router.refresh();
    }, REFRESH_MS);
    return () => clearInterval(id);
  }, [router]);

  return (
    <p className="live-indicator" title="Refreshes every 15s so new Stripe events in this date range appear automatically">
      <span className="live-dot" aria-hidden />
      Live · updates every 15s
    </p>
  );
}
