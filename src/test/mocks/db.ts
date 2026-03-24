import { vi } from "vitest";

/**
 * Creates a chainable mock DB object that mimics Drizzle's query builder.
 * Each method returns the same chain, allowing: db.select().from().where().limit()
 * Use `mockResolvedValue` on the chain to control what queries return.
 */
export function createMockDb() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};

  const createChain = (): any =>
    new Proxy(
      {},
      {
        get(_, prop) {
          if (prop === "then") return undefined; // Make it non-thenable by default
          if (!chain[prop as string]) {
            chain[prop as string] = vi.fn().mockReturnValue(createChain());
          }
          return chain[prop as string];
        },
      }
    );

  return {
    db: createChain(),
    chain,
  };
}

/**
 * Creates a mock DB that resolves specific queries with specific values.
 * For simpler tests where you just need the final query to resolve.
 */
export function createResolvingMockDb(resolvedValue: unknown = []) {
  const thenable = {
    then: (resolve: (val: unknown) => void) => {
      resolve(resolvedValue);
      return thenable;
    },
  };

  const chain: any = new Proxy(
    {},
    {
      get(_, prop) {
        if (prop === "then") return thenable.then;
        return vi.fn().mockReturnValue(chain);
      },
    }
  );

  return chain;
}
