import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function authorizeCredentials(credentials) {
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

export const authOptions = {
    adapter: PrismaAdapter(prisma),
    providers: [
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
    },
    callbacks: {
        jwt: async ({ token, user }) => {
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
