import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

/**
 * POST /api/actions/donor  { transactionId, email }
 *
 * Updates the donor email on the related Donor record. Does not send mail;
 * subsequent "Email link" actions use the new address.
 */
export async function POST(req: NextRequest) {
  const { transactionId, email } = await req.json();

  if (typeof email !== "string") {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const trimmed = email.trim();
  if (trimmed && !trimmed.includes("@")) {
    return NextResponse.json({ error: "Enter a valid email" }, { status: 400 });
  }

  const tx = await prisma.failedTransaction.findUnique({
    where: { id: transactionId },
    select: { donorId: true },
  });
  if (!tx) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });

  const donor = await prisma.donor.update({
    where: { id: tx.donorId },
    data: { email: trimmed || null },
  });

  return NextResponse.json({ ok: true, email: donor.email });
}
