import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import Providers from "./providers";
import Nav from "./nav";

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
              <div className="mx-auto max-w-[1600px] flex flex-wrap items-center justify-between gap-4 px-4 py-3">
                <Link href="/calendar" className="text-lg font-semibold text-slate-900 hover:text-indigo-600 transition-colors">
                  Calendar
                </Link>
                <Nav />
              </div>
            </header>
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
