declare module "node:test" {
  interface TestContext {
    name: string;
  }
  export default function test(
    name: string,
    fn: (context: TestContext) => void | Promise<void>,
  ): void;
}
declare module "node:assert/strict" {
  const assert: {
    equal(actual: unknown, expected: unknown): void;
    rejects(
      fn: () => Promise<unknown>,
      matcher?: RegExp | { message?: RegExp },
    ): Promise<void>;
  };
  export default assert;
}
