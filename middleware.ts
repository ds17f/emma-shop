import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  // Run middleware only on admin routes.
  matcher: ["/admin/:path*"],
};
