import { ClerkProvider } from "@clerk/nextjs";
import { isClerkConfigured } from "../lib/env";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  if (!isClerkConfigured()) {
    return <>{children}</>;
  }

  return (
    <ClerkProvider
      appearance={{
        elements: {
          card: {
            borderRadius: "24px",
            boxShadow: "0 20px 60px rgba(17, 42, 76, 0.12)",
            border: "1px solid #d4dfeb"
          }
        }
      }}
    >
      {children}
    </ClerkProvider>
  );
}
