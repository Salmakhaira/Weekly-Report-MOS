import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, users } from "@/db";

// ASSUMPTION: dummy authentication for the prototype. The cookie holds the user id
// in plain text and is not signed. Swap for NextAuth / Supabase Auth before real use.
export const SESSION_COOKIE = "srm_session";

export type Role = "BRANCH" | "HO" | "ADMIN";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  branchId: string | null;
  branchName: string | null;
  branchCode: string | null;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const id = store.get(SESSION_COOKIE)?.value;
  if (!id) return null;

  const row = db.query.users.findFirst({ where: eq(users.id, id), with: { branch: true } }).sync();
  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    branchId: row.branchId,
    branchName: row.branch?.name ?? null,
    branchCode: row.branch?.code ?? null,
  };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireBranchUser(): Promise<SessionUser & { branchId: string }> {
  const user = await requireUser();
  if (!user.branchId) redirect("/ho");
  return user as SessionUser & { branchId: string };
}

export async function requireHO(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role === "BRANCH") redirect("/branch");
  return user;
}
