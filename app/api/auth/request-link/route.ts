import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { isAllowedEmail, createLoginToken } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * POST /api/auth/request-link  { email }
 *
 * Always responds with the same generic message, whether or not the email
 * is on the allowlist, so this endpoint can't be used to enumerate staff
 * addresses. Only allowlisted emails actually get a token + email sent.
 */
export async function POST(req: NextRequest) {
  const { email } = await req.json();

  if (typeof email === "string" && email.includes("@") && isAllowedEmail(email)) {
    const token = await createLoginToken(email);
    const appUrl = process.env.APP_URL ?? "http://localhost:3000";
    const orgName = process.env.ORG_NAME ?? "Our Charity";
    const link = `${appUrl}/api/auth/callback?token=${token}`;

    if (process.env.NODE_ENV !== "production") {
      console.log(`[dev] Magic sign-in link for ${email}: ${link}`);
    }

    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: process.env.EMAIL_FROM ?? "donations@example.org",
        to: email,
        subject: `Sign in to ${orgName} Donor Recovery`,
        html: `
          <p>Click below to sign in to the Donor Recovery dashboard:</p>
          <p><a href="${link}">Sign in</a></p>
          <p>This link is valid for 15 minutes and can only be used once. If you
          didn't request this, you can safely ignore this email.</p>
        `,
      });
    } catch (err) {
      // Don't let a broken email provider change the response shape (that
      // would leak allowlist membership) or block dev-mode console testing.
      console.error("Failed to send sign-in email:", err);
    }
  }

  return NextResponse.json({
    ok: true,
    message: "If that email is on our team list, a sign-in link is on its way.",
  });
}
