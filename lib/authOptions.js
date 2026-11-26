import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { getOidcConfig, passwordLoginEnabled, sessionMaxAge } from "@/lib/oidc";
import { handleOidcSignIn } from "@/lib/sso";

export async function authorizeCredentials(credentials) {
    // PASSWORD_LOGIN=false: only SSO may sign in.
    if (!passwordLoginEnabled()) return null;
    if (!credentials?.email || !credentials?.password) return null;
    const user = await prisma.user.findUnique({ where: { email: credentials.email } });
    // Compare the provided password with the hashed password
    if (!user || !user.password) return null;
    if (!bcrypt.compareSync(credentials.password, user.password)) return null;
    // Service accounts (role API) may only use API tokens.
    if (user.role === "API") return null;
    // Deactivated users cannot sign in.
    if (user.disabledAt) return null;
    return { id: user.id, name: user.name, email: user.email, role: user.role };
}

/** NextAuth provider for the configured OIDC issuer (env is fixed per process). */
export function oidcProvider(config) {
    return {
        id: "oidc",
        name: config.name,
        type: "oauth",
        wellKnown: `${config.issuer.replace(/\/+$/, "")}/.well-known/openid-configuration`,
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        authorization: { params: { scope: config.scopes } },
        idToken: true,
        checks: ["pkce", "state"],
        profile(p) {
            return { id: p.sub, name: p.name ?? p.preferred_username, email: p.email ?? null };
        },
    };
}

const oidcConfig = getOidcConfig();

export const authOptions = {
    adapter: PrismaAdapter(prisma),
    providers: [
        ...(oidcConfig ? [oidcProvider(oidcConfig)] : []),
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "text" },
                password: { label: "Password", type: "password" },
            },
            authorize: (credentials) => authorizeCredentials(credentials),
        }),
    ],
    session: {
        strategy: "jwt",
        maxAge: sessionMaxAge(),
    },
    callbacks: {
        signIn: async ({ account, profile }) => {
            if (account?.provider !== "oidc") return true;
            const config = getOidcConfig();
            if (!config) return "/signin?error=SsoNoAccess";
            return handleOidcSignIn({ account, profile, config });
        },
        jwt: async ({ token, user, account }) => {
            if (account) token.sso = account.provider === "oidc";
            if (user) {
                token.id = user.id;
                token.role = user.role; // Attach role to token
                return token;
            }
            // Re-read the role on every session check so that demotions and
            // deletions take effect immediately instead of when the JWT expires.
            try {
                const current = await prisma.user.findUnique({
                    where: { id: token.id || token.sub },
                    select: { role: true, disabledAt: true },
                });
                token.role = current && current.role !== "API" && !current.disabledAt ? current.role : null;
            } catch (error) {
                console.error("Failed to refresh session role:", error);
            }
            return token;
        },
        session: async ({ session, token }) => {
            if (session?.user) {
                session.user.id = token.id || token.sub;
                session.user.role = token.role; // Attach role to session
                session.user.sso = token.sso === true;
            }
            return session;
        },
        redirect: async () => "/dashboard",
    },
    pages: {
        signIn: "/signin",
    },
};

export default authOptions;
