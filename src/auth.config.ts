import type { NextAuthConfig } from "next-auth";

// Edge-safe config (no DB / native deps) — imported by middleware.
export const authConfig = {
  pages: { signIn: "/admin/login" },
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      // The login page is always reachable.
      if (pathname.startsWith("/admin/login")) return true;
      // Everything else under /admin requires a session.
      if (pathname.startsWith("/admin")) return !!auth?.user;
      return true;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
