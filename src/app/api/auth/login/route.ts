import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, users } from "@/db";
import { SESSION_COOKIE } from "@/lib/session";

export async function POST(req: Request) {
  const { email, password } = await req.json();
  const normalised = String(email ?? "").trim().toLowerCase();

  const user = await db.query.users.findFirst({ where: eq(users.email, normalised) });
  // ASSUMPTION: plaintext comparison, prototype only.
  if (!user || user.password !== password) {
    return NextResponse.json({ error: "That email and password do not match an account." }, { status: 401 });
  }

  const res = NextResponse.json({ redirect: user.role === "BRANCH" ? "/branch" : "/ho" });
  res.cookies.set(SESSION_COOKIE, user.id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 8 });
  return res;
}
