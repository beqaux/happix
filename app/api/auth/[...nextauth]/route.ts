import NextAuth from "next-auth";
import TwitterProvider from "next-auth/providers/twitter";

interface TwitterProfile {
  data: {
    id: string;
  };
}

const handler = NextAuth({
  providers: [
    TwitterProvider({
      clientId: process.env.TWITTER_CLIENT_ID as string,
      clientSecret: process.env.TWITTER_CLIENT_SECRET as string,
      version: "2.0",
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, account, profile }) {
      // Save token for X API
      if (account) {
        token.accessToken = account.access_token;
        // Twitter API v2 returns the user ID directly in the profile
        token.id = (profile as TwitterProfile)?.data?.id || profile?.sub;
      }
      return token;
    },
    async session({ session, token }) {
      // Add token to session
      if (session.user) {
        session.user.id = token.id as string;
      }
      session.accessToken = token.accessToken;
      return session;
    },
  },
});

export { handler as GET, handler as POST }; 