declare module "node:test" {
  export type TestHandler = () => void | Promise<void>;
  export default function test(name: string, handler: TestHandler): void;
}

declare module "node:assert/strict" {
  export interface Assertion {
    equal(actual: unknown, expected: unknown, message?: string): void;
    ok(value: unknown, message?: string): void;
    rejects(block: () => unknown | Promise<unknown>, error?: RegExp): Promise<void>;
  }

  const assert: Assertion;
  export default assert;
}
