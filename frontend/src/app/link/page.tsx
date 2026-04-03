"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { ConnectButton } from "@/components/connect-button";
import { StepIndicator } from "@/components/step-indicator";
import { useEnsNames } from "@/hooks/use-ens-names";
import { useSetTextRecord } from "@/hooks/use-set-text-record";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LinkPage() {
  const { isConnected } = useAccount();
  const { names, isLoading: loadingNames } = useEnsNames();
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const { setTextRecord, isPending, isConfirming, isSuccess, hash, error } = useSetTextRecord();

  const label = selectedName?.replace(/\.eth$/, "");

  if (isSuccess) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16">
        <StepIndicator currentStep={1} />
        <Card className="mt-6 text-center">
          <CardHeader>
            <CardTitle className="text-green-400">Record Set ✓</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              <code className="text-blue-400">humanens</code> ={" "}
              <code className="text-green-400">{label}.humanens.eth</code>
            </p>
            {hash && <p className="text-xs text-muted-foreground break-all">Tx: {hash}</p>}
            <div className="pt-4 space-y-2">
              <p className="font-semibold">Continue in World App</p>
              <p className="text-sm text-muted-foreground">
                Open the HumanENS Mini App in World App to verify with World ID and claim your
                subname.
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-16 space-y-6">
      <StepIndicator currentStep={1} />

      <div>
        <h1 className="text-2xl font-bold">Link your ENS name</h1>
        <p className="text-muted-foreground">
          Set a text record on your .eth name to prove ownership
        </p>
      </div>

      {/* Connect wallet */}
      <Card>
        <CardContent className="flex items-center justify-between pt-4">
          <span className="text-sm text-muted-foreground">Wallet</span>
          <ConnectButton />
        </CardContent>
      </Card>

      {/* Select ENS name */}
      <Card className={!isConnected ? "opacity-50 pointer-events-none" : ""}>
        <CardHeader>
          <CardTitle className="text-sm font-normal text-muted-foreground">
            Your ENS names
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingNames ? (
            <p className="text-sm text-muted-foreground">Loading names...</p>
          ) : names.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {isConnected ? "No ENS names found for this address" : "Connect your wallet first"}
            </p>
          ) : (
            <div className="space-y-2">
              {names.map((name) => (
                <button
                  key={name}
                  onClick={() => setSelectedName(name)}
                  className={`w-full rounded-lg border p-3 text-left text-sm transition-colors ${
                    selectedName === name ? "border-primary bg-primary/5" : "hover:bg-muted"
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview */}
      <Card className={!selectedName ? "opacity-50 pointer-events-none" : ""}>
        <CardHeader>
          <CardTitle className="text-sm font-normal text-muted-foreground">
            Will set text record
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">
            <code className="text-blue-400">humanens</code> ={" "}
            <code className="text-green-400">{label || "..."}.humanens.eth</code>
          </p>
        </CardContent>
      </Card>

      {/* Submit */}
      <Button
        className="w-full"
        size="lg"
        disabled={!selectedName || isPending || isConfirming}
        onClick={() => selectedName && setTextRecord(selectedName)}
      >
        {isPending ? "Confirm in wallet..." : isConfirming ? "Confirming..." : "Set Record"}
      </Button>

      {error && <p className="text-sm text-destructive">{error.message}</p>}
    </main>
  );
}
