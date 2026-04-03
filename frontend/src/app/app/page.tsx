"use client";

import { useState } from "react";
import {
  MiniKit,
  VerificationLevel,
  type MiniAppVerifyActionSuccessPayload,
} from "@worldcoin/minikit-js";
import { MiniKitGate } from "@/components/minikit-gate";
import { StepIndicator } from "@/components/step-indicator";
import { useRegisterLink } from "@/hooks/use-register-link";
import { WORLD_ACTION_ID } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import Link from "next/link";

function RegisterFlow() {
  const [label, setLabel] = useState("");
  const { register, status, error, txHash } = useRegisterLink();

  const statusMessages: Record<string, string> = {
    idle: "",
    verifying: "Verifying with World ID...",
    attesting: "Getting backend attestation...",
    ccip: "Verifying ENS ownership...",
    sending: "Confirm in World App...",
    confirming: "Confirming transaction...",
    success: "",
    error: "",
  };

  async function handleVerifyAndRegister() {
    const { finalPayload } = await MiniKit.commandsAsync.verify({
      action: WORLD_ACTION_ID,
      verification_level: VerificationLevel.Orb,
    });

    if (finalPayload.status !== "success") return;

    const successPayload = finalPayload as MiniAppVerifyActionSuccessPayload;
    const idkitResult = {
      nullifier_hash: successPayload.nullifier_hash,
      proof: successPayload.proof,
      merkle_root: successPayload.merkle_root,
      verification_level: successPayload.verification_level,
    };

    await register({ label, idkitResult });
  }

  if (status === "success") {
    return (
      <main className="mx-auto max-w-lg px-4 py-16">
        <StepIndicator currentStep={3} />
        <Card className="mt-6 text-center">
          <CardHeader>
            <CardTitle className="text-green-400">{label}.humanens.eth is live ✓</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Your verified HumanENS subname has been registered.
            </p>
            {txHash && <p className="text-xs text-muted-foreground break-all">Tx: {txHash}</p>}
            <Link
              href="/app/manage"
              className="inline-flex mt-4 h-9 items-center justify-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground"
            >
              Manage Agents
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-16 space-y-6">
      <StepIndicator currentStep={2} />

      <div>
        <h1 className="text-2xl font-bold">Register your subname</h1>
        <p className="text-muted-foreground">Verify your identity and claim your .humanens.eth</p>
      </div>

      {/* Label input */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-normal text-muted-foreground">Your label</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Input
              placeholder="alice"
              value={label}
              onChange={(e) => setLabel(e.target.value.toLowerCase())}
              className="flex-1"
              disabled={status !== "idle"}
            />
            <span className="text-sm text-muted-foreground">.humanens.eth</span>
          </div>
        </CardContent>
      </Card>

      {/* Source name preview */}
      {label && (
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Source name</p>
            <p className="text-sm">
              {label}.eth → <span className="text-green-400">{label}.humanens.eth</span>
            </p>
          </CardContent>
        </Card>
      )}

      {/* Status */}
      {statusMessages[status] && (
        <p className="text-sm text-center text-muted-foreground animate-pulse">
          {statusMessages[status]}
        </p>
      )}

      {/* CTA */}
      <Button
        className="w-full"
        size="lg"
        disabled={!label || status !== "idle"}
        onClick={handleVerifyAndRegister}
      >
        {status === "idle" ? "Verify & Register (Gas Free)" : "Processing..."}
      </Button>

      {error && <p className="text-sm text-destructive text-center">{error}</p>}
    </main>
  );
}

export default function AppPage() {
  return (
    <MiniKitGate>
      <RegisterFlow />
    </MiniKitGate>
  );
}
