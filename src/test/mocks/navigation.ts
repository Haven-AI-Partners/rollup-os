import { vi } from "vitest";

/**
 * Mock for next/navigation. Call setupNavigationMocks() in beforeEach.
 * Returns mock functions for customization.
 */
export function setupNavigationMocks(pathname = "/test-portco/pipeline") {
  const push = vi.fn();
  const replace = vi.fn();
  const back = vi.fn();
  const refresh = vi.fn();

  vi.mock("next/navigation", () => ({
    useRouter: () => ({ push, replace, back, refresh }),
    usePathname: () => pathname,
    useParams: () => ({}),
    useSearchParams: () => new URLSearchParams(),
    redirect: vi.fn(),
  }));

  return { push, replace, back, refresh };
}
