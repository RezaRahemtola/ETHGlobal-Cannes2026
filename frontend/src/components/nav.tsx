"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IrisLogo } from "@/components/iris-logo";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Home" },
  { href: "/link", label: "Link" },
  { href: "/app", label: "Register" },
  { href: "/app/manage", label: "Agents" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <header className="border-b border-[var(--border-subtle)]">
      <nav className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <IrisLogo size={22} />
          <span className="text-[17px] font-semibold tracking-tight">
            HumanENS
          </span>
        </Link>
        <div className="flex gap-6 text-[13px]">
          {links.map(({ href, label }) => {
            const isActive =
              href === "/"
                ? pathname === "/"
                : pathname.startsWith(href) &&
                  (href !== "/app" || pathname === "/app");
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "transition-colors",
                  isActive
                    ? "font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
