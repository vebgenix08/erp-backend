declare module "node:test" {
  const test: (name: string, fn: () => void | Promise<void>) => void;
  export default test;
}

declare module "node:assert/strict" {
  interface Assert {
    equal(actual: unknown, expected: unknown): void;
    ok(value: unknown): void;
    rejects(block: () => Promise<unknown>, expected?: RegExp): Promise<void>;
  }
  const assert: Assert;
  export default assert;
}
