import { auth, currentUser } from "@clerk/nextjs/server";
import { isClerkConfigured } from "./env";

export async function getAuthContext() {
  if (!isClerkConfigured()) {
    return {
      enabled: false,
      userId: null as string | null,
      orgId: null as string | null,
      email: null as string | null,
      name: null as string | null
    };
  }

  const [session, user] = await Promise.all([auth(), currentUser()]);

  return {
    enabled: true,
    userId: session.userId,
    orgId: session.orgId ?? null,
    email: user?.primaryEmailAddress?.emailAddress ?? null,
    name: [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.username || null
  };
}
