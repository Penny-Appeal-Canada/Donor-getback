import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { setStatusManually } from "@/lib/recovery";

export const runtime = "nodejs";

const VALID_STATUSES = ["NEW", "CONTACTED", "RECOVERED", "CLOSED"];

/**
 * POST /api/actions/status  { transactionId, status, recoveredAmountCents? }
 *
 * Manual staff override of a transaction's status from the dashboard.
 * RECOVERED requires recoveredAmountCents (a positive integer) so the
 * "Recovered in this period" total stays accurate.
 */
export async function POST(req: NextRequest) {
  const { transactionId, status, recoveredAmountCents } = await req.json();

  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const tx = await prisma.failedTransaction.findUnique({ where: { id: transactionId } });
  if (!tx) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });

  if (status === "RECOVERED") {
    if (!Number.isInteger(recoveredAmountCents) || recoveredAmountCents <= 0) {
      return NextResponse.json(
        { error: "A positive recovered amount is required" },
        { status: 400 }
      );
    }
    await setStatusManually(tx.id, status, recoveredAmountCents);
  } else {
    await setStatusManually(tx.id, status);
  }

  return NextResponse.json({ ok: true });
}
