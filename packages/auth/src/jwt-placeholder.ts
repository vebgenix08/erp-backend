import type { AuthJwtClaimsPlaceholder } from "./types";

export interface JwtVerificationPlaceholderResult {
  verified: false;
  claims: AuthJwtClaimsPlaceholder | null;
  reason: "not_implemented";
}

export function verifyCognitoJwtPlaceholder(_token: string): JwtVerificationPlaceholderResult {
  return {
    verified: false,
    claims: null,
    reason: "not_implemented",
  };
}
