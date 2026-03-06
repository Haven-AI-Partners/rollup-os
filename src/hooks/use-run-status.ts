"use client";

import { useState, useEffect, useCallback } from "react";

interface RunStatus {
  id: string;
  status: string;
  output: unknown;
  error: unknown;
  finishedAt: string | null;
}

type RunState = "idle" | "running" | "completed" | "failed";

export function useRunStatus(runId: string | null) {
  const [state, setState] = useState<RunState>(runId ? "running" : "idle");
  const [output, setOutput] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  const poll = useCallback(async () => {
    if (!runId) return;

    try {
      const res = await fetch(`/api/processing/status?runId=${runId}`);
      if (!res.ok) return;

      const data: RunStatus = await res.json();

      if (data.status === "COMPLETED") {
        setState("completed");
        setOutput(data.output);
        return true; // stop polling
      }
      if (data.status === "FAILED" || data.status === "CRASHED" || data.status === "SYSTEM_FAILURE" || data.status === "INTERRUPTED" || data.status === "CANCELED") {
        setState("failed");
        const errMsg = data.error
          ? typeof data.error === "string" ? data.error : JSON.stringify(data.error)
          : `Task ${data.status.toLowerCase()}`;
        setError(errMsg);
        return true; // stop polling
      }

      return false; // keep polling
    } catch {
      return false;
    }
  }, [runId]);

  useEffect(() => {
    if (!runId) return;

    setState("running");
    setOutput(null);
    setError(null);

    let stopped = false;
    const interval = setInterval(async () => {
      if (stopped) return;
      const done = await poll();
      if (done) {
        stopped = true;
        clearInterval(interval);
      }
    }, 3000); // poll every 3 seconds

    // Initial poll
    poll().then((done) => {
      if (done) {
        stopped = true;
        clearInterval(interval);
      }
    });

    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [runId, poll]);

  return { state, output, error };
}
