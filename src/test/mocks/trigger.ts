import { vi } from "vitest";

export function setupTriggerMocks() {
  const triggerFn = vi.fn().mockResolvedValue({ id: "run-mock-001" });
  const retrieveFn = vi.fn().mockResolvedValue({
    id: "run-mock-001",
    status: "COMPLETED",
    output: { success: true },
    error: null,
    finishedAt: new Date().toISOString(),
  });

  vi.doMock("@trigger.dev/sdk", () => ({
    tasks: { trigger: triggerFn },
    runs: { retrieve: retrieveFn },
  }));

  return { triggerFn, retrieveFn };
}
