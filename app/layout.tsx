import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "Family Calendar",
  description: "A unified family calendar with AI scheduling."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <div className="min-h-screen bg-slate-50 text-slate-900">
            <header className="border-b border-slate-200 bg-white">
              <div className="container-page flex flex-wrap items-center justify-between gap-4 py-4">
                <Link href="/" className="text-lg font-semibold text-slate-900">
                  Family Calendar
                </Link>
                <nav className="flex flex-wrap gap-3 text-sm font-semibold text-slate-600">
                  <Link className="rounded-full px-3 py-2 hover:bg-slate-100" href="/calendar">
                    Calendar
                  </Link>
                  <Link className="rounded-full px-3 py-2 hover:bg-slate-100" href="/admin">
                    Admin
                  </Link>
                  <button className="rounded-full bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700">
                    Invite family
                  </button>
                </nav>
              </div>
            </header>
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
