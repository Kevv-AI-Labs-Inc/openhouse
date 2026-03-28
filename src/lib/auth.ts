/**
 * NextAuth.js v5 configuration for OpenHouse.
 * Supports Google OAuth, Microsoft Entra ID, and one-time magic links.
 */
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { magicLinks, users } from "@/lib/db/schema";
import { getPlanEntitlements, getNextMonthBoundary, resolvePlanTier } from "@/lib/billing";
import {
  getGoogleClientId,
  getGoogleClientSecret,
  getMicrosoftClientId,
  getMicrosoftClientSecret,
  getMicrosoftIssuer,
} from "@/lib/auth-provider-config";
import { hashMagicLinkToken, normalizeMagicLinkEmail } from "@/lib/magic-link";

const googleClientId = getGoogleClientId();
const googleClientSecret = getGoogleClientSecret();
const microsoftClientId = getMicrosoftClientId();
const microsoftClientSecret = getMicrosoftClientSecret();
const microsoftIssuer = getMicrosoftIssuer();

type SupportedProvider = "google" | "microsoft-entra-id" | "magic-link";

async function provisionWorkspaceUser(params: {
  email: string;
  name?: string | null;
  image?: string | null;
  provider: SupportedProvider;
  providerAccountId?: string | null;
}) {
  const db = getDb();
  const email = normalizeMagicLinkEmail(params.email);
  const freeEntitlements = getPlanEntitlements("free");
  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  const userPatch = {
    avatarUrl: params.image || existing?.avatarUrl || null,
    fullName: existing?.fullName || params.name || "Agent",
    usageResetAt: existing?.usageResetAt || getNextMonthBoundary(),
    googleId:
      params.provider === "google"
        ? existing?.googleId || params.providerAccountId || null
        : existing?.googleId || null,
    microsoftEntraId:
      params.provider === "microsoft-entra-id"
        ? existing?.microsoftEntraId || params.providerAccountId || null
        : existing?.microsoftEntraId || null,
  };

  if (!existing) {
    await db.insert(users).values({
      email,
      ...userPatch,
      ...freeEntitlements,
      pdlCreditsUsed: 0,
      aiQueriesUsed: 0,
    });
  } else {
    await db.update(users).set(userPatch).where(eq(users.id, existing.id));
  }

  const [dbUser] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (!dbUser) {
    throw new Error("Workspace user could not be provisioned");
  }

  return dbUser;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      id: "magic-link",
      name: "Magic Link",
      credentials: {
        token: { label: "Token", type: "text" },
      },
      async authorize(credentials) {
        const token = typeof credentials?.token === "string" ? credentials.token.trim() : "";

        if (!token) {
          return null;
        }

        const db = getDb();
        const tokenHash = hashMagicLinkToken(token);
        const [record] = await db
          .select()
          .from(magicLinks)
          .where(eq(magicLinks.tokenHash, tokenHash))
          .limit(1);

        if (!record) {
          return null;
        }

        if (new Date(record.expiresAt).getTime() <= Date.now()) {
          await db.delete(magicLinks).where(eq(magicLinks.id, record.id));
          return null;
        }

        await db.delete(magicLinks).where(eq(magicLinks.id, record.id));

        const dbUser = await provisionWorkspaceUser({
          email: record.email,
          provider: "magic-link",
        });

        return {
          id: String(dbUser.id),
          email: dbUser.email,
          name: dbUser.fullName,
          image: dbUser.avatarUrl,
        };
      },
    }),
    ...(googleClientId && googleClientSecret
      ? [
          Google({
            clientId: googleClientId,
            clientSecret: googleClientSecret,
          }),
        ]
      : []),
    ...(microsoftClientId && microsoftClientSecret
      ? [
          MicrosoftEntraID({
            clientId: microsoftClientId,
            clientSecret: microsoftClientSecret,
            issuer: microsoftIssuer,
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ user, account }) {
      const provider =
        account?.provider === "credentials" ? "magic-link" : account?.provider;

      if (!user.email) {
        const params = new URLSearchParams({ error: "missing-email" });

        if (provider) {
          params.set("provider", provider);
        }

        return `/login?${params.toString()}`;
      }

      if (
        provider !== "google" &&
        provider !== "microsoft-entra-id" &&
        provider !== "magic-link"
      ) {
        return `/login?error=unsupported-provider`;
      }

      if (provider === "magic-link") {
        return true;
      }

      try {
        await provisionWorkspaceUser({
          email: user.email,
          name: user.name,
          image: user.image,
          provider,
          providerAccountId: account?.providerAccountId,
        });
      } catch (error) {
        console.error("[Auth] Sign-in callback failed:", error);
        const params = new URLSearchParams({ error: "account-sync-failed" });
        params.set("provider", provider);
        return `/login?${params.toString()}`;
      }

      return true;
    },
    async jwt({ token, user, account }) {
      const email = user?.email || token.email;

      if (account?.provider) {
        token.authProvider =
          account.provider === "credentials" ? "magic-link" : account.provider;
      }

      if (email) {
        try {
          const db = getDb();
          const [dbUser] = await db
            .select()
            .from(users)
            .where(eq(users.email, email))
            .limit(1);

          if (dbUser) {
            token.userId = dbUser.id;
            token.subscriptionTier = resolvePlanTier({
              subscriptionTier: dbUser.subscriptionTier,
              email: dbUser.email,
            });
          }
        } catch (error) {
          console.error("[Auth] JWT sync failed:", error);
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.userId !== undefined ? String(token.userId) : "";
        session.user.subscriptionTier = token.subscriptionTier as string;
        session.user.authProvider = token.authProvider as string | undefined;
      }

      return session;
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) {
        return `${baseUrl}${url}`;
      }

      try {
        const target = new URL(url);

        if (target.origin === baseUrl) {
          return url;
        }
      } catch {
        return `${baseUrl}/dashboard`;
      }

      return `${baseUrl}/dashboard`;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
  },
});
