"use client";

import { useQueryState } from "nuqs";
import { useVerifyName } from "@/hooks/use-verify-name";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export function Verifier() {
  const [name, setName] = useQueryState("name", { defaultValue: "" });
  const { verify, result, isLoading, error } = useVerifyName();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) verify(name.trim());
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          placeholder="alice.eth"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1"
        />
        <Button type="submit" disabled={isLoading || !name.trim()}>
          {isLoading ? "Checking..." : "Check"}
        </Button>
      </form>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {result && (
        <Card>
          <CardContent className="pt-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm">{result.name}</span>
              {result.isVerified ? (
                <Badge className="bg-green-500/10 text-green-500">Verified Human</Badge>
              ) : (
                <Badge variant="secondary">Not Verified</Badge>
              )}
            </div>
            {result.humanensSubname && (
              <p className="text-sm text-muted-foreground">Subname: {result.humanensSubname}</p>
            )}
            {result.worldIdLevel && (
              <p className="text-sm text-muted-foreground">World ID: {result.worldIdLevel}</p>
            )}
            {result.isVerified && (
              <p className="text-xs text-green-500">Bidirectional link verified ✓</p>
            )}
            {result.humanensSubname && !result.reverseRecordValid && (
              <p className="text-xs text-yellow-500">
                Warning: reverse record not set on {result.name}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
