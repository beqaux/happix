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
      clientId: process.env.TWITTER_CLIENT_ID!,
      clientSecret: process.env.TWITTER_CLIENT_SECRET!,
      version: "2.0",
      authorization: {
        url: "https://twitter.com/i/oauth2/authorize",
        params: {
          scope: [
            "tweet.read",
            "tweet.write",
            "users.read",
            "follows.read",
            "follows.write",
            "offline.access"
          ].join(" ")
        }
      }
    }),
  ],
  pages: {
    signIn: "/login",
  },
  debug: true,
  callbacks: {
    async jwt({ token, account }) {
      // İlk giriş yapıldığında token'a access token ve refresh token ekle
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at! * 1000; // Unix timestamp'i milisaniyeye çevir
      }

      // Token süresi dolmuşsa yenile
      if (Date.now() > (token.expiresAt as number)) {
        try {
          const response = await fetch('https://api.twitter.com/2/oauth2/token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              grant_type: 'refresh_token',
              client_id: process.env.TWITTER_CLIENT_ID!,
              client_secret: process.env.TWITTER_CLIENT_SECRET!,
              refresh_token: token.refreshToken as string,
            }),
          });

          const data = await response.json();

          if (!response.ok) {
            throw data;
          }

          return {
            ...token,
            accessToken: data.access_token,
            refreshToken: data.refresh_token ?? token.refreshToken,
            expiresAt: Date.now() + data.expires_in * 1000,
          };
        } catch (error) {
          console.error('Error refreshing token:', error);
          return { ...token, error: 'RefreshAccessTokenError' };
        }
      }

      return token;
    },
    async session({ session, token }) {
      // Session'a access token'ı ekle
      return {
        ...session,
        accessToken: token.accessToken,
        error: token.error,
        user: {
          ...session.user,
          id: token.sub, // Twitter user ID'sini ekle
        }
      };
    },
  },
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 saat
  },
}; 