import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import { isClerkConfigured } from "../../../lib/env";

export default function SignInPage() {
  return (
    <main className="shell">
      <div className="container">
        <section className="hero auth-hero">
          <article className="hero-card">
            <span className="eyebrow">GitHub Sign-In</span>
            <h1>Sign in to connect GitHub and generate live operational insights.</h1>
            <p>
              ControlTower AI uses Clerk for authentication. Enable the GitHub social provider in Clerk so users can
              sign in with GitHub and then sync repositories from the workspace.
            </p>
            <div className="mini-actions">
              <span className="pill pill-low">GitHub login</span>
              <span className="pill pill-low">Clerk-backed sessions</span>
            </div>
            {!isClerkConfigured() ? (
              <div className="callout" style={{ marginTop: 18 }}>
                <strong>Clerk keys are missing</strong>
                <p className="muted">
                  Set `CLERK_SECRET_KEY` and `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, then enable the GitHub provider in Clerk.
                </p>
              </div>
            ) : null}
            <div className="actions">
              <Link href="/" className="button button-secondary">Back Home</Link>
            </div>
          </article>
          <aside className="panel auth-panel">
            {isClerkConfigured() ? (
              <SignIn
                signUpUrl="/sign-up"
                fallbackRedirectUrl="/workspace"
                forceRedirectUrl="/workspace"
              />
            ) : null}
          </aside>
        </section>
      </div>
    </main>
  );
}
