import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

/**
 * POST /api/actions/contact  { transactionId, method: "CALL", notes? }
 *
 * Calls happen off-platform (the dashboard exposes a tel: link), so this
 * endpoint just logs that the call was made and flips status to CONTACTED.
 * Also accepts { close: true } to mark a transaction CLOSED (donor declined,
 * unreachable, etc.).
 */
export async function POST(req: NextRequest) {
  const { transactionId, method = "CALL", notes, close } = await req.json();

  const tx = await prisma.failedTransaction.findUnique({ where: { id: transactionId } });
  if (!tx) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });

  if (close) {
    await prisma.failedTransaction.update({
      where: { id: tx.id },
      data: { status: "CLOSED" },
    });
    return NextResponse.json({ ok: true });
  }

  await prisma.$transaction([
    prisma.contactLog.create({
      data: { transactionId: tx.id, method, notes },
    }),
    prisma.failedTransaction.update({
      where: { id: tx.id },
      data: { status: tx.status === "NEW" ? "CONTACTED" : tx.status },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
