import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect(user.role === "BRANCH" ? "/branch" : "/ho");
  return <LoginForm />;
}
