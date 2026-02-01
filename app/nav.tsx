"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/calendar", label: "Calendar" },
  { href: "/admin", label: "Admin" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2 text-sm font-semibold">
      {navItems.map((item) => {
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
