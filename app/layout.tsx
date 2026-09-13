import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sayso — Speech therapy, thoughtfully connected",
  description:
    "Scheduling, clinical notes, and family communication for modern speech therapy clinics.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
