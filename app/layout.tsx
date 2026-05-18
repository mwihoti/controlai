import "./globals.css";
import type { Metadata } from "next";
import { AuthProvider } from "../components/auth-provider";

export const metadata: Metadata = {
  title: "ControlTower AI",
  description: "AI command center for release risk, blocked work, and incident operations."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
