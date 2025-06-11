import { NextAuthOptions } from "next-auth";
import TwitterProvider from "next-auth/providers/twitter";
import { JWT } from "next-auth/jwt";
import { Session } from "next-auth";

interface TwitterProfile {
  data: {
    id: string;
  };
}

interface ExtendedSession extends Session {
  accessToken?: string;
}

export const authOptions: NextAuthOptions = {
  providers: [
    TwitterProvider({
      clientId: process.env.TWITTER_CLIENT_ID as string,
      clientSecret: process.env.TWITTER_CLIENT_SECRET as string,
      version: "2.0",
      authorization: {
        url: "https://twitter.com/i/oauth2/authorize",
        params: {
          scope: "tweet.read users.read like.read offline.access",
        },
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  debug: true,
  callbacks: {
    async jwt({ token, account, profile }) {
      console.log('JWT Callback:', { 
        hasToken: !!token,
        hasAccount: !!account,
        hasProfile: !!profile,
        accountTokens: account ? {
          hasAccessToken: !!account.access_token,
          hasRefreshToken: !!account.refresh_token,
          tokenType: account.token_type,
        } : null
      });

      // Save token for X API
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.tokenType = account.token_type;
        // Twitter API v2 returns the user ID directly in the profile
        token.id = (profile as TwitterProfile)?.data?.id || profile?.sub;
      }
      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      console.log('Session Callback:', {
        hasSession: !!session,
        hasToken: !!token,
        sessionUser: session?.user ? {
          hasId: !!session.user.id,
          hasName: !!session.user.name,
          hasEmail: !!session.user.email,
        } : null,
        tokenData: {
          hasAccessToken: !!token.accessToken,
          hasRefreshToken: !!token.refreshToken,
          tokenType: token.tokenType,
          hasId: !!token.id,
        }
      });

      // Add token to session
      if (session.user) {
        session.user.id = token.id as string;
      }
      const extendedSession = session as ExtendedSession;
      extendedSession.accessToken = `${token.tokenType} ${token.accessToken}`;
      return extendedSession;
    },
  },
}; 