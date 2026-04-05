import { cookies } from "next/headers";
import crypto from "crypto";
import { db } from "@/lib/db";

const COOKIE_NAME = "cvz_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

interface SessionData {
  userId: string;
}

function sign(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

function createToken(data: SessionData): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  const signature = sign(payload, secret);
  return `${payload}.${signature}`;
}

function verifyToken(token: string): SessionData | null {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload, secret);
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString());
  } catch {
    return null;
  }
}

export async function createSession(userId: string): Promise<void> {
  const token = createToken({ userId });
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
}

export async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;
  return db.user.findUnique({
    where: { id: session.userId },
    include: { accounts: true },
  });
}

export async function getActiveAccount() {
  const user = await getCurrentUser();
  if (!user) return null;
  return user.accounts.find((a) => a.isActive) ?? user.accounts[0] ?? null;
}

/**
 * Verify a session/pipeline session belongs to the current user.
 * Returns the userId if valid, null otherwise.
 */
export async function verifySessionOwner(sessionId: string): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const session = await db.session.findUnique({
    where: { id: sessionId },
    select: { userId: true },
  });
  if (!session || session.userId !== user.id) return null;
  return user.id;
}
