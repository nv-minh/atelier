import type { NextAuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "./db";

const ghId = process.env.GITHUB_CLIENT_ID;
const ghSecret = process.env.GITHUB_CLIENT_SECRET;
const googleId = process.env.GOOGLE_CLIENT_ID;
const googleSecret = process.env.GOOGLE_CLIENT_SECRET;

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers: [
    // Google is the sign-in method the app offers. Like GitHub below, it is
    // only registered when its credentials exist, so a missing env var
    // degrades to "no button" rather than a crash at boot.
    //
    // allowDangerousEmailAccountLinking attaches a new Google Account row to
    // an EXISTING User with the same email. The app's users predate Google
    // sign-in — their User rows were created through GitHub — and User.email
    // is unique, so without this flag NextAuth would refuse the sign-in with
    // OAuthAccountNotLinked and they could reach neither their old account nor
    // a new one. The flag's risk is that it trusts the provider's email
    // verification; Google verifies emails, which is exactly the case it is
    // safe for. It is deliberately NOT set on GitHub.
    ...(googleId && googleSecret
      ? [
          GoogleProvider({
            clientId: googleId,
            clientSecret: googleSecret,
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
    // GitHub stays registered even though its button is gone from the login
    // page: removing it would orphan the existing github Account rows.
    // Restoring the button is the only step needed to bring it back.
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
