import "./globals.css";
import type { Metadata } from "next";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "Family Calendar",
  description: "An AI-first household planner for scheduling, coordination, and proactive alerts."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <div className="min-h-screen bg-slate-50 text-slate-900">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
