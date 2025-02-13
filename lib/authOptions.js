import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import prisma from "@/lib/prisma";

export const authOptions = {
    adapter: PrismaAdapter(prisma),
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "text" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) return null;
                const user = await prisma.user.findUnique({
                    where: { email: credentials.email },
                });
                // For demo purposes only: plain text password check.
                if (user && user.password === credentials.password) {
                    return user;

                }
                return null;
            },
        }),
    ],
    session: {
        strategy: "jwt",
    },
    callbacks: {
        // This callback is called whenever a JWT is created or updated.
        jwt: async ({ token, user }) => {
            // When signing in, `user` will be available.
            if (user) {
                token.id = user.id;
            }
            return token;
        },
        // This callback is called whenever a session is checked.
        session: async ({ session, token }) => {
            if (session?.user) {
                // Attach the user id to the session object.
                session.user.id = token.id || token.sub;
            }
            return session;
        },
        redirect: async ({ url, baseUrl }) => {
            // Always redirect to /dashboard after sign-in
            return "/dashboard";
        },
    },
    pages: {
        signIn: "/signin",
    },

};

export default authOptions;
