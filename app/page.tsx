import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { recoveredTotal, openTotal } from "@/lib/recovery";
import { money, shortDate } from "@/lib/format";
import { ActionButtons } from "@/components/ActionButtons";
import { DateRangePicker } from "@/components/DateRangePicker";
import { StatusSelect } from "@/components/StatusSelect";
import { LiveRefresh } from "@/components/LiveRefresh";
import { verifySession, SESSION_COOKIE } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Search = { start?: string; end?: string; status?: string };

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const signedInAs = await verifySession(cookieStore.get(SESSION_COOKIE)?.value);

  const end = params.end ? new Date(`${params.end}T23:59:59`) : new Date();
  const start = params.start
    ? new Date(`${params.start}T00:00:00`)
    : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

  const { totalCents, count } = await recoveredTotal(start, end);
  const { totalCents: openValue } = await openTotal(start, end);

  const statusFilter = params.status && params.status !== "ALL" ? params.status : undefined;

  const transactions = await prisma.failedTransaction.findMany({
    where: {
      failedAt: { gte: start, lte: end },
      ...(statusFilter ? { status: statusFilter } : {}),
    },
    include: { donor: true, contactLogs: { orderBy: { createdAt: "desc" }, take: 1 } },
    orderBy: { failedAt: "desc" },
    take: 200,
  });

  return (
    <main className="page">
      <header className="masthead">
        <div>
          <p className="eyebrow">Donor recovery</p>
          <h1>Lost donations, found again</h1>
        </div>
        <div className="masthead-controls">
          <LiveRefresh />
          <DateRangePicker
            start={start.toISOString().slice(0, 10)}
            end={end.toISOString().slice(0, 10)}
            status={params.status ?? "ALL"}
          />
        </div>
      </header>

      {signedInAs && (
        <div className="session-bar">
          Signed in as {signedInAs} ·{" "}
          <form action="/api/auth/logout" method="POST" className="logout-form">
            <button type="submit" className="link-btn">
              Log out
            </button>
          </form>
        </div>
      )}

      <section className="totals">
        <div className="total-card total-card--hero">
          <span className="total-label">Recovered in this period</span>
          <span className="total-value">{money(totalCents)}</span>
          <span className="total-sub">
            {count} donation{count === 1 ? "" : "s"} turned from failed to success
          </span>
        </div>
        <div className="total-card">
          <span className="total-label">Still recoverable</span>
          <span className="total-value total-value--muted">{money(openValue)}</span>
          <span className="total-sub">across open transactions below</span>
        </div>
      </section>

      <section className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Donor</th>
              <th>Amount</th>
              <th>Failed</th>
              <th>Reason</th>
              <th>Status</th>
              <th>Recovered via</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 && (
              <tr>
                <td colSpan={7} className="empty">
                  No failed transactions in this date range. Adjust the dates
                  above, or run the backfill script to import history from
                  Stripe.
                </td>
              </tr>
            )}
            {transactions.map((tx) => (
              <tr key={tx.id} className={tx.status === "RECOVERED" ? "row--recovered" : ""}>
                <td>
                  <div className="donor-name">{tx.donor.name ?? "Unknown donor"}</div>
                  <div className="donor-contact">
                    {tx.donor.email ?? "no email"}
                    {tx.donor.phone ? ` · ${tx.donor.phone}` : ""}
                  </div>
                </td>
                <td className="amount">{money(tx.amount, tx.currency)}</td>
                <td>{shortDate(tx.failedAt)}</td>
                <td>
                  <span className="reason" title={tx.failureMessage ?? ""}>
                    {tx.failureCode ?? "unknown"}
                  </span>
                </td>
                <td>
                  <span className={`badge badge--${tx.status.toLowerCase()}`}>
                    {tx.status}
                  </span>
                  <StatusSelect
                    transactionId={tx.id}
                    status={tx.status}
                    amount={tx.amount}
                    currency={tx.currency}
                  />
                  {tx.contactLogs[0] && tx.status === "CONTACTED" && (
                    <div className="last-contact">
                      last: {tx.contactLogs[0].method.toLowerCase()},{" "}
                      {shortDate(tx.contactLogs[0].createdAt)}
                    </div>
                  )}
                </td>
                <td>
                  {tx.status === "RECOVERED" ? (
                    <span className="recovered-via">
                      {tx.recoveryMethod?.replace("_", " ").toLowerCase()}
                      {tx.recoveredAt ? ` · ${shortDate(tx.recoveredAt)}` : ""}
                    </span>
                  ) : (
                    <span className="dash">—</span>
                  )}
                </td>
                <td>
                  <ActionButtons
                    transactionId={tx.id}
                    status={tx.status}
                    email={tx.donor.email}
                    phone={tx.donor.phone}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
