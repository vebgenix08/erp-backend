import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import type { AuthJwtClaimsPlaceholder, CognitoIntegrationConfig, CognitoVerificationResult } from "./types";

function getIssuer(config: CognitoIntegrationConfig): string {
  return (
    config.issuer ??
    `https://cognito-idp.${config.region}.amazonaws.com/${config.userPoolId}`
  );
}

function toClaims(payload: JWTPayload): AuthJwtClaimsPlaceholder {
  return {
    sub: typeof payload.sub === "string" ? payload.sub.trim() || undefined : undefined,
    email: typeof payload.email === "string" ? payload.email.trim() || undefined : undefined,
    role:
      typeof payload["custom:role"] === "string"
        ? payload["custom:role"].trim() || undefined
        : typeof payload["role"] === "string"
          ? payload["role"].trim() || undefined
          : undefined,
    permissions: Array.isArray(payload["custom:permissions"])
      ? payload["custom:permissions"].filter((value): value is string => typeof value === "string")
      : typeof payload["custom:permissions"] === "string"
        ? payload["custom:permissions"].split(/[,\s]+/g)
        : typeof payload["permissions"] === "string"
          ? payload["permissions"].split(/[,\s]+/g)
          : undefined,
    tenantId:
      typeof payload["custom:tenantId"] === "string"
        ? payload["custom:tenantId"].trim() || undefined
        : typeof payload["tenantId"] === "string"
          ? payload["tenantId"].trim() || undefined
          : undefined,
    tenantCode:
      typeof payload["custom:tenantCode"] === "string"
        ? payload["custom:tenantCode"].trim() || undefined
        : typeof payload["tenantCode"] === "string"
          ? payload["tenantCode"].trim() || undefined
          : undefined,
  };
}

export async function verifyCognitoJwt(
  token: string,
  config: CognitoIntegrationConfig,
): Promise<CognitoVerificationResult> {
  if (!token.trim()) {
    return { verified: false, reason: "missing_token" };
  }
  if (!config.userPoolId.trim() || !config.clientId.trim() || !config.region.trim()) {
    return { verified: false, reason: "missing_cognito_config" };
  }

  const issuer = getIssuer(config);
  const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
  const { payload } = await jwtVerify(token, jwks, {
    issuer,
    audience: config.clientId,
  });
  return {
    verified: true,
    claims: toClaims(payload),
  };
}
