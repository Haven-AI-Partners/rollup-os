"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, TreePine, CheckCircle, XCircle } from "lucide-react";
import { generateThesisTree } from "@/lib/actions/thesis";
import { useRouter } from "next/navigation";

interface GenerateThesisButtonProps {
  dealId: string;
  portcoId: string;
  portcoSlug: string;
  hasProfile: boolean;
}

export function GenerateThesisButton({
  dealId,
  portcoId,
  portcoSlug,
  hasProfile,
}: GenerateThesisButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      await generateThesisTree(dealId, portcoId, portcoSlug);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate thesis tree");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-md border border-dashed p-8 text-center space-y-4">
      <TreePine className="size-8 text-muted-foreground mx-auto" />
      <div>
        <h3 className="text-sm font-semibold">No thesis tree yet</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Generate a DD thesis tree to map all information needed for this deal.
          {hasProfile
            ? " Data from the IM analysis will be pre-filled automatically."
            : " Process an IM first for automatic data pre-fill."}
        </p>
      </div>
      <Button onClick={handleGenerate} disabled={loading} className="gap-2">
        {loading ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <TreePine className="size-4" />
            Generate Thesis Tree
          </>
        )}
      </Button>
      {error && (
        <div className="flex items-center justify-center gap-1.5 text-sm text-red-600">
          <XCircle className="size-4" />
          {error}
        </div>
      )}
    </div>
  );
}
