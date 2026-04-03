"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMiniKit } from "@worldcoin/minikit-js/minikit-provider";
import { IrisLogo } from "@/components/iris-logo";
import { cn } from "@/lib/utils";

const browserLinks = [
  { href: "/", label: "Home" },
  { href: "/link", label: "Link" },
  { href: "/app", label: "Register" },
  { href: "/app/manage", label: "Agents" },
];

const miniAppLinks = [
  { href: "/app", label: "Home" },
  { href: "/app/register", label: "Register" },
  { href: "/app/manage", label: "Agents" },
];

export function Nav() {
  const pathname = usePathname();
  const { isInstalled } = useMiniKit();
  const links = isInstalled ? miniAppLinks : browserLinks;
  const logoHref = isInstalled ? "/app" : "/";

  return (
    <header
      className="backdrop-blur-md"
      style={{
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(9,9,11,0.8)",
      }}
    >
      <nav className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <Link
          href={logoHref}
          className="flex items-center gap-2 transition-opacity hover:opacity-80"
        >
          <IrisLogo size={22} />
          <span className="text-[17px] font-semibold tracking-tight">HumanENS</span>
        </Link>
        <div className="flex gap-6 text-[13px]">
          {links.map(({ href, label }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "transition-colors relative py-1",
                  isActive
                    ? "font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
                {isActive && (
                  <span
                    className="absolute -bottom-[13px] left-0 right-0 h-[2px] rounded-full"
                    style={{
                      background: "linear-gradient(90deg, #6EE7B7, #3889FF)",
                      boxShadow: "0 0 8px rgba(110,231,183,0.3)",
                    }}
                  />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
