import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  async function login(formData: FormData) {
    "use server";
    try {
      await signIn("credentials", {
        email: formData.get("email"),
        password: formData.get("password"),
        redirectTo: "/admin",
      });
    } catch (e) {
      if (e instanceof AuthError) redirect("/admin/login?error=1");
      throw e; // re-throw redirect signals
    }
  }

  return (
    <div className="card mx-auto max-w-sm p-8">
      <h1 className="text-2xl font-bold">Admin sign in 🔑</h1>
      <form action={login} className="mt-6 space-y-4">
        {error && (
          <p className="rounded-xl border-2 border-ink bg-primary/10 px-3 py-2 text-sm font-bold text-primary-hover">
            Invalid email or password.
          </p>
        )}
        <div>
          <label className="mb-1 block text-sm font-bold text-ink/70">Email</label>
          <input name="email" type="email" required className="input" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-bold text-ink/70">
            Password
          </label>
          <input name="password" type="password" required className="input" />
        </div>
        <button type="submit" className="btn-primary w-full">
          Sign in
        </button>
      </form>
    </div>
  );
}
