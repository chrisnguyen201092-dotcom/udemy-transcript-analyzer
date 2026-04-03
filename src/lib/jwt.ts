/**
 * JWT helpers using jose (Edge Runtime compatible).
 * HS256 algorithm with JWT_SECRET from environment.
 */

import { SignJWT, jwtVerify, type JWTPayload } from "jose";

export interface TokenPayload extends JWTPayload {
  userId: string;
  email: string;
  tokenVersion: number;
}

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET environment variable is required");
  return new TextEncoder().encode(secret);
}

/**
 * Sign a JWT token with HS256.
 * @param payload - userId, email, tokenVersion
 * @param expiresIn - e.g. "24h" (default) or "30d" (remember me)
 */
export async function signToken(
  payload: { userId: string; email: string; tokenVersion: number },
  expiresIn: string = "24h"
): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getSecret());
}

/**
 * Verify and decode a JWT token.
 * Returns payload if valid, null if expired/invalid.
 */
export async function verifyToken(
  token: string
): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as TokenPayload;
  } catch {
    return null;
  }
}

/** Cookie name for the session JWT */
export const SESSION_COOKIE = "inkgest_session";
