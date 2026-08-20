import { LoginForm } from "@/components/LoginForm";

export const dynamic = "force-dynamic";

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="page login-page">
      <div className="login-card">
        <p className="eyebrow">Donor recovery</p>
        <h1>Sign in</h1>
        {error === "invalid" && (
          <p className="login-error">
            That link is invalid or has expired. Request a new one below.
          </p>
        )}
        <LoginForm />
      </div>
    </main>
  );
}
