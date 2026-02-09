"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "히트맵", icon: "M" },
  { href: "/complex", label: "산업단지", icon: "C" },
  { href: "/compare", label: "비교", icon: "V" },
  { href: "/company", label: "기업", icon: "B" },
];

export default function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[var(--panel-bg)]/90 backdrop-blur border border-[var(--panel-border)] rounded-full px-1 py-1 flex gap-0.5">
      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
              isActive
                ? "bg-blue-500/20 text-blue-400"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
