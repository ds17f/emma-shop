import { auth } from "@/auth";
import { redirect } from "next/navigation";

export async function requireAdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/admin/login");
  return session;
}
