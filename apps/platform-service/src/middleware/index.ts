export type PlatformMiddleware = (next: unknown) => unknown;

export const platformMiddleware: PlatformMiddleware[] = [];
