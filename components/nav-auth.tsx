"use client";

import Link from "next/link";
import { SignOutButton, UserButton, useAuth } from "@clerk/nextjs";

export function NavAuth({ clerkConfigured }: { clerkConfigured: boolean }) {
  if (!clerkConfigured) {
    return (
      <div className="nav-auth">
        <Link href="/sign-in" className="button button-secondary">Sign In</Link>
      </div>
    );
  }

  return <ConfiguredNavAuth />;
}

function ConfiguredNavAuth() {
  const { isSignedIn } = useAuth();

  if (!isSignedIn) {
    return (
      <div className="nav-auth">
        <Link href="/sign-in" className="button button-secondary">Sign In</Link>
      </div>
    );
  }

  return (
    <div className="nav-auth">
      <div className="nav-auth-user">
        <Link href="/workspace" className="button button-secondary">Workspace</Link>
        <UserButton />
        <SignOutButton>
          <button type="button" className="button button-secondary">Sign Out</button>
        </SignOutButton>
      </div>
    </div>
  );
}
