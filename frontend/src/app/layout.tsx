import Providers from "@/providers";
import "@worldcoin/mini-apps-ui-kit-react/styles.css";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HumanENS",
  description: "Biometric-bound ENS identities using World ID",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <Providers>
          <header className="border-b">
            <nav className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
              <Link href="/" className="font-bold">
                HumanENS
              </Link>
              <div className="flex gap-4 text-sm text-muted-foreground">
                <Link href="/link" className="hover:text-foreground transition-colors">
                  Link
                </Link>
                <Link href="/app" className="hover:text-foreground transition-colors">
                  Register
                </Link>
                <Link href="/app/manage" className="hover:text-foreground transition-colors">
                  Agents
                </Link>
              </div>
            </nav>
          </header>
          {children}
        </Providers>
      </body>
    </html>
  );
}
