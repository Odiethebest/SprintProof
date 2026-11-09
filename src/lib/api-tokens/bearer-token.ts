import { API_TOKEN_PREFIX } from "./api-token";

// "Bearer" is case-insensitive (RFC 6750). The token is the prefix plus 32
// random bytes in base64url, so anything else can't be one of ours and needs
// no database lookup.
const BEARER_HEADER = new RegExp(
  `^bearer +(${API_TOKEN_PREFIX}[A-Za-z0-9_-]{43})$`,
  "i"
);

// The token in an `Authorization: Bearer <token>` header, or null when the
// header is missing or holds anything else.
export function parseBearerToken({
  authorization,
}: {
  authorization: string | null;
}): string | null {
  if (authorization === null) {
    return null;
  }
  const match = BEARER_HEADER.exec(authorization.trim());
  return match?.[1] ?? null;
}
