/**
 * Extend NextAuth types with custom session fields.
 */
import "next-auth";

declare module "next-auth" {
    interface Session {
        user: {
            id: string;
            name?: string | null;
            email?: string | null;
            image?: string | null;
            subscriptionTier: string;
            authProvider?: string;
        };
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        userId?: number;
        subscriptionTier?: string;
        authProvider?: string;
    }
}
