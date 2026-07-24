import type { NextAuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "./db";

const ghId = process.env.GITHUB_CLIENT_ID;
const ghSecret = process.env.GITHUB_CLIENT_SECRET;

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers: [
    // GitHub provider is only enabled when credentials are configured.
    ...(ghId && ghSecret
      ? [GitHubProvider({ clientId: ghId, clientSecret: ghSecret })]
      : []),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.uid = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.uid) {
        (session.user as any).id = token.uid as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
};
