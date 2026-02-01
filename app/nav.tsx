"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/calendar", label: "Calendar" },
  { href: "/admin", label: "Admin" },
];

export default function Nav() {
  const pathname = usePathname();

  // Sort nav items so active one appears first
  const sortedItems = [...navItems].sort((a, b) => {
    const aActive = pathname === a.href || pathname.startsWith(a.href + "/");
    const bActive = pathname === b.href || pathname.startsWith(b.href + "/");
    if (aActive && !bActive) return -1;
    if (!aActive && bActive) return 1;
    return 0;
  });

  return (
    <nav className="flex flex-wrap gap-2 text-sm font-semibold">
      {sortedItems.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-full px-4 py-2 transition-colors ${
              isActive
                ? "bg-indigo-600 text-white"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
