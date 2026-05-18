import { SignUp } from "@clerk/nextjs";
import Link from "next/link";
import { isClerkConfigured } from "../../../lib/env";

export default function SignUpPage() {
  return (
    <main className="shell">
      <div className="container">
        <section className="hero auth-hero">
          <article className="hero-card">
            <span className="eyebrow">Create Account</span>
            <h1>Create an account and connect GitHub as the primary identity provider.</h1>
            <p>
              Users sign up through Clerk and then use GitHub-backed sessions to access the command center, sync
              repositories, and review release operations.
            </p>
            <div className="mini-actions">
              <span className="pill pill-low">GitHub social login</span>
              <span className="pill pill-low">Redirect to workspace</span>
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
              <SignUp
                signInUrl="/sign-in"
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
