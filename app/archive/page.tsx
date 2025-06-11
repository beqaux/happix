"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import Image from "next/image";

interface Tweet {
  id: string;
  text: string;
  created_at: string;
  author_id: string;
  public_metrics: {
    retweet_count: number;
    reply_count: number;
    like_count: number;
    quote_count: number;
  };
}

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
  const { data: session } = useSession();
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [users, setUsers] = useState<{ [key: string]: User }>({});
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchTweets = async (cursor?: string) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/tweets${cursor ? `?cursor=${cursor}` : ""}`
      );

      if (!response.ok) {
        const errorData: ApiError = await response.json();
        setError(errorData);
        return;
      }

      const data = await response.json();

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
      setError({
        error: "Error",
        message: "Failed to load tweets. Please try again later.",
        details: err instanceof Error ? err.message : "Unknown error"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session) {
      fetchTweets();
    }
  }, [session]);

  if (!session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-24">
        <h1 className="text-4xl font-bold mb-4">Please Sign In</h1>
        <p className="text-gray-600">
          You need to sign in with your X account to view your archive.
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8">Your Positive Interactions</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
          <h3 className="text-red-800 font-semibold mb-2">{error.message}</h3>
          {error.retryAfter && (
            <p className="text-red-600">
              Please try again after {new Date(error.retryAfter).toLocaleTimeString()}
            </p>
          )}
          {error.details && (
            <p className="text-red-600 text-sm mt-2">
              Technical details: {error.details}
            </p>
          )}
        </div>
      )}

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
                  <div className="relative w-12 h-12 mr-4">
                    <Image
                      src={user.profile_image_url}
                      alt={user.name}
                      fill
                      className="rounded-full object-cover"
                      sizes="48px"
                    />
                  </div>
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
            disabled={loading}
            className="px-6 py-2"
          >
            {loading ? "Loading..." : "Load More"}
          </Button>
        </div>
      )}

      {loading && tweets.length === 0 && (
        <div className="flex justify-center items-center min-h-[200px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      )}
    </div>
  );
} 