"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { MiniKit } from "@worldcoin/minikit-js";
import { Landing } from "@/components/landing";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    if (MiniKit.isInstalled()) {
      router.replace("/app");
    }
  }, [router]);

  return <Landing ctaHref="/link" />;
}
