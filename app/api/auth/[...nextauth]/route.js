import NextAuth from "next-auth";
import authOptions from "@/lib/authOptions"; // Make sure this file exists and contains a valid config

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
