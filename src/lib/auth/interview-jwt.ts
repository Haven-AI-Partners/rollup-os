import { NextRequest } from "next/server";
import { jwtVerify, SignJWT } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.INTERVIEW_JWT_SECRET || process.env.CLERK_SECRET_KEY || "discovery-interview-secret"
);

export async function validateInterviewSession(req: NextRequest): Promise<string | null> {
  const token = req.cookies.get("discovery_session")?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload.sessionId as string;
  } catch {
    return null;
  }
}

export async function createInterviewToken(sessionId: string): Promise<string> {
  return new SignJWT({ sessionId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}
