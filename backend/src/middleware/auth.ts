import type { NextFunction, Request, Response } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";

const SUPABASE_URL = process.env.SUPABASE_URL;
const AUD = process.env.SUPABASE_JWT_AUD ?? "authenticated";

if (!SUPABASE_URL) {
  throw new Error("Missing SUPABASE_URL env var");
}

const jwks = createRemoteJWKSet(
  new URL(`${SUPABASE_URL.replace(/\/+$/, "")}/auth/v1/.well-known/jwks.json`),
);

export type AuthedRequest = Request & {
  user?: { id: string; email?: string };
};

export async function requireUser(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.header("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    res.status(401).json({ error: "Missing bearer token" });
    return;
  }
  try {
    const { payload } = await jwtVerify(match[1], jwks, { audience: AUD });
    req.user = { id: String(payload.sub), email: payload.email as string | undefined };
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid token", detail: String(err) });
  }
}
