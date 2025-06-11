'use client';

import { Button } from "@/components/ui/button";
import { TweetCard } from "@/components/tweet-card";
import { Inbox } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Tweet, TwitterUser, getLikedTweets } from "@/lib/twitter";
import { useSession } from "next-auth/react";

interface User {
  id: string;
  name: string;
  username: string;
  profile_image_url: string;
}

interface ApiError {
  error: string;
  message: string;
  retryAfter?: string;
  details?: string;
}

export default function ArchivePage() {
  const { data: session, status } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [users, setUsers] = useState<{ [key: string]: User }>({});
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchTweets = useCallback(async (cursor?: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('Session state:', {
        status,
        accessToken: session?.accessToken,
        userId: session?.user?.id
      });

      const response = await fetch(
        `/api/tweets${cursor ? `?cursor=${cursor}` : ""}`
      );

      if (!response.ok) {
        const errorData: ApiError = await response.json();
        setError(errorData);
        return;
      }

      const data = await response.json();

      console.log('API Response:', data);

      if (cursor) {
        setTweets(prev => [...prev, ...(data.tweets || [])]);
      } else {
        setTweets(data.tweets || []);
      }

      // Convert users array to object for easier lookup
      const usersObj = (data.users || []).reduce((acc: { [key: string]: User }, user: User) => {
        acc[user.id] = user;
        return acc;
      }, {});

      setUsers(prev => ({ ...prev, ...usersObj }));
      setNextToken(data.next_token);
    } catch (err) {
      console.error('Error loading tweets:', err);
      setError({
        error: "Error",
        message: "Failed to load tweets. Please try again later.",
        details: err instanceof Error ? err.message : "Unknown error"
      });
    } finally {
      setIsLoading(false);
    }
  }, [session, status]);

  useEffect(() => {
    if (session?.accessToken) {
      fetchTweets();
    }
  }, [session, fetchTweets]);

  if (!session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
        <div className="flex max-w-md flex-col items-center gap-4">
          <h2 className="text-lg font-semibold">Please Sign In</h2>
          <p className="text-sm text-muted-foreground">
            You need to sign in with your X account to view your archive.
          </p>
          <Button asChild>
            <Link href="/login">Sign In</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading && tweets.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-8">
        <div className="h-32 w-32 animate-spin rounded-full border-4 border-muted border-t-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
        <div className="flex max-w-md flex-col items-center gap-4">
          <div className="rounded-full bg-red-100 p-4">
            <Inbox className="h-8 w-8 text-red-500" />
          </div>
          <h2 className="text-lg font-semibold">Error Loading Tweets</h2>
          <p className="text-sm text-muted-foreground">{error.message}</p>
          {error.retryAfter && (
            <p className="text-sm text-muted-foreground">
              Please try again after {new Date(error.retryAfter).toLocaleTimeString()}
            </p>
          )}
          {error.details && (
            <p className="text-sm text-muted-foreground">
              Technical details: {error.details}
            </p>
          )}
          <Button 
            variant="outline" 
            onClick={() => fetchTweets()}
            disabled={isLoading}
          >
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (tweets.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
        <div className="flex max-w-md flex-col items-center gap-4">
          <div className="rounded-full bg-muted p-4">
            <Inbox className="h-8 w-8" />
          </div>
          <h2 className="text-lg font-semibold">Your Archive is Empty</h2>
          <p className="text-sm text-muted-foreground">
            Posts you like on X will appear here. Start by liking a few posts!
          </p>
          <Button asChild>
            <Link href="https://twitter.com" target="_blank" rel="noopener noreferrer">
              Go to X
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8">Your Positive Interactions</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tweets.map((tweet) => {
          const user = users[tweet.author_id];
          return (
            <div
              key={tweet.id}
              className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
            >
              {user && (
                <div className="flex items-center mb-4">
                  <img
                    src={user.profile_image_url}
                    alt={user.name}
                    className="w-12 h-12 rounded-full mr-4"
                  />
                  <div>
                    <h3 className="font-semibold">{user.name}</h3>
                    <p className="text-gray-600">@{user.username}</p>
                  </div>
                </div>
              )}
              <p className="text-gray-800 mb-4">{tweet.text}</p>
              <div className="flex justify-between text-sm text-gray-500">
                <span>{new Date(tweet.created_at).toLocaleDateString()}</span>
                <div className="flex space-x-4">
                  <span>🔄 {tweet.public_metrics.retweet_count}</span>
                  <span>💬 {tweet.public_metrics.reply_count}</span>
                  <span>❤️ {tweet.public_metrics.like_count}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {nextToken && (
        <div className="mt-8 flex justify-center">
          <Button
            onClick={() => fetchTweets(nextToken)}
            disabled={isLoading}
            className="px-6 py-2"
          >
            {isLoading ? "Loading..." : "Load More"}
          </Button>
        </div>
      )}

      {isLoading && tweets.length === 0 && (
        <div className="flex justify-center items-center min-h-[200px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      )}
    </div>
  );
} 